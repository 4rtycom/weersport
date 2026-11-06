import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SportIcon } from "@/components/sport-icon";
import { ICE_CRITICAL_SPORTS, WATER_CRITICAL_SPORTS } from "@/lib/data/types";
import { scoreHour } from "@/lib/scoring/engine";
import { getScoreProfile } from "@/lib/scoring/profiles";
import { guideCopy } from "@/lib/sport-guide-copy";
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
  return { title: `${sport.name}: zo werkt het weeradvies`, description: guideCopy[sport.id][1] };
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

  return <>
    <div className="catalog-hero"><SiteHeader /></div>
    <main id="inhoud" className={styles.page}>
      <Link href={`/sporten#${sport.familyId}`}>← Alle sporten</Link>
      <header className={styles.intro}>
        <SportIcon src={sport.icon} size={44} />
        <h1>{sport.name}: zo werkt het weeradvies</h1>
        <p>{question} {advice}</p>
      </header>
      <section className={styles.example}>
        <h2>{ice || water ? "Waarom zie ik soms geen score?" : "Vergelijk twee uren"}</h2>
        {ice ? <p>Stel dat het vannacht 5 graden heeft gevroren. Zonder metingen van de dikte en kwaliteit van het ijs geeft WeerSport geen score voor natuurijs. Kijk bij de lokale ijsclub of een baan is vrijgegeven.</p>
          : water ? <p>Stel dat de lucht {exampleTemp} °C is en de wind {windKmh} km/u. Ontbreekt de benodigde informatie over het water{sport.id === "openwaterzwemmen" ? " of de zwemwaterkwaliteit" : ""}, dan krijg je geen score. Bekijk de actuele informatie voor jouw plek voordat je vertrekt.</p>
          : <>
            <p>Rekenvoorbeeld met verzonnen weer. Het is in beide uren {exampleTemp} °C en de wind is {windKmh} km/u. Alleen de kans op regen verandert.</p>
            <dl className={styles.hours}>{[5, 65].map((rain, i) => {
              const result = scoreHour(profile, { time: "", temperatureC: exampleTemp, windKmh, precipitationProbability: rain, uvIndex: 0 });
              return <div key={rain}><dt>{i === 0 ? "09:00" : "12:00"} · {rain}% regenkans</dt><dd>{result.score} / 100</dd></div>;
            })}</dl>
            <p>Van deze twee uren past 09:00 beter bij {sport.name.toLowerCase()}: dezelfde temperatuur en wind, maar minder kans op een bui.</p>
          </>}
      </section>
      <section><h2>Wat telt mee voor {sport.name.toLowerCase()}?</h2>
        <p>{ice ? "Het voorlopige weerprofiel gebruikt deze verdeling. Een berekening op papier zegt niets over de draagkracht van natuurijs." : "WeerSport geeft elk uur punten voor drie dingen. Hoe groter het aandeel, hoe sterker dat onderdeel meetelt."}</p>
        <dl className={styles.weights}>{factors.map(([name, weight]) => <div key={name}><dt>{name}</dt><dd>{Math.round(weight * 100)}%</dd></div>)}</dl>
        <details><summary>Bekijk de berekening</summary>
          <p>Bij {profile.idealTempC.join(" tot ")} °C en {profile.idealWindKmh.join(" tot ")} km/u krijgen temperatuur en wind elk hun volle punten. Buiten die bereiken lopen de punten terug. Regenpunten hangen af van de kans op neerslag en hoe zwaar een bui voor deze sport doorwerkt.</p>
          <p>Vermenigvuldig de drie deelscores met hun aandeel, tel ze op en rond af op een heel getal. De verdeling is voorlopig. De percentages geven aan wat meetelt in het model.</p>
        </details>
      </section>
      <section><h2>Hoe lees ik het advies?</h2>
        <p>{ice || water ? "Ontbreken essentiële gegevens, dan verschijnt er geen aanbevolen sportmoment op basis van een score." : "WeerSport vergelijkt de beschikbare uren en wijst het uur met de hoogste score aan. Rond dat uur zie je een tijdvak. Kijk ook naar de uren ernaast als je langer buiten blijft."}</p>
        <p>UV en officiële waarschuwingen staan los van de score. Controleer de actuele waarschuwingen bij het <a href="https://www.knmi.nl/nederland-nu/weer/waarschuwingen">KNMI</a>. Een hoge weerscore zegt hoe goed het verwachte weer bij deze sport past.</p>
      </section>
      <Link href="/#planner" className="button button-dark">Open de sportplanner →</Link>
    </main>
  </>;
}
