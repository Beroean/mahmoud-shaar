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
- `content/shakkil/schedule.yaml`: one entry per day (day 1 = first entry). An entry is one ID (a single-sentence day) or `["easy", "medium", "hard"]` IDs (a three-sentence day). While all days are single, unlisted puzzles run after the listed ones; once three-sentence days exist, unlisted puzzles wait in a pool until `npm run schedule -- plan` places them. Days already played (and tomorrow) are locked; CI fails if a PR changes them.
- Preview any day locally: `npm run dev`, then open `http://localhost:5173/shakkil/?day=N`. Dev server only; the live site ignores it. Progress you make there is saved in localhost storage, separate from the live site.
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
npm run schedule -- mix                                # spread harder puzzles evenly (single-sentence schedules)
npm run schedule -- plan                               # three-sentence days (easy, medium, hard) from all unplayed puzzles
npm run schedule -- plan --author "Name" --days 30     # same, Name's puzzles first, at most 30 days
npx tsx tools/shakkil/quran-excerpt.ts 94:6 "…"         # check a Quran excerpt is verbatim Tanzil text (needs .cache/tanzil)
```

Outside contributors: see [CONTRIBUTING.md](CONTRIBUTING.md) (Arabic and English). Pull requests that touch puzzles get an automatic report comment from `.github/workflows/puzzle-check.yml` + `puzzle-comment.yml`.

The game logic (parsing, leniency rules, grading, schedule, stats, share text) is in `src/pages/shakkil/core/`. The grading rules and their switches are in `rules.ts`.

## حلبيّات (Halabiyyat)

A daily game from «موسوعة حلب المقارنة» by محمد خير الدين الأسدي, dedicated to my father أحمد أديب شعار, who digitized the encyclopedia and made it free for everyone. Three multiple-choice rounds a day: where an Aleppine word came from; a saying to finish (proverb, wise saying or witty taunt); and a wildcard (riddle, street vendor's cry, idiom, folk belief, simile, blessing or folk-song line).

- `content/halab/origins.yaml`, `proverbs.yaml`, `wildcards.yaml`: day N plays item N of each list, so the shortest list sets the number of days and the rest are spares. Each item's `line` points into the book's text (non-blank lines of the archive.org `_djvu.txt`), for review.
- `content/halab/rejected.yaml`: items rejected in review (created on the first rejection).
- Day 1 is `LAUNCH_DATE` in `src/pages/halab/core/daily.ts`, on Shakkil's clock (midnight Mecca time). Builds ship days only up to tomorrow; `?day=N` replays past days (any day in dev).
- `npm test` validates every item and fails when fewer than 14 days are left.
- The opening animation is `src/pages/halab/ui/GateIntro.tsx`, with its drawings of the citadel in `gateArt.ts` (once per browser session; `?gate=1` replays it).
- Items the curators were unsure of carry a `flag:` note; the review page lists those first.

```bash
npm run review:halab   # local review page: flagged items first, with the book's text beside each (dev only)
```

The review page reads the book from `~/Downloads/موسوعة حلب المقارنة_djvu.txt` (or `HALAB_BOOK`); it isn't in the repo.

That `_djvu.txt` is OCR. The book's true text is the text layer of the PDF on the same archive.org item (`pdftotext -enc UTF-8`, then NFKC-normalize and restore the font's private ligatures U+E814 ته, U+E815 نه, U+E812 به, U+E811 لمج). Every item was checked against it; check new items against it too. Days already played, today's and tomorrow's must never change.

## WDI explorer data

The explorer (`/explore/`) never calls the World Bank API at runtime (its uncached data requests often hang for 60s+). Instead `npm run wdi` (`tools/wdi/build.ts`) reads the World Bank's bulk download `WDI_CSV.zip` (~280 MB) and writes small static files to `public/data/wdi/` (gitignored): `indicators.json`, `countries.json`, `meta.json` and one `ind/<id>.json` per indicator with the latest value per country.

```bash
npm run wdi              # uses .cache/wdi/WDI_CSV.zip, downloading it if missing
npm run wdi -- --fresh   # force a fresh download
```

CI builds this before every deploy (the zip is cached until the World Bank publishes a new one) and redeploys every Monday so new data shows up.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: lint → test → build → deploy to GitHub Pages. Pull requests run everything except the deploy. The custom domain comes from `public/CNAME`.
