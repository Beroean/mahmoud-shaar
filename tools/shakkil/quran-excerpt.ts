/**
 * Checks Quran excerpts for Shakkil against the Tanzil text: each excerpt must be an exact
 * (verbatim) substring of its verse, and must pass the puzzle checker.
 *
 *   npx tsx tools/shakkil/quran-excerpt.ts 94:6 "إِنَّ مَعَ الْعُسْرِ يُسْرًا" [112:1 "…" …]
 *
 * Needs .cache/tanzil/quran-simple.txt: the Tanzil "simple" text (sura|aya|text), downloaded from
 * https://tanzil.net/download (CC BY 3.0, verbatim only, credit + link to tanzil.net). Not committed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compilePuzzle } from "../../src/pages/shakkil/core/puzzle";

const FILE = resolve(import.meta.dirname, "../../.cache/tanzil/quran-simple.txt");

export function loadTanzil(path = FILE): Map<string, string> {
  const verses = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
    // NFC: canonically equivalent text (e.g. shadda+fatha vs fatha+shadda) compares equal.
    if (m) verses.set(`${m[1]}:${m[2]}`, m[3].normalize("NFC"));
  }
  return verses;
}

const args = process.argv.slice(2);
const verses = loadTanzil();
let ok = true;
for (let i = 0; i < args.length; i += 2) {
  const [ref, text] = [args[i], args[i + 1].normalize("NFC")];
  const verse = verses.get(ref);
  if (!verse) {
    console.log(`✗ ${ref}: no such verse`);
    ok = false;
    continue;
  }
  if (!verse.includes(text)) {
    console.log(`✗ ${ref}: not a verbatim excerpt\n    verse: ${verse}`);
    ok = false;
    continue;
  }
  const words = text.split(/\s+/);
  const { errors } = compilePuzzle({ number: 0, text, irab: words.map(() => "-"), source: "quran", ref });
  if (errors.length) {
    console.log(`✗ ${ref}: ${text}\n    ${errors.join("\n    ")}`);
    ok = false;
  } else console.log(`✓ ${ref}: ${text} (${words.length} words)`);
}
process.exit(ok ? 0 : 1);
