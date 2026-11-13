/** Thin wrapper around GoatCounter custom events. A no-op when the script isn't loaded (dev, blockers). */
declare global {
  interface Window {
    goatcounter?: { count?: (opts: { path: string; title?: string; event?: boolean }) => void };
  }
}

export function trackEvent(path: string, title?: string): void {
  try {
    window.goatcounter?.count?.({ path, title: title ?? path, event: true });
  } catch {
    /* analytics must never break the page */
  }
}
