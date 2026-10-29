// Renders portfolio/assets/og.jpg, the 1200x630 social preview, from the live page's hero.
//
// Needs Playwright and a running copy of the site:
//   python3 -m http.server 8090 --directory portfolio   (in one terminal)
//   node portfolio/tools/og-image.mjs http://localhost:8090/
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'http://localhost:8090/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(url, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.nav,.hero__note,.hero__actions{display:none!important}.hero{padding-top:64px}.hero__shot{margin-top:48px}' });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(HERE, '..', 'assets', 'og.jpg'), type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('portfolio/assets/og.jpg');
