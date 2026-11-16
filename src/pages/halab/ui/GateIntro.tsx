import { useEffect } from "react";
import "./gate.css";
import { markGateSeen } from "./gateState";

/**
 * Opening scene: the great gate of the Citadel of Aleppo, head-on, in gold line art. Its doors
 * swing inward, light spills out, and we walk through the arch into the game (gate.css). Plays once
 * per browser session; skipped for reduced motion; ?gate=1 forces it (see gateState.ts).
 */

const DURATION_MS = 3050;

const GOLD = "#c9a96e";
/** Facade coordinates (viewBox 400 × 560). The arch: two arcs of radius R centred on the jambs. */
const L = 140;
const RGT = 260;
const SPRING = 380;
const R = 120;
const APEX = SPRING - Math.sqrt(R * R - ((RGT - L) / 2) ** 2); // ≈ 276.1
const FRAME = 14;

/** Point on the left arc (centre at the right jamb) or right arc, at angle a in degrees. */
const arcPt = (side: "l" | "r", r: number, a: number): [number, number] => {
  const cx = side === "l" ? RGT : L;
  const rad = (a * Math.PI) / 180;
  return [cx + r * Math.cos(rad), SPRING - r * Math.sin(rad)];
};

const archPath = (r: number) => {
  const [lx] = arcPt("l", r, 180);
  const [rx] = arcPt("r", r, 0);
  const apexY = SPRING - Math.sqrt(r * r - ((RGT - L) / 2) ** 2);
  return `M${lx} 560V${SPRING}A${r} ${r} 0 0 1 200 ${apexY}A${r} ${r} 0 0 1 ${rx} ${SPRING}V560`;
};

/** Facade with the doorway cut out (even-odd), so the doors behind show through. */
const FACADE = `M20 70H380V560H20Z${archPath(R)}Z`;

/** Alternating light/dark voussoirs (ablaq) around the arch. */
function voussoirs() {
  const out: { d: string; light: boolean }[] = [];
  const top = (Math.acos((RGT - L) / 2 / R) * 180) / Math.PI; // angle at the apex, from the far jamb
  const steps = 7;
  for (const side of ["l", "r"] as const) {
    for (let i = 0; i < steps; i++) {
      const a0 = side === "l" ? 180 - (top * i) / steps : (top * i) / steps;
      const a1 = side === "l" ? 180 - (top * (i + 1)) / steps : (top * (i + 1)) / steps;
      const p = [arcPt(side, R, a0), arcPt(side, R + FRAME, a0), arcPt(side, R + FRAME, a1), arcPt(side, R, a1)];
      out.push({ d: `M${p.map((q) => q.join(" ")).join("L")}Z`, light: i % 2 === 0 });
    }
  }
  return out;
}

/** Stone courses with staggered joints. */
function courses() {
  const lines: string[] = [];
  for (let y = 92, row = 0; y < 560; y += 22, row++) {
    lines.push(`M20 ${y}H380`);
    for (let x = 20 + (row % 2 ? 22 : 44); x < 380; x += 44) lines.push(`M${x} ${y}v22`);
  }
  return lines.join("");
}

/** A small pointed window centred on x, with its sill at y. */
const pointedWindow = (x: number, y: number, w = 18, h = 40) =>
  `M${x - w / 2} ${y}V${y - h + w * 0.6}Q${x - w / 2} ${y - h + 6} ${x} ${y - h}Q${x + w / 2} ${y - h + 6} ${x + w / 2} ${y - h + w * 0.6}V${y}Z`;

/** Box machicolations with corbels, left and right of the arch. */
const MACHICOLATIONS = [28, 62, 96, 280, 314, 348];

