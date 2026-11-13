import { resolve } from "node:path";
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { GOATCOUNTER_CODE } from "./site.config";
import { PUZZLE_DIR, loadAll } from "./tools/shakkil/content";

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
 * Compiles content/shakkil/puzzles/*.yaml into `virtual:shakkil-puzzles` (a list of PuzzleSource).
 * Invalid puzzles fail the build with the same messages `npm run puzzle:check` prints.
 */
function shakkilPuzzles(): Plugin {
  const ID = "virtual:shakkil-puzzles";
  const RESOLVED = "\0" + ID;
  return {
    name: "shakkil-puzzles",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      this.addWatchFile(PUZZLE_DIR);
      const { results, setErrors } = loadAll();
      const errors = [
        ...setErrors,
        ...results.flatMap((r) => r.errors.map((e) => `${r.file}: ${e}`)),
      ];
      if (errors.length) this.error(`Invalid Shakkil puzzles:\n${errors.join("\n")}`);
      return `export default ${JSON.stringify(results.map((r) => r.source))};`;
    },
    configureServer(server) {
      server.watcher.add(PUZZLE_DIR);
      server.watcher.on("all", (_, file) => {
        if (!file.startsWith(PUZZLE_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}

// Multi-page app: every page is its own HTML entry with its own <head>.
const pages = {
  home: "index.html",
  explore: "explore/index.html",
  shakkil: "shakkil/index.html",
  notFound: "404.html",
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), sharedHead(), shakkilPuzzles()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([k, v]) => [k, resolve(import.meta.dirname, v)]),
      ),
    },
  },
});
