import { fietsCurve } from "@/lib/sponsoring/fiets-voorbeeld";
import styles from "@/app/sponsoring/voorbeeld/moment.module.css";

const label = "Sportscore door de dag van 06:00 tot 20:00. Het hoogste punt is 10:00.";

export function FietsScoreCurve({ prominent = false }: { prominent?: boolean }) {
  const { width, height, line, area, band, peak, hours } = fietsCurve;

  return (
    <figure className={prominent ? `${styles.curveFigure} ${styles.curveProminent}` : styles.curveFigure}>
      <svg
        className={prominent ? styles.curveSvgTall : styles.curveSvg}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id="fiets-curve-fill" x1="16" y1="30.4" x2="16" y2="137" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C4F256" stopOpacity="0.35" />
            <stop offset="1" stopColor="#C4F256" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x={band.x}
          y={band.y}
          width={band.width}
          height={band.height}
          rx={band.rx}
          fill="#C4F256"
          opacity="0.1"
        />
        {[38.48, 79.92, 121.36].map((y) => (
          <line
            key={y}
            x1="8"
            x2="1000"
            y1={y}
            y2={y}
            stroke="#40646A"
            strokeWidth="1.4"
            strokeDasharray="2 7"
          />
        ))}
        <path d={area} fill="url(#fiets-curve-fill)" />
        <line
          x1={peak.x}
          x2={peak.x}
          y1={peak.y}
          y2="137"
          stroke="#A4BD56"
          strokeWidth="1.6"
          strokeDasharray="2.2 4.2"
        />
        <path d={line} fill="none" stroke="#D6FA63" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {hours.map((hour) =>
          hour.peak ? null : (
            <circle key={hour.time} cx={hour.x} cy={hour.y} r="3.8" fill="#B9E9DD" stroke="#102C35" strokeWidth="2" />
          ),
        )}
        <circle cx={peak.x} cy={peak.y} r="7" fill="#D6FA63" stroke="#102C35" strokeWidth="2" />
      </svg>
      <ol className={styles.hours}>
        {hours.map((hour) => (
          <li
            key={hour.time}
            style={{ left: `${(hour.x / width) * 100}%` }}
            data-peak={hour.peak ? "true" : undefined}
          >
            {hour.time}
          </li>
        ))}
      </ol>
      <figcaption className="visually-hidden">{label} De sportscore in het beste tijdvak is 91 van 100.</figcaption>
    </figure>
  );
}
