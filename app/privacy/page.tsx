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
          Het wachtwoord wordt niet leesbaar opgeslagen. Je kunt je gegevens exporteren of je account verwijderen via{" "}
          <Link href="/account/privacy">Privacy &amp; data</Link>. Een formele verwerkerovereenkomst volgt bij
          productie-onboarding.
        </p>
        <p>
          Plaatsnamen worden gecontroleerd bij de publieke PDOK Locatieserver, zodat alleen Nederlandse woonplaatsen
          gekozen kunnen worden.
        </p>
        <p>
          We vragen toestemming voor optionele cookies. Noodzakelijke cookies (account/sessie) blijven beschikbaar.
          Zonder cookie-toestemming laden we geen AdSense. Op Basis staat maximaal één handmatig slot ná sportweer en
          veiligheid. Homepage, auth, Mollie checkout/facturering, kritieke NO_SCORE-schermen en Pro tonen geen
          advertenties. AdSense is geen sport+radius-targetingengine van WeerSport.
        </p>
        <Link href="/auth/registreren">Terug naar registreren</Link>
      </main>
    </>
  );
}