function Facade() {
  return (
    <svg viewBox="0 0 400 560" aria-hidden>
      <defs>
        <clipPath id="gate-facade">
          <path d={FACADE} clipRule="evenodd" />
        </clipPath>
        <linearGradient id="gate-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17140f" />
          <stop offset="1" stopColor="#0f0e0c" />
        </linearGradient>
      </defs>

      {/* Parapet on top of the block. */}
      <path d="M166 70V48H234V70" fill="#14120e" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1.2" />
      <path d="M190 48V40H210V48" fill="none" stroke={GOLD} strokeOpacity="0.35" strokeWidth="1.2" />

      <path d={FACADE} fill="url(#gate-stone)" fillRule="evenodd" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1.3" />
      <g clipPath="url(#gate-facade)">
        <path d={courses()} stroke={GOLD} strokeOpacity="0.09" strokeWidth="1" fill="none" />
      </g>
      <path d="M20 82H380" stroke={GOLD} strokeOpacity="0.35" strokeWidth="1.2" />

      {/* Upper windows: two small pointed ones and the framed central window with its panel above. */}
      <g fill="#070706" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1.2">
        <path d={pointedWindow(82, 206)} />
        <path d={pointedWindow(318, 206)} />
        <rect x="183" y="152" width="34" height="44" />
      </g>
      <g fill="none" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1.2">
        <rect x="172" y="140" width="56" height="68" />
        <rect x="186" y="106" width="28" height="22" />
        <path d="M200 110l6 7-6 7-6-7z" />
        <path d={`M70 ${166}q12-14 24 0M306 166q12-14 24 0`} />
      </g>

      {/* Machicolations. */}
      <g stroke={GOLD} strokeWidth="1.2">
        {MACHICOLATIONS.map((x) => (
          <g key={x}>
            <rect x={x} y="298" width="24" height="26" fill="#15130f" strokeOpacity="0.55" />
            <path d={`M${x - 3} 296H${x + 27}`} strokeOpacity="0.45" />
            <path d={`M${x + 4} 324v9M${x + 12} 324v9M${x + 20} 324v9`} strokeOpacity="0.4" />
          </g>
        ))}
      </g>

      {/* The arch: ablaq voussoirs, outer moulding and jambs. */}
      <g stroke={GOLD} strokeWidth="1.1">
        {voussoirs().map((v, i) => (
          <path key={i} d={v.d} fill={v.light ? "#2a2318" : "#100e0b"} strokeOpacity="0.45" />
        ))}
      </g>
      <path d={archPath(R + FRAME)} fill="none" stroke={GOLD} strokeOpacity="0.7" strokeWidth="1.4" />
      <path d={archPath(R)} fill="none" stroke={GOLD} strokeOpacity="0.85" strokeWidth="1.4" />

      <path d="M0 559.5H400" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1" />
    </svg>
  );
}

/** One door leaf, drawn in its half of the doorway (x 140–200 or 200–260). */
function Leaf({ side }: { side: "l" | "r" }) {
  const x0 = side === "l" ? L : 200;
  const outline =
    side === "l"
      ? `M${L} 560V${SPRING}A${R} ${R} 0 0 1 200 ${APEX}V560Z`
      : `M200 ${APEX}A${R} ${R} 0 0 1 ${RGT} ${SPRING}V560H200Z`;
  const id = `gate-leaf-${side}`;
  const planks = [12, 24, 36, 48].map((dx) => `M${x0 + dx} ${APEX}V560`).join("");
  const bands = [404, 468, 532];
  const ringX = side === "l" ? 192 : 208;
  return (
    <svg viewBox={`${x0} ${APEX} 60 ${560 - APEX}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <clipPath id={id}>
          <path d={outline} />
        </clipPath>
      </defs>
      <path d={outline} fill="#23190e" />
      <g clipPath={`url(#${id})`} stroke={GOLD} fill="none">
        <path d={planks} strokeOpacity="0.22" strokeWidth="0.8" />
        {bands.map((y) => (
          <g key={y}>
            <path d={`M${x0} ${y}h60`} strokeOpacity="0.55" strokeWidth="2.2" />
            {[6, 18, 30, 42, 54].map((dx) => (
              <circle key={dx} cx={x0 + dx} cy={y} r="1.5" fill={GOLD} fillOpacity="0.75" stroke="none" />
            ))}
          </g>
        ))}
      </g>
      <circle cx={ringX} cy="436" r="4.5" fill="none" stroke={GOLD} strokeOpacity="0.8" strokeWidth="1.2" />
      <path d={outline} fill="none" stroke={GOLD} strokeOpacity="0.7" strokeWidth="1.2" />
    </svg>
  );
}

export function GateIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    markGateSeen();
    const id = setTimeout(onDone, DURATION_MS);
    const onKey = () => onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);

  return (
    <div className="gate-overlay" onClick={onDone} role="presentation">
      <div className="gate-scene">
        <div className="gate-doorway">
          <div className="gate-light" />
          <div className="gate-door gate-door-left">
            <Leaf side="l" />
          </div>
          <div className="gate-door gate-door-right">
            <Leaf side="r" />
          </div>
        </div>
        <Facade />
      </div>
      <span className="gate-skip">اضغط للدخول</span>
    </div>
  );
}
