import { type Mark, type Vowel, SHADDA, VOWEL_CHAR, VOWEL_NAMES_AR } from "../core/arabic";
import type { Action, MarkOp } from "../game";

const CARRIER = "ـ"; // tatweel: shows a lone diacritic in the Arabic font (Amiri has no ◌)

const VOWEL_ROWS: Vowel[][] = [
  ["a", "u", "i", "o"],
  ["an", "un", "in"],
];

function Key({
  label,
  title,
  active,
  onClick,
  className = "",
  disabled,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`h-14 rounded-md border text-base transition-colors select-none disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "border-gold bg-gold/20 text-gold"
          : "border-paper/15 bg-ink-2 text-paper/90 hover:border-paper/40 active:bg-paper/10"
      } ${className}`}
    >
      {label}
    </button>
  );
}

export function Keyboard({
  mark,
  dispatch,
  canSubmit,
  hasCursor,
}: {
  mark: Mark | null;
  dispatch: (a: Action) => void;
  canSubmit: boolean;
  hasCursor: boolean;
}) {
  const op = (o: MarkOp) => () => dispatch({ type: "mark", op: o });
  return (
    <div className="flex flex-col gap-2" aria-label="لوحة الحركات">
      {VOWEL_ROWS.map((row, r) => (
        <div key={r} className="grid grid-cols-4 gap-2">
          {row.map((v) => (
            <Key
              key={v}
              label={CARRIER + VOWEL_CHAR[v]}
              title={VOWEL_NAMES_AR[v]}
              active={mark?.vowel === v}
              disabled={!hasCursor}
              onClick={op({ type: "vowel", vowel: v })}
              className="font-naskh text-4xl leading-none"
            />
          ))}
          {r === 1 && (
            <Key
              label={CARRIER + SHADDA}
              title="شدة"
              active={mark?.shadda}
              disabled={!hasCursor}
              onClick={op({ type: "shadda" })}
              className="font-naskh text-4xl leading-none"
            />
          )}
        </div>
      ))}
      <div className="grid grid-cols-4 gap-2">
        <Key label="→" title="الحرف السابق" disabled={!hasCursor} onClick={() => dispatch({ type: "move", delta: -1 })} />
        <Key label="مسح" title="مسح الحركة" disabled={!hasCursor} onClick={op({ type: "clear" })} />
        <Key label="←" title="الحرف التالي" disabled={!hasCursor} onClick={() => dispatch({ type: "move", delta: 1 })} />
        <Key
          label="تحقّق"
          title="تحقّق من الإجابة"
          disabled={!canSubmit}
          onClick={() => dispatch({ type: "submit" })}
          className="!bg-gold !text-ink !border-gold font-bold hover:!bg-gold/90"
        />
      </div>
    </div>
  );
}
