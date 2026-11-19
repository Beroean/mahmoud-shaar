import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./mapIntro.css";
import { GAME_NAME } from "../core/share";
import { LAND } from "./mapData";
import { LAND_FILL, LAND_STROKE, LAND_STROKE_OPACITY, LAND_STROKE_WIDTH, MapPins, type MapPin } from "./MiniMap";
import { HEIGHT, WIDTH, project } from "./projection";

/**
 * Opening scene, about 3.8 s (the first part's timings are in mapIntro.css):
 * 1. the coastline of the Arab world traces itself and the land fills in, with the game's name;
 * 2. a dot rises on the place of every book the game draws from, west to east;
 * 3. the dots settle and today's pin (or pins) drops;
 * 4. the map flies down into the mini map on the page and the dark lifts around it.
 * The last frame is drawn exactly like MiniMap, so the hand-over is invisible.
 * Plays once per browser session; skipped for reduced motion; ?intro=1 forces it (introOnce.ts).
 */

/** When the dots start rising, and how long they take to cover the map (s). */
const BOOKS_AT = 0.9;
const BOOKS_SPAN = 0.8;
/** When today's pins drop (s). */
const PINS_AT = 2.3;
/** When the map flies into place, and how long that takes (ms). */
const LAND_AT_MS = 2900;
const LAND_MS = 850;

export interface MapIntroProps {
  /** Every book's place (duplicates are fine); may arrive after the scene has started. */
  books: { lat: number; lon: number }[];
  /** Today's pins as the mini map will show them; null until the day has loaded. */
  pins: MapPin[] | null;
  /** The mini map's svg on the page, where the scene lands. */
  target: () => Element | null;
  onDone: () => void;
}

/** One dot per place, west to east. */
function places(books: { lat: number; lon: number }[]): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const b of books) {
    const p = project(b.lat, b.lon);
    const key = `${Math.round(p[0] / 6)},${Math.round(p[1] / 6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function MapIntro({ books, pins, target, onDone }: MapIntroProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const map = useRef<SVGSVGElement>(null);
  const [start] = useState(() => performance.now());

  useEffect(() => {
    const onKey = () => onDone();
    window.addEventListener("keydown", onKey);

    const land = setTimeout(() => {
      const el = map.current;
      const box = overlay.current;
      if (!el || !box) return;
      const to = target()?.getBoundingClientRect();
      const ease = "cubic-bezier(0.55, 0, 0.25, 1)";
      const opts = { duration: LAND_MS, easing: ease, fill: "forwards" as const };
      box.animate([{ backgroundColor: "rgb(10 10 10)" }, { backgroundColor: "rgb(10 10 10 / 0)" }], opts);
      if (to && to.width > 0) {
        // Drop the entrance zoom first: in a background tab it may not have finished.
        el.style.animation = "none";
        const from = el.getBoundingClientRect();
        const s = to.width / from.width;
        el.style.transformOrigin = "0 0";
        el.animate([{ transform: "none" }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${s})` }], opts);
        el.classList.add("mi-landing");
      } else {
        el.animate([{ opacity: 1 }, { opacity: 0 }], opts);
      }
    }, LAND_AT_MS);
    const done = setTimeout(onDone, LAND_AT_MS + LAND_MS);

    return () => {
      clearTimeout(land);
      clearTimeout(done);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone, target]);

  // Pieces that mount late (the day loads while the coast is drawing) start where they'd have been:
  // each carries its planned start in data-at, shifted here by the time already gone.
  const hasPins = pins !== null;
  useLayoutEffect(() => {
    const elapsed = (performance.now() - start) / 1000;
    map.current?.querySelectorAll<SVGElement>("[data-at]").forEach((el) => {
      el.style.animationDelay = `${Number(el.dataset.at) - elapsed}s`;
    });
  }, [books, hasPins, start]);

  const dots = places(books);
  const step = dots.length > 1 ? BOOKS_SPAN / (dots.length - 1) : 0;

  return (
    <div ref={overlay} className="mi-overlay" onClick={onDone} role="presentation">
      <div className="mi-stage">
        <svg ref={map} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mi-map" aria-hidden>
          <path className="mi-fill" d={LAND} fill={LAND_FILL} />
          <path
            className="mi-coast"
            d={LAND}
            pathLength={1}
            fill="none"
            stroke={LAND_STROKE}
            strokeWidth={LAND_STROKE_WIDTH}
            strokeLinejoin="round"
            style={{ ["--mi-rest" as string]: LAND_STROKE_OPACITY }}
          />
          <g className="mi-books">
            {dots.map(([x, y], i) => (
              <g key={`${x},${y}`} transform={`translate(${x} ${y})`}>
                <circle className="mi-dot" r={6} fill={LAND_STROKE} data-at={BOOKS_AT + i * step} />
              </g>
            ))}
          </g>
          {pins && (
            <g className="mi-pins" data-at={PINS_AT}>
              <MapPins pins={pins} />
            </g>
          )}
        </svg>
        <p className="mi-name font-naskh">{GAME_NAME}</p>
      </div>
      <span className="mi-skip">اضغط للدخول</span>
    </div>
  );
}
