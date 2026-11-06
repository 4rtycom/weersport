import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page" id="inhoud">
      <a className="skip-link" href="#auth-form">
        Naar formulier
      </a>
      <section className="auth-shell">
        <aside className="auth-story">
          <Link className="auth-wordmark" href="/">
            WeerSport.
          </Link>
          <p className="auth-badge">Jouw buitensport. Jouw moment.</p>
          <h2>Plan slimmer. Sport op het beste moment.</h2>
          <p className="auth-story-copy">
            Krijg weerinzichten die aansluiten bij jouw buitensport. Allemaal voor locaties in Nederland.
          </p>
          <figure className="auth-chart">
            <img src="/auth/hourly-trend.svg" alt="" width={409} height={200} />
            <figcaption>Sportgerichte weersgeschiktheid · demonstratie</figcaption>
          </figure>
          <p className="auth-story-foot">WeerSport · Alleen Nederland</p>
        </aside>
        <div className="auth-canvas">
          <p className="auth-kicker">Alles begint met jouw sport</p>
          <div className="auth-body" id="auth-form" tabIndex={-1}>
            {children}
          </div>
          <p className="auth-footnote">Je gegevens blijven privé. Geen zoekopdracht wordt uitgevoerd vóór je inlogt.</p>
        </div>
      </section>
    </main>
  );
}
