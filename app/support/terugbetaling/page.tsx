import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ReturnLink } from "@/components/return-link";
import { PRO_PRICE_EUR } from "@/lib/billing/constants";
import { pageReturn } from "@/lib/navigation/page-return";

export const metadata = { title: "Terugbetalingen" };

export default async function RefundPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ van?: string }>;
}) {
  const params = await searchParams;
  const back = await pageReturn(params.van);
  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">Mollie · Pro</p>
        <h1>Terugbetalingen</h1>
        <p>
          Pro kost € {PRO_PRICE_EUR} per maand. Een browserredirect is geen betaalbewijs: rechten volgen pas na
          geverifieerde Mollie-status. Bij opzegging blijft Pro actief tot het einde van de betaalde periode.
        </p>
        <h2>Zo vraag je een terugbetaling</h2>
        <ol className="support-steps">
          <li>
            Open <Link href="/account/facturering?van=/support/terugbetaling">facturering</Link> in je account. Daar
            staat de Mollie-modus en de factuurstatus.
          </li>
          <li>
            Staging/sandbox: zonder <code>MOLLIE_API_KEY</code> kun je een terugbetaling simuleren via Facturering; Pro
            eindigt dan meteen en de factuurstatus wordt <code>refunded</code>.
          </li>
          <li>
            Live refunds lopen via Mollie Dashboard of support totdat de provider-API volledig is aangesloten. Deze
            pagina verstuurt geen e-mail en start geen live terugbetaling.
          </li>
        </ol>
        <p>
          Geschillen/chargebacks: behandel via Mollie en documenteer correlatie-ID&apos;s. Verwijder geen
          persoonsgegevens zolang een open betaal- of bewaarplicht loopt; gebruik daarna Privacy &amp; data.
        </p>
        <p>
          <Link href="/account/facturering?van=/support/terugbetaling">Naar facturering</Link> ·{" "}
          <Link href="/support?van=/support/terugbetaling">Support</Link>
        </p>
        <ReturnLink href={back.href} label={back.label} />
      </main>
    </>
  );
}
