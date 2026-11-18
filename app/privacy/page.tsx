import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero title="Privacy" lead="Welke gegevens WeerSport bewaart, en wat je ermee kunt doen." />
        <div className="page-body page-body-narrow">
        <article className="page-card prose">
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
        <p id="cookies">
          Noodzakelijke cookies houden je ingelogd en bewaren je zoekopdracht. Die staan altijd aan. Voor optionele
          cookies vragen we eerst toestemming met onze eigen cookiemelding; je keuze wijzig je via Cookie-instellingen
          onderaan elke pagina.
        </p>
        <p>
          Accepteer je optionele cookies en gebruik je Basis, dan tonen we advertenties van Google AdSense. Zonder
          toestemming laden we AdSense niet en zie je geen advertenties. Omdat we geen cookiemelding van Google gebruiken,
          toont Google alleen advertenties die niet op jouw interesses zijn afgestemd. Dezelfde keuze bepaalt of we tellen
          hoe vaak een sponsor of aanbieding wordt bekeken.
        </p>
        <p>
          Waar advertenties staan: één blok onder je advies, onder je opgeslagen momenten en onder sportgidsen, en af en
          toe een advertentie over het hele scherm als je naar een andere pagina gaat. Die kun je meteen wegklikken. Op de
          homepage, bij inloggen en betalen, als er geen score is, en met Pro zie je geen advertenties.
        </p>
        {process.env.NEXT_PUBLIC_ANALYTICS === "vercel" ? (
          <p>
            We tellen paginabezoeken met Vercel Web Analytics. Dat werkt zonder cookies en zonder je te volgen over andere
            websites; we zien alleen geanonimiseerde aantallen, zoals welke pagina&apos;s en sporten het meest bekeken worden.
          </p>
        ) : null}
        </article>
        </div>
      </main>
    </>
  );
}
