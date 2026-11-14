/**
 * Dev-only review page for candidate puzzles (npm run review). Talks to the /__review API that
 * vite.config.ts adds to the dev server; it is not part of the production build.
 */
import { useEffect, useState } from "react";
import { SiteLayout } from "../../components/SiteLayout";
import { VOWEL_NAMES_AR, letterToString, skeleton, wordToString } from "../shakkil/core/arabic";
import { compilePuzzle } from "../shakkil/core/puzzle";

interface Queued {
  id: string;
  text: string;
  irab: string[];
  alts?: string[];
  author?: string;
  source?: string;
  ref?: string;
  level?: number;
  notes?: string;
  errors: string[];
}

interface Draft {
  text: string;
  irab: string;
  alts: string;
  author: string;
  ref: string;
  level: number;
}

const AUTHOR_KEY = "shakkil-review:author";
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function rememberedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
}

function toDraft(c: Queued): Draft {
  return {
    text: c.text,
    irab: c.irab.join("\n"),
    alts: (c.alts ?? []).join("\n"),
    // Quran / poetry / literature are credited to their source, not the reviewer.
    author: c.author ?? (c.source && c.source !== "llm-reviewed" ? "" : rememberedAuthor()),
    ref: c.ref ?? "",
    level: c.level ?? 1,
  };
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/__review${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

function Preview({ draft }: { draft: Draft }) {
  const { puzzle, errors } = compilePuzzle({
    number: 0,
    text: draft.text,
    irab: lines(draft.irab),
    alts: lines(draft.alts),
  });
  if (!puzzle) {
    return (
      <ul className="space-y-1 text-rose-300 text-sm" dir="auto">
        {errors.map((e) => (
          <li key={e}>✗ {e}</li>
        ))}
      </ul>
    );
  }
  const specs = puzzle.variants[0].specs;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-paper/40 mb-1">ما يراه اللاعب</div>
        <p className="font-naskh text-3xl text-paper/70">{skeleton(puzzle.words)}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-paper/40 text-xs">
          <tr>
            <th className="text-start py-1">الكلمة</th>
            <th className="text-start">مطلوب ●</th>
            <th className="text-start">اختياري ○</th>
            <th className="text-start">الإعراب</th>
          </tr>
        </thead>
        <tbody>
          {puzzle.words.map((word, w) => {
            const req: string[] = [];
            const opt: string[] = [];
            word.letters.forEach((l, i) => {
              const s = specs[w][i];
              if (!s.graded) return;
              const name = [l.mark.shadda ? "شدة" : "", l.mark.vowel ? VOWEL_NAMES_AR[l.mark.vowel] : ""]
                .filter(Boolean)
                .join("+");
              (s.emptyOk ? opt : req).push(`${letterToString(l)} ${name}`);
            });
            return (
              <tr key={w} className="border-t border-paper/10 align-top">
                <td className="py-2 font-naskh text-2xl text-gold whitespace-nowrap pe-3">{wordToString(word)}</td>
                <td className="py-2 pe-3">{req.join("، ") || "—"}</td>
                <td className="py-2 pe-3 text-paper/60">{opt.join("، ") || "—"}</td>
                <td className="py-2 text-paper/80">{puzzle.irab[w]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {puzzle.variants.length > 1 && (
        <p className="text-sm text-paper/60">
          بدائل مقبولة: {puzzle.variants.slice(1).map((v) => v.words.map((x) => wordToString(x)).join(" ")).join("، ")}
        </p>
      )}
    </div>
  );
}

const field = "w-full bg-ink-2 border border-paper/15 rounded-md px-3 py-2 focus:border-gold outline-none";

export default function Review() {
  const [queue, setQueue] = useState<Queued[] | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = queue?.[index] ?? null;

  function select(q: Queued[], i: number) {
    const k = Math.max(0, Math.min(i, q.length - 1));
    setIndex(k);
    setDraft(q[k] ? toDraft(q[k]) : null);
    setReason("");
  }

  useEffect(() => {
    api<Queued[]>("/queue")
      .then((q) => {
        setQueue(q);
        select(q, 0);
      })
      .catch((e: Error) => setMessage(`✗ ${e.message}`));
  }, []);

  function drop(id: string) {
    const q = queue!.filter((c) => c.id !== id);
    setQueue(q);
    select(q, index);
  }

  async function onApprove() {
    if (!current || !draft || busy) return;
    setBusy(true);
    try {
      try {
        localStorage.setItem(AUTHOR_KEY, draft.author);
      } catch {
        /* ignore */
      }
      const r = await api<{ file: string }>("/approve", {
        id: current.id,
        candidate: {
          text: draft.text,
          irab: lines(draft.irab),
          alts: lines(draft.alts),
          author: draft.author,
          source: current.source,
          ref: draft.ref,
          level: draft.level,
        },
      });
      setMessage(`✓ أضيفت ${r.file}`);
      drop(current.id);
    } catch (e) {
      setMessage(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await api("/reject", { id: current.id, reason });
      setMessage("رُفضت الجملة");
      drop(current.id);
    } catch (e) {
      setMessage(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void onApprove();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const valid = draft ? compilePuzzle({ number: 0, text: draft.text, irab: lines(draft.irab), alts: lines(draft.alts), source: current?.source, ref: draft.ref, level: draft.level }).errors.length === 0 : false;

  return (
    <div className="font-[system-ui,'Segoe_UI',Tahoma,sans-serif]">
      <SiteLayout
        headerStart={<span className="text-sm text-paper/40">مراجعة جمل شَكِّل (محلي فقط)</span>}
        headerEnd={
          <span className="text-sm text-paper/40 tabular-nums">
            {queue ? (queue.length ? `${index + 1} / ${queue.length}` : "٠") : "…"}
          </span>
        }
      >
        <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 space-y-6">
          {message && <p className="text-sm text-paper/70">{message}</p>}
          {queue && !queue.length && (
            <p className="text-paper/50 py-16 text-center">
              لا توجد جمل في قائمة الانتظار. اطلب من Claude دفعة جديدة في content/shakkil/queue.
            </p>
          )}
          {current && draft && (
            <>
              {current.notes && (
                <p className="text-sm bg-gold/10 border border-gold/30 rounded-md px-3 py-2 text-paper/80">
                  ملاحظة: {current.notes}
                </p>
              )}
              <label className="block">
                <span className="text-xs text-paper/40">الجملة مشكولة</span>
                <input
                  className={`${field} font-naskh text-4xl leading-[2]`}
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </label>
              <Preview draft={draft} />
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-paper/40">الإعراب (سطر لكل كلمة)</span>
                  <textarea
                    className={`${field} h-36`}
                    value={draft.irab}
                    onChange={(e) => setDraft({ ...draft, irab: e.target.value })}
                  />
                </label>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs text-paper/40">تشكيلات بديلة (سطر لكل تشكيل)</span>
                    <textarea
                      className={`${field} h-16 font-naskh text-xl`}
                      value={draft.alts}
                      onChange={(e) => setDraft({ ...draft, alts: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-paper/40">
                      {current.source === "quran" ? "الاسم الظاهر (يُترك فارغًا للقرآن)" : "الاسم الظاهر / الشاعر (اختياري)"}
                    </span>
                    <input
                      className={field}
                      value={draft.author}
                      onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-paper/40">المرجع (السورة والآية / القصيدة)</span>
                      <input
                        className={field}
                        value={draft.ref}
                        onChange={(e) => setDraft({ ...draft, ref: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-paper/40">الصعوبة</span>
                      <select
                        className={field}
                        value={draft.level}
                        onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })}
                      >
                        <option value={1}>سهل</option>
                        <option value={2}>متوسط</option>
                        <option value={3}>صعب</option>
                      </select>
                    </label>
                  </div>
                  {current.source && current.source !== "llm-reviewed" && (
                    <p className="text-xs text-paper/40">المصدر: {current.source}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={!valid || busy}
                  onClick={onApprove}
                  className="px-5 py-3 rounded-md bg-emerald-600 text-white font-bold disabled:opacity-40"
                  title="Ctrl+Enter"
                >
                  ✓ اعتماد
                </button>
                <input
                  className={`${field} w-56`}
                  placeholder="سبب الرفض (اختياري)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReject}
                  className="px-5 py-3 rounded-md border border-rose-400/60 text-rose-200"
                >
                  ✗ رفض
                </button>
                <div className="ms-auto flex gap-2">
                  <button type="button" onClick={() => select(queue!, index - 1)} className="px-4 py-3 rounded-md border border-paper/15">
                    → السابق
                  </button>
                  <button type="button" onClick={() => select(queue!, index + 1)} className="px-4 py-3 rounded-md border border-paper/15">
                    التالي ←
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </SiteLayout>
    </div>
  );
}
