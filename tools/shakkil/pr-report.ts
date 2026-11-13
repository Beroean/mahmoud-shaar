/**
 * Puzzle report for a pull request: validates every puzzle the PR adds or changes and renders a
 * Markdown comment (Arabic first) showing how each letter will be graded.
 *
 *   npx tsx tools/shakkil/pr-report.ts <base-ref> [out.md]
 *
 * Exits 1 when the PR breaks the puzzle set. Used by .github/workflows/puzzle-check.yml.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { VOWEL_NAMES_AR, type Word, letterToString, wordToString } from "../../src/pages/shakkil/core/arabic";
import { type FileResult, FILE_RE, loadAll } from "./content";

export const MARKER = "<!-- shakkil-puzzle-report -->";

type Change = { status: "added" | "modified" | "deleted" | "renamed"; file: string };

function changedPuzzles(base: string): Change[] {
  const out = execFileSync(
    "git",
    ["diff", "--name-status", "--no-renames", `${base}...HEAD`, "--", "content/shakkil/puzzles"],
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, path] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { status, file: basename(path) } as Change;
    });
}

/** Markdown-safe cell text. */
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function markName(word: Word, i: number): string {
  const m = word.letters[i].mark;
  return [m.shadda ? "شدة" : "", m.vowel ? VOWEL_NAMES_AR[m.vowel] : ""].filter(Boolean).join(" + ");
}

/** One table row per word: required marks, optional marks, i'rab. */
function wordTable(r: FileResult): string {
  const p = r.puzzle!;
  const specs = p.variants[0].specs;
  const rows = p.words.map((word, w) => {
    const req: string[] = [];
    const opt: string[] = [];
    word.letters.forEach((l, i) => {
      const s = specs[w][i];
      if (!s.graded) return;
      (s.emptyOk ? opt : req).push(`${letterToString(l)} (${markName(word, i)})`);
    });
    return `| ${cell(wordToString(word))} | ${cell(req.join("، ") || "—")} | ${cell(opt.join("، ") || "—")} | ${cell(p.irab[w])} |`;
  });
  return [
    "| الكلمة | مطلوب ● | اختياري ○ | الإعراب |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}

export function buildReport(changes: Change[], results: FileResult[], setErrors: string[]) {
  const byFile = new Map(results.map((r) => [r.file, r]));
  const maxNumber = results.reduce((m, r) => Math.max(m, Number.isFinite(r.number) ? r.number : 0), 0);
  const lines: string[] = [MARKER, "## شَكِّل · فحص الجمل / puzzle check", ""];
  let ok = setErrors.length === 0;
  const warnings: string[] = [];

  if (!changes.length) {
    lines.push("لا تغييرات على الجمل في هذا الطلب. / No puzzle changes in this PR.", "");
  }

  for (const c of changes) {
    if (c.status === "deleted") {
      ok = false;
      lines.push(`### ✗ \`${c.file}\``, "", "حذف جملة منشورة غير مسموح. / Deleting a puzzle is not allowed (it would shift the schedule).", "");
      continue;
    }
    if (!FILE_RE.test(c.file)) {
      ok = false;
      lines.push(`### ✗ \`${c.file}\``, "", "اسم الملف يجب أن يكون أربعة أرقام مثل `0012.yaml`. / File name must be 4 digits.", "");
      continue;
    }
    const r = byFile.get(c.file);
    if (!r) continue;
    const valid = r.errors.length === 0;
    ok &&= valid;
    lines.push(`### ${valid ? "✓" : "✗"} \`${c.file}\` ${c.status === "modified" ? "(تعديل / modified)" : "(جديد / new)"}`, "");
    if (r.source?.text) lines.push(`> ${cell(r.source.text)}`, "");
    if (c.status === "modified") {
      warnings.push(
        `\`${c.file}\`: يعدّل جملة موجودة. إن كانت قد نُشرت فقد يتغيّر جواب لاعبين سابقين. / modifies an existing puzzle; if it has already been published, past players' answers may change.`,
      );
    }
    if (valid) {
      lines.push(wordTable(r), "");
      if (r.puzzle!.variants.length > 1) {
        lines.push(
          `تشكيلات بديلة مقبولة / accepted alternatives: ${r.puzzle!.variants
            .slice(1)
            .map((v) => v.words.map((w) => wordToString(w)).join(" "))
            .join("، ")}`,
          "",
        );
      }
      if (r.source?.author) lines.push(`المساهم / author: ${cell(r.source.author)}`, "");
    } else {
      lines.push(...r.errors.map((e) => `- ${e}`), "");
    }
  }

  if (setErrors.length) {
    lines.push("### ✗ مجموعة الجمل / puzzle set", "", ...setErrors.map((e) => `- ${e}`), "");
  }
  if (warnings.length) lines.push("### ⚠️ تنبيهات / warnings", "", ...warnings.map((w) => `- ${w}`), "");
  lines.push(
    "---",
    ok
      ? `✓ كل شيء سليم. عدد الجمل بعد الدمج: ${maxNumber}. / All good: ${maxNumber} puzzles after merge.`
      : "✗ يوجد أخطاء. عدّل الملفات ثم ادفع التغييرات وسيُعاد الفحص تلقائيًا. / Errors found: fix the files and push; this check reruns automatically.",
    "",
    "<sub>● مطلوب، ○ يجوز تركه بلا تشكيل. حروف المد وألف «ال» لا تُشكَّل. / ● required, ○ may be left bare; long-vowel letters and the alif of ال are not graded.</sub>",
  );
  return { ok, markdown: lines.join("\n") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = "origin/main", out] = process.argv.slice(2);
  const { results, setErrors } = loadAll();
  const { ok, markdown } = buildReport(changedPuzzles(base), results, setErrors);
  if (out) writeFileSync(out, markdown, "utf8");
  else console.log(markdown);
  process.exit(ok ? 0 : 1);
}
