import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SponsoringForm } from "@/components/sponsoring-form";
import { SponsoringRunningPreview } from "@/components/sponsoring-running-preview";
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
              <div className={styles.actions}>
                <a className="button button-lime" href="#aanvraag">Bespreek een samenwerking <span aria-hidden="true">↗</span></a>
                <a className={styles.textLink} href="#voorbeeld">Bekijk een voorbeeld ↓</a>
              </div>
            </div>
            <figure className={styles.photo}>
              <Image
                src="/sponsoring/hardlopen-heide.png"
                alt="Twee hardlopers op een nat zandpad door de heide, met ochtendlicht onder een openbrekend wolkendek."
                width={1536}
                height={1024}
                priority
                sizes="(max-width: 760px) calc(100vw - 40px), 530px"
              />
            </figure>
          </div>
        </section>
        <section className={styles.example} id="voorbeeld" aria-labelledby="voorbeeld-kop">
          <div className={styles.exampleIntro}>
            <h2 id="voorbeeld-kop">Zo ziet een hardloper jouw merk</h2>
            <p>In dit voorbeeld bekijkt een hardloper het weer in Ede. Onder het sportadvies is ruimte voor een lokale hardloopwinkel.</p>
          </div>
          <SponsoringRunningPreview />
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
