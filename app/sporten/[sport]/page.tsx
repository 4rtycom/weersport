import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SportIcon } from "@/components/sport-icon";
import { ICE_CRITICAL_SPORTS } from "@/lib/data/types";
import { getScoreProfile } from "@/lib/scoring/profiles";
import { MISSING_WATER_TEMPERATURE_REASON } from "@/lib/scoring/swim";
import { guideCopy } from "@/lib/sport-guide-copy";
import { describeProfileForGuide } from "@/lib/sport-guide-examples";
import { sports } from "@/lib/sports";
import styles from "./guide.module.css";

type Props = { params: Promise<{ sport: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return sports.map(({ id }) => ({ sport: id }));
}

function requireSport(id: string) {
  const sport = sports.find((item) => item.id === id);
  if (!sport) notFound();
  return sport;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sport = requireSport((await params).sport);
  const [question, advice] = guideCopy[sport.id];
  return {
    title: `${sport.name}: zo werkt het weeradvies`,
    description: `${question} ${advice}`,
  };
}

export default async function SportGuide({ params }: Props) {
  const sport = requireSport((await params).sport);
  const profile = getScoreProfile(sport.id);
  const guide = describeProfileForGuide(profile);
  const [question, advice] = guideCopy[sport.id];
  const ice = ICE_CRITICAL_SPORTS.has(sport.id);
  const swim = sport.id === "openwaterzwemmen";

  return (
    <>
      <div className="catalog-hero">
        <SiteHeader />
      </div>
      <main id="inhoud" className={styles.page}>
        <Link href={`/sporten#${sport.familyId}`}>← Alle sporten</Link>
        <header className={styles.intro}>
          <SportIcon src={sport.icon} size={44} />
          <h1>{sport.name}: zo werkt het weeradvies</h1>
          <p className={styles.question}>{question}</p>
          <p className={styles.answer}>{advice}</p>
        </header>

        <section className={styles.example} aria-labelledby="example-title">
          <h2 id="example-title">{swim || ice || !guide.personalAdvice ? "Waarom zie ik soms geen score?" : "Vergelijk twee uren"}</h2>
          {swim ? (
            <>
              <p>{MISSING_WATER_TEMPERATURE_REASON}</p>
              <p>
                Dat voorbeeld gaat over een ontbrekende meting, niet over een live advies. Zonder die watertemperatuur,
                of zonder officiële zwemplek, is er geen score en geen beste tijdvak.
              </p>
            </>
          ) : ice ? (
            <>
              <p>
                Stel dat het vannacht heeft gevroren. Zonder metingen van de dikte en kwaliteit van het natuurijs geeft
                WeerSport geen score. Vorst alleen rechtvaardigt geen aanbeveling.
              </p>
              <p>
                Kijk bij de lokale ijsclub of een baan is vrijgegeven voordat je het ijs op gaat. UV en officiële
                waarschuwingen blijven los van dit advies zichtbaar.
              </p>
            </>
          ) : (
            <>
              <p>{guide.explanation}</p>
              <p>Er is geen puntenvoorbeeld, omdat een vrijgegeven beslisregel ontbreekt.</p>
            </>
          )}
        </section>

        <section aria-labelledby="weights-title">
          <h2 id="weights-title">Wat telt mee voor {sport.name.toLowerCase()}?</h2>
          <p>
            Model {guide.modelVersion}. Persoonlijk advies is {guide.personalAdvice ? "vrijgegeven" : "niet vrijgegeven"}.
          </p>
          <h3>Al verwerkt</h3>
          {guide.applied.length === 0 ? (
            <p>Nog geen factor wordt in een vrijgegeven score verwerkt.</p>
          ) : (
            <ul>
              {guide.applied.map((factor) => (
                <li key={factor.id}>
                  <strong>{factor.label}.</strong> {factor.explanation}
                </li>
              ))}
            </ul>
          )}
          <h3>Nog niet verwerkt of ontbrekend</h3>
          <ul>
            {guide.withheld.map((factor) => (
              <li key={factor.id}>
                <strong>{factor.label}.</strong> {factor.explanation}
              </li>
            ))}
            {guide.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Benodigde bronvelden</h3>
          <ul>
            {guide.requiredFields.map((field) => (
              <li key={field.id}>
                <strong>{field.label}.</strong>{" "}
                {field.measurable
                  ? "Dit veld bestaat op een bron in deze versie. Zonder geldige meting blijft het geblokkeerd, en een geldige meting is nog geen score."
                  : field.field
                    ? "Dit veld staat op een bron, maar het is voor deze sport geen meting van de ontbrekende factor. Het advies blijft geblokkeerd."
                    : "Dit veld zit niet in de gekoppelde bronnen. Het advies blijft daarom geblokkeerd."}
              </li>
            ))}
          </ul>
          {guide.blocks.length > 0 ? (
            <>
              <h3>Blokkades</h3>
              <ul>
                {guide.blocks.map((block) => (
                  <li key={block.id}>{block.explanation}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section aria-labelledby="howto-title">
          <h2 id="howto-title">Hoe lees ik het advies?</h2>
          <p>
            {guide.personalAdvice
              ? "WeerSport vergelijkt aaneengesloten uren in het gevraagde tijdvak. Het getoonde cijfer, de badge en de toelichting komen uit hetzelfde venster."
              : "Ontbreken essentiële gegevens of een vrijgegeven beslisregel, dan is er geen score en geen aanbevolen sportmoment."}
          </p>
          <p>
            UV en officiële waarschuwingen staan los van de score. Controleer de actuele waarschuwingen bij het{" "}
            <a href="https://www.knmi.nl/nederland-nu/weer/waarschuwingen">KNMI</a>.
          </p>
          <p>{profile.caveats}</p>
        </section>

        <Link href={`/?sport=${sport.id}#planner`} className={`button button-dark ${styles.plannerCta}`}>
          Plan {sport.name.toLowerCase()} in de planner →
        </Link>
      </main>
    </>
  );
}
