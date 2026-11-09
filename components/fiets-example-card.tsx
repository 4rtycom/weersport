import { fietsVoorbeeld } from "@/lib/sponsoring/fiets-voorbeeld";
import styles from "@/app/sponsoring/signup.module.css";

/** Compact Fietsen sample beside the signup form. Not the full moment page. */
export function FietsExampleCard() {
  const moment = fietsVoorbeeld;
  return (
    <aside className={styles.example} aria-label={moment.badge}>
      <p className={styles.exampleBadge}>{moment.badge}</p>
      <p className={styles.exampleContext}>{moment.context}</p>
      <div className={styles.exampleHead}>
        <div>
          <h2>{moment.title}</h2>
          <p className={styles.exampleWindow}>{moment.window}</p>
        </div>
        <p className={styles.exampleScore} aria-label={`Sportscore ${moment.score} van 100`}>
          <strong>{moment.score}</strong>
          <span>/100</span>
        </p>
      </div>
      <p className={styles.exampleReason}>{moment.explanation}</p>
      <ul className={styles.exampleFactors}>
        {moment.factors.map((factor) => (
          <li key={factor.id}>
            <span>{factor.label}</span>
            <strong>{factor.value}</strong>
          </li>
        ))}
      </ul>
      <section className={styles.exampleSponsors} aria-labelledby="voorbeeld-sponsors">
        <h3 id="voorbeeld-sponsors">Onze sportsponsors</h3>
        <a href={moment.sponsor.href} rel="sponsored noopener" target="_blank">
          <img src={moment.sponsor.image} alt="" width={40} height={40} />
          <span>{moment.sponsor.partner}</span>
        </a>
      </section>
    </aside>
  );
}
