/* otto — portfolio. Draws the hero map overlay and the contribution profile. No dependencies. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const line = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');

  /* ---------------------------------------------------------------- hero map */
  function heroMap(data) {
    const svg = document.querySelector('.map__svg');
    const g = svg && svg.querySelector('.map__overlay');
    if (!g || !data) return;
    const defs = el('defs', {}, svg);

    // a dashed line cannot draw itself in with a dash offset, so it is revealed through a mask instead
    let maskId = 0;
    function revealed(d, cls, timing) {
      const id = 'reveal-' + (++maskId);
      const m = el('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: data.width, height: data.height }, defs);
      const p = el('path', { d, class: 'draw', fill: 'none', stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round' }, m);
      setTiming(p, timing);
      el('path', { d, class: cls, mask: `url(#${id})` }, g);
      return p;
    }
    function setTiming(node, { delay, dur }) {
      node.style.setProperty('--delay', delay + 's');
      if (dur) node.style.setProperty('--dur', dur + 's');
    }

    const [dx, dy] = data.depot;

    // truck, along the real road network
    const truckD = line(data.truck);
    el('path', { d: truckD, class: 'case' }, g);
    const truck = el('path', { d: truckD, class: 'truck draw' }, g);
    setTiming(truck, { delay: 0.35, dur: 2.4 });

    // drone, straight to Birenchok
    const [, droneTo] = data.drone;
    revealed(line(data.drone), 'drone', { delay: 0.9, dur: 0.9 });

    // airdrop: aircraft track from the depot's airstrip, release upwind of the zone, drift down
    const [tx, ty] = data.airdrop.target;
    const vx = tx - dx, vy = ty - dy, len = Math.hypot(vx, vy), ux = vx / len, uy = vy / len;
    const release = [tx - ux * 26, ty - uy * 26];
    const trackEnd = [tx + ux * 34, ty + uy * 34];
    revealed(line([[dx, dy], trackEnd]), 'air', { delay: 1.5, dur: 1.5 });
    const fall = `M${release[0].toFixed(1)} ${release[1].toFixed(1)} Q${(release[0] + ux * 6 - uy * 10).toFixed(1)} ${(release[1] + uy * 6 + ux * 10).toFixed(1)} ${tx} ${ty}`;
    revealed(fall, 'fall', { delay: 2.7, dur: 0.8 });
    const angle = Math.atan2(uy, ux) * 180 / Math.PI;
    const zone = el('ellipse', { cx: tx, cy: ty, rx: 11, ry: 6.5, class: 'zone later', transform: `rotate(${angle.toFixed(1)} ${tx} ${ty})` }, g);
    setTiming(zone, { delay: 3.2 });
    const x = el('path', { d: `M${release[0] - 4} ${release[1] - 4} l8 8 M${release[0] + 4} ${release[1] - 4} l-8 8`, class: 'release later' }, g);
    setTiming(x, { delay: 2.6 });

    // places
    const ends = new Set(['Kyamuntar', 'Birenchok', 'Deurali']);
    data.labels.forEach(l => {
      if (l.name === 'Gorkha') return;
      el('circle', { cx: l.x, cy: l.y, r: ends.has(l.name) ? 3.2 : 1.7, class: ends.has(l.name) ? 'stop' : 'dot' }, g);
    });
    el('rect', { x: dx - 4, y: dy - 4, width: 8, height: 8, class: 'depot' }, g);

    const texts = [];
    function label(text, x, y, cls, anchor) {
      const t = el('text', { x, y, class: cls || '', 'text-anchor': anchor || 'start' }, g);
      t.textContent = text;
      texts.push({ t, x, y, anchor });
      return t;
    }
    data.labels.forEach(l => {
      const end = ends.has(l.name);
      if (l.name === 'Gorkha') label('Gorkha', l.x + 8, l.y - 8, 'town');
      else if (l.name === 'Birenchok') label(l.name, l.x - 7, l.y + 4, '', 'end');
      else if (l.x > data.width - 90) label(l.name, l.x - 7, l.y - 7, end ? '' : 'minor', 'end');
      else label(l.name, l.x + 7, l.y + 4, end ? '' : 'minor');
    });
    const kyamuntar = data.labels.find(l => l.name === 'Kyamuntar');
    label('6 t of water', kyamuntar.x - 7, kyamuntar.y - 22, 'note', 'end');
    label('12 kg, blood and vaccines', droneTo[0] + 7, droneTo[1] + 18, 'note');
    label('release', release[0] + 7, release[1] - 6, 'note');

    // keep strokes and type at a constant screen size whatever the map's scale
    const scaleBar = document.querySelector('.scale__bar');
    function fit() {
      const r = svg.getBoundingClientRect();
      const k = Math.max(r.width / data.width, r.height / data.height) || 1;
      g.style.setProperty('--k', k.toFixed(4));
      if (scaleBar) scaleBar.style.setProperty('--scale-px', (2000 / data.metresPerUnit * k).toFixed(1) + 'px');
    }
    new ResizeObserver(fit).observe(svg);
    fit();

    // dash lengths for the draw-in, in map units
    g.querySelectorAll('.draw').forEach(p => p.style.setProperty('--len', p.getTotalLength().toFixed(1)));
    defs.querySelectorAll('.draw').forEach(p => p.style.setProperty('--len', p.getTotalLength().toFixed(1)));
    const start = () => { g.classList.add('is-live'); svg.querySelectorAll('.draw').forEach(p => p.classList.add('go')); };
    const relief = new Image();
    relief.onload = relief.onerror = () => requestAnimationFrame(start);
    relief.src = 'assets/map/relief.webp';
  }

  /* ---------------------------------------------------------------- contribution profile */
  function profile(data) {
    const section = document.getElementById('year');
    if (!section || !data || !Array.isArray(data.days) || data.days.length < 60) return;
    const days = data.days.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-364);
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      weeks.push({ start: chunk[0][0], count: chunk.reduce((s, d) => s + d[1], 0) });
    }
    const total = days.reduce((s, d) => s + d[1], 0);
    if (!total) return;
    const peak = weeks.reduce((a, b) => b.count > a.count ? b : a);
    const month = d => new Date(d + 'T12:00:00').toLocaleString('en-GB', { month: 'short' });
    section.querySelector('.year__summary').textContent =
      `${total.toLocaleString('en-GB')} contributions in the last year, ${peak.count} of them in the busiest week.`;
    section.hidden = false;

    const svg = section.querySelector('.profile__svg');
    function draw() {
      svg.textContent = '';
      const w = svg.clientWidth, h = svg.clientHeight, top = 26, base = h - 22;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const xs = i => (i / (weeks.length - 1)) * w;
      const ys = c => base - (Math.sqrt(c) / Math.sqrt(peak.count)) * (base - top);
      // Catmull-Rom through the weekly totals, like a profile drawn from spot heights
      const pts = weeks.map((wk, i) => [xs(i), ys(wk.count)]);
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${Math.min(base, p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6} ${Math.min(base, p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
      }
      el('path', { d: `${d} L${w} ${base} L0 ${base} Z`, class: 'ground' }, svg);
      el('path', { d, class: 'line' }, svg);
      el('line', { x1: 0, x2: w, y1: base + 0.5, y2: base + 0.5, class: 'grid' }, svg);
      let lastMonth = '';
      weeks.forEach((wk, i) => {
        const m = month(wk.start);
        if (m !== lastMonth && i > 0 && xs(i) < w - 30) {
          el('line', { x1: xs(i), x2: xs(i), y1: base, y2: base + 5, class: 'grid' }, svg);
          const t = el('text', { x: xs(i) + 3, y: base + 17 }, svg);
          t.textContent = m;
        }
        lastMonth = m;
      });
      const pi = weeks.indexOf(peak), px = xs(pi), py = ys(peak.count);
      el('line', { x1: px, x2: px, y1: py - 4, y2: py - 12, class: 'grid' }, svg);
      const t = el('text', { x: px, y: py - 16, class: 'peak', 'text-anchor': px > w - 80 ? 'end' : px < 80 ? 'start' : 'middle' }, svg);
      t.textContent = `${peak.count} in a week`;
    }
    new ResizeObserver(draw).observe(svg);
  }

  heroMap(window.HERO_MAP);
  profile(window.PORTFOLIO_CONTRIBUTIONS);
})();
