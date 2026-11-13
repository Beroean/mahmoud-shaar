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
import { type FileResult, FILE_RE, idOfFile, loadAll, parseSchedule, resolveOrder } from "./content";
import { dateOfDay, lockedDays } from "./schedule";

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

/** The day order on the base branch (what is live now). */
function baseOrder(base: string): string[] {
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });
  const ids = git("ls-tree", "--name-only", base, "--", "content/shakkil/puzzles/")
    .split(/\r?\n/)
    .filter((f) => FILE_RE.test(basename(f)))
    .map(idOfFile);
  let schedule: string | null = null;
  try {
    schedule = git("show", `${base}:content/shakkil/schedule.yaml`);
  } catch {
    /* no schedule on base */
  }
  return resolveOrder(parseSchedule(schedule), ids).order;
}

function scheduleChanged(base: string): boolean {
  const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`, "--", "content/shakkil/schedule.yaml"], { encoding: "utf8" });
  return out.trim().length > 0;
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

export interface ScheduleContext {
  /** Day order currently live (base branch). */
  baseOrder: string[];
  /** Days that have been played (today included); they must not change. */
  locked: number;
  scheduleChanged?: boolean;
}

export function buildReport(
  changes: Change[],
  results: FileResult[],
  setErrors: string[],
  ctx: ScheduleContext = { baseOrder: results.map((r) => r.id), locked: 0 },
) {
  const byFile = new Map(results.map((r) => [r.file, r]));
  const lockedIds = new Set(ctx.baseOrder.slice(0, ctx.locked));
  const lines: string[] = [MARKER, "## شَكِّل · فحص الجمل / puzzle check", ""];
  let ok = setErrors.length === 0;
  const warnings: string[] = [];

  // Played days are locked: their puzzles must stay on the same days.
  const headOrder = results.map((r) => r.id);
  const moved = ctx.baseOrder.slice(0, ctx.locked).filter((id, k) => headOrder[k] !== id);
  if (moved.length) {
    ok = false;
    lines.push(
      "### ✗ ترتيب الأيام المنشورة / played days",
      "",
      `لا يجوز تغيير جمل الأيام التي نُشرت (من ١ إلى ${ctx.locked}). / Days 1–${ctx.locked} have been played and can't change: ${moved.join(", ")}`,
      "",
    );
  }

  if (!changes.length && !ctx.scheduleChanged) {
    lines.push("لا تغييرات على الجمل في هذا الطلب. / No puzzle changes in this PR.", "");
  }

  for (const c of changes) {
    if (c.status === "deleted") {
      const id = idOfFile(c.file);
      if (lockedIds.has(id)) {
        ok = false;
        lines.push(`### ✗ \`${c.file}\``, "", "لا يجوز حذف جملة نُشرت. / This puzzle has been played and can't be deleted.", "");
      } else {
        lines.push(`### 🗑 \`${c.file}\``, "", "حُذفت من الجمل القادمة. / Removed from the upcoming puzzles.", "");
      }
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
    lines.push(
      `### ${valid ? "✓" : "✗"} \`${c.file}\` ${c.status === "modified" ? "(تعديل / modified)" : "(جديد / new)"} · اليوم ${r.number} (${dateOfDay(r.number)}) / day ${r.number}`,
      "",
    );
    if (r.source?.text) lines.push(`> ${cell(r.source.text)}`, "");
    if (c.status === "modified" && lockedIds.has(r.id)) {
      warnings.push(
        `\`${c.file}\`: يعدّل جملة نُشرت، وقد يتغيّر جواب من لعبها. / edits a puzzle that has already been played; past answers may change.`,
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

  if (ctx.scheduleChanged) {
    const upcoming = results.slice(ctx.locked, ctx.locked + 10);
    lines.push(
      "### 📅 الترتيب الجديد / new order",
      "",
      ...upcoming.map((r) => `- اليوم ${r.number} (${dateOfDay(r.number)}): \`${r.id}\` ${cell(r.source?.text ?? "")}${r.source?.author ? ` · ${cell(r.source.author)}` : ""}`),
      "",
    );
  }

  if (setErrors.length) {
    lines.push("### ✗ مجموعة الجمل / puzzle set", "", ...setErrors.map((e) => `- ${e}`), "");
  }
  if (warnings.length) lines.push("### ⚠️ تنبيهات / warnings", "", ...warnings.map((w) => `- ${w}`), "");
  lines.push(
    "---",
    ok
      ? `✓ كل شيء سليم. عدد الجمل بعد الدمج: ${results.length}. / All good: ${results.length} puzzles after merge.`
      : "✗ يوجد أخطاء. عدّل الملفات ثم ادفع التغييرات وسيُعاد الفحص تلقائيًا. / Errors found: fix the files and push; this check reruns automatically.",
    "",
    "<sub>● مطلوب، ○ يجوز تركه بلا تشكيل. حروف المد وألف «ال» لا تُشكَّل. / ● required, ○ may be left bare; long-vowel letters and the alif of ال are not graded.</sub>",
  );
  return { ok, markdown: lines.join("\n") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = "origin/main", out] = process.argv.slice(2);
  const { results, setErrors } = loadAll();
  const { ok, markdown } = buildReport(changedPuzzles(base), results, setErrors, {
    baseOrder: baseOrder(base),
    locked: lockedDays(),
    scheduleChanged: scheduleChanged(base),
  });
  if (out) writeFileSync(out, markdown, "utf8");
  else console.log(markdown);
  process.exit(ok ? 0 : 1);
}
