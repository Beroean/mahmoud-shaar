# mahmoudshaar.com

My personal site and a place for side experiments. Live at <https://mahmoudshaar.com>.

## Stack

- Vite (multi-page app), React 19 with the React Compiler, TypeScript
- Tailwind CSS 3 with shared design tokens (`ink`, `paper`, `gold`; `font-serif`, `font-mono`, `font-naskh`) in `tailwind.config.js`
- Self-hosted fonts via `@fontsource`
- Vitest for tests
- GitHub Pages, deployed by GitHub Actions
- GoatCounter analytics (cookieless), configured in `site.config.ts`

## Layout

```
index.html, explore/index.html, 404.html   HTML entries (one per page, each with its own <head>)
src/pages/<page>/main.tsx                  page entry points
src/components/                            shared layout (SiteLayout, Overline, SectionDivider, icons)
src/lib/                                   small shared helpers
src/styles/base.css                        Tailwind + fonts + base styles
site.config.ts                             site URL and analytics code
public/                                    copied verbatim (CNAME, robots.txt, sitemap.xml, favicon)
```

### Adding a page

1. Create `<page>/index.html` with its own `<title>`, description, canonical and OG tags, loading `/src/pages/<page>/main.tsx`.
2. Create `src/pages/<page>/main.tsx` that calls `mount(<YourPage />)`.
3. Register the HTML file in `pages` in `vite.config.ts` and add the URL to `public/sitemap.xml`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm test
npm run build && npm run preview
```

## شَكِّل (Shakkil) puzzles

- `content/shakkil/puzzles/NNNN.yaml`: one puzzle per file. `NNNN` is a permanent ID.
- `content/shakkil/schedule.yaml`: the run order (day 1 = first entry). Unlisted puzzles run after the listed ones in ID order. Days already played are locked; CI fails if a PR changes them.
- `content/shakkil/queue/*.yaml`: candidates waiting for review. `content/shakkil/rejected.yaml`: rejected candidates (so they aren't drafted again).

```bash
npm run puzzle:new -- "ذَهَبَ الْوَلَدُ إِلَى الْمَدْرَسَةِ"   # scaffold the next ID
npm run puzzle:check                                   # validate everything, preview grading
npm run puzzle:check -- --text "هٰذَا كِتَابٌ"            # try a sentence without a file
npm run review                                         # local review page for the queue (dev only)
npm run queue:check                                    # validate queued candidates
npm run schedule                                       # list the run order with dates
npm run schedule -- next 0042 0057                     # run these next, right after today
npm run schedule -- author "Name"                      # run all upcoming puzzles by Name next
npm run schedule -- move 0042 15                       # put 0042 on day 15
```

Outside contributors: see [CONTRIBUTING.md](CONTRIBUTING.md) (Arabic and English). Pull requests that touch puzzles get an automatic report comment from `.github/workflows/puzzle-check.yml` + `puzzle-comment.yml`.

The game logic (parsing, leniency rules, grading, schedule, stats, share text) is in `src/pages/shakkil/core/`. The grading rules and their switches are in `rules.ts`.

## WDI explorer data

The explorer (`/explore/`) never calls the World Bank API at runtime (its uncached data requests often hang for 60s+). Instead `npm run wdi` (`tools/wdi/build.ts`) reads the World Bank's bulk download `WDI_CSV.zip` (~280 MB) and writes small static files to `public/data/wdi/` (gitignored): `indicators.json`, `countries.json`, `meta.json` and one `ind/<id>.json` per indicator with the latest value per country.

```bash
npm run wdi              # uses .cache/wdi/WDI_CSV.zip, downloading it if missing
npm run wdi -- --fresh   # force a fresh download
```

CI builds this before every deploy (the zip is cached until the World Bank publishes a new one) and redeploys every Monday so new data shows up.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: lint → test → build → deploy to GitHub Pages. Pull requests run everything except the deploy. The custom domain comes from `public/CNAME`.
