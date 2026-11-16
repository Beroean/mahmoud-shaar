/** When the gate intro plays: once per browser session, never for reduced motion, always with ?gate=1. */
const KEY = "halab:gate";

export function shouldShowGate(): boolean {
  try {
    if (new URLSearchParams(location.search).get("gate") === "1") return true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem(KEY) === null;
  } catch {
    return false;
  }
}

export function markGateSeen(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* blocked storage: it may play again, that's all */
  }
}
