import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ReturnLink } from "@/components/return-link";
import { pageReturn } from "@/lib/navigation/page-return";

export const metadata = { title: "Support" };

export default async function SupportPage({
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
        <p className="eyebrow">Hulp & monitoring</p>
        <h1>Support</h1>
        <p>
          WeerSport is een sportweer-advies, geen veiligheidsgarantie. Bij twijfel over weer, water of ijs raadpleeg
          altijd de officiële bronnen (KNMI, RWS, lokale zwemwaterstatus).
        </p>
        <h2>Account, privacy en betalingen</h2>
        <ul className="support-list">
          <li>
            <Link href="/support/terugbetaling?van=/support">Terugbetalingen & geschillen</Link> — Mollie Pro. Een
            browserredirect is geen betaalbewijs. In de sandbox eindigt Pro direct; live refunds lopen via Mollie of
            support, niet via een automatische klantmail.
          </li>
          <li>
            <Link href="/privacy?van=/support">Privacy</Link> — cookies, AdSense en accountrechten.
          </li>
          <li>
            <Link href="/account/privacy?van=/support">Export & verwijdering</Link> — na inloggen. Verwijder geen
            persoonsgegevens zolang een open betaal- of bewaarplicht loopt.
          </li>
          <li>
            <Link href="/voorwaarden?van=/support">Voorwaarden</Link> — Basis, Pro en opzeggen tot het einde van de
            betaalde periode.
          </li>
          <li>
            <Link href="/release-gate">Release-gate (staging UAT)</Link> — P0-matrix en sign-off. Geen klantroute.
          </li>
        </ul>
        <p>
          Productiestatus: <code>/api/health</code> voor databasebereikbaarheid en latency.
        </p>
        <ReturnLink href={back.href} label={back.label} />
      </main>
    </>
  );
}
