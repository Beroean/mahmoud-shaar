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

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: lint → test → build → deploy to GitHub Pages. Pull requests run everything except the deploy. The custom domain comes from `public/CNAME`.
