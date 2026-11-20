/**
 * Approves every candidate in one or more queue files at once, without the review page. Each one
 * becomes the next numbered puzzle file, in queue order, exactly as the review page's "approve"
 * does (core/puzzle.ts validation included). Refuses to approve anything if any named file has a
 * queue:check error (puzzle checker, Tanzil, duplicates).
 *
 *   npm run queue:approve -- batch-08-modern.yaml [batch-08-quran.yaml …]
 *
 * Use it for batches whose sample has been reviewed by hand; the rest of the batch passed
 * queue:check and a second read. Run `npm run schedule -- relevel` afterwards.
 */
import { basename } from "node:path";
import { approve, checkQueue } from "./queue";

const names = process.argv.slice(2).map((a) => basename(a));
if (!names.length) {
  console.log("usage: npm run queue:approve -- <queue-file.yaml> [more files…]");
  process.exit(1);
}

const queue = checkQueue();
const files = new Set(queue.map((c) => basename(c.file)));
const missing = names.filter((n) => !files.has(n));
if (missing.length) {
  console.log(`✗ not in content/shakkil/queue: ${missing.join(", ")}`);
  process.exit(1);
}

const items = queue.filter((c) => names.includes(basename(c.file)));
const bad = items.filter((c) => c.errors.length);
if (bad.length) {
  for (const c of bad) console.log(`✗ ${basename(c.file)}  ${c.text}\n    ${c.errors.join("\n    ")}`);
  console.log(`\n${bad.length} candidate(s) have errors; nothing approved. Fix them, then run again.`);
  process.exit(1);
}

// Approve file by file, in the order given, keeping each file's order.
let first = 0;
let last = 0;
for (const name of names) {
  for (const c of items.filter((x) => basename(x.file) === name)) {
    const { number } = approve(c.id, c);
    first ||= number;
    last = number;
  }
}
console.log(`✓ approved ${items.length} candidate(s) as puzzles ${String(first).padStart(4, "0")}–${String(last).padStart(4, "0")}`);
console.log("  next: npm run schedule -- relevel");
