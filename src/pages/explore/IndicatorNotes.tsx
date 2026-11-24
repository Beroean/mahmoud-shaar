import { Fragment, useState } from "react";

/** The descriptive part of public/data/<dataset>/ind/<id>.json. */
export interface IndicatorAbout {
  unit: string;
  def: string;
  source: string;
  /** Longer notes, as [heading, text] pairs (tools/wdi/build.ts). */
  about: [string, string][];
}

/** Text with its http(s) URLs as links. The notes are plain text with line breaks. */
function Linked({ text }: { text: string }) {
  return text.split(/(https?:\/\/[^\s)]+)/).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-gold/70 hover:text-gold underline break-all">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * What the indicator measures: the World Bank's definition, clamped to a few lines, and on request
 * the full definition, its notes, sources and a link to the World Bank's own page for it.
 */
export function IndicatorNotes({ info, docsUrl }: { info: IndicatorAbout; docsUrl?: string }) {
  const [open, setOpen] = useState(false);
  if (!info.def) return null;
  const hasMore = info.def.length > 240 || info.about.length > 0 || !!info.source || !!docsUrl;
  return (
    <div className="max-w-2xl mx-auto text-left mb-6 border-l border-gold/30 pl-4">
      <p className={`text-sm text-paper/60 leading-relaxed whitespace-pre-line ${open ? "" : "line-clamp-3"}`}>
        {info.def}
      </p>
      {info.unit && (
        <p className="mt-2 text-xs text-paper/40">
          <span className="tracking-widest uppercase text-paper/30">Unit</span> · {info.unit}
        </p>
      )}

      {open && (
        <div className="mt-5 space-y-4">
          {info.about.map(([heading, text]) => (
            <section key={heading}>
              <h3 className="text-xs tracking-widest uppercase text-gold/60 mb-1">{heading}</h3>
              <p className="text-xs text-paper/50 leading-relaxed whitespace-pre-line">
                <Linked text={text} />
              </p>
            </section>
          ))}
          {info.source && (
            <section>
              <h3 className="text-xs tracking-widest uppercase text-gold/60 mb-1">Sources</h3>
              <p className="text-xs text-paper/50 leading-relaxed whitespace-pre-line">
                <Linked text={info.source} />
              </p>
            </section>
          )}
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-gold/70 hover:text-gold underline"
            >
              The World Bank's page for this indicator ↗
            </a>
          )}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 text-xs tracking-widest uppercase text-paper/40 hover:text-gold transition-colors duration-150"
        >
          {open ? "Show less" : "More about this indicator"}
        </button>
      )}
    </div>
  );
}
