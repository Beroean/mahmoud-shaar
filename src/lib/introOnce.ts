/**
 * When a game's opening scene plays: once per browser session, never for reduced motion, always
 * when the URL has ?<param>=1 (for reviewing it).
 */
export function shouldPlayIntro(key: string, param: string): boolean {
  try {
    if (new URLSearchParams(location.search).get(param) === "1") return true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem(key) === null;
  } catch {
    return false;
  }
}

export function markIntroSeen(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* blocked storage: it may play again, that's all */
  }
}
