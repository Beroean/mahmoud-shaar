import type { ReactNode } from "react";

export function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/* ── Line icons ─────────────────────────────────────────────────────────────
 * Custom set drawn on a 24px grid with a 1.5px round stroke in currentColor, so they inherit the
 * text colour (gold on cards). Size with className (default 1.75rem).
 */

function LineIcon({ children, className = "w-7 h-7" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

/** Globe with meridians. Background / countries. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
    </LineIcon>
  );
}

/** Candlestick chart. Software for commodity trading. */
export function CandlesIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M6 4v3M6 14v6" />
      <rect x="4" y="7" width="4" height="7" rx="0.5" />
      <path d="M12 3v5M12 15v3" />
      <rect x="10" y="8" width="4" height="7" rx="0.5" />
      <path d="M18 6v2M18 13v6" />
      <rect x="16" y="8" width="4" height="5" rx="0.5" />
    </LineIcon>
  );
}

/** Mortarboard. Education. */
export function CapIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.5v4c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4" />
      <path d="M21.5 9.5v5" />
    </LineIcon>
  );
}

/** Horizontal ranked bars. The WDI explorer. */
export function BarsIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 3v18" />
      <path d="M4 6h15M4 10h12M4 14h8M4 18h5" />
    </LineIcon>
  );
}

/** بَ: a letter bowl with its dot and a fatha. The tashkeel game. */
export function HarakaIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M20.5 9v4.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V12" />
      <circle cx="12" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9.5 7 15 4.5" />
    </LineIcon>
  );
}

/** Stacked layers. "All entries" (countries + aggregates). */
export function LayersIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M12 4 3 8.5l9 4.5 9-4.5z" />
      <path d="m3 12.5 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </LineIcon>
  );
}

/** Question mark in a circle. Help. */
export function HelpIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </LineIcon>
  );
}

/** Vertical bars. Statistics. */
export function StatsIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V6M17 20v-9" />
    </LineIcon>
  );
}

/** Finish flag. Show the result. */
export function FlagIcon({ className }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </LineIcon>
  );
}

/** Arrow pointing along the reading direction (flip with rtl:-scale-x-100 if needed). */
export function ArrowIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </LineIcon>
  );
}

/** Chevron pointing down (rotate for up). Dropdowns. */
export function ChevronIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </LineIcon>
  );
}
