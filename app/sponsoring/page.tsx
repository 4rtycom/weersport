import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SponsoringForm } from "@/components/sponsoring-form";
import { SponsoringRunningPreview } from "@/components/sponsoring-running-preview";
import { pilotBookable, pilotCta } from "@/lib/sponsoring/constants";
import { sports } from "@/lib/sports";
import styles from "./partners.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sponsoring voor sportmerken en organisaties",
  description:
    "Bekijk hoe een pilot van vier weken zichtbaar kan zijn bij één sport en één regio. De aanvraag is vrijblijvend.",
};

export default async function SponsoringPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const params = await searchParams;
  const initialIntent = params.intent === "custom" ? "custom" : "pilot";
  const bookable = pilotBookable();
  const catalog = sports.map((sport) => ({ id: sport.id, name: sport.name }));

  return (
    <>
      <div className={styles.top}>
        <div className={styles.wrap}>
          <SiteHeader />
        </div>
      </div>
      <main id="inhoud" className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.split}>
            <div>
              <p className="eyebrow eyebrow-mint">WeerSport voor partners</p>
              <h1>In beeld vóór de eerste kilometer.</h1>
              <p className={styles.lead}>
                Een wielrenner checkt de wind. Een hardloper zoekt een droog uur. Op WeerSport kan je merk zichtbaar
                zijn terwijl sporters hun training plannen.
              </p>
              <div className={styles.actions}>
                <a className="button button-lime" href="#pilot">
                  Vraag een pilot aan <span aria-hidden="true">↗</span>
                </a>
                <a className={styles.textLink} href="#voorbeeld">
                  Bekijk de voorbeeldplaatsing
                </a>
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
        <section className={styles.example} id="voorbeeld" tabIndex={-1} aria-labelledby="voorbeeld-kop">
          <div className={styles.exampleIntro}>
            <h2 id="voorbeeld-kop">Zo ziet een hardloper jouw merk</h2>
            <p>
              In dit voorbeeld bekijkt een hardloper het weer in Ede. Onder het sportadvies is ruimte voor een lokale
              hardloopwinkel.
            </p>
          </div>
          <SponsoringRunningPreview />
        </section>
        <section className={styles.price} id="pilot" tabIndex={-1} aria-labelledby="pilot-kop">
          <div className={styles.priceCard}>
            <p className="eyebrow">Pilot</p>
            <h2 id="pilot-kop">Vier weken zichtbaar bij jouw sport</h2>
            <p className={styles.priceAmount}>€99 excl. btw</p>
            <ul>
              <li>Eén sport</li>
              <li>Eén overeengekomen regio</li>
              <li>Eén goedgekeurde vermelding</li>
              <li>Eén eindrapport</li>
            </ul>
            <p>
              28 kalenderdagen, vanaf de afgesproken startdatum. Geen automatische verlenging en geen gegarandeerd
              aantal vertoningen of klikken. De pilot start pas na akkoord over de plaatsing en de periode.
            </p>
            <p>Aanvragen is nog geen boeking. Maatwerk kan meerdere sporten, regio&apos;s of een seizoen omvatten.</p>
            <div className={styles.priceActions}>
              <a className="button button-lime" href={`/sponsoring?intent=pilot#aanvraag`}>
                {pilotCta(bookable)}
              </a>
              <a className={styles.priceLink} href="/sponsoring?intent=custom#aanvraag">
                Bespreek maatwerk
              </a>
            </div>
            <p className={styles.priceNote}>
              Je aanvraag is vrijblijvend. We stemmen de plek en startdatum eerst met je af.
            </p>
          </div>
        </section>
        <section className={styles.rules}>
          <div className={styles.split}>
            <h2>Het sportadvies blijft onafhankelijk.</h2>
            <div>
              <p>Sponsoring staat los van het sportadvies. WeerSport bepaalt de score, de UV-informatie en alle veiligheidswaarschuwingen.</p>
              <p>Partnervermeldingen horen bij schermen met een sportscore. De homepage, het afrekenen en schermen zonder score blijven vrij van sponsoring.</p>
            </div>
          </div>
        </section>
        <section className={styles.split} id="aanvraag" tabIndex={-1} aria-labelledby="aanvraag-kop">
          <div>
            <p className="eyebrow">Samenwerken</p>
            <h2 id="aanvraag-kop">Welke sporters wil je bereiken?</h2>
            <p>
              Een pilot geldt voor één sport en één regio. Voor meerdere sporten, regio&apos;s of een seizoen kies je
              maatwerk. Een eerste idee is genoeg.
            </p>
          </div>
          <div className={styles.form}>
            <SponsoringForm initialIntent={initialIntent} sports={catalog} />
            <Link href="/privacy">Hoe we je gegevens gebruiken</Link>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <Link href="/">WeerSport.</Link>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </>
  );
}
