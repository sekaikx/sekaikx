"""Builds the hero map: shaded relief of the hills around Gorkha, Nepal, plus
contours, drainage and roads, and the three delivery routes from Lifeline's
worked example.

Inputs (not committed, see the README in this folder):
  tiles/12_<x>_<y>.png   AWS Terrain Tiles, terrarium encoding, zoom 12
  osm.json               Overpass export of roads and places for the window

Outputs (committed):
  assets/map/relief.webp   tinted hillshade
  assets/map/lines.svg     contours, rivers, roads
  assets/map/overlay.js    places and routes in map units, read by the page

Run with:  python3 tools/map/build_map.py <tiles dir> <osm.json>
"""
import heapq
import json
import math
import os
import sys

import contourpy
import numpy as np
from PIL import Image

Z = 12
TILE = 256
# lat/lon window: Gorkha bazaar sits near the middle
NORTH, SOUTH, WEST, EAST = 28.05, 27.90, 84.50, 84.75

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'map')


def merc(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n * TILE
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * TILE
    return x, y


X0, Y0 = merc(NORTH, WEST)
X1, Y1 = merc(SOUTH, EAST)
W, H = X1 - X0, Y1 - Y0
METRES_PER_PX = 156543.03392 * math.cos(math.radians((NORTH + SOUTH) / 2)) / 2 ** Z


def to_map(lat, lon):
    x, y = merc(lat, lon)
    return x - X0, y - Y0


# ---------------------------------------------------------------- elevation
def load_dem(tiles):
    tx0, ty0 = int(X0 // TILE), int(Y0 // TILE)
    tx1, ty1 = int(X1 // TILE), int(Y1 // TILE)
    rows = []
    for ty in range(ty0, ty1 + 1):
        row = []
        for tx in range(tx0, tx1 + 1):
            im = np.asarray(Image.open(os.path.join(tiles, f'{Z}_{tx}_{ty}.png')).convert('RGB'), dtype=np.float64)
            row.append(im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768)
        rows.append(np.hstack(row))
    big = np.vstack(rows)
    ox, oy = int(round(X0 - tx0 * TILE)), int(round(Y0 - ty0 * TILE))
    return big[oy:oy + int(round(H)), ox:ox + int(round(W))]


def blur(a, passes=1):
    k = np.array([1, 4, 6, 4, 1], dtype=np.float64) / 16
    for _ in range(passes):
        h = np.pad(a, ((0, 0), (2, 2)), mode='edge')
        a = sum(k[i] * h[:, i:i + a.shape[1]] for i in range(5))
        v = np.pad(a, ((2, 2), (0, 0)), mode='edge')
        a = sum(k[i] * v[i:i + a.shape[0], :] for i in range(5))
    return a


def upsample(a, f):
    im = Image.fromarray(a.astype(np.float32), mode='F')
    return np.asarray(im.resize((a.shape[1] * f, a.shape[0] * f), Image.BICUBIC), dtype=np.float64)


def relief(dem, scale):
    d = upsample(blur(dem, 1), scale)
    d = blur(d, 4)
    cell = METRES_PER_PX / scale
    gy, gx = np.gradient(d, cell)
    slope = np.arctan(np.hypot(gx, gy) * 1.6)
    aspect = np.arctan2(-gx, gy)
    shade = np.zeros_like(d)
    # two lights, the usual cartographic trick: a strong north-west key and a soft fill
    for az, alt, w in ((315, 42, 0.75), (250, 60, 0.25)):
        a, e = math.radians(az), math.radians(alt)
        s = math.sin(e) * np.cos(slope) + math.cos(e) * np.sin(slope) * np.cos(a - aspect - math.pi / 2)
        shade += w * np.clip(s, 0, 1)
    shade = shade / shade.max()

    lo, hi = np.percentile(d, 2), np.percentile(d, 99.5)
    t = np.clip((d - lo) / (hi - lo), 0, 1)[..., None]
    # hypsometric tint: valley floors a cool green-grey, ridges lighter
    low = np.array([214, 225, 212], dtype=np.float64)
    mid = np.array([232, 236, 226], dtype=np.float64)
    high = np.array([246, 246, 242], dtype=np.float64)
    tint = np.where(t < 0.5, low + (mid - low) * (t / 0.5), mid + (high - mid) * ((t - 0.5) / 0.5))

    shadow = np.array([92, 104, 122], dtype=np.float64)       # blue-grey shadows, not black
    k = np.clip((shade - 0.62) * -1.25, 0, 1)[..., None]       # only darken faces turned away
    hl = np.clip((shade - 0.8) * 1.6, 0, 1)[..., None]
    rgb = tint * (1 - 0.55 * k) + shadow * 0.55 * k
    rgb = rgb + (255 - rgb) * 0.35 * hl
    return np.clip(rgb, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- drainage
def drainage(dem, threshold):
    h, w = dem.shape
    # bias flat valley floors towards their middle, so streams follow the valley
    # instead of running in straight lines across it
    z = dem + 0.25 * blur(dem, 14)
    # SRTM flattens big rivers into level strips; sink their middles so the
    # river runs down the centre of the strip
    gy, gx = np.gradient(blur(dem, 2))
    flat = np.hypot(gx, gy) < 2.5
    dist, inside = np.zeros((h, w)), flat.copy()
    for _ in range(40):
        dist += inside
        p = np.pad(inside, 1, constant_values=False)
        inside = inside & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        if not inside.any():
            break
    z = z - 3.0 * dist
    # priority flood from the edges; every cell drains to the one that reached it
    seen = np.zeros((h, w), bool)
    heap = []
    for y in range(h):
        for x in (0, w - 1):
            heapq.heappush(heap, (z[y, x], y, x)); seen[y, x] = True
    for x in range(1, w - 1):
        for y in (0, h - 1):
            heapq.heappush(heap, (z[y, x], y, x)); seen[y, x] = True
    order = []
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    down = np.full((h, w, 2), -1, np.int32)
    while heap:
        e, y, x = heapq.heappop(heap)
        order.append((y, x))
        for dy, dx in nb:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                seen[ny, nx] = True
                # no filling: a depression drains along its lowest cells to the
                # spill point, which reads like a river instead of a straight line
                down[ny, nx] = (y, x)
                heapq.heappush(heap, (z[ny, nx], ny, nx))
    acc = np.ones((h, w))
    for y, x in reversed(order):
        dy, dx = down[y, x]
        if dy >= 0:
            acc[dy, dx] += acc[y, x]
    # trace streams from their sources downhill
    river = acc >= threshold
    lines, used = [], np.zeros((h, w), bool)
    sources = [(acc[y, x], y, x) for y, x in zip(*np.nonzero(river))]
    sources.sort()
    for a, y, x in sources:
        if used[y, x]:
            continue
        pts = [(x + 0.5, y + 0.5, acc[y, x])]
        used[y, x] = True
        while True:
            dy, dx = down[y, x]
            if dy < 0:
                break
            y, x = int(dy), int(dx)
            pts.append((x + 0.5, y + 0.5, acc[y, x]))
            if used[y, x]:
                break
            used[y, x] = True
        if len(pts) > 3:
            lines.append(pts)
    return lines


# ---------------------------------------------------------------- geometry helpers
def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0][:2]), np.array(pts[-1][:2])
    ab = b - a
    n = np.hypot(*ab) or 1e-9
    best, idx = -1, 0
    for i in range(1, len(pts) - 1):
        p = np.array(pts[i][:2])
        d = abs(ab[0] * (a[1] - p[1]) - ab[1] * (a[0] - p[0])) / n
        if d > best:
            best, idx = d, i
    if best > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def chaikin(pts, rounds=2):
    for _ in range(rounds):
        out = [pts[0]]
        for p, q in zip(pts, pts[1:]):
            out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
            out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
        out.append(pts[-1])
        pts = out
    return pts


def d_attr(pts, closed=False):
    s = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return s + ('Z' if closed else '')


# ---------------------------------------------------------------- roads
def load_osm(path):
    data = json.load(open(path))
    nodes = {e['id']: (e['lat'], e['lon']) for e in data['elements'] if e['type'] == 'node' and 'lat' in e}
    ways = [e for e in data['elements'] if e['type'] == 'way' and 'highway' in e.get('tags', {})]
    places = [e for e in data['elements'] if e['type'] == 'node' and e.get('tags', {}).get('place')]
    return nodes, ways, places


SPEED = {'primary': 45, 'secondary': 35, 'tertiary': 30, 'unclassified': 20, 'track': 10}


def route(nodes, ways, start, goal):
    graph = {}
    for w in ways:
        v = SPEED.get(w['tags']['highway'])
        if not v:
            continue
        ids = [i for i in w['nodes'] if i in nodes]
        for a, b in zip(ids, ids[1:]):
            pa, pb = to_map(*nodes[a]), to_map(*nodes[b])
            t = math.hypot(pa[0] - pb[0], pa[1] - pb[1]) / v
            graph.setdefault(a, []).append((b, t))
            graph.setdefault(b, []).append((a, t))

    def nearest(p):
        return min(graph, key=lambda i: (to_map(*nodes[i])[0] - p[0]) ** 2 + (to_map(*nodes[i])[1] - p[1]) ** 2)

    s, g = nearest(start), nearest(goal)
    dist, prev, heap = {s: 0}, {}, [(0, s)]
    while heap:
        d, u = heapq.heappop(heap)
        if u == g:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, t in graph[u]:
            if d + t < dist.get(v, 1e18):
                dist[v] = d + t; prev[v] = u
                heapq.heappush(heap, (d + t, v))
    path, u = [g], g
    while u != s:
        u = prev[u]; path.append(u)
    return [to_map(*nodes[i]) for i in reversed(path)]


def main(tiles, osm_path):
    os.makedirs(OUT, exist_ok=True)
    dem = load_dem(tiles)
    h, w = dem.shape
    print(f'DEM {w}x{h}, {METRES_PER_PX:.1f} m/px, {dem.min():.0f}-{dem.max():.0f} m')

    Image.fromarray(relief(dem, 3)).save(os.path.join(OUT, 'relief.webp'), 'WEBP', quality=82, method=6)

    smooth = blur(dem, 2)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" stroke-linecap="round" stroke-linejoin="round">']

    # contours every 40 m, an index contour every 200 m
    gen = contourpy.contour_generator(z=smooth, name='serial', line_type='Separate')
    minor, index = [], []
    for level in range(int(smooth.min() // 40 + 1) * 40, int(smooth.max()), 40):
        for line in gen.lines(level):
            if len(line) < 8:
                continue
            pts = rdp([(float(x) + 0.5, float(y) + 0.5) for x, y in line], 0.55)
            if len(pts) < 3:
                continue
            closed = np.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 0.01
            (index if level % 200 == 0 else minor).append(d_attr(chaikin(pts, 1), closed))
    svg.append(f'<path stroke="#8a6f52" stroke-opacity=".32" stroke-width=".45" d="{" ".join(minor)}"/>')
    svg.append(f'<path stroke="#8a6f52" stroke-opacity=".55" stroke-width=".8" d="{" ".join(index)}"/>')

    # rivers, widening downstream
    for pts in drainage(dem, threshold=2500):
        a = pts[-1][2]
        width = min(2.0, 0.4 + 0.5 * math.log10(a / 2500 + 1) * 1.6)
        simple = chaikin(rdp([(x, y) for x, y, _ in pts], 0.6), 3)
        svg.append(f'<path stroke="#3f7fbf" stroke-opacity=".8" stroke-width="{width:.2f}" d="{d_attr(simple)}"/>')

    nodes, ways, places = load_osm(osm_path)
    groups = {'track': [], 'unclassified': [], 'minor': [], 'major': []}
    for wy in ways:
        hw = wy['tags']['highway']
        key = 'major' if hw in ('primary', 'secondary') else 'minor' if hw == 'tertiary' else hw if hw in groups else None
        if not key:
            continue
        pts = [to_map(*nodes[i]) for i in wy['nodes'] if i in nodes]
        if len(pts) > 1:
            groups[key].append(d_attr(rdp(pts, 0.45)))
    svg.append(f'<path stroke="#5b5146" stroke-opacity=".55" stroke-width=".45" stroke-dasharray="1.6 1.2" d="{" ".join(groups["track"])}"/>')
    svg.append(f'<path stroke="#4a4038" stroke-opacity=".7" stroke-width=".6" d="{" ".join(groups["unclassified"])}"/>')
    for key, wdt, col in (('minor', 1.9, '#5a4a3a'), ('major', 2.6, '#4b3a2c')):
        svg.append(f'<path stroke="{col}" stroke-width="{wdt}" d="{" ".join(groups[key])}"/>')
        svg.append(f'<path stroke="#f4ead6" stroke-width="{wdt - 0.9:.1f}" d="{" ".join(groups[key])}"/>')
    svg.append('</svg>')
    open(os.path.join(OUT, 'lines.svg'), 'w').write('\n'.join(svg))

    # places and Lifeline's worked example
    def place(name):
        for p in places:
            t = p['tags']
            if name.lower() in (t.get('name:en') or t.get('name') or '').lower():
                return to_map(p['lat'], p['lon'])
        raise KeyError(name)

    depot = place('Gorkha')
    truck_to, drone_to = place('Kyamuntar'), place('Birenchok')

    # the airdrop goes to the named village furthest from any road
    road_pts = np.array([to_map(*nodes[i]) for wy in ways if wy['tags']['highway'] != 'track' for i in wy['nodes'] if i in nodes])
    best = None
    for p in places:
        name = p['tags'].get('name:en') or p['tags'].get('name')
        if not name or not name.isascii():
            continue
        q = np.array(to_map(p['lat'], p['lon']))
        if not (30 < q[0] < w - 30 and 30 < q[1] < h - 30):
            continue
        gap = np.min(np.hypot(*(road_pts - q).T))
        if best is None or gap > best[0]:
            best = (gap, name, tuple(q))
    print('airdrop target', best[1], f'{best[0] * METRES_PER_PX:.0f} m from a road')

    truck = route(nodes, ways, depot, truck_to)
    labels = []
    for name, kind in (('Gorkha', 'town'), ('Kyamuntar', 'village'), ('Birenchok', 'village'),
                       ('Manakamana', 'village'), ('Aabu khaireni', 'village'), ('Chhebetar', 'village'),
                       ('Bhirkot', 'village'), ('Taple', 'village')):
        x, y = place(name)
        labels.append({'name': name.title() if name.islower() or name == 'Aabu khaireni' else name, 'kind': kind, 'x': round(x, 1), 'y': round(y, 1)})
    if best[1] not in [l['name'] for l in labels]:
        labels.append({'name': best[1].title(), 'kind': 'village', 'x': round(best[2][0], 1), 'y': round(best[2][1], 1)})

    overlay = {
        'width': w, 'height': h, 'metresPerUnit': METRES_PER_PX,
        'bounds': {'north': NORTH, 'south': SOUTH, 'west': WEST, 'east': EAST},
        'depot': [round(depot[0], 1), round(depot[1], 1)],
        'truck': [[round(x, 1), round(y, 1)] for x, y in rdp(truck, 0.4)],
        'drone': [[round(depot[0], 1), round(depot[1], 1)], [round(drone_to[0], 1), round(drone_to[1], 1)]],
        'airdrop': {'target': [round(best[2][0], 1), round(best[2][1], 1)], 'name': best[1].title()},
        'labels': labels,
    }
    with open(os.path.join(OUT, 'overlay.js'), 'w') as f:
        f.write('/* Generated by tools/map/build_map.py */\nwindow.HERO_MAP = ' + json.dumps(overlay, separators=(',', ':')) + ';\n')
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
