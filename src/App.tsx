import "./App.css";
import { Routes, Route, Link } from "react-router-dom";
import DataExplorer from "./DataExplorer";

function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e4dc] font-['IBM_Plex_Mono',monospace] overflow-x-hidden">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#e8e4dc 1px, transparent 1px), linear-gradient(90deg, #e8e4dc 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-[#e8e4dc]/10">
        <span className="text-xs tracking-[0.3em] uppercase text-[#e8e4dc]/40">
          Personal Site
        </span>
        <div className="flex items-center gap-6">
          <a
            href="https://www.linkedin.com/in/mahmoud-shaar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs tracking-widest uppercase text-[#e8e4dc]/40 hover:text-[#c9a96e] transition-colors duration-300"
          >
            LinkedIn
          </a>
          <span className="text-[#e8e4dc]/20">·</span>
          <a
            href="https://github.com/Beroean"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs tracking-widest uppercase text-[#e8e4dc]/40 hover:text-[#c9a96e] transition-colors duration-300"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 px-8 pt-24 pb-16">
        {/* Overline */}
        <div className="flex items-center gap-4 mb-10 animate-fade-in">
          <div className="h-px w-12 bg-[#c9a96e]" />
          <span className="text-xs tracking-[0.4em] uppercase text-[#c9a96e]">
            Houston, TX · Software Engineer
          </span>
        </div>

        {/* Main headline */}
        <h1 className="font-['DM_Serif_Display',serif] text-[clamp(3rem,8vw,6.5rem)] leading-[1.05] tracking-tight text-[#e8e4dc] mb-10 animate-slide-up">
          Welcome to my
          <br />
          <span className="italic text-[#c9a96e]">personal corner</span>
          <br />
          of the internet.
        </h1>

        {/* Description */}
        <p className="text-sm leading-[1.9] text-[#e8e4dc]/60 max-w-xl mb-16 animate-slide-up-delay">
          I'm using this space to experiment with new tech stacks in my free
          time. I got sick and was stuck at home for a weekend so I decided to
          build this.
        </p>

        {/* CTA row */}
        <div className="flex flex-wrap gap-4 mb-32 animate-slide-up-delay-2">
          <a
            href="https://www.linkedin.com/in/mahmoud-shaar/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-6 py-3 border border-[#c9a96e] text-[#c9a96e] text-xs tracking-widest uppercase hover:bg-[#c9a96e] hover:text-[#0a0a0a] transition-all duration-300"
          >
            <LinkedInIcon />
            LinkedIn
          </a>
          <a
            href="https://github.com/Beroean"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-6 py-3 border border-[#e8e4dc]/20 text-[#e8e4dc]/60 text-xs tracking-widest uppercase hover:border-[#e8e4dc]/60 hover:text-[#e8e4dc] transition-all duration-300"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>

        {/* Divider with label */}
        <div className="flex items-center gap-6 mb-16">
          <div className="h-px flex-1 bg-[#e8e4dc]/10" />
          <span className="text-xs tracking-[0.3em] uppercase text-[#e8e4dc]/20">
            A bit about me
          </span>
          <div className="h-px flex-1 bg-[#e8e4dc]/10" />
        </div>

        {/* About cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#e8e4dc]/10 mb-16">
          {[
            {
              label: "Background",
              value: "Syrian-American",
              sub: "Based in Houston, TX",
              icon: "🌍",
            },
            {
              label: "Profession",
              value: "Software Engineer",
              sub: "Commodity Trading",
              icon: "⚡",
            },
            {
              label: "Education",
              value: "CS + MBA",
              sub: "University of Houston and Lawrence University",
              icon: "🎓",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-[#0a0a0a] p-8 group hover:bg-[#111] transition-colors duration-300"
            >
              <div className="text-2xl mb-4">{card.icon}</div>
              <div className="text-xs tracking-widest uppercase text-[#e8e4dc]/30 mb-2">
                {card.label}
              </div>
              <div className="font-['DM_Serif_Display',serif] text-xl text-[#e8e4dc] mb-1">
                {card.value}
              </div>
              <div className="text-xs text-[#e8e4dc]/40">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Experiments section */}
        <div className="flex items-center gap-6 mb-12">
          <div className="h-px flex-1 bg-[#e8e4dc]/10" />
          <span className="text-xs tracking-[0.3em] uppercase text-[#e8e4dc]/20">
            Experiments
          </span>
          <div className="h-px flex-1 bg-[#e8e4dc]/10" />
        </div>

        <div className="grid grid-cols-1 gap-px bg-[#e8e4dc]/10">
          <Link
            to="/explore"
            className="bg-[#0a0a0a] p-8 group hover:bg-[#111] transition-colors duration-300 block"
          >
            <div className="text-2xl mb-4">📊</div>
            <div className="text-xs tracking-widest uppercase text-[#e8e4dc]/30 mb-2">
              Data Explorer
            </div>
            <div className="font-['DM_Serif_Display',serif] text-xl text-[#e8e4dc] mb-2 group-hover:text-[#c9a96e] transition-colors duration-300">
              World Bank WDI
            </div>
            <div className="text-xs text-[#e8e4dc]/40 leading-relaxed">
              Browse and visualize 1,400+ World Development Indicators across
              every country. Pick a metric, see the world ranked.
            </div>
            <div className="mt-6 text-xs tracking-widest uppercase text-[#c9a96e]/60 group-hover:text-[#c9a96e] transition-colors duration-300">
              Open Explorer →
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-8 border-t border-[#e8e4dc]/10 flex items-center justify-between mt-16">
        <span className="text-xs text-[#e8e4dc]/20 tracking-widest">
          Built on 3-15-2026 because I was sick and bored.
        </span>
        <span className="text-xs text-[#e8e4dc]/20">
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/explore" element={<DataExplorer />} />
    </Routes>
  );
}

export default App;
