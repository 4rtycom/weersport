import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The homepage hero pattern for inner pages: a dark band that continues from the header, with the page title.
 * Put it first inside <main>, followed by <div className="page-body">; the first card there overlaps the band.
 */
export function PageHero({
  title,
  eyebrow,
  lead,
  back,
  icon,
  children,
}: {
  title: ReactNode;
  eyebrow?: string;
  lead?: ReactNode;
  back?: { href: string; label: string };
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-hero">
      <div className="page-hero-inner">
        {back ? (
          <Link className="page-hero-back" href={back.href}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="eyebrow eyebrow-lime">
            <img src="/home/lime-dot.svg" alt="" width={15} height={15} />
            {eyebrow}
          </p>
        ) : null}
        <div className="page-hero-title">
          {icon ? <span className="icon-badge icon-badge-lg page-hero-icon">{icon}</span> : null}
          <h1>{title}</h1>
        </div>
        {lead ? <div className="page-hero-lead">{lead}</div> : null}
        {children}
      </div>
    </header>
  );
}

/** Outcome card for checkout and other one-step results. */
export function StatusCard({
  tone,
  title,
  children,
  actions,
}: {
  tone: "success" | "pending" | "error" | "neutral";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const icon =
    tone === "success" ? (
      <path d="M7 12.5l3.2 3.2L17 9" />
    ) : tone === "pending" ? (
      <>
        <circle cx="12" cy="12" r="6.5" />
        <path d="M12 8.5V12l2.4 1.6" />
      </>
    ) : tone === "error" ? (
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    ) : (
      <path d="M7.5 12h9" />
    );
  return (
    <section className={`page-card status-card status-${tone}`}>
      <span className="status-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <div>
        <h2>{title}</h2>
        {children}
        {actions ? <div className="status-actions">{actions}</div> : null}
      </div>
    </section>
  );
}
