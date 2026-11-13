import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SportIcon } from "@/components/sport-icon";
import { ICE_CRITICAL_SPORTS, WATER_CRITICAL_SPORTS } from "@/lib/data/types";
import { getScoreProfile } from "@/lib/scoring/profiles";
import { guideCopy } from "@/lib/sport-guide-copy";
import { buildLandGuideExample } from "@/lib/sport-guide-examples";
import { families, sports } from "@/lib/sports";
import { cities, landSports } from "@/lib/live";
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
  const [question, advice] = guideCopy[sport.id];
  const ice = ICE_CRITICAL_SPORTS.has(sport.id);
  const water = WATER_CRITICAL_SPORTS.has(sport.id);
  const exampleTemp = Math.round((profile.idealTempC[0] + profile.idealTempC[1]) / 2);
  const windKmh = Math.round((profile.idealWindKmh[0] + profile.idealWindKmh[1]) / 2);
  const factors = [
    ["Luchttemperatuur", profile.weights.temperature],
    ["Windsnelheid", profile.weights.wind],
    ["Kans op regen", profile.weights.rain],
  ] as const;
  const landExample = !ice && !water ? buildLandGuideExample(profile, sport.name) : null;

  return (
    <>
      <SiteHeaderBar />
      <main id="inhoud" className="page">
        <PageHero
          back={{ href: `/sporten#${sport.familyId}`, label: families.find((f) => f.id === sport.familyId)?.name ?? "Alle sporten" }}
          icon={<SportIcon src={sport.icon} size={32} />}
          title={`${sport.name}: zo werkt het weeradvies`}
          lead={
            <>
              <p className={styles.question}>{question}</p>
              <p className={styles.answer}>{advice}</p>
            </>
          }
        />
        <div className={`page-body page-body-narrow ${styles.body}`}>
        <section className={`page-card ${styles.example}`} aria-labelledby="example-title">
          <h2 id="example-title">{ice || water ? "Waarom zie ik soms geen score?" : "Vergelijk twee uren"}</h2>
          {ice ? (
            <>
              <p>
                Stel dat het vannacht ongeveer 5 °C heeft gevroren. Zonder metingen van de dikte en kwaliteit van het
                natuurijs geeft WeerSport geen score. Een temperatuur- of windpercentage zegt niets over de
                draagkracht van het ijs.
              </p>
              <p>
                Kijk bij de lokale ijsclub of een baan is vrijgegeven voordat je het ijs op gaat. UV en officiële
                waarschuwingen blijven los van dit advies zichtbaar.
              </p>
            </>
          ) : water ? (
            <>
              <p>
                Stel dat de lucht {exampleTemp} °C is en de wind {windKmh} km/u. Ontbreekt de benodigde informatie over
                het water
                {sport.id === "openwaterzwemmen"
                  ? " — watertemperatuur, zwemwaterkwaliteit en de exacte zwemplek"
                  : " of de plek waar je wilt varen of surfen"}
                , dan krijg je geen score. WeerSport zet dan geen fictief gunstig cijfer.
              </p>
              <p>
                Informatie die de app verwerkt (luchttemperatuur, wind, regenkans) verschilt van wat je lokaal moet
                controleren (watercondities, spotregels, getij of kwaliteit). UV en officiële waarschuwingen staan apart.
              </p>
            </>
          ) : landExample ? (
            <>
              <p>{landExample.intro}</p>
              <p className={styles.exampleLabel}>Rekenvoorbeeld · geen live analyse</p>
              <dl className={styles.hours}>
                {landExample.hours.map((hour) => (
                  <div key={hour.label} style={{ ["--score" as string]: `${hour.score}%` }}>
                    <dt>
                      {hour.label}
                      {landExample.factor === "temperature"
                        ? ` · ${hour.temperatureC} °C`
                        : landExample.factor === "wind"
                          ? ` · ${hour.windKmh} km/u wind`
                          : ` · ${hour.rainPct}% regenkans`}
                    </dt>
                    <dd>{hour.score} / 100</dd>
                  </div>
                ))}
              </dl>
              <p>{landExample.conclusion}</p>
            </>
          ) : null}
        </section>

        <section className="page-card" aria-labelledby="weights-title">
          <h2 id="weights-title">Wat telt mee voor {sport.name.toLowerCase()}?</h2>
          <p>
            {ice
              ? "Het voorlopige weerprofiel gebruikt deze verdeling. Een berekening op papier zegt niets over de draagkracht van natuurijs."
              : "WeerSport geeft elk uur punten voor drie dingen. Hoe groter het aandeel, hoe sterker dat onderdeel meetelt."}
          </p>
          <dl className={styles.weights}>
            {factors.map(([name, weight]) => (
              <div key={name} style={{ ["--score" as string]: `${Math.round(weight * 100)}%` }}>
                <dt>{name}</dt>
                <dd>{Math.round(weight * 100)}%</dd>
              </div>
            ))}
          </dl>
          <details>
            <summary>Bekijk de berekening</summary>
            <p>
              Bij {profile.idealTempC.join(" tot ")} °C en {profile.idealWindKmh.join(" tot ")} km/u krijgen
              temperatuur en wind elk hun volle punten. Buiten die bereiken lopen de punten terug. Regenpunten hangen
              af van de kans op neerslag en hoe zwaar een bui voor deze sport doorwerkt.
            </p>
            <p>
              Vermenigvuldig de drie deelscores met hun aandeel, tel ze op en rond af op een heel getal. De verdeling
              is voorlopig. De percentages geven aan wat meetelt in het model.
            </p>
          </details>
        </section>

        <section className="page-card" aria-labelledby="howto-title">
          <h2 id="howto-title">Hoe lees ik het advies?</h2>
          <p>
            {ice || water
              ? "Ontbreken essentiële gegevens, dan verschijnt er geen aanbevolen sportmoment op basis van een score."
              : "WeerSport vergelijkt de beschikbare uren en wijst het uur met de hoogste score aan. Rond dat uur zie je een tijdvak. Kijk ook naar de uren ernaast als je langer buiten blijft."}
          </p>
          <p>
            UV en officiële waarschuwingen staan los van de score. Controleer de actuele waarschuwingen bij het{" "}
            <a href="https://www.knmi.nl/nederland-nu/weer/waarschuwingen">KNMI</a>. Een hoge weerscore zegt hoe goed
            het verwachte weer bij deze sport past — geen veiligheidsgarantie.
          </p>
        </section>

        {landSports.some((item) => item.id === sport.id) ? (
          <section className="page-card" aria-labelledby="plaatsen-title">
            <h2 id="plaatsen-title">Het beste moment in jouw stad</h2>
            <p>Bekijk de actuele verwachting voor {sport.name.toLowerCase()} in:</p>
            <ul className="link-chips">
              {cities.map((city) => (
                <li key={city.slug}>
                  <Link href={`/sporten/${sport.id}/${city.slug}`}>{city.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={`page-card ${styles.cta}`} aria-labelledby="cta-title">
          <h2 id="cta-title">Wanneer kun jij {sport.name.toLowerCase()}?</h2>
          <p>Kies je plek en zie het beste moment in de komende 48 uur.</p>
          <Link href={`/?sport=${sport.id}#planner`} className={`button button-lime ${styles.plannerCta}`}>
            Plan {sport.name.toLowerCase()} in de planner →
          </Link>
        </section>
        </div>
      </main>
    </>
  );
}
