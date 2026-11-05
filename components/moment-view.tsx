import Link from "next/link";
import { SaveActions } from "@/components/account/save-actions";
import { SiteHeader } from "@/components/site-header";
import { ScoreCurve } from "@/components/score-curve";
import { SportIcon } from "@/components/sport-icon";
import { UvBadge } from "@/components/uv-badge";
import type { ForecastSnapshot } from "@/lib/data/types";
import { getSportMeta } from "@/lib/scoring/engine";
import { findSport } from "@/lib/sports";

function formatMetric(value: number | null, suffix: string) {
  if (value === null || Number.isNaN(value)) return "—";
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}${suffix}`;
}

function statusLabel(status: string) {
  switch (status) {
    case "READY":
      return "READY";
    case "PARTIAL":
      return "PARTIAL";
    case "STALE":
      return "STALE";
    case "MISSING_CRITICAL":
      return "MISSING_CRITICAL";
    case "TEST_ONLY":
      return "TEST_ONLY";
    case "OFFICIAL_WARNING":
      return "OFFICIAL_WARNING";
    default:
      return "NOT_LINKED";
  }
}

export function MomentView({
  snapshot,
  accountName,
  entitlement = null,
  booking = null,
}: {
  snapshot: ForecastSnapshot;
  accountName: string;
  entitlement?: { plan: string; used: number; limit: number; remaining: number } | null;
  booking?: { booked: boolean; consumed: number; cacheHit: boolean } | null;
}) {
  const sport = findSport(snapshot.sportId);
  const meta = getSportMeta(snapshot.sportId);
  const weather = snapshot.weather.value;
  const uv = snapshot.uv.value;
  const suitability = snapshot.suitability;
  const noScore = suitability.kind === "NO_SCORE" ? suitability : null;
  const scored = suitability.kind === "SCORED" ? suitability : null;
  const nextSport = meta.nextSportId ? findSport(meta.nextSportId) : null;

  return (
    <>
      <header className="moment-top">
        <SiteHeader account />
      </header>
      <main id="inhoud" className="moment">
        <p className="eyebrow">{`Sportmoment · ${sport.name}`}</p>
        <section className="moment-hero">
          <div className="moment-hero-copy">
            <span className="icon-badge icon-badge-lg moment-icon">
              <SportIcon src={sport.icon} size={32} />
            </span>
            <div>
              <h1>{snapshot.sportName}</h1>
              <p>
                {snapshot.placeLabel}, Nederland · {snapshot.period}
              </p>
              <p className="moment-account">
                Ingelogd als {accountName}.
                {booking
                  ? booking.cacheHit
                    ? " Cachehit · geen extra verbruik."
                    : booking.booked
                      ? ` Nieuwe analyse geboekt (${booking.consumed}).`
                      : " Geen analyse verbruikt."
                  : " Boekingsstatus volgt onder."}
                {entitlement
                  ? ` ${entitlement.plan === "pro" ? "Pro" : "Basis"} ${entitlement.used}/${entitlement.limit}.`
                  : ""}
              </p>
            </div>
          </div>
          <p className={`moment-live-badge ${snapshot.weather.demo ? "is-demo" : "is-live"}`}>
            {scored
              ? `Live score · ${scored.modelVersion}`
              : snapshot.weather.demo || snapshot.weather.status !== "READY"
                ? "Geen live weerscore · bronstatus hieronder"
                : "Live weeradapter · geen sportscore"}
          </p>
        </section>

        <div className="moment-grid">
          <article className="moment-card moment-score-card">
            {scored ? (
              <>
                <p className="eyebrow">Sportgeschiktheid · {scored.modelVersion}</p>
                <div className="score-headline">
                  <div>
                    <p className="score-value" aria-label={`Score ${scored.score} van 100`}>
                      {scored.score}
                      <span>/100</span>
                    </p>
                    <p className={`score-badge score-badge-${scored.badge.toLowerCase()}`}>{scored.badge}</p>
                  </div>
                  <div className="score-peak">
                    <span>{scored.peakWindow.label}</span>
                    <strong>{scored.peakWindow.peakScore} / 100</strong>
                  </div>
                </div>
                <p className="score-tooltip" title={scored.tooltip}>
                  {meta.tagline}. {scored.bestTimeLabel}.
                </p>
                <ScoreCurve
                  hourly={scored.hourly}
                  peakTime={scored.peakWindow.peakTime}
                  tooltip={scored.tooltip}
                />
                <ul className="score-factors">
                  {scored.factors.map((factor) => (
                    <li key={factor.id}>
                      <div>
                        <strong>{factor.label}</strong>
                        <span>{factor.explanation}</span>
                      </div>
                      <em>{factor.impact}</em>
                    </li>
                  ))}
                </ul>
                <p className="moment-rights">{scored.caveats} UV en officiële waarschuwingen blijven los van deze score.</p>
              </>
            ) : (
              <>
                <p className="eyebrow">Sportgeschiktheid · NO_SCORE</p>
                <h2>NO_SCORE</h2>
                <p>{noScore?.reason ?? "Geen score beschikbaar."}</p>
                {noScore?.missing && noScore.missing.length > 0 ? (
                  <ul className="score-missing">
                    {noScore.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="moment-note">
                  <strong>Broncontrole</strong>
                  <span>
                    Officiële waarschuwingen en UV staan los van elke score. Testdata wordt nooit als live getoond.
                  </span>
                </div>
              </>
            )}
          </article>

          <aside className="moment-card moment-safety">
            <h2>Zon &amp; veiligheid</h2>
            <div className={`uv-panel uv-panel-${uv?.level ?? "missing"}`}>
              <p>
                {uv?.index === null || !uv
                  ? "UV niet beschikbaar"
                  : `UV ${uv.index % 1 === 0 ? uv.index.toFixed(0) : uv.index.toFixed(1)} · ${uv.label.toUpperCase()}`}
              </p>
              <span>Zonbescherming los van de sportscore.</span>
            </div>
            <div className="warning-panel">
              <p>Officiële weerwaarschuwingen</p>
              <strong>{snapshot.warnings.message}</strong>
            </div>
            {nextSport ? (
              <Link className="button button-lime moment-next-sport" href={`/?sport=${nextSport.id}#planner`}>
                Volgende sport · {nextSport.name}
              </Link>
            ) : null}
          </aside>
        </div>

        <section className="moment-card" aria-labelledby="bewaar-title">
          <p className="eyebrow">Opslaan zonder verbruik</p>
          <h2 id="bewaar-title">Bewaar dit sportmoment</h2>
          <p>
            Filters en plannen opslaan kost 0 aanvragen. Opgeslagen plannen zijn geen live veiligheidsgarantie; oude
            analyses tonen hun leeftijd.
          </p>
          <SaveActions
            sportId={snapshot.sportId}
            placeId={snapshot.placeId}
            placeLabel={snapshot.placeLabel}
            period={snapshot.period}
            peakLabel={scored?.peakWindow.label ?? scored?.bestTimeLabel ?? null}
            snapshotAt={snapshot.generatedAt}
            scoreLabel={scored ? `${scored.score}/100 · ${scored.badge}` : noScore ? "NO_SCORE" : null}
          />
          <p className="moment-save-link">
            <Link href="/account/momenten">Naar mijn sportmomenten</Link>
          </p>
        </section>

        <section className="moment-card" aria-labelledby="weer-title">
          <p className="eyebrow">Weeradapter · Open-Meteo</p>
          <h2 id="weer-title">Actuele weermetingen</h2>
          <p className="moment-source-line">{snapshot.weather.message}</p>
          <ul className="moment-metrics">
            <li>
              <span>Temperatuur</span>
              <strong>{formatMetric(weather?.temperatureC ?? null, "°C")}</strong>
            </li>
            <li>
              <span>Wind</span>
              <strong>{formatMetric(weather?.windKmh ?? null, " km/u")}</strong>
            </li>
            <li>
              <span>Regenkans</span>
              <strong>{formatMetric(weather?.precipitationProbability ?? null, "%")}</strong>
            </li>
          </ul>
          <p className="moment-rights">{snapshot.weather.rightsNote}</p>
        </section>

        <section className="moment-card" aria-labelledby="uv-classes">
          <p className="eyebrow">UV-index · universele weerfactor</p>
          <h2 id="uv-classes">UV-risicoklassen</h2>
          <div className="uv-scale">
            <UvBadge uv={{ index: 1, level: "laag", label: "Laag" }} />
            <UvBadge uv={{ index: 4, level: "matig", label: "Matig" }} />
            <UvBadge uv={{ index: 6, level: "hoog", label: "Hoog" }} />
            <UvBadge uv={{ index: 9, level: "zeer-hoog", label: "Zeer hoog" }} />
            <UvBadge uv={{ index: 11, level: "extreem", label: "Extreem" }} />
          </div>
          <div className="uv-sample">
            <img src="/uv/sun.svg" alt="" width={54} height={54} />
            <div>
              <strong>
                {uv?.index === null || !uv
                  ? "UV niet beschikbaar"
                  : `UV-index ${uv.index % 1 === 0 ? uv.index.toFixed(0) : uv.index.toFixed(1)} · ${uv.label}`}
              </strong>
              <p>Maximale UV in het geselecteerde sporttijdvak. Bescherming aanbevolen bij blootstelling.</p>
            </div>
          </div>
        </section>

        <section className="moment-card" aria-labelledby="bronnen-title">
          <p className="eyebrow">Officiële bronnen en coverage</p>
          <h2 id="bronnen-title">Bronstatus</h2>
          <ul className="source-list">
            {snapshot.sources.map((source) => (
              <li key={source.id}>
                <div>
                  <strong>{source.label}</strong>
                  <span>{source.message}</span>
                  <small>{source.rightsNote}</small>
                </div>
                <em className={`source-status source-status-${source.status.toLowerCase()}`}>
                  {statusLabel(source.status)}
                </em>
              </li>
            ))}
          </ul>
        </section>

        <p className="moment-foot">
          <Link href="/#planner">Andere zoekopdracht</Link>
          <Link href="/account">Mijn account</Link>
        </p>
      </main>
    </>
  );
}
