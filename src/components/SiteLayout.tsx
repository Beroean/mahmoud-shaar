import type { ReactNode } from "react";

type Props = {
  /** Left side of the header (e.g. a label or a back link). */
  headerStart: ReactNode;
  /** Right side of the header. */
  headerEnd?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared page chrome: grid backdrop, top bar, optional footer. */
export function SiteLayout({ headerStart, headerEnd, children, footer }: Props) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#e8e4dc 1px, transparent 1px), linear-gradient(90deg, #e8e4dc 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 sm:px-8 py-6 border-b border-paper/10">
        {headerStart}
        {headerEnd}
      </header>
      {children}
      {footer && (
        <footer className="relative z-10 px-6 sm:px-8 py-8 border-t border-paper/10 flex items-center justify-between gap-4 mt-16">
          {footer}
        </footer>
      )}
    </div>
  );
}

export function HomeLink({ label = "← Home" }: { label?: string }) {
  return (
    <a
      href="/"
      className="text-xs tracking-[0.3em] uppercase text-paper/40 hover:text-gold transition-colors duration-300"
    >
      {label}
    </a>
  );
}

export function Overline({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px w-12 bg-gold" />
      <span className="text-xs tracking-[0.4em] uppercase text-gold">
        {children}
      </span>
    </div>
  );
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-6">
      <div className="h-px flex-1 bg-paper/10" />
      <span className="text-xs tracking-[0.3em] uppercase text-paper/20">
        {label}
      </span>
      <div className="h-px flex-1 bg-paper/10" />
    </div>
  );
}
