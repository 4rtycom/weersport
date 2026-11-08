import styles from "@/components/commercial.module.css";
import type { PublicSponsor } from "@/lib/sponsoring/directory";

export function SportSponsors({ sponsors }: { sponsors: PublicSponsor[] }) {
  if (sponsors.length === 0) return null;
  return (
    <section className={styles.sponsors} aria-labelledby="sportsponsors-titel">
      <p className={styles.kicker}>Sponsoring</p>
      <h2 id="sportsponsors-titel">Onze sportsponsors</h2>
      <ul>
        {sponsors.map((sponsor) => (
          <li key={sponsor.id}>
            <a href={sponsor.href} rel="sponsored noopener" target="_blank">
              <img src={sponsor.logoUrl} alt="" width={48} height={48} />
              <span>{sponsor.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
