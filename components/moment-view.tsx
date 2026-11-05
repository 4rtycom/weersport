import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SportIcon } from "@/components/sport-icon";
import { UvBadge } from "@/components/uv-badge";
import type { ForecastSnapshot } from "@/lib/data/types";
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

export function MomentView({ snapshot, accountName }: { snapshot: ForecastSnapshot; accountName: string }) {
  const sport = findSport(snapshot.sportId);
  const weather = snapshot.weather.value;
  const uv = snapshot.uv.value;
  const noScore = snapshot.suitability.kind === "NO_SCORE";

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
              <p className="moment-account">Ingelogd als {accountName}. Deze laadactie boekt geen analyse.</p>
            </div>
          </div>
          <p className={`moment-live-badge ${snapshot.weather.demo ? "is-demo" : "is-live"}`}>
            {snapshot.weather.demo || snapshot.weather.status !== "READY"
              ? "Geen live weerscore · bronstatus hieronder"
              : "Live weeradapter · geen gevalideerde sportscore"}
          </p>
        </section>

        <div className="moment-grid">
          <article className="moment-card">
            <p className="eyebrow">{noScore ? "Sportgeschiktheid · NO_SCORE" : "Sportgeschiktheid · fase 04"}</p>
            <h2>{noScore ? "NO_SCORE" : "Nog geen gevalideerde score"}</h2>
            <p>{snapshot.suitability.reason}</p>
            <div className="moment-note">
              <strong>Broncontrole</strong>
              <span>
                Officiële waarschuwingen en UV staan los van elke score. Testdata wordt nooit als live getoond.
              </span>
            </div>
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
          </aside>
        </div>

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
