import { LEVEL_NAMES } from "./styles";

const LEVEL_TONE: Record<number, string> = {
  1: "border-emerald-400/40 text-emerald-200/80",
  2: "border-sky-400/40 text-sky-200/80",
  3: "border-rose-400/50 text-rose-200/90",
};

/** Small difficulty pill (level 1 when unset). */
export function LevelBadge({ level = 1, className = "ms-2" }: { level?: number; className?: string }) {
  return (
    <span
      className={`${className} inline-block rounded-full border px-2 py-px text-[11px] align-middle ${LEVEL_TONE[level] ?? LEVEL_TONE[1]}`}
    >
      {LEVEL_NAMES[level] ?? LEVEL_NAMES[1]}
    </span>
  );
}
