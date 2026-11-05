import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">WeerSport</p>
        <h1>Privacy</h1>
        <p>
          Een account bewaart je naam, e-mailadres, een gehasht wachtwoord en de zoekopdracht die je zelf hebt gekozen.
          Het wachtwoord wordt niet leesbaar opgeslagen. Er is nog geen export, verwijdering of verwerkerovereenkomst
          vastgesteld; die horen bij de releasefase.
        </p>
        <p>
          Plaatsnamen worden gecontroleerd bij de publieke PDOK Locatieserver, zodat alleen Nederlandse woonplaatsen
          gekozen kunnen worden. Er wordt geen weeranalyse opgevraagd.
        </p>
        <Link href="/auth/registreren">Terug naar registreren</Link>
      </main>
    </>
  );
}
