import { resolve } from "node:path";
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { GOATCOUNTER_CODE } from "./site.config";
import { PUZZLE_DIR, SCHEDULE_FILE, loadAll } from "./tools/shakkil/content";
import { puzzleNumber } from "./src/pages/shakkil/core/daily";
import { splitDays, type DaySplit } from "./src/lib/dayStore";

import { approve, loadQueue, reject } from "./tools/shakkil/queue";
import { CONTENT_DIR as HALAB_DIR, loadDays } from "./tools/halab/content";
import { todayNumber as halabToday } from "./src/pages/halab/core/daily";
import { listItems as halabItems, rejectItem as halabReject, saveItem as halabSave } from "./tools/halab/review";
import { CONTENT_DIR as ARABIYYAT_DIR, loadDays as loadArabiyyatDays } from "./tools/arabiyyat/content";
import { todayNumber as arabiyyatToday } from "./src/pages/arabiyyat/core/daily";

/**
 * Dev-only JSON API for the حلبيّات review page (halab/review/index.html). Never part of the build:
 * `apply: "serve"` and the page isn't a build input.
 */
function halabReviewApi(): Plugin {
  return {
    name: "halab-review-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__halab", async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        try {
          if (req.method === "GET" && req.url === "/items") return send(200, halabItems());
          if (req.method !== "POST") return send(405, { error: "method not allowed" });
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw || "{}");
          if (req.url === "/save") return send(200, halabSave(String(body.id), body.patch ?? {}));
          if (req.url === "/reject") {
            halabReject(String(body.id), String(body.reason ?? ""));
            return send(200, { ok: true });
          }
          send(404, { error: "not found" });
        } catch (e) {
          send(400, { error: (e as Error).message });
        }
      });
    },
  };
}

/**
 * Compiles a daily game's content into `virtual:<name>-days` (src/lib/dayStore.ts): a small module
 * with today's and tomorrow's days, plus one lazily loaded chunk per block of past days, so a visit
 * downloads only what it plays. Invalid content fails the build. A build ships nothing after
 * tomorrow (DAYS_AHEAD), so future answers aren't readable from the site; the nightly rebuild
 * (deploy.yml) adds the next day. The dev server ships every day so ?day=N can preview any of them.
 */
const DAYS_AHEAD = 1;

