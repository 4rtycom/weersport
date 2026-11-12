import Link from "next/link";
import { SaveActions } from "@/components/account/save-actions";
import { AdsHost } from "@/components/ads/ads-host";
import { AffiliateTip } from "@/components/affiliate-tip";
import { SportSponsors } from "@/components/sport-sponsors";
import commercial from "@/components/commercial.module.css";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { ScoreCurve } from "@/components/score-curve";
import { SportIcon } from "@/components/sport-icon";
import { UvBadge } from "@/components/uv-badge";
import type { AdDecision } from "@/lib/ads/policy";
import type { AffiliateTip as AffiliateTipData } from "@/lib/affiliate/select";
import type { PublicSponsor } from "@/lib/sponsoring/directory";
import type { ForecastSnapshot } from "@/lib/data/types";
import { parseSportTimestamp } from "@/lib/data/time";
import { getSportMeta } from "@/lib/scoring/engine";
import { findSport } from "@/lib/sports";

const AMSTERDAM = "Europe/Amsterdam";

function formatMetric(value: number | null, suffix: string) {
  if (value === null || Number.isNaN(value)) return "—";
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}${suffix}`;
}

/** Plain Dutch for the reader; the enum stays in the class name for styling and tests. */
function statusLabel(status: string) {
  switch (status) {
    case "READY":
      return "Actueel";
    case "PARTIAL":
      return "Gedeeltelijk";
    case "STALE":
      return "Verouderd";
    case "MISSING_CRITICAL":
      return "Ontbreekt";
    case "TEST_ONLY":
      return "Testdata";
    case "OFFICIAL_WARNING":
      return "Waarschuwing actief";
    case "NOT_COVERED":
      return "Geen dekking";
    case "ERROR":
      return "Storing";
    default:
      return "Nog niet gekoppeld";
  }
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AMSTERDAM }).format(date);
}

/** "vandaag", "morgen" or the weekday, so a 48-hour answer says which day it means. */
function dayLabel(iso: string, nowIso: string) {
  const when = parseSportTimestamp(iso);
  const now = new Date(nowIso);
  if (Number.isNaN(when.getTime()) || Number.isNaN(now.getTime())) return "";
  if (dayKey(when) === dayKey(now)) return "Vandaag";
  if (dayKey(when) === dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return "Morgen";
  const weekday = new Intl.DateTimeFormat("nl-NL", { weekday: "long", timeZone: AMSTERDAM }).format(when);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatStamp(iso: string | null | undefined) {
  if (!iso) return "tijd onbekend";
  const when = parseSportTimestamp(iso);
  if (Number.isNaN(when.getTime())) return iso;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AMSTERDAM,
  }).format(when);
}

function formatUv(index: number) {
  return index % 1 === 0 ? index.toFixed(0) : index.toFixed(1);
}

const badgeLabels = { GOED: "Goed", MATIG: "Matig", SLECHT: "Slecht" } as const;

const uvSteps = [
  { index: 1, level: "laag", label: "Laag" },
  { index: 4, level: "matig", label: "Matig" },
  { index: 6, level: "hoog", label: "Hoog" },
  { index: 9, level: "zeer-hoog", label: "Zeer hoog" },
  { index: 11, level: "extreem", label: "Extreem" },
] as const;

function dutchState(status: string) {
  switch (status) {
    case "READY":
    case "OFFICIAL_WARNING":
      return "actueel";
    case "PARTIAL":
      return "gedeeltelijk";
    case "STALE":
      return "verouderd";
    case "NOT_COVERED":
      return "geen dekking";
    default:
      return "niet beschikbaar";
  }
}

export function MomentView({
  snapshot,
  accountName,
  entitlement = null,
  booking = null,
  ads = null,
  commercialBlocks = null,
  consentGranted = false,
}: {
  snapshot: ForecastSnapshot;
  accountName: string;
  entitlement?: { plan: string; used: number; limit: number; remaining: number } | null;
  booking?: { booked: boolean; consumed: number; cacheHit: boolean } | null;
  ads?: { decision: AdDecision; scriptEnabled: boolean } | null;
  commercialBlocks?: { affiliate: AffiliateTipData | null; sponsors: PublicSponsor[] } | null;
  consentGranted?: boolean;
}) {
  const sport = findSport(snapshot.sportId);
  const meta = getSportMeta(snapshot.sportId);
  const weather = snapshot.weather.value;
  const uv = snapshot.uv.value;
  const suitability = snapshot.suitability;
  const noScore = suitability.kind === "NO_SCORE" ? suitability : null;
  const scored = suitability.kind === "SCORED" ? suitability : null;
  const nextSport = meta.nextSportId ? findSport(meta.nextSportId) : null;
  const uvKnown = uv && uv.index !== null ? { index: uv.index, level: uv.level, label: uv.label } : null;
  const peakDay = scored ? dayLabel(scored.peakWindow.start, snapshot.generatedAt) : "";
  const peakClock = scored ? scored.peakWindow.label.replace(/^Beste moment\s*·\s*/, "") : "";
  const airReadings = snapshot.airQuality?.value?.readings ?? [];
  const usageLine = [
    `Ingelogd als ${accountName}.`,
    booking
      ? booking.cacheHit
        ? "Dit advies was al opgehaald en telt niet opnieuw mee."
        : booking.booked
          ? "Dit advies telt als één analyse."
          : "Dit advies kost geen analyse."
      : "",
    entitlement
      ? `${entitlement.plan === "pro" ? "Pro" : "Basis"}: ${entitlement.used} van ${entitlement.limit} analyses gebruikt.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <SiteHeaderBar account />
      <main id="inhoud" className="moment">
        <section className="moment-hero">
          <div className="moment-hero-copy">
            <span className="icon-badge icon-badge-lg moment-icon">
              <SportIcon src={sport.icon} size={32} />
            </span>
            <div>
              <h1>
                {snapshot.sportName} in {snapshot.placeLabel}
              </h1>
              <p>{snapshot.period}</p>
              <Link className="moment-hero-link" href={`/sporten/${sport.id}`}>
                Hoe werkt het advies voor {sport.name.toLowerCase()}?
              </Link>
            </div>
          </div>
          <p className={`moment-live-badge ${snapshot.weather.demo ? "is-demo" : "is-live"}`}>
            {scored
              ? "Live weerdata"
              : snapshot.weather.demo || snapshot.weather.status !== "READY"
                ? "Geen live weerdata"
                : "Live weer, nog geen score"}
          </p>
        </section>

        <div className="moment-grid">
          <article className="moment-card moment-score-card" data-state={scored ? "SCORED" : "NO_SCORE"}>
            {scored ? (
              <>
                <p className="eyebrow">Beste moment voor {sport.name.toLowerCase()}</p>
                <div className="answer">
                  <div>
                    <p className="answer-window">
                      {peakDay ? <span>{peakDay}</span> : null}
                      {peakClock}
                    </p>
                    <p className="answer-reason" title={scored.tooltip}>
                      {meta.tagline}. {scored.bestTimeLabel}.
                    </p>
                  </div>
                  <p className="answer-score" aria-label={`Score ${scored.peakWindow.peakScore} van 100 in dit tijdvak`}>
                    <strong>{scored.peakWindow.peakScore}</strong>
                    <span>/100</span>
                  </p>
                </div>
                <p className="answer-now">
                  <span className={`score-badge score-badge-${scored.badge.toLowerCase()}`}>
                    {badgeLabels[scored.badge]}
                  </span>
                  <span>
                    Op dit moment: <strong>{scored.score}/100</strong>
                  </span>
                </p>
                <p className="moment-rights">{scored.caveats} UV en officiële waarschuwingen blijven los van deze score.</p>
                {snapshot.safety && snapshot.safety.level !== "NONE_IN_WINDOW" ? (
                  <p className="moment-rights">{snapshot.safety.summary} De comfortscore is geen veiligheidsgoedkeuring.</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="eyebrow">Sportgeschiktheid</p>
                <h2>Nog geen score voor {sport.name.toLowerCase()}</h2>
                <p>{noScore?.reason ?? "Geen score beschikbaar."}</p>
                {noScore?.missing && noScore.missing.length > 0 ? (
                  <>
                    <p className="score-missing-label">Dit ontbreekt nog:</p>
                    <ul className="score-missing">
                      {noScore.missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <div className="moment-note">
                  <strong>Broncontrole</strong>
                  <span>
                    Officiële waarschuwingen en UV staan los van elke score. Testdata wordt nooit als live getoond.
                  </span>
                </div>
              </>
            )}
            <p className="moment-usage">{usageLine}</p>
          </article>

          {commercialBlocks?.affiliate || (commercialBlocks?.sponsors.length ?? 0) > 0 ? (
            <div className={`${commercial.stack} ${commercial.compact} moment-offer`}>
              {commercialBlocks?.affiliate ? (
                <AffiliateTip tip={commercialBlocks.affiliate} sportId={snapshot.sportId} measure={consentGranted} />
              ) : null}
              <SportSponsors sponsors={commercialBlocks?.sponsors ?? []} />
            </div>
          ) : null}

          <aside className="moment-card moment-safety" aria-label="Zon en veiligheid">
            <p className="eyebrow">Zon &amp; veiligheid</p>
            <ul className="safety-list">
              <li className={`uv-badge-${uvKnown?.level ?? "missing"}`}>
                <img src="/weather/uv.svg" alt="" width={24} height={24} />
                <span>{uvKnown ? `UV-index ${formatUv(uvKnown.index)}, ${uvKnown.label.toLowerCase()}` : "UV niet beschikbaar"}</span>
              </li>
              <li>
                <img src="/weather/safety.svg" alt="" width={24} height={24} />
                <span>{snapshot.warnings.message}</span>
              </li>
            </ul>
            {!scored && nextSport ? (
              <Link className="button button-lime moment-next-sport" href={`/?sport=${nextSport.id}#planner`}>
                Probeer {nextSport.name.toLowerCase()}
              </Link>
            ) : null}
          </aside>
        </div>

        {scored ? (
          <section className="moment-card" aria-label="Scoreverloop en factoren">
            <p className="eyebrow">Verloop per uur</p>
            <h2>Zo verandert de score</h2>
            <ScoreCurve hourly={scored.hourly} peakTime={scored.peakWindow.peakTime} tooltip={scored.tooltip} />
            <h3 className="moment-subhead">Wat het zwaarst weegt</h3>
            <ul className="score-factors factor-list">
              {scored.factors.map((factor) => (
                <li key={factor.id}>
                  <div>
                    <strong>{factor.label}</strong>
                    <span>{factor.explanation}</span>
                    <span className="factor-meter" aria-hidden="true">
                      <i style={{ width: `${Math.max(0, Math.min(100, factor.impact))}%` }} />
                    </span>
                  </div>
                  <em aria-label={`${factor.impact} van 100`}>
                    {factor.impact}
                    <small>/100</small>
                  </em>
                </li>
              ))}
            </ul>
            {nextSport ? (
              <Link className="button button-ghost moment-next-sport" href={`/?sport=${nextSport.id}#planner`}>
                Bekijk ook {nextSport.name.toLowerCase()}
              </Link>
            ) : null}
          </section>
        ) : null}

        <section className="moment-card" aria-labelledby="bewaar-title">
          <h2 id="bewaar-title">Bewaar dit sportmoment</h2>
          <p>
            Opslaan kost geen analyses. Een opgeslagen plan is geen live veiligheidsgarantie; oude analyses tonen hun
            leeftijd.
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
        </section>

        <section className="moment-card" aria-labelledby="weer-title">
          <p className="eyebrow">Bron: Open-Meteo</p>
          <h2 id="weer-title">Het weer nu</h2>
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
          <h2 id="uv-classes">
            {uvKnown ? `UV-index ${formatUv(uvKnown.index)}, ${uvKnown.label.toLowerCase()}` : "UV-index niet beschikbaar"}
          </h2>
          <p>Hoogste UV in het gekozen tijdvak. Bescherm huid en ogen vanaf UV 3.</p>
          <ol className="uv-scale" aria-label="UV-risicoklassen">
            {uvSteps.map((step) => (
              <li key={step.level} className={uvKnown?.level === step.level ? "is-current" : undefined}>
                <UvBadge uv={step} />
                {uvKnown?.level === step.level ? <span className="visually-hidden">Geldt nu</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="moment-card" aria-labelledby="waarschuwingen-title">
          <p className="eyebrow">Bron: KNMI</p>
          <h2 id="waarschuwingen-title">Officiële waarschuwingen</h2>
          <p className="moment-source-line">
            {dutchState(snapshot.warnings.status)} · {snapshot.warnings.message}
          </p>
          {snapshot.warnings.value?.items.length ? (
            <ul className="score-factors warning-list">
              {snapshot.warnings.value.items.map((item) => (
                <li key={`${item.title}-${item.validFrom ?? ""}`} className={item.code ? `warning-${item.code}` : undefined}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                    <span>
                      {formatStamp(item.validFrom)} – {formatStamp(item.validUntil)}
                      {item.attribution ? ` · ${item.attribution}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {["zeilen", "windsurfen", "kitesurfen", "surfen", "suppen", "kajakken", "roeien", "openwaterzwemmen"].includes(snapshot.sportId) ? (
          <section className="moment-card" aria-labelledby="water-title">
            <p className="eyebrow">Bron: Rijkswaterstaat</p>
            <h2 id="water-title">Watercondities</h2>
            <p className="moment-source-line">
              {dutchState(snapshot.water.status)} · {snapshot.water.message}
            </p>
            <ul className="moment-metrics">
              {(snapshot.water.value?.readings ?? []).map((reading) => (
                <li key={reading.parameter}>
                  <span>{reading.label}</span>
                  <strong>{formatMetric(reading.value, reading.unit ? ` ${reading.unit}` : "")}</strong>
                  <span>
                    Gemeten bij {reading.stationLabel}
                    {reading.observedAt ? `, ${formatStamp(reading.observedAt)}` : ""}
                    {reading.distanceKm !== null ? `, ${reading.distanceKm.toFixed(1)} km` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="moment-rights">{snapshot.water.rightsNote}</p>
          </section>
        ) : null}

        {airReadings.length > 0 ? (
        <section className="moment-card" aria-labelledby="lucht-title">
          <p className="eyebrow">Bron: Luchtmeetnet</p>
          <h2 id="lucht-title">Luchtkwaliteit</h2>
          <p className="moment-source-line">
            {dutchState(snapshot.airQuality?.status ?? "NOT_LINKED")} · {snapshot.airQuality?.message ?? "Niet beschikbaar."}
          </p>
          <ul className="moment-metrics">
            {airReadings.map((reading) => (
              <li key={reading.formula}>
                <span>{reading.formula}</span>
                <strong>{reading.value === null ? "—" : formatMetric(reading.value, reading.unit ? ` ${reading.unit}` : "")}</strong>
                <span>
                  {reading.stationLabel ? `${reading.stationLabel}` : "geen station"}
                  {reading.stationType ? ` · ${reading.stationType}` : ""}
                  {reading.distanceKm !== null ? ` · ${reading.distanceKm.toFixed(1)} km` : ""}
                  {reading.observedAt ? ` · ${formatStamp(reading.observedAt)}` : ""}
                  {reading.value !== null ? ` · ${reading.fresh ? "actueel" : "verouderd"}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="moment-rights">{snapshot.airQuality?.value?.note ?? snapshot.airQuality?.rightsNote}</p>
        </section>
        ) : null}

        <details className="moment-card moment-details">
          <summary>
            <h2 id="bronnen-title">Bronnen en actualiteit</h2>
            <span>Waar de gegevens vandaan komen en hoe vers ze zijn</span>
          </summary>
          <h3 className="moment-subhead" id="actualiteit-title">
            Laatst bijgewerkt
          </h3>
          <ul className="source-list">
            {[snapshot.warnings, snapshot.water, snapshot.airQuality, snapshot.uv].filter((item) => item).map((item) => (
              <li key={item!.sourceId}>
                <div>
                  <strong>{item!.sourceLabel}</strong>
                  <span>
                    {dutchState(item!.status)}
                    {item!.publishedAt ? ` · gepubliceerd ${formatStamp(item!.publishedAt)}` : ""}
                    {item!.locationLabel ? ` · ${item!.locationLabel}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <h3 className="moment-subhead">Status per bron</h3>
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
          {scored ? <p className="moment-rights">Scoremodel {scored.modelVersion}.</p> : null}
        </details>

        {ads ? (
          <AdsHost
            decision={ads.decision}
            scriptEnabled={ads.scriptEnabled}
            hideWhenBlocked={false}
          />
        ) : null}

        <p className="moment-foot">
          <Link className="button button-dark" href="/#planner">
            Nieuwe zoekopdracht
          </Link>
          <Link className="button button-ghost" href="/account/momenten">
            Mijn sportmomenten
          </Link>
        </p>
      </main>
    </>
  );
}
