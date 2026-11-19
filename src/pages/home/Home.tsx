import type { ReactNode } from "react";
import {
  Overline,
  SectionDivider,
  SiteLayout,
} from "../../components/SiteLayout";
import {
  ArrowIcon,
  BarsIcon,
  CitadelIcon,
  DallahIcon,
  GitHubIcon,
  HarakaIcon,
  LinkedInIcon,
} from "../../components/icons";

const LINKEDIN = "https://www.linkedin.com/in/mahmoud-shaar/";
const GITHUB = "https://github.com/Beroean";

type Experiment = {
  href: string;
  icon: ReactNode;
  kicker: string;
  title: ReactNode;
  blurb: string;
  cta: string;
};

const EXPERIMENTS: Experiment[] = [
  {
    href: "/shakkil/",
    icon: <HarakaIcon />,
    kicker: "Daily Puzzle · Arabic",
    title: (
      <>
        <span lang="ar" className="font-naskh">
          شَكِّل
        </span>{" "}
        · Shakkil
      </>
    ),
    blurb:
      "A daily Arabic diacritics puzzle: put the right harakat on a short sentence in six tries, then see the i'rab of every word.",
    cta: "Play today's puzzle",
  },
  {
    href: "/halab/",
    icon: <CitadelIcon />,
    kicker: "Daily Game · Aleppo",
    title: (
      <>
        <span lang="ar" className="font-naskh">
          حلبيّات
        </span>{" "}
        · Halabiyyat
      </>
    ),
    blurb:
      "Three rounds a day from al-Asadi's Comparative Encyclopedia of Aleppo: where a word came from, a proverb to finish, and a riddle, street cry or folk belief.",
    cta: "Play today's rounds",
  },
  {
    href: "/arabiyyat/",
    icon: <DallahIcon />,
    kicker: "Daily Game · Arab World",
    title: (
      <>
        <span lang="ar" className="font-naskh">
          عربيّات
        </span>{" "}
        · Arabiyyat
      </>
    ),
    blurb:
      "Three questions a day from folklore books across the Arab world: finish a proverb, say when it's used, then a word's origin, a riddle or an old custom.",
    cta: "Play today's questions",
  },
  {
    href: "/explore/",
    icon: <BarsIcon />,
    kicker: "Data Explorer",
    title: "World Bank WDI",
    blurb:
      "Browse and visualize 1,400+ World Development Indicators across every country. Pick a metric, see the world ranked.",
    cta: "Open Explorer",
  },
];

function HeaderLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs tracking-widest uppercase text-paper/40 hover:text-gold transition-colors duration-300"
    >
      {children}
    </a>
  );
}

export default function Home() {
  return (
    <SiteLayout
      headerStart={
        <span className="text-xs tracking-[0.3em] uppercase text-paper/40">
          Mahmoud Shaar
        </span>
      }
      headerEnd={
        <nav className="flex items-center gap-6">
          <HeaderLink href={LINKEDIN}>LinkedIn</HeaderLink>
          <span className="text-paper/20">·</span>
          <HeaderLink href={GITHUB}>GitHub</HeaderLink>
        </nav>
      }
      footer={
        <span className="mx-auto text-xs text-paper/20">
          {new Date().getFullYear()}
        </span>
      }
    >
      <main className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 pt-14 pb-16 text-center">
        <div className="mb-6 animate-fade-in">
          <Overline center>
            <span className="whitespace-nowrap">Software Engineer</span> ·{" "}
            <span className="whitespace-nowrap">Aleppo → Houston</span>
          </Overline>
        </div>

        <h1 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.1] tracking-tight mb-6 animate-slide-up">
          Things I make <span className="italic text-gold">after hours.</span>
        </h1>

        <p className="text-sm leading-[1.9] text-paper/60 max-w-xl mx-auto mb-8 animate-slide-up-delay">
          I work on software for commodity trading. Outside work, I build
          Arabic games, data tools, and whatever I'm curious about next.
        </p>

        <div className="flex justify-center gap-6 mb-16 animate-slide-up-delay-2">
          <a
            href={LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs tracking-widest uppercase text-gold/70 hover:text-gold transition-colors duration-300"
          >
            <LinkedInIcon />
            LinkedIn
          </a>
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs tracking-widest uppercase text-paper/50 hover:text-paper transition-colors duration-300"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>

        <div className="mb-8">
          <SectionDivider label="Experiments" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-paper/10">
          {EXPERIMENTS.map((x) => (
            <a
              key={x.href}
              href={x.href}
              className="bg-ink p-8 group hover:bg-ink-2 transition-colors duration-300 block md:[&:last-child:nth-child(odd)]:col-span-2"
            >
              <div className="flex justify-center text-gold/80 group-hover:text-gold mb-5 transition-colors duration-300">
                {x.icon}
              </div>
              <div className="text-xs tracking-widest uppercase text-paper/30 mb-2">
                {x.kicker}
              </div>
              <div className="font-serif text-xl mb-2 group-hover:text-gold transition-colors duration-300">
                {x.title}
              </div>
              <div className="text-xs text-paper/40 leading-relaxed max-w-md mx-auto">
                {x.blurb}
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs tracking-widest uppercase text-gold/60 group-hover:text-gold transition-colors duration-300">
                {x.cta}
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowIcon />
                </span>
              </div>
            </a>
          ))}
        </div>
      </main>
    </SiteLayout>
  );
}
