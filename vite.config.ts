import { resolve } from "node:path";
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { GOATCOUNTER_CODE } from "./site.config";
import { PUZZLE_DIR, SCHEDULE_FILE, loadAll } from "./tools/shakkil/content";
import { puzzleNumber } from "./src/pages/shakkil/core/daily";

/**
 * Shakkil ships only puzzles up to this many days after the build day, so future answers aren't
 * readable from the site. 1 = tomorrow's is included, so the midnight rollover works even if the
 * nightly rebuild (deploy.yml) runs late. The full set is still validated.
 */
const SHAKKIL_DAYS_AHEAD = 1;
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
 * Compiles content/halab/*.yaml into `virtual:halab-days` (a list of Day). Invalid items fail the
 * build. Like Shakkil, a build ships only days up to tomorrow (HALAB_DAYS_AHEAD), so future answers
 * aren't readable from the site; the nightly rebuild (deploy.yml) adds the next one. The dev server
 * ships every day so ?day=N can preview any of them.
 */
const HALAB_DAYS_AHEAD = 1;

function halabDays(): Plugin {
  const ID = "virtual:halab-days";
  const RESOLVED = "\0" + ID;
  let dev = false;
  return {
    name: "halab-days",
    configResolved(config) {
      dev = config.command === "serve";
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      const { days, errors } = loadDays();
      if (errors.length) this.error(`Invalid حلبيّات content:\n${errors.join("\n")}`);
      const lastDay = halabToday() + HALAB_DAYS_AHEAD;
      return `export default ${JSON.stringify(dev ? days : days.filter((d) => d.number <= lastDay))};`;
    },
    configureServer(server) {
      server.watcher.add(HALAB_DIR);
      server.watcher.on("all", (_, file) => {
        if (!file.startsWith(HALAB_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        // Only the game reloads; the review page keeps its place.
        server.ws.send({ type: "full-reload", path: "/halab/index.html" });
      });
    },
  };
}

/**
 * Compiles content/arabiyyat/*.yaml into `virtual:arabiyyat-days`, the same way as halabDays():
 * invalid items fail the build, and a build ships only days up to tomorrow (the dev server ships all).
 */
function arabiyyatDays(): Plugin {
  const ID = "virtual:arabiyyat-days";
  const RESOLVED = "\0" + ID;
  let dev = false;
  return {
    name: "arabiyyat-days",
    configResolved(config) {
      dev = config.command === "serve";
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      const { days, errors } = loadArabiyyatDays();
      if (errors.length) this.error(`Invalid عربيّات content:\n${errors.join("\n")}`);
      const lastDay = arabiyyatToday() + HALAB_DAYS_AHEAD;
      return `export default ${JSON.stringify(dev ? days : days.filter((d) => d.number <= lastDay))};`;
    },
    configureServer(server) {
      server.watcher.add(ARABIYYAT_DIR);
      server.watcher.on("all", (_, file) => {
        if (!file.startsWith(ARABIYYAT_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload", path: "/arabiyyat/index.html" });
      });
    },
  };
}

/** Injects tags every page shares (favicon, analytics) so each HTML entry stays small. */
function sharedHead(): Plugin {
  return {
    name: "shared-head",
    transformIndexHtml() {
      const tags: HtmlTagDescriptor[] = [
        {
          tag: "link",
          attrs: { rel: "icon", type: "image/png", href: "/favicon-32x32.png" },
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
 * Compiles content/shakkil/puzzles/*.yaml, in content/shakkil/schedule.yaml order, into
 * `virtual:shakkil-puzzles` (a list of PuzzleSource; index = day - 1).
 * Invalid puzzles fail the build with the same messages `npm run puzzle:check` prints.
 */
function shakkilPuzzles(): Plugin {
  const ID = "virtual:shakkil-puzzles";
  const RESOLVED = "\0" + ID;
  // The dev server serves every day so `/shakkil/?day=N` can preview future days locally.
  let serveAll = false;
  return {
    name: "shakkil-puzzles",
    configResolved(config) {
      serveAll = config.command === "serve";
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      const { results, setErrors } = loadAll();
      const errors = [
        ...setErrors,
        ...results.flatMap((r) => r.errors.map((e) => `${r.file}: ${e}`)),
      ];
      if (errors.length) this.error(`Invalid Shakkil puzzles:\n${errors.join("\n")}`);
      const lastDay = serveAll ? Infinity : puzzleNumber() + SHAKKIL_DAYS_AHEAD;
      const shipped = results.filter((r) => r.number <= lastDay).map((r) => r.source);
      return `export default ${JSON.stringify(shipped)};`;
    },
    configureServer(server) {
      server.watcher.add([PUZZLE_DIR, SCHEDULE_FILE]);
      server.watcher.on("all", (_, file) => {
        if (!file.startsWith(PUZZLE_DIR) && file !== SCHEDULE_FILE) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        // Only the game page uses puzzles; the review page must keep its state.
        server.ws.send({ type: "full-reload", path: "/shakkil/index.html" });
      });
    },
  };
}

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
  shakkil: "shakkil/index.html",
  halab: "halab/index.html",
  arabiyyat: "arabiyyat/index.html",
  notFound: "404.html",
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), sharedHead(), shakkilPuzzles(), halabDays(), arabiyyatDays(), halabReviewApi(), reviewApi()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([k, v]) => [k, resolve(import.meta.dirname, v)]),
      ),
    },
  },
});
