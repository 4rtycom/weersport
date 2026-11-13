import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { PRO_PRICE_EUR } from "@/lib/billing/constants";

export const metadata = { title: "Terugbetalingen" };

export default function RefundPolicyPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero eyebrow="Support" title="Terugbetalingen" />
        <div className="page-body page-body-narrow">
        <article className="page-card prose">
        <p>
          Pro kost € {PRO_PRICE_EUR} per maand. Een browserredirect is geen betaalbewijs: rechten volgen pas na
          geverifieerde Mollie-status. Bij opzegging blijft Pro actief tot het einde van de betaalde periode.
        </p>
        <p>
          Staging/sandbox: zonder <code>MOLLIE_API_KEY</code> kun je een terugbetaling simuleren via Facturering; Pro
          eindigt dan meteen en de factuurstatus wordt <code>refunded</code>. Live refunds lopen via Mollie Dashboard
          of support totdat de provider-API volledig is aangesloten.
        </p>
        <p>
          Geschillen/chargebacks: behandel via Mollie en documenteer correlatie-ID&apos;s. Verwijder geen
          persoonsgegevens zolang een open betaal- of bewaarplicht loopt; gebruik daarna Privacy &amp; data.
        </p>
        <p>
          <Link href="/account/facturering">Naar facturering</Link> of <Link href="/support">terug naar support</Link>.
        </p>
        </article>
        </div>
      </main>
    </>
  );
}
