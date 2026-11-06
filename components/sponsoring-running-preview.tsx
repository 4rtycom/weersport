import Image from "next/image";
import styles from "@/app/sponsoring/partners.module.css";

/**
 * One fixed hardlopen illustration. The copy and both photos are local.
 * Nothing here calls the weather service, a place lookup, a quota or an ad network.
 * The partner block is not a link.
 */
export function SponsoringRunningPreview({ sportName }: { sportName: string }) {
  const otherSport = sportName !== "" && sportName !== "Hardlopen";

  return (
    <div className={styles.aside}>
      <h2>Zo ziet een sporter je merk</h2>
      {otherSport ? (
        <p className={styles.exampleNote}>Dit is een hardloopvoorbeeld. Je aanvraag blijft voor {sportName}.</p>
      ) : null}
      <figure className={styles.example} aria-label="Voorbeeldplaatsing voor hardlopen, met demogegevens">
        <div className={styles.heroPhoto}>
          <Image
            src="/sponsoring/hardlopen-heide.webp"
            alt="Twee hardlopers op een nat zandpad door de heide."
            fill
            priority
            sizes="(max-width: 899px) calc(100vw - 40px), 514px"
            style={{ objectFit: "cover", objectPosition: "center 32%" }}
          />
          <div className={styles.overlay} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Hardlopen / Ede</p>
            <h3 className={styles.heroTitle}>Je ochtendrun</h3>
            <p className={styles.demo}>Voorbeeld met demogegevens</p>
          </div>
        </div>
        <div className={styles.exampleBody}>
          <p className={styles.bestLabel}>Beste moment</p>
          <p className={styles.bestTime}>09:00 – 10:00</p>
          <p className={styles.conditions}>Droog · 12 °C · Zwakke wind</p>
          <div className={styles.rule} />
          <div className={styles.partner}>
            <div className={styles.shoe}>
              <Image
                src="/sponsoring/trailschoen.webp"
                alt="Groene trailschoen op de bosgrond."
                fill
                sizes="143px"
                style={{ objectFit: "cover", objectPosition: "62% 42%" }}
              />
            </div>
            <div className={styles.partnerCopy}>
              <p className={styles.sponsored}>Gesponsord</p>
              <p className={styles.shop}>Loopatelier Ede</p>
              <p className={styles.shopLine}>Vind de trailschoen die bij je past.</p>
              <p className={styles.fictional}>Fictieve partner</p>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
