import { ScoreCurve } from "@/components/score-curve";
import type { LiveMoment } from "@/lib/live";
import { clock, dayLabel } from "@/lib/format-time";

function round(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}${suffix}`;
}

/** A real best moment from the live forecast, in the same shape as the homepage example card. */
export function LiveMomentCard({ moment, showCurve = false, headingLevel = 3 }: { moment: LiveMoment; showCurve?: boolean; headingLevel?: 2 | 3 }) {
  const day = dayLabel(moment.windowStart, moment.generatedAt);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const peak = moment.peakHour;
  return (
    <article className="signature live-card" aria-labelledby={`live-${moment.sportId}`}>
      <div className="signature-top">
        <p className="demo-badge live-badge">
          <span aria-hidden="true" className="live-dot" />
          Live
        </p>
        <p className="signature-context">
          {moment.sportName} · {moment.placeLabel}
        </p>
      </div>
      <div className="signature-heading">
        <div>
          <Heading id={`live-${moment.sportId}`}>Beste moment voor {moment.sportName.toLowerCase()}</Heading>
          <p className="window">
            {day ? <span className="live-day">{day}</span> : null}
            {moment.windowLabel}
          </p>
          <p className="reason">{moment.bestTimeLabel}.</p>
        </div>
        <p className="score" aria-label={`Sportscore ${moment.peakScore} van 100`}>
          <span>{moment.peakScore}</span>
          <small>/100</small>
          <b>Sportscore</b>
        </p>
      </div>
      <p className="section-kicker">Het weer op het beste uur</p>
      <ul className="metrics">
        <li>
          <img src="/weather/temperature.svg" alt="" width={28} height={28} />
          <span>Temperatuur</span>
          <strong>{round(peak?.temperatureC, "°C")}</strong>
        </li>
        <li>
          <img src="/weather/wind.svg" alt="" width={28} height={28} />
          <span>Wind</span>
          <strong>{round(peak?.windKmh, " km/u")}</strong>
        </li>
        <li>
          <img src="/weather/rain.svg" alt="" width={28} height={28} />
          <span>Regenkans</span>
          <strong>{round(peak?.precipitationProbability, "%")}</strong>
        </li>
      </ul>
      {moment.uv.index !== null ? (
        <div className="uv-alert">
          <img src="/weather/uv.svg" alt="" width={34} height={34} />
          <div>
            <strong>
              UV-index {Math.round(moment.uv.index)}, {moment.uv.label.toLowerCase()}
            </strong>
            <p>Hoogste UV in de komende 48 uur. Telt niet mee in de score.</p>
          </div>
        </div>
      ) : null}
      {showCurve ? <ScoreCurve hourly={moment.hourly} peakTime={moment.peakHour?.time ?? moment.windowStart} tooltip={moment.tooltip} /> : null}
      {moment.alternatives.length > 0 ? (
        <>
          <p className="section-kicker">Andere goede momenten</p>
          <ul className="alternatives">
            {moment.alternatives.map((alt) => (
              <li key={alt.start}>
                <span>
                  {dayLabel(alt.start, moment.generatedAt)} {clock(alt.start)}
                </span>
                <b>{alt.score}/100</b>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="live-updated">
        Bijgewerkt om {clock(moment.generatedAt)} · Open-Meteo. Geen veiligheidsgarantie; UV en waarschuwingen staan los van
        de score.
      </p>
    </article>
  );
}
