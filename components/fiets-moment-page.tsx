import { FietsScoreCurve } from "@/components/fiets-score-curve";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { fietsVoorbeeld } from "@/lib/sponsoring/fiets-voorbeeld";
import styles from "@/app/sponsoring/voorbeeld/moment.module.css";

function FietsMomentContent({ embedded = false }: { embedded?: boolean }) {
  const moment = fietsVoorbeeld;

  return (
    <>
        <article className={styles.hero}>
          <div className={styles.heroTop}>
            <p className={styles.badge}>{moment.badge}</p>
            <p className={styles.context}>{moment.context}</p>
          </div>
          <div className={styles.heroMain}>
            <div>
              <h1>
                {embedded ? <span className={styles.exampleTitle}>Voorbeeld · fictief</span> : null}
                {moment.title}
              </h1>
              <p className={styles.window}>{moment.window}</p>
              <p className={styles.reason}>{moment.explanation}</p>
            </div>
            <p className={styles.score} aria-label={`Sportscore ${moment.score} van 100`}>
              <strong>{moment.score}</strong>
              <span>/100</span>
              <b>SPORTSCORE</b>
            </p>
          </div>
          <h2 className={styles.factorsTitle}>{moment.factorsTitle}</h2>
          <ul className={styles.metrics}>
            {moment.factors.map((factor) => (
              <li key={factor.id}>
                <img src={factor.icon} alt="" width={28} height={28} />
                <div>
                  <span>{factor.label}</span>
                  <p>
                    <strong>{factor.value}</strong>
                    <small>{factor.note}</small>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <section className={styles.curve} aria-labelledby="dagcurve">
          <h2 id="dagcurve">{moment.curveTitle}</h2>
          <FietsScoreCurve />
        </section>

        <section className={styles.uv} aria-label={moment.uvTitle}>
          <img src="/weather/uv.svg" alt="" width={34} height={34} />
          <div>
            <h2>{moment.uvTitle}</h2>
            <p>{moment.uvNote}</p>
          </div>
        </section>

        <section className={styles.alternatives} aria-labelledby="alternatieven">
          <h2 id="alternatieven">{moment.alternativesTitle}</h2>
          <ul>
            {moment.alternatives.map((item) => (
              <li key={item.window}>
                <span>{item.window}</span>
                <b>{item.score}</b>
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.safety}>
          <img src="/weather/safety.svg" alt="" width={28} height={28} />
          <span>{moment.safety}</span>
        </p>

        <p className={styles.safety}>Sponsorvermelding en producttips volgen het contract op het sportmoment, niet dit vaste voorbeeld.</p>
    </>
  );
}

export function FietsMomentPage({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    return (
      <div className={`${styles.embed} ${styles.shell}`}>
        <FietsMomentContent embedded />
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.shell}`}>
      <a className="skip-link" href="#inhoud">
        Naar inhoud
      </a>
      <SiteHeaderBar />
      <main id="inhoud" className={styles.main}>
        <FietsMomentContent />
      </main>
    </div>
  );
}
