"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SportIcon } from "@/components/sport-icon";
import { SportSelect } from "@/components/sport-select";
import { PlaceField } from "@/components/place-field";
import { families, findSport, periods, sportsInFamily } from "@/lib/sports";
import type { SearchDraft } from "@/lib/draft";

const hours = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
const mobileHours = new Set(["08:00", "10:00", "12:00", "16:00"]);

export function HomePage({
  viewerName = null,
  draft = null,
  resumed = false,
  preselectedSportId = null,
}: {
  viewerName?: string | null;
  draft?: SearchDraft | null;
  resumed?: boolean;
  /** Validated sport from /?sport= — wins over an older draft sport. */
  preselectedSportId?: string | null;
}) {
  const [sportId, setSportId] = useState(draft?.sportId ?? "fietsen");
  const [location, setLocation] = useState(draft?.placeLabel ?? "Amsterdam");
  const [placeId, setPlaceId] = useState(draft?.placeId ?? "");
  const [period, setPeriod] = useState<(typeof periods)[number]>(draft?.period ?? "Komende 48 uur");
  const [notice, setNotice] = useState(() => {
    if (resumed && draft) {
      return `Je zoekopdracht voor ${draft.sportName} in ${draft.placeLabel} is bewaard. Er is geen analyse gestart en er is geen aanvraag geboekt. Het voorbeeld hieronder blijft fictief.`;
    }
    if (preselectedSportId) {
      return `Sport voorgeselecteerd: ${findSport(preselectedSportId).name}. Kies je plek en zoek je sportmoment — er start nog geen analyse.`;
    }
    return "";
  });
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNoticeIsError(false);
    try {
      const response = await fetch("/api/zoeken", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sportId, placeId, placeLabel: location, period }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; next?: string; booked?: boolean };
      if (!response.ok || !data.next || data.booked !== false) {
        setNotice(data.error ?? "Zoeken is niet gestart. Er is geen analyse geboekt.");
        setNoticeIsError(true);
        setPending(false);
        return;
      }
      window.location.assign(data.next);
    } catch {
      setNotice("Geen verbinding. Controleer je internet en probeer het opnieuw. Er is geen analyse geboekt.");
      setNoticeIsError(true);
      setPending(false);
    }
  }

  return (
    <>
      <SiteHeaderBar account={Boolean(viewerName)} />
      <section className="hero hero-home">
        <img className="hero-halo" src="/home/halo.svg" alt="" width={670} height={670} />
        <div className="hero-copy">
          <p className="eyebrow eyebrow-lime">
            <img src="/home/lime-dot.svg" alt="" width={15} height={15} />
            Het weer is anders als je gaat sporten
          </p>
          <h1>
            Wat is jouw
            <br />
            beste
            <br />
            <span>sportmoment?</span>
          </h1>
          <p className="hero-lead hero-lead-desktop">
            Weet niet alleen welk weer je krijgt. Ontdek wanneer je het beste buiten kunt sporten.
          </p>
          <p className="hero-lead hero-lead-mobile">
            Jouw beste sportmoment in Nederland.
            <br />
            Voor 24 buitensporten.
          </p>
          <a className="button button-lime hero-cta" href="#planner">
            Vind mijn WeerSport-moment →
          </a>
          <p className="hero-meta">24 Nederlandse buitensporten · Sportspecifiek advies</p>
        </div>
        <figure className="hero-photo">
          <img src="/home/hero.png" alt="Fietser op een duinweg aan de Nederlandse kust." />
          <div className="weather-chip">
            <svg className="weather-sun" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="4.5" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 3v3M14 22v3M3 14h3M22 14h3M6.2 6.2l2.1 2.1M19.7 19.7l2.1 2.1M21.8 6.2l-2.1 2.1M8.3 19.7l-2.1 2.1" />
              </g>
            </svg>
            <p className="weather-temp">16°</p>
            <p className="weather-note">Fictief · NL</p>
          </div>
          <figcaption>
            <p>Buiten begint hier</p>
            <strong>Meer sport. Minder twijfel.</strong>
          </figcaption>
        </figure>
      </section>

      <main id="inhoud">
        <section className="planner" id="planner" aria-labelledby="planner-title">
          <div className="accent-strip" aria-hidden="true" />
          <h2 id="planner-title" className="planner-title">
            Kies jouw buitensport
          </h2>
          <form className="planner-grid" onSubmit={onSearch}>
            <div>
              <p className="field-label" id="sport-label">
                Welke sport?
              </p>
              <SportSelect value={sportId} onChange={setSportId} labelledBy="sport-label" />
            </div>
            <div>
              <label className="field-label" htmlFor="locatie">
                Waar ga je sporten?
              </label>
              <PlaceField
                label={location}
                placeId={placeId}
                onChange={(next) => {
                  setLocation(next.label);
                  setPlaceId(next.placeId);
                }}
              />
            </div>
            <div>
              {periods.length > 1 ? (
                <>
                  <label className="field-label" htmlFor="periode">
                    Wanneer?
                  </label>
                  <div className="text-field">
                    <select
                      id="periode"
                      name="periode"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value as (typeof periods)[number])}
                    >
                      {periods.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* One period on offer: show it as a fact instead of a dropdown with a single choice. */}
                  <p className="field-label" id="periode-label">
                    Wanneer?
                  </p>
                  <p className="text-field text-field-static" aria-labelledby="periode-label">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M10 6v4.2l2.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {period}
                  </p>
                </>
              )}
            </div>
            <button className="button button-dark planner-cta" type="submit" disabled={pending}>
              {pending ? "Bezig met zoeken…" : "Bekijk mijn WeerSport-moment →"}
            </button>
          </form>
          <p className="planner-note">
            <span>Gratis account nodig bij zoeken</span>
            <span className="planner-note-long">
              Alleen locaties in Nederland · Voorbeeldadvies; data en bronnen volgen bij livegang
            </span>
            <span className="planner-note-short">Alleen locaties in Nederland</span>
          </p>
          <p className={notice ? (noticeIsError ? "status status-error" : "status status-note") : "status"} role="status">
            {notice}
          </p>
        </section>

        <section className="families" id="families" aria-labelledby="families-title">
          <div className="families-head">
            <div>
              <p className="eyebrow">Buitensporten in Nederland</p>
              <h2 id="families-title">Wat ga jij buiten doen?</h2>
              <p>Kies jouw sport direct bovenaan of ontdek de zes sportfamilies.</p>
            </div>
            <Link className="button button-dark" href="/sporten">
              Bekijk alle 24 sporten →
            </Link>
          </div>
          <ul className="family-grid">
            {families.map((family) => (
              <li key={family.id}>
                <Link className="family-card" href={`/sporten#${family.id}`}>
                  <span className="icon-badge icon-badge-lg">
                    <SportIcon src={family.icon} size={28} />
                  </span>
                  <span>
                    <strong>{family.name}</strong>
                    <small>{sportsInFamily(family.id).length} sporten</small>
                  </span>
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="showcase" aria-labelledby="showcase-title">
          <div className="showcase-copy">
            <p className="eyebrow">Een weerbericht dat met je meedenkt</p>
            <h2 id="showcase-title">
              Niet zomaar een
              <br />
              weersverwachting.
            </h2>
            <p>
              WeerSport vertaalt de voorspelling naar één handig tijdvak voor jouw sport. Inclusief de reden waarom.
            </p>
          </div>
          <article className="signature" id="moment" aria-labelledby="moment-title">
            <div className="signature-top">
              <p className="demo-badge">Voorbeeld · fictief</p>
              <p className="signature-context">Fietsen · Amsterdam</p>
            </div>
            <div className="signature-heading">
              <div>
                <h3 id="moment-title">Jouw WeerSport-moment</h3>
                <p className="window">10:00 – 12:00</p>
                <p className="reason">Beste verwachte twee uur voor jouw fietstocht.</p>
              </div>
              <p className="score" aria-label="Sportscore 91 van 100, voorbeeld">
                <span>91</span>
                <small>/100</small>
                <b>Sportscore</b>
              </p>
            </div>
            <p className="section-kicker">Dit maakt het moment geschikt</p>
            <ul className="metrics">
              <li>
                <img src="/weather/temperature.svg" alt="" width={28} height={28} />
                <span>Temperatuur</span>
                <strong>16°C</strong>
                <small>Prettig voor fietsen</small>
              </li>
              <li>
                <img src="/weather/wind.svg" alt="" width={28} height={28} />
                <span>Wind</span>
                <strong>12 km/u</strong>
                <small>Rustige omstandigheden</small>
              </li>
              <li>
                <img src="/weather/rain.svg" alt="" width={28} height={28} />
                <span>Regenkans</span>
                <strong>10%</strong>
                <small>Lage kans op regen</small>
              </li>
            </ul>
            <div className="uv-alert" id="weer-uv">
              <img src="/weather/uv.svg" alt="" width={34} height={34} />
              <div>
                <strong>UV-index 6 · hoog</strong>
                <p>Demo: maximale UV in dit tijdvak. Bescherm je huid en ogen.</p>
              </div>
            </div>
            <p className="section-kicker">Andere geschikte momenten</p>
            <ul className="alternatives">
              <li>
                <span>12:00 – 14:00</span>
                <b>85/100</b>
              </li>
              <li>
                <span>14:00 – 16:00</span>
                <b>78/100</b>
              </li>
            </ul>
            <p className="safety-note">
              <img src="/weather/safety.svg" alt="" width={28} height={28} />
              <span>UV-risico, extreem weer en databron blijven los van de sportscores.</span>
            </p>
          </article>
        </section>

        <figure className="editorial">
          <img src="/home/hero.png" alt="Fietser op een duinweg aan de Nederlandse kust." />
        </figure>

        <section className="curve" id="uurverloop" aria-labelledby="curve-title">
          <div className="curve-head">
            <div>
              <p className="eyebrow eyebrow-mint">Tijdvakvergelijking / voorbeeld</p>
              <h2 id="curve-title">Het beste moment springt eruit.</h2>
              <p>Vergelijk scores per tijdvak. Elke sport gebruikt andere weersfactoren.</p>
            </div>
            <p className="peak">
              <span>Beste moment · 10–12 uur</span>
              <strong>91 / 100</strong>
            </p>
          </div>
          <div className="plot">
            <img
              src="/home/curve.svg"
              alt="Illustratieve scorecurve met een piek van 91 rond 10 uur."
            />
          </div>
          <ol className="hours">
            {hours.map((hour) => (
              <li key={hour} className={mobileHours.has(hour) ? "hour-keep" : undefined} data-peak={hour === "10:00"}>
                {hour}
              </li>
            ))}
          </ol>
          <p className="curve-note">
            Illustratieve scores. Definitieve berekening en betrouwbaarheid volgen na koppeling met gevalideerde weerdata.
            Gekozen sport en periode ({period.toLowerCase()}
            {location.trim() ? `, ${location.trim()}` : ""}) veranderen dit voorbeeld niet.
          </p>
        </section>

        <section className="factors" aria-labelledby="factors-title">
          <p className="eyebrow">Meer dan een weercijfer</p>
          <h2 id="factors-title">Waarom is dit het juiste moment?</h2>
          <p className="factors-lead">Je ziet niet alleen de score, maar ook de omstandigheden erachter.</p>
          <ul>
            <li>
              <img className="factor-icon" src="/factors/wind.svg" alt="" width={56} height={56} />
              <h3>Wind & windstoten</h3>
              <p>Windrichting en windstoten wegen per sport anders mee.</p>
            </li>
            <li>
              <img className="factor-icon" src="/factors/temperature.svg" alt="" width={56} height={56} />
              <h3>Temperatuur & comfort</h3>
              <p>Per sport verschilt wat prettig is: temperatuur, wind of water.</p>
            </li>
            <li>
              <img className="factor-icon" src="/factors/alerts.svg" alt="" width={56} height={56} />
              <h3>Regen, UV & waarschuwingen</h3>
              <p>Neerslag, UV en officiële waarschuwingen blijven apart zichtbaar.</p>
            </li>
          </ul>
        </section>

        <section className="steps" id="stappen" aria-labelledby="steps-title">
          <p className="eyebrow">Zo simpel werkt het</p>
          <h2 id="steps-title">Van weersverwachting naar sportplan.</h2>
          <ol>
            <li>
              <span>01</span>
              <h3>Kies je sport</h3>
              <p>Van wandelen tot kitesurfen.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Selecteer je plek</h3>
              <p>Een locatie binnen Nederland.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Ontdek jouw moment</h3>
              <p>Tijdvak, score en uitleg.</p>
            </li>
          </ol>
          <p className="steps-actions">
            <a className="button button-dark" href="#planner">
              Kies je sport en plek
            </a>
            <Link className="button button-ghost" href="/hoe-werkt-het">
              Meer over hoe het werkt
            </Link>
          </p>
        </section>

        <aside className="sponsor">
          <div>
            <h2>Ook zichtbaar zijn als sportpartner?</h2>
            <p>Sponsoring is duidelijk herkenbaar en beïnvloedt nooit de weerscore.</p>
          </div>
          <a href="/sponsoring">Samenwerken →</a>
        </aside>
      </main>

      </>
  );
}
