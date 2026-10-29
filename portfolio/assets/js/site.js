/* otto — portfolio. Draws the GitHub activity chart and turns the brief form into an email.
 * The page works without it: the chart stays hidden and the form falls back to its mailto action. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* ---------------------------------------------------------------- activity chart */
  function activity(data) {
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
    const num = new Intl.NumberFormat();
    const month = new Intl.DateTimeFormat(undefined, { month: 'short' });
    section.querySelector('.year__summary').textContent =
      `${num.format(total)} contributions in the last 12 months, ${num.format(peak.count)} in the busiest week.`;
    section.hidden = false;

    const svg = section.querySelector('.activity__svg');
    function draw() {
      svg.textContent = '';
      const w = svg.clientWidth, h = svg.clientHeight, base = h - 18;
      if (!w) return;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const slot = w / weeks.length, bw = Math.max(2, slot * 0.6);
      let lastMonth = -1;
      weeks.forEach((wk, i) => {
        const bh = Math.max(1.5, (Math.sqrt(wk.count) / Math.sqrt(peak.count)) * (base - 4));
        el('rect', { x: (i * slot + (slot - bw) / 2).toFixed(1), y: (base - bh).toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: 1, class: wk === peak ? 'bar is-peak' : 'bar' }, svg);
        const d = new Date(wk.start + 'T12:00:00'), m = d.getMonth();
        if (m !== lastMonth && i > 0 && m % 3 === 0 && i * slot < w - 30) {
          el('text', { x: i * slot, y: h - 2 }, svg).textContent = month.format(d);
        }
        lastMonth = m;
      });
    }
    new ResizeObserver(draw).observe(svg);
  }

  /* ---------------------------------------------------------------- brief form */
  // No backend: the answers become a pre-filled email in the visitor's own mail app.
  function brief() {
    const form = document.querySelector('.brief');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const kinds = f.getAll('kind');
      const subject = `Project enquiry${kinds.length ? ': ' + kinds.join(', ') : ''}`;
      const lines = ['Hi otto,', '', String(f.get('message') || '').trim(), ''];
      if (kinds.length) lines.push(`Type: ${kinds.join(', ')}`);
      if (f.get('budget')) lines.push(`Budget: ${f.get('budget')}`);
      lines.push('', String(f.get('name') || '').trim());
      location.href = `mailto:sekaikx@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    });
  }

  activity(window.PORTFOLIO_CONTRIBUTIONS);
  brief();
})();
