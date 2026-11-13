import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";

export const metadata = { title: "Voorwaarden" };

export default function TermsPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero title="Voorwaarden" lead="De afspraken voor Basis en Pro, in het kort." />
        <div className="page-body page-body-narrow">
        <article className="page-card prose">
        <p>
          Basis is gratis (5 analyses/maand). Pro kost € 4,95/maand (100 analyses, advertentievrij) via Mollie.
          Browserredirect is geen betaalbewijs. Zie <Link href="/support/terugbetaling">terugbetalingsbeleid</Link> en{" "}
          <Link href="/support">support</Link>.
        </p>
        <p>
          WeerSport is bedoeld voor locaties in Nederland. Een WeerSport-moment is een advies, geen veiligheidsgarantie.
        </p>
        </article>
        </div>
      </main>
    </>
  );
}
