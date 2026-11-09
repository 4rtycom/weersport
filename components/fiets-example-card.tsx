import { FietsScoreCurve } from "@/components/fiets-score-curve";
import { fietsVoorbeeld } from "@/lib/sponsoring/fiets-voorbeeld";
import styles from "@/app/sponsoring/signup.module.css";

/** Strong Fietsen preview beside the signup form. Not the full moment page. */
export function FietsExampleCard() {
  const moment = fietsVoorbeeld;
  return (
    <aside className={styles.example} aria-label={moment.badge}>
      <div className={styles.exampleTop}>
        <p className={styles.exampleBadge}>{moment.badge}</p>
        <p className={styles.exampleContext}>{moment.context}</p>
      </div>
      <div className={styles.exampleHead}>
        <div>
          <h2>{moment.title}</h2>
          <p className={styles.exampleWindow}>{moment.window}</p>
          <p className={styles.exampleReason}>{moment.explanation}</p>
        </div>
        <p className={styles.exampleScore} aria-label={`Sportscore ${moment.score} van 100`}>
          <strong>{moment.score}</strong>
          <span>/100</span>
          <b>Sportscore</b>
        </p>
      </div>
      <section className={styles.exampleCurve} aria-labelledby="voorbeeld-curve">
        <h3 id="voorbeeld-curve">{moment.curveTitle}</h3>
        <FietsScoreCurve prominent />
      </section>
      <section className={styles.exampleSponsors} aria-labelledby="voorbeeld-sponsors">
        <h3 id="voorbeeld-sponsors">Onze sportsponsors</h3>
        <a href={moment.sponsor.href} rel="sponsored noopener" target="_blank">
          <img src={moment.sponsor.image} alt="" width={56} height={56} />
          <span>{moment.sponsor.partner}</span>
        </a>
      </section>
    </aside>
  );
}
