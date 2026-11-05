import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Voorwaarden" };

export default function TermsPage() {
  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">WeerSport</p>
        <h1>Voorwaarden</h1>
        <p>
          De abonnementsvoorwaarden, de fiscale presentatie en de betaalvoorwaarden zijn nog niet vastgesteld. Een
          Basis-account is in deze fase gratis. Er wordt nog geen betaling gestart en er wordt nog geen analyse
          geboekt.
        </p>
        <p>
          WeerSport is bedoeld voor locaties in Nederland. Een WeerSport-moment is een advies, geen veiligheidsgarantie.
        </p>
        <Link href="/auth/registreren">Terug naar registreren</Link>
      </main>
    </>
  );
}
