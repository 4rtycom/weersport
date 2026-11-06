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
            Figma <code>314:8</code> · Phase 08 matrix · Phase 7 evidence packs.
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
          <p>Totdat opgelost: geen live release. Productie-GO blijft menselijke review (Glenn).</p>
        </section>

        <section className="release-evidence-box" aria-labelledby="evidence-title">
          <h2 id="evidence-title">Phase 7 evidence & rollback</h2>
          <p>
            Per gate: commit, environment, datum, fixture/provider-ref, expected/actual, classificatie
            (static / automated / manual_uat / untested), reviewer, open defects, GO/NO-GO.
          </p>
          <p className="release-status-lime">
            Geautomatiseerde checks ≠ browser-UAT. Visuele en AT-checks vullen de packs handmatig.
          </p>
          <p>
            Runbook: <code>docs/phase7-release-evidence.md</code> · packs:{" "}
            <code>docs/phase7-evidence/</code> · kill switches via health{" "}
            <code>checks.capabilities</code>.
          </p>
          <p>
            Staging-only: <Link href="/ux-states">/ux-states</Link> · support voor klanten zonder
            staging-diagnostics.
          </p>
        </section>
      </main>
    </>
  );
}
