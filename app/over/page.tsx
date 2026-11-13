import type { Metadata } from "next";
import Link from "next/link";
import { CtaCard } from "@/components/info-blocks";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { readSession } from "@/lib/auth/cookies";
import { CONTACT_EMAIL } from "@/lib/site";
import { sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Over WeerSport",
  description: "Waarom WeerSport bestaat, hoe we onafhankelijk blijven en hoe je ons bereikt.",
};

export default async function AboutPage() {
  const account = await readSession();
  return (
    <>
      <SiteHeaderBar account={Boolean(account)} />
      <main id="inhoud" className="page">
        <PageHero
          eyebrow="Over WeerSport"
          title="Meer buiten sporten, minder twijfelen"
          lead="Een weerbericht vertelt wat voor weer het wordt. Voor wie buiten sport is de echte vraag: wanneer kan ik het beste gaan? Daar is WeerSport voor."
        />
        <div className="page-body page-body-narrow info">
          <section className="page-card" aria-labelledby="waarom-titel">
            <h2 id="waarom-titel">Waarom WeerSport</h2>
            <p>
              Elke buitensport vraagt iets anders van het weer. Wind is voor een fietser een tegenstander en voor een
              kitesurfer de reden om te gaan. Daarom rekent WeerSport voor {sports.length} sporten apart uit welk uur het
              beste past, en laat het zien waarom.
            </p>
          </section>

          <section className="page-card" aria-labelledby="principes-titel">
            <h2 id="principes-titel">Waar we ons aan houden</h2>
            <ul className="principles">
              <li>
                <strong>Eerlijk over wat we niet weten.</strong> Ontbreken metingen van ijs of water, dan geven we geen
                score in plaats van een geruststellend cijfer.
              </li>
              <li>
                <strong>Veiligheid gaat voor.</strong> UV en officiële waarschuwingen staan altijd los van de score, zodat
                een mooi cijfer nooit een risico verbergt.
              </li>
              <li>
                <strong>Onafhankelijk advies.</strong> Sponsors en advertenties zijn herkenbaar en hebben nooit invloed op
                de score. Met Pro sport je zonder advertenties.
              </li>
              <li>
                <strong>Zuinig met je gegevens.</strong> We bewaren alleen wat nodig is voor je account, en je kunt alles
                exporteren of verwijderen. <Link href="/privacy">Lees het privacybeleid</Link>.
              </li>
            </ul>
          </section>

          <section className="page-card" aria-labelledby="bronnen-titel">
            <h2 id="bronnen-titel">Gebouwd op open data</h2>
            <p>
              WeerSport gebruikt de weersverwachting van Open-Meteo en Nederlandse open data van PDOK, het KNMI,
              Rijkswaterstaat en Luchtmeetnet. <Link href="/weer-en-uv">Zo gebruiken we die bronnen</Link>.
            </p>
          </section>

          <section className="page-card" id="contact" aria-labelledby="contact-titel">
            <h2 id="contact-titel">Contact</h2>
            {CONTACT_EMAIL ? (
              <p>
                Vragen, ideeën of een fout gevonden? Mail naar <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            ) : (
              <p>
                Vragen of een fout gevonden? Kijk bij <Link href="/support">Support</Link>.
              </p>
            )}
            <p>
              Wil je als bedrijf zichtbaar zijn bij een sport? <Link href="/sponsoring">Bekijk sportsponsoring</Link>.
            </p>
          </section>

          <CtaCard title="Zelf proberen?">Kies je sport en plek en zie je beste moment in de komende 48 uur.</CtaCard>
        </div>
      </main>
    </>
  );
}
