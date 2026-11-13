import { HomeLink, Overline, SiteLayout } from "../../components/SiteLayout";

export default function NotFound() {
  return (
    <SiteLayout headerStart={<HomeLink />}>
      <main className="relative z-10 px-6 sm:px-8 pt-24 pb-16">
        <div className="mb-8">
          <Overline>404</Overline>
        </div>
        <h1 className="font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.05] mb-8">
          Nothing <span className="italic text-gold">here</span>.
        </h1>
        <a
          href="/"
          className="inline-block px-6 py-3 border border-gold text-gold text-xs tracking-widest uppercase hover:bg-gold hover:text-ink transition-all duration-300"
        >
          Back home
        </a>
      </main>
    </SiteLayout>
  );
}
