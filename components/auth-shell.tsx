import type { ReactNode } from "react";
import { SiteHeaderBar } from "@/components/site-header-bar";

/** Sign-in screens use the homepage hero: dark band with the promise, form card overlapping it. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-frame">
      <SiteHeaderBar />
      <main className="auth-page" id="inhoud">
        <div className="auth-layout">
          <aside className="auth-story">
            <p className="eyebrow eyebrow-lime">
              <img src="/home/lime-dot.svg" alt="" width={15} height={15} />
              Jouw buitensport. Jouw moment.
            </p>
            <h2>
              Plan slimmer.
              <br />
              <span>Sport op het beste moment.</span>
            </h2>
            <p className="auth-story-copy">
              Weerinzichten die passen bij jouw buitensport, voor elke plek in Nederland.
            </p>
            <ul className="auth-points">
              <li>24 buitensporten</li>
              <li>Gratis Basis-account</li>
              <li>Bewaren kost niets</li>
            </ul>
          </aside>
          <section className="auth-card">
            <div className="accent-strip" aria-hidden="true" />
            <div className="auth-body">{children}</div>
            <p className="auth-footnote">Je gegevens blijven privé. Er start geen zoekopdracht voordat je inlogt.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
