/**
 * Dev-only review page for حلبيّات content (`npm run review:halab`). One item at a time: edit it
 * next to the book's own text, then approve (saves edits) or reject (removes it, with a reason).
 * Flagged items come first. Backed by /__halab in vite.config.ts (tools/halab/review.ts).
 */
import { useEffect, useState } from "react";
import { toArabicDigits } from "../../shakkil/core/share";
import { KIND_LABEL } from "../core/share";
import type { RoundKind } from "../core/types";

type FileName = "origins" | "proverbs" | "wildcards";
interface Item {
  file: FileName;
  day: number | null;
  data: Record<string, unknown> & { id: string; others: string[]; status?: string; flag?: string; line?: number };
  context: [number, string][];
}
type Filter = "flagged" | "draft" | "approved" | "all";

const FILTERS: [Filter, string][] = [
  ["flagged", "بحاجة لمراجعة"],
  ["draft", "مسودّات"],
  ["approved", "موافق عليها"],
  ["all", "الكل"],
];

const kindOf = (it: Item): RoundKind =>
  it.file === "origins" ? "origin" : it.file === "proverbs" ? "proverb" : ((it.data.kind as RoundKind) ?? "riddle");

/** The main text field per file. */
const textKey = (it: Item) => (it.file === "origins" ? "word" : it.file === "proverbs" ? "text" : "prompt");

