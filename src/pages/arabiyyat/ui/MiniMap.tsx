/**
 * The mini map: the Arab world's coastline (no borders) with a pin on the place of the current
 * question's book. It stays mounted between questions, so the pin glides from one place to the next.
 * The pin marks where the book was written about, never where a saying "belongs".
 */
import { toArabicDigits } from "../../shakkil/core/share";
import { LAND } from "./mapData";
import { HEIGHT, WIDTH, project } from "./projection";

export interface MapPin {
  lat: number;
  lon: number;
  /** Shown inside the pin on the day's summary (1, 2, 3). */
  label?: number;
}

/** Pin radius on the summary; numbered pins closer than this get fanned out so all stay readable. */
const LABELED_R = 15;

/** Positions for the pins, nudging numbered pins that would overlap an earlier one. */
function place(pins: MapPin[]): [number, number][] {
  const out: [number, number][] = [];
  for (const pin of pins) {
    const [px, y] = project(pin.lat, pin.lon);
    let x = px;
    if (pin.label !== undefined) {
      for (let step = 1; out.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < LABELED_R * 2.2) && step < 8; step++) {
        x += (step % 2 ? 1 : -1) * step * LABELED_R * 1.1;
      }
    }
    out.push([x, y]);
  }
  return out;
}

/** The pins, as MiniMap draws them (also the last frame of the opening scene, MapIntro.tsx). */
export function MapPins({ pins }: { pins: MapPin[] }) {
  const spots = place(pins);
  return (
    <>
      {pins.map((pin, i) => {
        const [x, y] = spots[i];
        return (
          <g
            // One pin moves (key stays 0); the summary's pins sit side by side.
            key={pin.label ?? i}
            style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 700ms cubic-bezier(.4,0,.2,1)" }}
          >
            {pin.label === undefined && (
              <circle r={22} fill="rgb(186 230 253 / 0.25)">
                <animate attributeName="r" values="10;30;10" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0.9" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle r={pin.label === undefined ? 9 : LABELED_R} fill="rgb(186 230 253)" stroke="#0a0a0a" strokeWidth={3} />
            {pin.label !== undefined && (
              <text textAnchor="middle" dy="0.35em" fontSize={18} fontWeight={700} fill="#0a0a0a">
                {toArabicDigits(pin.label)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

/** The coastline's look on the mini map; the opening scene ends on the same values. */
export const LAND_FILL = "rgb(232 228 220 / 0.06)";
export const LAND_STROKE = "rgb(186 230 253)";
export const LAND_STROKE_OPACITY = 0.35;
export const LAND_STROKE_WIDTH = 1.5;

export function MiniMap({ pins, title }: { pins: MapPin[]; title: string }) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title} className="block w-56 sm:w-64 mx-auto h-auto">
      <path
        d={LAND}
        fill={LAND_FILL}
        stroke={LAND_STROKE}
        strokeOpacity={LAND_STROKE_OPACITY}
        strokeWidth={LAND_STROKE_WIDTH}
        strokeLinejoin="round"
      />
      <MapPins pins={pins} />
    </svg>
  );
}
