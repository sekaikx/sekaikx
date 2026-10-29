# Portfolio

The site behind [sekaikx.vercel.app](https://sekaikx.vercel.app). It replaces the old Sillage template: same idea of one static page with no build step, but with real content and a design of its own.

Open `index.html` through any static server (`python3 -m http.server 8090` in this folder) to work on it.

## Deploying on Vercel

Import the `sekaikx/sekaikx` repository in Vercel and deploy. `vercel.json` at the repository root does the rest: it serves this folder and, on every deploy, refreshes the GitHub contribution calendar behind the "A year of commits" section. If GitHub can't be reached during the build, the section simply stays hidden.

## Files

```
index.html                 the page
assets/css/site.css        all styles; tokens at the top, dark mode redefines only the tokens
assets/js/site.js          hero terrain (procedural contours and route), contribution profile, brief form, scroll reveal
assets/lifeline/           screenshots from the Lifeline repository
assets/work/               other project visuals (the generated GitHub header)
assets/data/contributions.js   written by tools/contributions.mjs at deploy time
tools/og-image.mjs         renders assets/og.jpg, the social preview, from the hero
tools/contributions.mjs    fetches the public contribution calendar
```

## Design notes

The page sells work: every section ends somewhere near the contact form. Keep new work inside these rules so it stays one piece.

- **Order.** Hero with availability and one call to action, services, selected work, process, activity, contact. New projects go in Selected work: the strongest one as the wide case with numbers, the rest as small cards.
- **Colour.** Map paper `#f3f5f1`, print ink `#1e2326`, contour brown `#8a6f52`, and route magenta `#a3195b` for links, the primary button and the one highlighted word in the hero. Green only for the availability dot.
- **Type.** Barlow only, in three widths: Semi Condensed for headings, Condensed for small caps labels, regular for text. Sentence case everywhere. Monospace only for terminal output.
- **Motion.** The hero route draws in once; sections fade up once as they scroll in. Reduced motion turns both off.
- **Contact.** No backend: the brief form composes a pre-filled email. Change the address in `index.html` and `site.js` together.
