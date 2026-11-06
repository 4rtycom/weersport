import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";

export const metadata = { title: "Voorwaarden" };

export default function TermsPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="legal" id="inhoud">
        <p className="eyebrow">WeerSport</p>
        <h1>Voorwaarden</h1>
        <p>
          Basis is gratis (5 analyses/maand). Pro kost € 4,95/maand (100 analyses, advertentievrij) via Mollie.
          Browserredirect is geen betaalbewijs. Zie <Link href="/support/terugbetaling">terugbetalingsbeleid</Link> en{" "}
          <Link href="/support">support</Link>.
        </p>
        <p>
          WeerSport is bedoeld voor locaties in Nederland. Een WeerSport-moment is een advies, geen veiligheidsgarantie.
        </p>
        <Link href="/auth/registreren">Terug naar registreren</Link>
      </main>
    </>
  );
}
