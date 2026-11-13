import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { families, sports, sportsInFamily } from "@/lib/sports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alle 24 buitensporten",
  description: "De zes sportfamilies en 24 Nederlandse buitensporten van WeerSport, met uitleg per sportgids.",
};

export default async function SportenPage() {
  const account = await readSession();
  return (
    <>
      <SiteHeaderBar account={Boolean(account)} />
      <main id="inhoud" className="page">
        <PageHero
          eyebrow="Buitensporten in Nederland"
          title={`Alle ${sports.length} sporten`}
          lead="Elke sport weegt het weer anders. Open een sportgids om te zien hoe het advies werkt; dat kost geen analyse."
        >
          <nav className="page-hero-chips" aria-label="Sportfamilies">
            {families.map((family) => (
              <a key={family.id} href={`#${family.id}`}>
                {family.name}
              </a>
            ))}
          </nav>
        </PageHero>
        <div className="page-body catalog">
          {families.map((family) => {
            const items = sportsInFamily(family.id);
            return (
              <section key={family.id} id={family.id} className="page-card" aria-labelledby={`${family.id}-title`}>
                <div className="catalog-family-head">
                  <span className="icon-badge icon-badge-lg">
                    <SportIcon src={family.icon} size={28} />
                  </span>
                  <div>
                    <h2 id={`${family.id}-title`}>{family.name}</h2>
                    <p>{items.length} sporten</p>
                  </div>
                </div>
                <ul>
                  {items.map((sport) => (
                    <li key={sport.id}>
                      <Link className="catalog-card catalog-card-link" href={`/sporten/${sport.id}`}>
                        <span className="icon-badge">
                          <SportIcon src={sport.icon} size={26} label="" />
                        </span>
                        <span className="catalog-card-text">
                          <h3>{sport.name}</h3>
                          <span className="catalog-card-action">Bekijk sportgids</span>
                        </span>
                        <span className="chevron" aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
