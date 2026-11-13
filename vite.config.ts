import { resolve } from "node:path";
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { GOATCOUNTER_CODE } from "./site.config";

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

// Multi-page app: every page is its own HTML entry with its own <head>.
const pages = {
  home: "index.html",
  explore: "explore/index.html",
  notFound: "404.html",
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), sharedHead()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([k, v]) => [k, resolve(import.meta.dirname, v)]),
      ),
    },
  },
});
