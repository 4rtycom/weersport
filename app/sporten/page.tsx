import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { SiteHeader } from "@/components/site-header";
import { SportIcon } from "@/components/sport-icon";
import { families, sportsInFamily } from "@/lib/sports";

export const metadata: Metadata = {
  title: "Alle 24 buitensporten",
  description: "De zes sportfamilies en 24 Nederlandse buitensporten van WeerSport, met de goedgekeurde iconen.",
};

export default function SportenPage() {
  return (
    <>
      <div className="catalog-hero">
        <SiteHeader />
        <div className="catalog-intro">
          <p className="eyebrow eyebrow-lime">Buitensporten in Nederland</p>
          <h1>Alle 24 sporten</h1>
          <p>Eén sport per zoekopdracht. Scores en live weer volgen in een latere fase.</p>
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
                <li key={sport.id} className="catalog-card">
                  <span className="icon-badge icon-badge-lg">
                    <SportIcon src={sport.icon} size={36} label="" />
                  </span>
                  <h3>{sport.name}</h3>
                  {sport.iconNote ? <p>{sport.iconNote}</p> : null}
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
        <p className="footer-tagline">Wat is jouw beste sportmoment?</p>
        <p className="footer-disclaimer">WeerSport-moment is een advies, geen veiligheidsgarantie.</p>
      </footer>
    </>
  );
}