function matches(it: Item, f: Filter, q: string): boolean {
  const status = it.data.status ?? "draft";
  if (f === "flagged" && !it.data.flag) return false;
  if (f === "draft" && status !== "draft") return false;
  if (f === "approved" && status !== "approved") return false;
  if (!q) return true;
  return JSON.stringify(it.data).includes(q);
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/__halab${path}`, body ? { method: "POST", body: JSON.stringify(body) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json as T;
}

const input =
  "w-full rounded-md border border-paper/15 bg-ink-2 px-3 py-2 font-naskh text-lg focus:border-gold/60 focus:outline-none";

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-paper/50">{label}</span>
      {area ? (
        <textarea className={`${input} min-h-[4.5rem] text-base`} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={input} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Editor({ item, onDone }: { item: Item; onDone: (msg: string) => void }) {
  const key = textKey(item);
  const [draft, setDraft] = useState(() => ({
    text: String(item.data[key] ?? ""),
    answer: String(item.data.answer ?? ""),
    others: [...item.data.others.map(String), "", "", ""].slice(0, 3),
    meaning: String(item.data.meaning ?? ""),
    note: String(item.data.note ?? ""),
    entry: String(item.data.entry ?? ""),
  }));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { [key]: draft.text, answer: draft.answer, others: draft.others, note: draft.note };
      if (item.file !== "wildcards") patch.meaning = draft.meaning;
      if (item.file === "origins") patch.entry = draft.entry;
      await api("/save", { id: item.data.id, patch });
      onDone(`وافقت على ${item.data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError("اكتب سبب الرفض");
      return;
    }
    setBusy(true);
    try {
      await api("/reject", { id: item.data.id, reason });
      onDone(`رفضت ${item.data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview = draft.text.replace("___", `«${draft.answer || "؟"}»`);
  return (
    <div className="space-y-4">
      <Field label={key === "word" ? "الكلمة" : key === "text" ? "المثل (___ مكان الكلمة الناقصة)" : "النص"} value={draft.text} onChange={set("text")} area={key !== "word"} />
      <Field label="الجواب الصحيح" value={draft.answer} onChange={set("answer")} />
      <div className="grid grid-cols-3 gap-2">
        {draft.others.map((o, i) => (
          <Field
            key={i}
            label={`خيار خاطئ ${toArabicDigits(i + 1)}`}
            value={o}
            onChange={(v) => setDraft((d) => ({ ...d, others: d.others.map((x, j) => (j === i ? v : x)) }))}
          />
        ))}
      </div>
      {item.file !== "wildcards" && <Field label="المعنى" value={draft.meaning} onChange={set("meaning")} area />}
      <Field label="ملاحظة (تظهر بعد الجواب)" value={draft.note} onChange={set("note")} area />
      {item.file === "origins" && <Field label="المادّة في الموسوعة" value={draft.entry} onChange={set("entry")} />}

      <p className="text-sm text-paper/50">
        كما تظهر: <span className="font-naskh text-lg text-paper">{preview}</span>
      </p>

      {error && <p className="text-rose-300 text-sm">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="button" disabled={busy} onClick={approve} className="px-5 py-2.5 rounded-md bg-emerald-600/80 hover:bg-emerald-600 font-bold">
          موافقة وحفظ
        </button>
        <input
          className="flex-1 min-w-[10rem] rounded-md border border-paper/15 bg-ink-2 px-3 py-2 text-sm"
          placeholder="سبب الرفض"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reject()}
        />
        <button type="button" disabled={busy} onClick={reject} className="px-4 py-2.5 rounded-md border border-rose-400/60 text-rose-200 hover:bg-rose-500/15">
          رفض
        </button>
      </div>
    </div>
  );
}

function BookContext({ item }: { item: Item }) {
  if (!item.context.length)
    return <p className="text-sm text-paper/40">لا يوجد نص من الكتاب. ضع ملف الموسوعة في مجلد Downloads أو اضبط HALAB_BOOK.</p>;
  return (
    <ol className="space-y-1 font-naskh text-base leading-loose">
      {item.context.map(([n, text]) => (
        <li key={n} className={`flex gap-3 rounded px-2 ${n === item.data.line ? "bg-gold/15 text-paper" : "text-paper/55"}`}>
          <span className="font-mono text-[10px] text-paper/30 pt-2 w-12 shrink-0" dir="ltr">
            {n}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

export default function HalabReview() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [bookFound, setBookFound] = useState(true);
  const [filter, setFilter] = useState<Filter>("flagged");
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    api<{ items: Item[]; bookFound: boolean }>("/items")
      .then((r) => {
        setItems(r.items);
        setBookFound(r.bookFound);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const list = (items ?? []).filter((it) => matches(it, filter, q.trim()));
  const at = Math.min(index, Math.max(0, list.length - 1));
  const item = list[at];
  const count = (f: Filter) => (items ?? []).filter((it) => matches(it, f, "")).length;

  return (
    <div className="font-[system-ui,'Segoe_UI',Tahoma,sans-serif] min-h-screen">
      <header className="sticky top-0 z-10 bg-ink/95 backdrop-blur border-b border-paper/10 px-6 py-4 flex flex-wrap items-center gap-4">
        <h1 className="font-naskh text-2xl text-gold">مراجعة حلبيّات</h1>
        <nav className="flex gap-1">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setIndex(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-gold text-gold" : "border-paper/15 text-paper/60"}`}
            >
              {label} · {toArabicDigits(count(f))}
            </button>
          ))}
        </nav>
        <input
          className="rounded-md border border-paper/15 bg-ink-2 px-3 py-1.5 text-sm w-48"
          placeholder="بحث (رقم أو نص)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
          }}
        />
        <a href="/halab/" className="ms-auto text-xs text-paper/40 hover:text-gold">
          اللعبة ←
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && <p className="text-rose-300">{error}</p>}
        {!bookFound && <p className="mb-4 text-amber-200 text-sm">لم يُعثر على ملف الموسوعة، فلن يظهر نص الكتاب.</p>}
        {items && !item && <p className="text-paper/50 py-24 text-center">لا شيء هنا. أحسنت!</p>}
        {item && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
              <button type="button" disabled={at === 0} onClick={() => setIndex(at - 1)} className="px-3 py-1 rounded border border-paper/15 disabled:opacity-30">
                → السابق
              </button>
              <span className="text-paper/60">
                {toArabicDigits(at + 1)} من {toArabicDigits(list.length)}
              </span>
              <button type="button" disabled={at >= list.length - 1} onClick={() => setIndex(at + 1)} className="px-3 py-1 rounded border border-paper/15 disabled:opacity-30">
                التالي ←
              </button>
              <span className="font-mono text-paper/40" dir="ltr">
                {item.data.id}
              </span>
              <span className="rounded-full border border-paper/15 px-2 py-0.5 text-xs">{KIND_LABEL[kindOf(item)]}</span>
              <span className="text-xs text-paper/40">{item.day ? `اليوم ${toArabicDigits(item.day)}` : "احتياطي"}</span>
              <span className={`text-xs ${item.data.status === "approved" ? "text-emerald-300" : "text-paper/40"}`}>
                {item.data.status === "approved" ? "موافق عليه" : "مسودّة"}
              </span>
            </div>

            {item.data.flag && (
              <p className="mb-6 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-100" dir="ltr">
                ⚑ {item.data.flag}
              </p>
            )}

            <div className="grid gap-8 md:grid-cols-2">
              <Editor
                key={`${item.data.id}-${JSON.stringify(item.data)}`}
                item={item}
                onDone={(msg) => {
                  setToast(msg);
                  reload();
                }}
              />
              <section>
                <h2 className="text-xs text-paper/50 mb-2">من الكتاب (السطر {item.data.line ?? "؟"})</h2>
                <BookContext item={item} />
              </section>
            </div>
          </>
        )}
        {toast && (
          <div role="status" className="fixed bottom-6 inset-x-0 mx-auto w-fit px-4 py-2 rounded-md bg-paper text-ink text-sm">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
