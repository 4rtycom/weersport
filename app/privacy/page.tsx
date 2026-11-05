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
          gekozen kunnen worden.
        </p>
        <p>
          Voor EER-gebruikers vragen we toestemming vóór AdSense. Zonder toestemming wordt geen advertentieverzoek
          gedaan. Op Basis staat maximaal één handmatig slot ná sportweer en veiligheid. Homepage, auth, Mollie
          checkout/facturering, kritieke NO_SCORE-schermen en Pro tonen geen advertenties. AdSense is geen
          sport+radius-targetingengine van WeerSport.
        </p>
        <Link href="/auth/registreren">Terug naar registreren</Link>
      </main>
    </>
  );
}
