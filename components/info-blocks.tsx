import Link from "next/link";
import type { ReactNode } from "react";

/** Closing call-to-action card used at the bottom of information pages. */
export function CtaCard({
  title,
  children,
  href = "/#planner",
  label = "Vind mijn WeerSport-moment →",
}: {
  title: string;
  children?: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <section className="page-card page-cta" aria-label={title}>
      <div>
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
      <Link className="button button-lime" href={href}>
        {label}
      </Link>
    </section>
  );
}

/** Question list built on <details>, so it works without JavaScript and is keyboard friendly. */
export function Faq({ items }: { items: Array<{ q: string; a: ReactNode }> }) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <div>{item.a}</div>
        </details>
      ))}
    </div>
  );
}

/** Horizontal share bar, e.g. how much a factor weighs. */
export function Meter({ label, value, suffix = "%" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="meter-row" style={{ ["--score" as string]: `${Math.max(0, Math.min(100, value))}%` }}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix}
      </strong>
    </div>
  );
}
