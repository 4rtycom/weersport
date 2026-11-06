import Link from "next/link";
import { ScoreCurve } from "@/components/score-curve";
import { SportIcon } from "@/components/sport-icon";
import styles from "@/app/sponsoring/partners.module.css";
import type { WeatherHour } from "@/lib/data/types";
import { getSportMeta, scoreSportHours } from "@/lib/scoring/engine";
import { getScoreProfile } from "@/lib/scoring/profiles";
import { findSport, periods } from "@/lib/sports";

/**
 * Fixed hardlopen hours. Temperatures, wind and rain follow the land-guide
 * fixture in lib/sport-guide-examples.ts (favorable morning, warmer afternoon).
 * Scores and factor text come from scoreSportHours, not from hand-written numbers.
 * Timestamps are in the past so the scorer keeps the whole sample and never
 * calls a weather, place or quota API.
 */
const FIXTURE_DAY = "2024-06-12";

function fixtureHour(utcHour: string, temperatureC: number, windKmh: number, rainPct: number): WeatherHour {
  return {
    time: `${FIXTURE_DAY}T${utcHour}:00.000Z`,
    temperatureC,
    windKmh,
    precipitationProbability: rainPct,
    uvIndex: null,
  };
}

function buildRunningFixture() {
  const profile = getScoreProfile("hardlopen");
  const midTemp = Math.round((profile.idealTempC[0] + profile.idealTempC[1]) / 2);
  const midWind = Math.round((profile.idealWindKmh[0] + profile.idealWindKmh[1]) / 2);
  const calmRain = 5;
  const warmTemp = Math.min(34, profile.idealTempC[1] + 8);
  const suitability = scoreSportHours({
    sportId: "hardlopen",
    waterLinked: false,
    swimLinked: false,
    hours: [
      fixtureHour("07:00", midTemp, midWind, calmRain),
      fixtureHour("08:00", midTemp + 1, midWind, calmRain),
      fixtureHour("09:00", Math.min(profile.idealTempC[1], midTemp + 3), midWind, calmRain),
      fixtureHour("12:00", warmTemp, midWind, calmRain),
    ],
  });
  if (suitability.kind !== "SCORED") {
    throw new Error("Hardlopen preview fixture did not score");
  }
  return suitability;
}

const scored = buildRunningFixture();

export function SponsoringRunningPreview() {
  const sport = findSport("hardlopen");
  const meta = getSportMeta(sport.id);

  return (
    <figure className={styles.preview}>
      <div className={styles.result}>
        <p className="eyebrow">Sportmoment · {sport.name}</p>
        <header className="moment-hero">
          <div className="moment-hero-copy">
            <span className="icon-badge icon-badge-lg moment-icon">
              <SportIcon src={sport.icon} size={32} />
            </span>
            <div>
              <h3>{sport.name}</h3>
              <Link href={`/sporten/${sport.id}`}>Hoe werkt het advies voor {sport.name.toLowerCase()}?</Link>
              <p>
                Ede, Nederland · {periods[0]}
              </p>
            </div>
          </div>
        </header>
        <article className={`moment-card ${styles.advice}`} aria-label="Sportadvies">
          <p className={styles.demoLabel}>Voorbeeld met demogegevens</p>
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
          <ScoreCurve hourly={scored.hourly} peakTime={scored.peakWindow.peakTime} tooltip={scored.tooltip} />
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
        </article>
      </div>
      <aside className={styles.partner} aria-label="Gesponsorde vermelding">
        <p className={styles.sponsored}>Gesponsord</p>
        <p className={styles.shop}>Loopatelier Ede</p>
        <h3>Welke schoen past bij jouw rondje?</h3>
        <p>Van asfalt tot heidepad. In onze winkel in Ede kun je verschillende hardloopschoenen passen en vergelijken.</p>
        <p className={styles.fictional}>Fictieve partner</p>
      </aside>
    </figure>
  );
}
