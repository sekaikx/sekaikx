# Portfolio

The site behind [sekaikx.vercel.app](https://sekaikx.vercel.app). It replaces the old Sillage template: same idea of one static page with no build step, but with real content and a design of its own.

Open `index.html` through any static server (`python3 -m http.server 8090` in this folder) to work on it.

## Deploying on Vercel

Import the `sekaikx/sekaikx` repository in Vercel and deploy. `vercel.json` at the repository root does the rest: it serves this folder and, on every deploy, refreshes the GitHub contribution calendar behind the "A year of commits" section. If GitHub can't be reached during the build, the section simply stays hidden.

## Files

```
index.html                 the page
robots.txt, sitemap.xml    for search engines; update the URL if the domain changes
assets/css/site.css        all styles; tokens at the top
assets/js/site.js          GitHub activity chart and the brief form (turns answers into an email)
assets/lifeline/           screenshots from the Lifeline repository
assets/work/               other project visuals (the generated GitHub header)
assets/data/contributions.js   written by tools/contributions.mjs at deploy time
tools/og-image.mjs         renders assets/og.jpg, the social preview, from the hero
tools/contributions.mjs    fetches the public contribution calendar
```

## Design rules

The page exists to get project briefs. Keep it honest and quiet.

- **Proof over decoration.** Real screenshots, real numbers, links to source. No mock browser frames, fake terminals, logo strips or made-up stats.
- **Colour.** Near-black background, grey text, one accent (`#ec5f9b`, the magenta from the GitHub header) for links, the primary button and the peak bar in the activity chart. No gradients or glows.
- **Type.** Inter only, sentence case. Headings are plain text, no badges or labels above them.
- **Layout.** Left-aligned. Sections use a heading column and a content column, separated by hairline rules rather than cards.
- **Motion.** Hover colour changes only.
- **Copy.** Concrete and checkable. No negation lists ("no X, no Y"), no stacked fragments, no claims the page can't back up.
- **Contact.** No backend: the brief form composes a pre-filled email. Change the address in `index.html` and `site.js` together.