function gameDays<T extends { number: number }>(game: {
  name: string;
  /** Content folders and files; a change reloads `page` in dev. */
  watch: string[];
  page: string;
  /** The game's days, or an error message. `extra` is more module code (e.g. `export const …`). */
  load: () => { entries: T[]; errors: string[]; extra?: string };
  today: () => number;
}): Plugin {
  const ID = `virtual:${game.name}-days`;
  const RESOLVED = "\0" + ID;
  let dev = false;
  let split: DaySplit<T> | null = null;
  const compile = (fail: (msg: string) => never) => {
    const { entries, errors, extra = "" } = game.load();
    if (errors.length) fail(`Invalid ${game.name} content:\n${errors.join("\n")}`);
    // Past the last day the list wraps around (src/lib/wrapDays.ts).
    split = splitDays(entries, game.today() + DAYS_AHEAD, dev);
    return extra;
  };
  return {
    name: `${game.name}-days`,
    configResolved(config) {
      dev = config.command === "serve";
    },
    resolveId: (id) => (id === ID || id.startsWith(`${ID}-block-`) ? "\0" + id : undefined),
    load(id) {
      if (id === RESOLVED) {
        const extra = compile((msg) => this.error(msg));
        const { recent, count, last, blockDays, blocks } = split!;
        return [
          extra,
          `export const recent = ${JSON.stringify(recent)};`,
          `export const count = ${count}, last = ${last}, blockDays = ${blockDays};`,
          `export const blocks = [${blocks.map((_, k) => `() => import(${JSON.stringify(`${ID}-block-${k}`)})`).join(", ")}];`,
        ].join("\n");
      }
      if (!id.startsWith(`${RESOLVED}-block-`)) return;
      if (!split) compile((msg) => this.error(msg));
      return `export default ${JSON.stringify(split!.blocks[Number(id.slice(`${RESOLVED}-block-`.length))] ?? [])};`;
    },
    configureServer(server) {
      server.watcher.add(game.watch);
      server.watcher.on("all", (_, file) => {
        if (!game.watch.some((w) => file.startsWith(w))) return;
        for (const k of [-1, ...(split?.blocks.keys() ?? [])]) {
          const mod = server.moduleGraph.getModuleById(k < 0 ? RESOLVED : `${RESOLVED}-block-${k}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        split = null;
        // Only the game reloads; the review pages keep their place.
        server.ws.send({ type: "full-reload", path: game.page });
      });
    },
  };
}

const halabDays = () =>
  gameDays({
    name: "halab",
    watch: [HALAB_DIR],
    page: "/halab/index.html",
    today: halabToday,
    load: () => {
      const { days, errors } = loadDays();
      return { entries: days, errors };
    },
  });

const arabiyyatDays = () =>
  gameDays({
    name: "arabiyyat",
    watch: [ARABIYYAT_DIR],
    page: "/arabiyyat/index.html",
    today: arabiyyatToday,
    load: () => {
      const { days, errors, sources } = loadArabiyyatDays();
      // Every book, for the credits: the shipped days alone name only a few of them.
      const used = new Set(days.flatMap((d) => d.rounds.map((r) => r.source.id)));
      const extra = `export const sources = ${JSON.stringify(sources.filter((s) => used.has(s.id)))};`;
      return { entries: days, errors, extra };
    },
  });

/** Injects tags every page shares (favicon, analytics) so each HTML entry stays small. */
function sharedHead(): Plugin {
  return {
    name: "shared-head",
    transformIndexHtml() {
      const tags: HtmlTagDescriptor[] = [
        // Icons from `npm run favicon` (tools/favicon.ts). Browsers take the SVG; older ones the PNG.
        {
          tag: "link",
          attrs: { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "theme-color", content: "#0a0a0a" },
          injectTo: "head",
        },
      ];
      if (GOATCOUNTER_CODE) {
        tags.push({
          tag: "script",
          attrs: {
            "data-goatcounter": `https://${GOATCOUNTER_CODE}.goatcounter.com/count`,
            async: true,
            src: "https://gc.zgo.at/count.js",
          },
          injectTo: "head",
        });
      }
      return tags;
    },
  };
}

/**
 * Shakkil's puzzles (content/shakkil/puzzles/*.yaml, in content/shakkil/schedule.yaml order) as
 * `virtual:shakkil-days`, the same way as the other games (gameDays). Invalid puzzles fail the
 * build with the same messages `npm run puzzle:check` prints.
 */
const shakkilDays = () =>
  gameDays({
    name: "shakkil",
    watch: [PUZZLE_DIR, SCHEDULE_FILE],
    page: "/shakkil/index.html",
    today: () => puzzleNumber(),
    load: () => {
      const { results, setErrors } = loadAll();
      const errors = [...setErrors, ...results.flatMap((r) => r.errors.map((e) => `${r.file}: ${e}`))];
      return { entries: errors.length ? [] : results.map((r) => r.source!), errors };
    },
  });

/**
 * Dev-only JSON API for the puzzle review page (review/index.html). Never part of the build:
 * `apply: "serve"` and the page isn't a build input.
 */
function reviewApi(): Plugin {
  return {
    name: "shakkil-review-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__review", async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        try {
          if (req.method === "GET" && req.url === "/queue") return send(200, loadQueue());
          if (req.method !== "POST") return send(405, { error: "method not allowed" });
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw || "{}");
          if (req.url === "/approve") return send(200, approve(body.id, body.candidate));
          if (req.url === "/reject") {
            reject(body.id, body.reason ?? "");
            return send(200, { ok: true });
          }
          send(404, { error: "not found" });
        } catch (e) {
          send(400, { error: (e as Error).message });
        }
      });
    },
  };
}

// Multi-page app: every page is its own HTML entry with its own <head>.
const pages = {
  home: "index.html",
  explore: "explore/index.html",
  country: "country/index.html",
  shakkil: "shakkil/index.html",
  halab: "halab/index.html",
  arabiyyat: "arabiyyat/index.html",
  notFound: "404.html",
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), sharedHead(), shakkilDays(), halabDays(), arabiyyatDays(), halabReviewApi(), reviewApi()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([k, v]) => [k, resolve(import.meta.dirname, v)]),
      ),
    },
  },
});
