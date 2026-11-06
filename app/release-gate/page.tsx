import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RELEASE_NO_GO, RELEASE_QA_CARDS } from "@/lib/release/matrix";

export const metadata = {
  title: "Release gate",
  robots: { index: false, follow: false },
};

export default function ReleaseGatePage() {
  return (
    <>
      <section className="release-hero">
        <SiteHeader />
        <div className="release-hero-copy">
          <p className="eyebrow">H06 / UAT, regression & release approval</p>
          <h1>Niet alleen mooi. Aantoonbaar correct.</h1>
          <p>
            Release is geblokkeerd zolang P0 veiligheids-, betalings-, privacy- of authenticatieproblemen openstaan.
            Figma <code>314:8</code> · Phase 08.
          </p>
        </div>
      </section>

      <main className="release-main" id="inhoud">
        <p className="release-section-label">01 / Verplichte UAT-matrix</p>
        <div className="release-grid">
          {RELEASE_QA_CARDS.map((card, index) => (
            <article key={card.id} className={`release-card ${index % 2 === 0 ? "is-tint" : ""}`}>
              <div className="release-card-top">
                <span className="release-p0">P0</span>
                <h2>{card.title}</h2>
              </div>
              <p>{card.criteria}</p>
              <p className="release-status">Status: {card.status.replaceAll("_", " ")}</p>
              <p className="release-evidence">{card.evidence}</p>
            </article>
          ))}
        </div>

        <p className="release-section-label">02 / Prioriteiten, evidence & sign-off</p>
        <section className="release-nogo" aria-labelledby="nogo-title">
          <h2 id="nogo-title">GO / NO-GO — geen automatische goedkeuring</h2>
          <ul>
            {RELEASE_NO_GO.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>Totdat opgelost: geen live release.</p>
        </section>

        <section className="release-evidence-box" aria-labelledby="evidence-title">
          <h2 id="evidence-title">Elke Cursor-fase levert bewijs</h2>
          <p>
            Pull request / wijzigingslijst · Figma node-ID&apos;s · screenshots 390 en 1440 · tests + resultaten ·
            bekende issues · rollbackplan · expliciete reviewbeslissing.
          </p>
          <p className="release-status-lime">
            Codefase 01–08: geautomatiseerde checks aanwezig · productie-GO blijft menselijke review
          </p>
          <p>
            Bewijsdocument: <code>docs/phase08-release-gate.md</code> · <Link href="/support">support</Link> ·{" "}
            <Link href="/api/health">/api/health</Link>.
          </p>
        </section>
      </main>
    </>
  );
}
