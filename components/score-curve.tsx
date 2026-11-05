import type { HourlyScorePoint } from "@/lib/data/types";
import { formatHour } from "@/lib/forecast-time";

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
  const height = 220;
  const padX = 24;
  const padTop = 28;
  const padBottom = 36;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const maxScore = Math.max(100, ...hourly.map((point) => point.score));

  const coords = hourly.map((point, index) => {
    const x = padX + (hourly.length === 1 ? plotW / 2 : (index / (hourly.length - 1)) * plotW);
    const y = padTop + plotH - (point.score / maxScore) * plotH;
    return { ...point, x, y };
  });

  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)!.x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;
  const peak = coords.reduce((best, point) => (point.score > best.score ? point : best), coords[0]);
  const peakFromProp = coords.find((point) => point.time === peakTime) ?? peak;
  const labels = [coords[0], coords[Math.floor(coords.length / 2)], coords.at(-1)!].filter(Boolean);

  return (
    <figure className="score-curve" title={tooltip}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={tooltip} className="score-curve-svg">
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d6fa63" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#d6fa63" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#scoreFill)" />
        <path d={line} fill="none" stroke="#d6fa63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={peakFromProp.x} cy={peakFromProp.y} r="8" fill="#d6fa63" stroke="#ffffff" strokeWidth="3" />
        {labels.map((point) => (
          <text
            key={point.time}
            x={point.x}
            y={height - 10}
            textAnchor="middle"
            className="score-curve-label"
          >
            {formatHour(point.time)}
          </text>
        ))}
      </svg>
      <figcaption className="visually-hidden">{tooltip}</figcaption>
    </figure>
  );
}
