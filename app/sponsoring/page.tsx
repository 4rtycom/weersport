import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SponsoringForm } from "@/components/sponsoring-form";
import styles from "./partners.module.css";

export const metadata: Metadata = {
  title: "Sponsoring voor sportmerken en organisaties",
  description: "Bekijk hoe je merk zichtbaar kan zijn bij het plannen van een buitentraining. Ontdek het voorbeeld en bespreek een samenwerking met WeerSport.",
};

export default function SponsoringPage() {
  return (
    <>
      <div className={styles.top}><div className={styles.wrap}><SiteHeader /></div></div>
      <main id="inhoud" className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.split}>
            <div>
              <p className="eyebrow eyebrow-mint">WeerSport voor partners</p>
              <h1>In beeld vóór de eerste kilometer.</h1>
              <p className={styles.lead}>Een wielrenner checkt de wind. Een hardloper zoekt een droog uur. Op WeerSport kan je merk zichtbaar zijn terwijl sporters hun training plannen.</p>
              <a className="button button-lime" href="#aanvraag">Bespreek een samenwerking <span aria-hidden="true">↗</span></a>
            </div>
            <figure className={styles.photo}>
              <Image src="/home/hero.png" alt="Wielrenner op een slingerend fietspad door de duinen" width={1024} height={1024} priority sizes="(min-width: 800px) 46vw, 100vw" />
              <figcaption>Wielrennen <span>Wind aan de kust</span></figcaption>
            </figure>
          </div>
        </section>
        <section className={styles.split} aria-labelledby="voorbeeld">
          <div>
            <p className="eyebrow">Voorbeeld van een plaatsing</p>
            <h2 id="voorbeeld">Zo komt je merk in beeld.</h2>
            <p>Een fietser bekijkt het weer voor een duinrit. Onder het advies kan een fietsenwinkel uit de regio zich voorstellen. Het label ‘Gesponsord’ maakt direct duidelijk wie de afzender is.</p>
          </div>
          <figure className={styles.preview}>
            <figcaption>Illustratief voorbeeld · Wielrennen</figcaption>
            <div className={styles.forecast}><strong>Je rit door de duinen</strong><p>Op de terugweg heb je tegenwind. Houd daar rekening mee bij het kiezen van je route.</p></div>
            <div className={styles.placement}><small>Gesponsord</small><strong>Jouw fietsenwinkel</strong><p>Van een lekke band tot een voorjaarsbeurt. Onze werkplaats helpt je weer op weg.</p></div>
          </figure>
        </section>
        <section className={styles.rules}>
          <div className={styles.split}>
            <h2>Het sportadvies blijft onafhankelijk.</h2>
            <div><p>Sponsoring staat los van het sportadvies. WeerSport bepaalt de score, de UV-informatie en alle veiligheidswaarschuwingen.</p><p>Partnervermeldingen horen bij schermen met een sportscore. De homepage, het afrekenen en schermen zonder score blijven vrij van sponsoring.</p></div>
          </div>
        </section>
        <section className={styles.split} id="aanvraag" aria-labelledby="aanvraag-kop">
          <div><p className="eyebrow">Samenwerken</p><h2 id="aanvraag-kop">Welke sporters wil je bereiken?</h2><p>Vertel ons voor welke sport, regio of periode je een samenwerking zoekt. Een eerste idee is genoeg.</p></div>
          <div className={styles.form}><SponsoringForm /><Link href="/privacy">Hoe we je gegevens gebruiken</Link></div>
        </section>
      </main>
      <footer className={styles.footer}><div className={styles.wrap}><Link href="/">WeerSport.</Link><Link href="/support">Support</Link><Link href="/privacy">Privacy</Link></div></footer>
    </>
  );
}
