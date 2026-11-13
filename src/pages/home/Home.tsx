import type { ReactNode } from "react";
import {
  Overline,
  SectionDivider,
  SiteLayout,
} from "../../components/SiteLayout";
import {
  ArrowIcon,
  BarsIcon,
  CandlesIcon,
  CapIcon,
  GitHubIcon,
  GlobeIcon,
  HarakaIcon,
  LinkedInIcon,
} from "../../components/icons";

const LINKEDIN = "https://www.linkedin.com/in/mahmoud-shaar/";
const GITHUB = "https://github.com/Beroean";

const ABOUT = [
  {
    label: "Background",
    value: "Syrian Living in the US",
    sub: "Based in Houston, TX",
    icon: <GlobeIcon />,
  },
  {
    label: "Profession",
    value: "Software Engineer",
    sub: "Commodity Trading",
    icon: <CandlesIcon />,
  },
  {
    label: "Education",
    value: "CS + MBA",
    sub: "University of Houston and Lawrence University",
    icon: <CapIcon />,
  },
];

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
    href: "/explore/",
    icon: <BarsIcon />,
    kicker: "Data Explorer",
    title: "World Bank WDI",
    blurb:
      "Browse and visualize 1,400+ World Development Indicators across every country. Pick a metric, see the world ranked.",
    cta: "Open Explorer",
  },
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
          Personal Site
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
        <>
          <span className="text-xs text-paper/20 tracking-widest">
            Built on 3-15-2026 because I was sick and bored.
          </span>
          <span className="text-xs text-paper/20">
            {new Date().getFullYear()}
          </span>
        </>
      }
    >
      <main className="relative z-10 px-6 sm:px-8 pt-24 pb-16">
        <div className="mb-10 animate-fade-in">
          <Overline>Houston, TX · Software Engineer</Overline>
        </div>

        <h1 className="font-serif text-[clamp(3rem,8vw,6.5rem)] leading-[1.05] tracking-tight mb-10 animate-slide-up">
          Welcome to my
          <br />
          <span className="italic text-gold">personal corner</span>
          <br />
          of the internet.
        </h1>

        <p className="text-sm leading-[1.9] text-paper/60 max-w-xl mb-16 animate-slide-up-delay">
          I'm using this space to experiment with new tech stacks in my free
          time. I got sick and was stuck at home for a weekend so I decided to
          build this.
        </p>

        <div className="flex flex-wrap gap-4 mb-32 animate-slide-up-delay-2">
          <a
            href={LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3 border border-gold text-gold text-xs tracking-widest uppercase hover:bg-gold hover:text-ink transition-all duration-300"
          >
            <LinkedInIcon />
            LinkedIn
          </a>
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3 border border-paper/20 text-paper/60 text-xs tracking-widest uppercase hover:border-paper/60 hover:text-paper transition-all duration-300"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>

        <div className="mb-16">
          <SectionDivider label="A bit about me" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-paper/10 mb-16">
          {ABOUT.map((card) => (
            <div
              key={card.label}
              className="bg-ink p-8 hover:bg-ink-2 transition-colors duration-300"
            >
              <div className="text-gold/80 mb-5">{card.icon}</div>
              <div className="text-xs tracking-widest uppercase text-paper/30 mb-2">
                {card.label}
              </div>
              <div className="font-serif text-xl mb-1">{card.value}</div>
              <div className="text-xs text-paper/40">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-12">
          <SectionDivider label="Experiments" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-paper/10">
          {EXPERIMENTS.map((x) => (
            <a
              key={x.href}
              href={x.href}
              className="bg-ink p-8 group hover:bg-ink-2 transition-colors duration-300 block"
            >
              <div className="text-gold/80 group-hover:text-gold mb-5 transition-colors duration-300">
                {x.icon}
              </div>
              <div className="text-xs tracking-widest uppercase text-paper/30 mb-2">
                {x.kicker}
              </div>
              <div className="font-serif text-xl mb-2 group-hover:text-gold transition-colors duration-300">
                {x.title}
              </div>
              <div className="text-xs text-paper/40 leading-relaxed">
                {x.blurb}
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs tracking-widest uppercase text-gold/60 group-hover:text-gold transition-colors duration-300">
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
