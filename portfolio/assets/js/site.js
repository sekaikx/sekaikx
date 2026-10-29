/* otto — portfolio. Draws the hero terrain, the contribution profile and wires up the brief form. No dependencies. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- hero terrain */
  // A made-up landscape: a few seeded hills, contoured with marching squares, and one
  // route across it from idea to release. Redrawn on resize so it always fills the hero.
  function terrain() {
    const svg = document.querySelector('.terrain');
    if (!svg) return;

    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const hills = Array.from({ length: 11 }, () => ({
      x: 0.25 + rand() * 0.85, y: rand() * 1.1 - 0.05, r: 0.08 + rand() * 0.2, h: (rand() < 0.2 ? -0.6 : 1) * (0.5 + rand())
    }));
    const height = (x, y) => {
      let z = 0.25 * x + 0.12 * Math.sin(6 * x + 3 * y);
      for (const h of hills) z += h.h * Math.exp(-((x - h.x) ** 2 + ((y - h.y) * 0.9) ** 2) / (2 * h.r * h.r));
      return z;
    };

    function draw() {
      const w = svg.clientWidth, h = svg.clientHeight;
      if (!w || !h) return;
      svg.textContent = '';
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const s = Math.max(w, h * 1.6);  // landscape units: 1 = this many pixels
      const step = 6, cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
      const z = new Float32Array(cols * rows);
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const v = height(i * step / s, j * step / s);
        z[j * cols + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
      }
      const levels = 26, gap = (hi - lo) / levels;
      for (let l = 1; l < levels; l++) {
        const t = lo + l * gap, segs = [];
        for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
          const a = z[j * cols + i], b = z[j * cols + i + 1], c = z[(j + 1) * cols + i + 1], d = z[(j + 1) * cols + i];
          const x0 = i * step, y0 = j * step, pts = [];
          if ((a < t) !== (b < t)) pts.push([x0 + step * (t - a) / (b - a), y0]);
          if ((b < t) !== (c < t)) pts.push([x0 + step, y0 + step * (t - b) / (c - b)]);
          if ((c < t) !== (d < t)) pts.push([x0 + step * (t - d) / (c - d), y0 + step]);
          if ((d < t) !== (a < t)) pts.push([x0, y0 + step * (t - a) / (d - a)]);
          if (pts.length >= 2) segs.push(`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`);
          if (pts.length === 4) segs.push(`M${pts[2][0].toFixed(1)} ${pts[2][1].toFixed(1)}L${pts[3][0].toFixed(1)} ${pts[3][1].toFixed(1)}`);
        }
        el('path', { d: segs.join(''), class: l % 5 === 0 ? 'c c--index' : 'c' }, svg);
      }

      // the route: idea, prototype, release, as a smooth line through three waypoints
      if (w < 1100) return;  // keep the route clear of the text
      const wp = [[0.7, 0.8], [0.8, 0.46], [0.92, 0.2]].map(([x, y]) => [x * w, y * h]);
      const [p0, p1, p2] = wp;
      const d = `M${p0[0]} ${p0[1]} C${p0[0] + 60} ${p0[1] - 20} ${p1[0] - 70} ${p1[1] + 80} ${p1[0]} ${p1[1]} S${p2[0] - 110} ${p2[1] + 30} ${p2[0]} ${p2[1]}`;
      el('path', { d, class: 'route-case' }, svg);
      const route = el('path', { d, class: 'route' }, svg);
      route.style.setProperty('--len', route.getTotalLength().toFixed(1));
      [['Idea', 0.4], ['Prototype', 1.3], ['Shipped', 2.4]].forEach(([name, delay], i) => {
        const [x, y] = wp[i];
        const dot = i === 2
          ? el('rect', { x: x - 6, y: y - 6, width: 12, height: 12, class: 'wp wp--end later' }, svg)
          : el('circle', { cx: x, cy: y, r: 6, class: 'wp later' }, svg);
        const t = el('text', { x: x + 14, y: y + 5, class: 'later' }, svg);
        t.textContent = name.toUpperCase();
        dot.style.setProperty('--delay', delay + 's');
        t.style.setProperty('--delay', delay + 's');
      });
    }

    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    let lastW = 0, lastH = 0;
    new ResizeObserver(() => {
      const w = svg.clientWidth, h = svg.clientHeight;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 120) return;  // ignore mobile URL bar jitter
      lastW = w; lastH = h;
      draw();
    }).observe(svg);
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
      `${total.toLocaleString('en-GB')} contributions on GitHub in the last year, ${peak.count} of them in the busiest week.`;
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

  /* ---------------------------------------------------------------- brief form */
  // No backend: the form becomes a pre-filled email in the visitor's own mail app.
  function brief() {
    const form = document.querySelector('.brief');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const kinds = f.getAll('kind');
      const name = (f.get('name') || '').trim();
      const subject = `Project enquiry${kinds.length ? ': ' + kinds.join(', ') : ''}`;
      const body = [
        `Hi otto,`, '',
        (f.get('message') || '').trim(), '',
        kinds.length ? `Type: ${kinds.join(', ')}` : '',
        f.get('budget') ? `Budget: ${f.get('budget')}` : '',
        '', name
      ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
      location.href = `mailto:sekaikx@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  /* ---------------------------------------------------------------- chrome */
  function chrome() {
    const top = document.querySelector('.top');
    const onScroll = () => top.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (reduced || !('IntersectionObserver' in window)) return;
    const items = document.querySelectorAll('.section-head, .service, .case, .mini, .steps li, .brief');
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    items.forEach((n, i) => {
      n.classList.add('reveal');
      n.style.transitionDelay = (i % 3) * 70 + 'ms';
      io.observe(n);
    });
  }

  terrain();
  profile(window.PORTFOLIO_CONTRIBUTIONS);
  brief();
  chrome();
})();
