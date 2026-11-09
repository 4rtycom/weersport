import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { families, sportsInFamily } from "@/lib/sports";

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
      <div className="catalog-hero">
        <div className="catalog-intro">
          <p className="eyebrow eyebrow-lime">Buitensporten in Nederland</p>
          <h1>Alle 24 sporten</h1>
          <p>Open een sportgids om te zien hoe WeerSport het weeradvies berekent. Dat kost geen analyse.</p>
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
                  <Link className="catalog-card catalog-card-link" href={`/sporten/${sport.id}`}>
                    <span className="icon-badge icon-badge-lg">
                      <SportIcon src={sport.icon} size={36} label="" />
                    </span>
                    <h3>{sport.name}</h3>
                    <span className="catalog-card-action">Bekijk weeradvies →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
