import { useEffect } from "react";
import "./gate.css";
import { ARCH, ARCH_APEX, FACADE, FACADE_VIEWBOX, PANORAMA, PANORAMA_FOCUS, PANORAMA_VIEWBOX, leaf } from "./gateArt";
import { markGateSeen } from "./gateState";

/**
 * Opening scene, about 4.4 s (timings in gate.css; drawings in gateArt.ts):
 * 1. the Citadel of Aleppo's entrance is drawn in gold lines, seen from the side: outer tower,
 *    bridge, gate block, glacis and walls;
 * 2. we move in on the gate until we stand in front of it;
 * 3. its doors swing inward, light spills out, and we walk through the arch into the game.
 * Plays once per browser session; skipped for reduced motion; ?gate=1 forces it (gateState.ts).
 */

const DURATION_MS = 4450;

/** Static, trusted markup from gateArt.ts. */
const html = (svg: string) => ({ __html: svg });

const LEAVES = { l: leaf("l"), r: leaf("r") };

/** The doorway's box as percentages of the facade, for the 3D door leaves. */
const DOORWAY = {
  left: `${ARCH.left / 4}%`,
  width: `${(ARCH.right - ARCH.left) / 4}%`,
  top: `${(ARCH_APEX / 560) * 100}%`,
  height: `${((ARCH.sill - ARCH_APEX) / 560) * 100}%`,
};

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
      <div className="gate-pano" style={{ transformOrigin: `${PANORAMA_FOCUS.x * 100}% ${PANORAMA_FOCUS.y * 100}%` }}>
        <svg viewBox={PANORAMA_VIEWBOX} aria-hidden dangerouslySetInnerHTML={html(PANORAMA)} />
      </div>

      <div className="gate-scene">
        <div className="gate-doorway" style={DOORWAY}>
          <div className="gate-light" />
          <div className="gate-door gate-door-left">
            <svg viewBox={LEAVES.l.viewBox} preserveAspectRatio="none" aria-hidden dangerouslySetInnerHTML={html(LEAVES.l.svg)} />
          </div>
          <div className="gate-door gate-door-right">
            <svg viewBox={LEAVES.r.viewBox} preserveAspectRatio="none" aria-hidden dangerouslySetInnerHTML={html(LEAVES.r.svg)} />
          </div>
        </div>
        <svg viewBox={FACADE_VIEWBOX} aria-hidden dangerouslySetInnerHTML={html(FACADE)} />
      </div>

      <span className="gate-skip">اضغط للدخول</span>
    </div>
  );
}
