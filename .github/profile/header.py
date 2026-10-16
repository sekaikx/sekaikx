"""Draws the profile header: readme/header-dark.svg and readme/header-light.svg.

A field of contour lines, a route that draws itself across it, the name, and a
line that cycles through what I make. Fonts are embedded so GitHub shows them.

Run with:  python3 .github/profile/header.py   (needs numpy, pillow, contourpy)
"""
import base64
import os

import contourpy
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'readme')
W, H = 1200, 360

THEMES = {
    'dark': dict(bg='#0f1417', line='#2c3a37', index='#3d4f4a', ink='#eef2ef', muted='#93a19c', route='#ff4f9a', halo='#0f1417'),
    'light': dict(bg='#f3f5f1', line='#cfc3b2', index='#b9a68d', ink='#1e2326', muted='#5b6460', route='#b0175f', halo='#f3f5f1'),
}

LINES = ['I write software.', 'I make games.', 'I build websites.', 'I take things apart.']


def font(name):
    with open(os.path.join(HERE, 'fonts', name), 'rb') as f:
        return base64.b64encode(f.read()).decode()


def terrain(seed=11):
    rng = np.random.default_rng(seed)
    gw, gh = W // 4, H // 4
    field = np.zeros((gh, gw))
    for octave, amp in ((5, 1.0), (10, 0.45), (20, 0.18)):
        small = rng.random((max(2, gh * octave // gw + 2), octave + 2)).astype(np.float32)
        big = np.asarray(Image.fromarray(small, mode='F').resize((gw, gh), Image.BICUBIC))
        field += amp * big
    # a ridge running across, so the lines read as hills rather than noise
    y = np.linspace(0, 1, gh)[:, None]
    x = np.linspace(0, 1, gw)[None, :]
    field += 0.8 * np.exp(-((y - 0.45 - 0.15 * np.sin(x * 5)) ** 2) / 0.05)
    return field


def contours(field):
    gen = contourpy.contour_generator(z=field, name='serial', line_type='Separate')
    lo, hi = field.min(), field.max()
    minor, index = [], []
    for i, level in enumerate(np.linspace(lo, hi, 26)[1:-1]):
        for line in gen.lines(level):
            if len(line) < 6:
                continue
            pts = line[::2] if len(line) > 12 else line
            d = 'M' + ' L'.join(f'{x * 4:.0f} {y * 4:.0f}' for x, y in pts)
            (index if i % 5 == 4 else minor).append(d)
    return ' '.join(minor), ' '.join(index)


def route():
    # a road-like line that wanders from the middle to the right edge, with stops along it
    pts = [(560, 300), (640, 262), (700, 280), (770, 214), (850, 228), (905, 160), (985, 176), (1050, 108), (1130, 124)]
    d = f'M{pts[0][0]} {pts[0][1]}'
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        mx = (x0 + x1) / 2
        d += f' C{mx:.0f} {y0} {mx:.0f} {y1} {x1} {y1}'
    return d, pts


def build(theme):
    t = THEMES[theme]
    minor, index = contours(terrain())
    rd, stops = route()
    cycle = len(LINES) * 3.2
    words = []
    for i, text in enumerate(LINES):
        words.append(f'<text class="cycle" x="56" y="292" style="animation-delay:{i * 3.2:.1f}s">{text}</text>')
    stop_marks = ''.join(f'<circle class="stop" cx="{x}" cy="{y}" r="5" style="animation-delay:{0.4 + 2.2 * k / (len(stops) - 1):.2f}s"/>'
                         for k, (x, y) in enumerate(stops[1:], start=1))
    sx, sy = stops[0]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="otto (sekaikx). I write software, make games, build websites and take things apart.">
<style>
@font-face {{ font-family: "BSC"; font-weight: 600; src: url(data:font/woff2;base64,{font('BarlowSemiCondensed-600.woff2')}) format("woff2"); }}
@font-face {{ font-family: "B"; font-weight: 500; src: url(data:font/woff2;base64,{font('Barlow-500.woff2')}) format("woff2"); }}
@font-face {{ font-family: "BC"; font-weight: 500; src: url(data:font/woff2;base64,{font('BarlowCondensed-500.woff2')}) format("woff2"); }}
.minor {{ fill: none; stroke: {t['line']}; stroke-width: 1; }}
.index {{ fill: none; stroke: {t['index']}; stroke-width: 1.6; }}
.name {{ font: 600 168px "BSC", "Arial Narrow", sans-serif; fill: {t['ink']}; letter-spacing: -5px; }}
.handle {{ font: 500 30px "BC", "Arial Narrow", sans-serif; fill: {t['route']}; letter-spacing: .5px; }}
.cycle {{ font: 500 32px "B", Arial, sans-serif; fill: {t['muted']}; opacity: 0; animation: cycle {cycle:.1f}s infinite; }}
.case {{ fill: none; stroke: {t['halo']}; stroke-width: 9; stroke-linecap: round; }}
.route {{ fill: none; stroke: {t['route']}; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 1400; stroke-dashoffset: 1400; animation: draw 2.6s cubic-bezier(.45,0,.2,1) .3s forwards; }}
.stop {{ fill: {t['bg']}; stroke: {t['route']}; stroke-width: 3; opacity: 0; animation: show .3s ease-out forwards; }}
.depot {{ fill: {t['ink']}; }}
.runner {{ fill: {t['route']}; opacity: 0; animation: show .3s 3s forwards; }}
@keyframes draw {{ to {{ stroke-dashoffset: 0; }} }}
@keyframes show {{ to {{ opacity: 1; }} }}
@keyframes cycle {{ 0% {{ opacity: 0; transform: translateY(8px); }} 4%, 21% {{ opacity: 1; transform: none; }} 25%, 100% {{ opacity: 0; transform: translateY(-6px); }} }}
@media (prefers-reduced-motion: reduce) {{
  .route {{ animation: none; stroke-dashoffset: 0; }} .stop, .runner {{ animation: none; opacity: 1; }}
  .cycle {{ animation: none; }} .cycle:first-of-type {{ opacity: 1; }}
}}
</style>
<defs>
  <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".45" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff"/></linearGradient>
  <mask id="m"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>
  <clipPath id="c"><rect width="{W}" height="{H}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#c)">
<rect width="{W}" height="{H}" fill="{t['bg']}"/>
<g mask="url(#m)"><path class="minor" d="{minor}"/><path class="index" d="{index}"/></g>
<path class="case" d="{rd}"/>
<path id="r" class="route" d="{rd}"/>
<rect class="depot" x="{sx - 7}" y="{sy - 7}" width="14" height="14"/>
{stop_marks}
<circle class="runner" r="6"><animateMotion dur="5s" begin="3s" repeatCount="indefinite"><mpath href="#r"/></animateMotion></circle>
</g>
<text class="handle" x="60" y="84">@sekaikx</text>
<text class="name" x="48" y="228">otto</text>
{''.join(words)}
</svg>
'''


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for theme in THEMES:
        path = os.path.join(OUT, f'header-{theme}.svg')
        with open(path, 'w') as f:
            f.write(build(theme))
        print(path, os.path.getsize(path) // 1024, 'KB')
