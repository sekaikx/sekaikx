// Draws readme/stats-dark.svg and readme/stats-light.svg from live GitHub data.
//   GITHUB_TOKEN=... node .github/profile/stats.mjs            (what the Action runs)
//   node .github/profile/stats.mjs --fixture data.json         (offline, for drawing)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'readme');
const LOGIN = 'sekaikx';
const SKIP = new Set(['sekaikx']);          // the profile repo itself is mostly site assets

const QUERY = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    contributionsCollection { contributionCalendar { totalContributions } }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes { name stargazerCount languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } }
    }
  }
}`;

async function live() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN, or pass --fixture <file>.');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'sekaikx-profile' },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } })
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(JSON.stringify(body.errors || body));
  const u = body.data.user;
  const repos = u.repositories.nodes.filter(r => !SKIP.has(r.name));
  const bytes = {};
  for (const r of repos) for (const e of r.languages.edges) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;
  return {
    contributions: u.contributionsCollection.contributionCalendar.totalContributions,
    repos: u.repositories.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    languages: bytes,
    basis: 'by code size'
  };
}

const THEMES = {
  dark: { bg: '#0f1417', rule: '#26312f', ink: '#eef2ef', muted: '#93a19c',
    langs: ['#ff4f9a', '#f5a3c7', '#7fb3d5', '#9fc7a3', '#d9c27e', '#b3a6e0'], other: '#3a4744' },
  light: { bg: '#f3f5f1', rule: '#d6dcd6', ink: '#1e2326', muted: '#5b6460',
    langs: ['#b0175f', '#d96b9b', '#2f6daa', '#4f8a57', '#a8862a', '#6b5bb0'], other: '#c3cbc5' }
};

const font = f => readFileSync(path.join(HERE, 'fonts', f)).toString('base64');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = n => n.toLocaleString('en-US');

function draw(d, theme) {
  const t = THEMES[theme];
  const W = 1200, H = 250;
  const stats = [
    d.contributions != null && ['Contributions', d.contributions],
    ['Public repos', d.repos],
    ['Stars earned', d.stars],
    ['Followers', d.followers]
  ].filter(Boolean);

  const total = Object.values(d.languages).reduce((s, v) => s + v, 0) || 1;
  const sorted = Object.entries(d.languages).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
  if (rest) top.push(['Other', rest]);

  const colW = 152;
  const statSvg = stats.map(([label, value], i) => {
    const x = 48 + i * colW;
    return `<text class="num" x="${x}" y="122">${fmt(value)}</text><text class="lbl" x="${x}" y="152">${esc(label)}</text>`;
  }).join('');

  const bx = 48 + stats.length * colW + 40, bw = W - bx - 48;
  let x = bx;
  const bar = top.map(([name, v], i) => {
    const w = Math.max(2, (v / total) * bw);
    const col = name === 'Other' ? t.other : t.langs[i];
    const r = `<rect x="${x.toFixed(1)}" y="96" width="${(w - 2).toFixed(1)}" height="14" fill="${col}"/>`;
    x += w;
    return r;
  }).join('');
  const legend = top.map(([name, v], i) => {
    const col = name === 'Other' ? t.other : t.langs[i];
    const lx = bx + (i % 3) * (bw / 3), ly = 146 + Math.floor(i / 3) * 30;
    return `<rect x="${lx}" y="${ly - 11}" width="12" height="12" rx="2" fill="${col}"/><text class="leg" x="${lx + 20}" y="${ly}">${esc(name)} <tspan class="pct">${((v / total) * 100).toFixed(1)}%</tspan></text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GitHub stats for ${LOGIN}: ${stats.map(([l, v]) => `${l} ${v}`).join(', ')}. Top languages: ${top.map(([n]) => n).join(', ')}.">
<style>
@font-face { font-family: "BSC"; font-weight: 600; src: url(data:font/woff2;base64,${font('BarlowSemiCondensed-600.woff2')}) format("woff2"); }
@font-face { font-family: "B"; font-weight: 500; src: url(data:font/woff2;base64,${font('Barlow-500.woff2')}) format("woff2"); }
.num { font: 600 52px "BSC", "Arial Narrow", sans-serif; fill: ${t.ink}; }
.lbl, .leg { font: 500 17px "B", Arial, sans-serif; fill: ${t.muted}; }
.leg { fill: ${t.ink}; }
.pct { fill: ${t.muted}; }
.title { font: 600 22px "BSC", "Arial Narrow", sans-serif; fill: ${t.ink}; }
.note { font: 500 14px "B", Arial, sans-serif; fill: ${t.muted}; }
</style>
<rect width="${W}" height="${H}" rx="18" fill="${t.bg}"/>
<text class="title" x="48" y="56">On GitHub</text>
<text class="title" x="${bx}" y="56">Languages</text>
<text class="note" x="${W - 48}" y="56" text-anchor="end">${esc(d.basis)}</text>
${d.contributions != null ? `<text class="note" x="48" y="${H - 44}">Contributions are counted over the last 12 months.</text>` : ''}
<line x1="${bx - 20}" x2="${bx - 20}" y1="88" y2="${H - 48}" stroke="${t.rule}"/>
${statSvg}
${bar}
${legend}
</svg>
`;
}

const fixtureAt = process.argv.indexOf('--fixture');
const data = fixtureAt > 0 ? JSON.parse(readFileSync(process.argv[fixtureAt + 1], 'utf8')) : await live();
mkdirSync(OUT, { recursive: true });
for (const theme of Object.keys(THEMES)) writeFileSync(path.join(OUT, `stats-${theme}.svg`), draw(data, theme));
console.log('stats:', JSON.stringify({ ...data, languages: Object.keys(data.languages).length + ' languages' }));
