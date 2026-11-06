export function SponsorCard({
  partner,
  headline,
  body,
  href,
  fictional = false,
  onActivate,
}: {
  partner: string;
  headline: string;
  body: string;
  href?: string | null;
  fictional?: boolean;
  onActivate?: () => void;
}) {
  return (
    <aside className="sponsor-placement" aria-label="Gesponsorde vermelding">
      <p className="sponsor-placement-kicker">Gesponsord</p>
      <p className="sponsor-placement-partner">{partner}</p>
      <h3>{headline}</h3>
      <p>{body}</p>
      {href ? (
        <a href={href} rel="sponsored noopener noreferrer" onClick={onActivate}>
          Website van de partner
        </a>
      ) : null}
      {fictional ? <p className="sponsor-placement-note">Fictieve partner</p> : null}
    </aside>
  );
}
