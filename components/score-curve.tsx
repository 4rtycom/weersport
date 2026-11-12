import { parseSportTimestamp } from "@/lib/data/time";
import type { HourlyScorePoint } from "@/lib/data/types";

const AMSTERDAM = "Europe/Amsterdam";

function hourOf(iso: string) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: AMSTERDAM }).format(
      parseSportTimestamp(iso),
    ),
  );
}

function formatHour(iso: string) {
  return `${String(hourOf(iso)).padStart(2, "0")}:00`;
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", timeZone: AMSTERDAM }).format(parseSportTimestamp(iso));
}

export function ScoreCurve({
  hourly,
  peakTime,
  tooltip,
}: {
  hourly: HourlyScorePoint[];
  peakTime: string;
  tooltip: string;
}) {
  if (hourly.length === 0) return null;

  const width = 640;
  const height = 260;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 40;
  const padBottom = 62;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const maxScore = Math.max(100, ...hourly.map((point) => point.score));
  const baseline = padTop + plotH;

  const coords = hourly.map((point, index) => {
    const x = padLeft + (hourly.length === 1 ? plotW / 2 : (index / (hourly.length - 1)) * plotW);
    const y = padTop + plotH - (point.score / maxScore) * plotH;
    return { ...point, x, y };
  });

  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)!.x.toFixed(1)} ${baseline.toFixed(1)} L${coords[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`;
  const peak = coords.reduce((best, point) => (point.score > best.score ? point : best), coords[0]);
  const peakFromProp = coords.find((point) => point.time === peakTime) ?? peak;

  // A tick every six hours keeps the axis readable for a 48-hour run; short runs label every point they can.
  const step = coords.length > 30 ? 6 : coords.length > 14 ? 3 : coords.length > 8 ? 2 : 1;
  const ticks = coords.filter((point, index) => (step === 1 ? true : hourOf(point.time) % step === 0) || index === 0);
  // Labels need about 70 units each at phone size; drop the ones that would collide.
  const spaced = ticks.reduce<typeof ticks>((kept, point) => {
    if (kept.length === 0 || point.x - kept[kept.length - 1].x >= 72) kept.push(point);
    return kept;
  }, []);
  const gridScores = [50, 100];
  const peakLabelX = Math.min(Math.max(peakFromProp.x, padLeft + 22), width - padRight - 22);

  return (
    <figure className="score-curve" title={tooltip}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={tooltip} className="score-curve-svg">
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d6fa63" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#d6fa63" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridScores.map((score) => {
          const y = padTop + plotH - (score / maxScore) * plotH;
          return (
            <g key={score}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="score-curve-grid" />
              <text x={padLeft - 10} y={y + 5} textAnchor="end" className="score-curve-label">
                {score}
              </text>
            </g>
          );
        })}
        <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} className="score-curve-axis" />
        <path d={area} fill="url(#scoreFill)" />
        <path d={line} fill="none" stroke="#d6fa63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <line
          x1={peakFromProp.x}
          x2={peakFromProp.x}
          y1={peakFromProp.y}
          y2={baseline}
          className="score-curve-peak-line"
        />
        <circle cx={peakFromProp.x} cy={peakFromProp.y} r="7" fill="#d6fa63" stroke="#102d36" strokeWidth="3" />
        <text x={peakLabelX} y={Math.max(peakFromProp.y - 14, 16)} textAnchor="middle" className="score-curve-peak">
          {Math.round(peakFromProp.score)}
        </text>
        {spaced.map((point, index) => {
          const newDay = index === 0 || hourOf(point.time) === 0;
          return (
            <text key={point.time} x={point.x} y={baseline + 24} textAnchor="middle" className="score-curve-label">
              {formatHour(point.time)}
              {newDay ? (
                <tspan x={point.x} dy="1.15em" className="score-curve-day">
                  {formatDay(point.time)}
                </tspan>
              ) : null}
            </text>
          );
        })}
      </svg>
      <figcaption className="visually-hidden">{tooltip}</figcaption>
    </figure>
  );
}
