/**
 * Creates the next numbered puzzle file from a template.
 *
 *   npm run puzzle:new
 *   npm run puzzle:new -- "ذَهَبَ الْوَلَدُ إِلَى الْمَدْرَسَةِ"   # pre-fill the sentence
 */
import { existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { PUZZLE_DIR, puzzleFiles, FILE_RE } from "./content";

const numbers = puzzleFiles()
  .map((p) => FILE_RE.exec(p.split(/[\\/]/).pop()!)?.[1])
  .filter(Boolean)
  .map(Number);
const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
const name = `${String(next).padStart(4, "0")}.yaml`;
const path = join(PUZZLE_DIR, name);
if (existsSync(path)) throw new Error(`${name} already exists`);

const text = process.argv[2]?.trim() ?? "";
const words = text ? text.split(/\s+/) : ["الكلمة الأولى", "الكلمة الثانية"];
const irab = words.map((w) => `  - "" # ${w}`).join("\n");

writeFileSync(
  path,
  `# الجملة مشكولة تشكيلًا كاملًا / the fully diacritized sentence (2–6 words)
text: ${text || "ضع الجملة هنا"}

# إعراب مختصر لكل كلمة بالترتيب / one short i'rab note per word, in order
irab:
${irab}

# تشكيلات أخرى صحيحة للجملة نفسها (اختياري) / other fully valid diacritizations (optional)
alts: []

author: ""
source: original # original | tashkeela | llm-reviewed
`,
  "utf8",
);
console.log(`created ${relative(process.cwd(), path)}`);
console.log(`next: fill it in, then run  npm run puzzle:check -- ${name}`);
