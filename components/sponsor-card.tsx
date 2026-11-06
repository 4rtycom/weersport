export function SponsorCard({
  partner,
  headline,
  body,
  href,
  fictional = false,
  onActivate,
  media = null,
}: {
  partner: string;
  headline: string;
  body: string;
  href?: string | null;
  fictional?: boolean;
  onActivate?: () => void;
  media?: { src: string; alt: string } | null;
}) {
  if (media) {
    return (
      <aside className="sponsor-moment" aria-label="Gesponsorde vermelding">
        <div className="sponsor-moment-photo">
          <img src={media.src} alt={media.alt} width={560} height={560} />
        </div>
        <div className="sponsor-moment-copy">
          <p className="sponsor-moment-kicker">{`Gesponsord  ·  ${partner}`}</p>
          <h3>{headline}</h3>
          <p>{body}</p>
          {fictional ? <p className="sponsor-moment-note">Fictieve partner</p> : null}
        </div>
      </aside>
    );
  }

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
