import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ReturnLink } from "@/components/return-link";
import { pageReturn } from "@/lib/navigation/page-return";

export const metadata = { title: "Voorwaarden" };

export default async function TermsPage({
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
        <ReturnLink href={back.href} label={back.label} />
      </main>
    </>
  );
}
