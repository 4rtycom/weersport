import type { Metadata } from "next";
import Link from "next/link";
import { CtaCard, Faq } from "@/components/info-blocks";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { readSession } from "@/lib/auth/cookies";
import { BASIS_MONTHLY_LIMIT, PRO_MONTHLY_LIMIT, PRO_PRICE_EUR } from "@/lib/billing/constants";
import { formatEuro } from "@/lib/site";
import { sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prijzen",
  description: `Begin gratis met ${BASIS_MONTHLY_LIMIT} sportadviezen per maand, of kies Pro voor ${PRO_MONTHLY_LIMIT} adviezen zonder advertenties.`,
};

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9.5l3.2 3.2L14 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function PricingPage() {
  const account = await readSession();
  return (
    <>
      <SiteHeaderBar account={Boolean(account)} />
      <main id="inhoud" className="page">
        <PageHero
          eyebrow="Prijzen"
          title="Begin gratis, upgrade als je vaker gaat"
          lead="Alle sporten en alle uitleg zijn voor iedereen. Het verschil zit in hoeveel nieuwe adviezen je per maand opvraagt."
        />
        <div className="page-body info">
          <div className="price-grid">
            <section className="page-card price-card" aria-labelledby="basis-titel">
              <h2 id="basis-titel">Basis</h2>
              <p className="price">Gratis</p>
              <ul className="price-list">
                <li>
                  <Check /> {BASIS_MONTHLY_LIMIT} nieuwe adviezen per maand
                </li>
                <li>
                  <Check /> Alle {sports.length} buitensporten
                </li>
                <li>
                  <Check /> Momenten en zoekopdrachten bewaren
                </li>
                <li>
                  <Check /> Eén advertentie onder je advies, alleen met je toestemming
                </li>
              </ul>
              <Link className="button button-dark" href="/auth/registreren">
                Gratis account aanmaken
              </Link>
            </section>
            <section className="page-card price-card price-card-pro" aria-labelledby="pro-titel">
              <p className="price-flag">Voor wie vaak buiten sport</p>
              <h2 id="pro-titel">Pro</h2>
              <p className="price">
                {formatEuro(PRO_PRICE_EUR)}
                <span> per maand</span>
              </p>
              <ul className="price-list">
                <li>
                  <Check /> {PRO_MONTHLY_LIMIT} nieuwe adviezen per maand
                </li>
                <li>
                  <Check /> Geen advertenties
                </li>
                <li>
                  <Check /> Alles uit Basis
                </li>
                <li>
                  <Check /> Opzeggen per periode, veilig betalen via Mollie
                </li>
              </ul>
              <Link className="button button-lime" href="/checkout/pro">
                Kies Pro →
              </Link>
            </section>
          </div>

          <section className="page-card page-body-narrow price-faq" aria-labelledby="prijs-vragen">
            <h2 id="prijs-vragen">Vragen over betalen</h2>
            <Faq
              items={[
                {
                  q: "Wat is een advies?",
                  a: (
                    <p>
                      Elke keer dat je voor een sport en plek een nieuw sportmoment opent, is dat één advies. Bewaren,
                      terugkijken en de sportgidsen lezen kost niets.
                    </p>
                  ),
                },
                {
                  q: "Wat gebeurt er als mijn adviezen op zijn?",
                  a: (
                    <p>
                      Je bewaarde momenten blijven beschikbaar. Aan het begin van de volgende maand begint je teller
                      opnieuw, of je kiest Pro.
                    </p>
                  ),
                },
                {
                  q: "Hoe zeg ik Pro op?",
                  a: (
                    <p>
                      In je account onder Abonnement. Pro blijft actief tot het einde van de periode die je al hebt betaald.{" "}
                      <Link href="/support/terugbetaling">Meer over terugbetalen</Link>.
                    </p>
                  ),
                },
                {
                  q: "Hoe betaal ik?",
                  a: <p>Via Mollie. WeerSport ziet en bewaart geen kaart- of bankgegevens.</p>,
                },
              ]}
            />
          </section>

          <div className="page-body-narrow price-cta">
            <CtaCard title="Eerst proberen?" href="/#planner" label="Vind mijn WeerSport-moment →">
              Kies je sport en plek. Je maakt pas een account aan als je je advies opent.
            </CtaCard>
          </div>
        </div>
      </main>
    </>
  );
}
