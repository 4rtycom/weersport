import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SiteHeader } from "@/components/site-header";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { robotsDirective, SITE_TAGLINE } from "@/lib/site";
import { families, sportsInFamily } from "@/lib/sports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alle 24 buitensporten",
  description: "De zes sportfamilies en 24 Nederlandse buitensporten van WeerSport.",
  robots: robotsDirective(),
};

export default async function SportenPage() {
  const account = await readSession();
  return (
    <>
      <div className="catalog-hero">
        <SiteHeader account={Boolean(account)} />
        <div className="catalog-intro">
          <p className="eyebrow eyebrow-lime">Buitensporten in Nederland</p>
          <h1>Alle 24 sporten</h1>
          <p>Eén sport per zoekopdracht. Open een tegeltje om die sport in de planner te zetten — dat kost geen analyse.</p>
        </div>
      </div>
      <main id="inhoud" className="catalog">
        {families.map((family) => (
          <section key={family.id} id={family.id} aria-labelledby={`${family.id}-title`}>
            <div className="catalog-family-head">
              <span className="icon-badge icon-badge-lg">
                <SportIcon src={family.icon} size={28} />
              </span>
              <h2 id={`${family.id}-title`}>{family.name}</h2>
            </div>
            <ul>
              {sportsInFamily(family.id).map((sport) => (
                <li key={sport.id}>
                  <Link className="catalog-card catalog-card-link" href={`/?sport=${sport.id}#planner`}>
                    <span className="icon-badge icon-badge-lg">
                      <SportIcon src={sport.icon} size={36} label="" />
                    </span>
                    <h3>{sport.name}</h3>
                    <span className="catalog-card-action">Plan {sport.name} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <BrandMark size={42} />
          <p>WeerSport.</p>
        </div>
        <p className="footer-tagline">{SITE_TAGLINE}</p>
        <p className="footer-disclaimer">WeerSport-moment is een advies, geen veiligheidsgarantie.</p>
        <nav className="footer-links" aria-label="Juridisch en support">
          <Link href="/privacy">Privacy</Link>
          <Link href="/voorwaarden">Voorwaarden</Link>
          <Link href="/support">Support</Link>
          <Link href="/support/terugbetaling">Terugbetaling</Link>
          <Link href="/samenwerken">Samenwerken</Link>
        </nav>
      </footer>
    </>
  );
}
