import type { Metadata } from "next";
import Link from "next/link";
import { CtaCard } from "@/components/info-blocks";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { UvBadge } from "@/components/uv-badge";
import { readSession } from "@/lib/auth/cookies";
import { ICE_CRITICAL_SPORTS } from "@/lib/data/types";
import { sportProfiles } from "@/lib/scoring/profiles";
import { findSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Weer & UV",
  description:
    "Welke weerfactoren meetellen voor jouw sport, wat de UV-index betekent en waarom waarschuwingen los van de score staan.",
};

type FactorKey = "temperature" | "wind" | "rain";

/** The three sports where a factor weighs most, straight from the score profiles. */
function heaviest(key: FactorKey) {
  return Object.values(sportProfiles)
    // Leave out sports that never get a weather-only score, so the examples match what people actually see.
    .filter((profile) => !ICE_CRITICAL_SPORTS.has(profile.sportId) && profile.sportId !== "openwaterzwemmen")
    .sort((a, b) => b.weights[key] - a.weights[key])
    .slice(0, 3)
    .map((profile) => findSport(profile.sportId).name.toLowerCase());
}

const factors: Array<{ key: FactorKey; title: string; icon: string; text: string }> = [
  {
    key: "temperature",
    title: "Temperatuur",
    icon: "/weather/temperature.svg",
    text: "Elke sport heeft een bereik waarin het prettig is. Daarbinnen krijgt een uur alle punten, daarbuiten loopt het af. Een wielrenner wil het koeler dan iemand die gaat suppen.",
  },
  {
    key: "wind",
    title: "Wind",
    icon: "/weather/wind.svg",
    text: "Voor de meeste sporten is minder wind beter. Voor zeilen, windsurfen en kitesurfen juist niet: daar zoekt WeerSport naar genoeg wind, maar niet te veel.",
  },
  {
    key: "rain",
    title: "Regenkans",
    icon: "/weather/rain.svg",
    text: "Hoe hoger de kans op neerslag, hoe minder punten. Hoe zwaar dat doorwerkt, verschilt per sport: een bui op de fiets is anders dan een bui op het water.",
  },
];

const uvAdvice = [
  { uv: { index: 1, level: "laag", label: "Laag" } as const, advice: "Bescherming is meestal niet nodig." },
  { uv: { index: 4, level: "matig", label: "Matig" } as const, advice: "Bij langer buiten: zonnebrand, zonnebril en een pet." },
  { uv: { index: 6, level: "hoog", label: "Hoog" } as const, advice: "Smeer je in en zoek rond het middaguur schaduw op." },
  { uv: { index: 9, level: "zeer-hoog", label: "Zeer hoog" } as const, advice: "Extra bescherming. Plan je sport liever in de ochtend of avond." },
  { uv: { index: 11, level: "extreem", label: "Extreem" } as const, advice: "Vermijd de zon midden op de dag." },
];

export default async function WeatherUvPage() {
  const account = await readSession();
  return (
    <>
      <SiteHeaderBar account={Boolean(account)} />
      <main id="inhoud" className="page">
        <PageHero
          eyebrow="Weer & UV"
          title="Welk weer telt voor jouw sport"
          lead="De score gebruikt drie weerfactoren. UV, officiële waarschuwingen, water en luchtkwaliteit zie je er los naast, zodat een mooie score nooit een risico verbergt."
        />
        <div className="page-body page-body-narrow info">
          <section className="page-card" aria-labelledby="factoren-titel">
            <h2 id="factoren-titel">Drie factoren in de score</h2>
            <div className="factor-cards">
              {factors.map((factor) => (
                <article key={factor.key}>
                  <img src={factor.icon} alt="" width={32} height={32} />
                  <h3>{factor.title}</h3>
                  <p>{factor.text}</p>
                  <p className="factor-cards-note">Weegt het zwaarst bij {heaviest(factor.key).join(", ")}.</p>
                </article>
              ))}
            </div>
          </section>

          <section className="page-card" id="uv" aria-labelledby="uv-titel">
            <h2 id="uv-titel">De UV-index</h2>
            <p>
              De UV-index zegt hoe sterk de zonnestraling is die je huid kan verbranden. Bij elk sportmoment zie je de
              hoogste UV in jouw tijdvak. Die telt niet mee in de score: een zonnige dag blijft fijn om te sporten, maar
              vraagt wel om bescherming.
            </p>
            <ul className="uv-advice">
              {uvAdvice.map((item) => (
                <li key={item.uv.level}>
                  <UvBadge uv={item.uv} />
                  <p>{item.advice}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="page-card" id="waarschuwingen" aria-labelledby="waarschuwing-titel">
            <h2 id="waarschuwing-titel">Officiële waarschuwingen</h2>
            <p>
              Het KNMI waarschuwt met kleurcodes voor gevaarlijk weer. WeerSport toont die los van de score, omdat een
              waarschuwing altijd voorgaat.
            </p>
            <ul className="warning-codes">
              <li className="code-geel">
                <strong>Code geel</strong>
                <span>Wees alert. Het weer kan hinder geven.</span>
              </li>
              <li className="code-oranje">
                <strong>Code oranje</strong>
                <span>Wees voorbereid. Grote kans op schade, letsel of veel overlast.</span>
              </li>
              <li className="code-rood">
                <strong>Code rood</strong>
                <span>Onderneem actie. Extreem weer; ga niet sporten.</span>
              </li>
            </ul>
            <p>
              Ontbreekt de waarschuwingsfeed, dan staat dat erbij. Dat is iets anders dan &ldquo;geen waarschuwing&rdquo;.
              Kijk bij twijfel op <a href="https://www.knmi.nl/nederland-nu/weer/waarschuwingen">knmi.nl</a>.
            </p>
          </section>

          <section className="page-card" aria-labelledby="water-titel">
            <h2 id="water-titel">Water en lucht</h2>
            <p>
              Voor watersporten kijkt WeerSport naar metingen van Rijkswaterstaat, zoals watertemperatuur en golfhoogte,
              van een meetpunt dat bij jouw plek past. Luchtkwaliteit komt van Luchtmeetnet. Deze gegevens zie je bij je
              sportmoment zodra ze voor jouw plek beschikbaar zijn; ontbreken ze, dan staat dat er eerlijk bij.
              Luchtkwaliteit telt niet mee in de score.
            </p>
          </section>

          <section className="page-card page-card-muted" aria-labelledby="bronnen-titel">
            <h2 id="bronnen-titel">Bronnen</h2>
            <ul className="source-names">
              <li>
                <strong>Open-Meteo</strong> weersverwachting en UV (CC BY 4.0)
              </li>
              <li>
                <strong>KNMI</strong> officiële weerwaarschuwingen
              </li>
              <li>
                <strong>Rijkswaterstaat</strong> watermetingen
              </li>
              <li>
                <strong>Luchtmeetnet</strong> luchtkwaliteit
              </li>
              <li>
                <strong>PDOK</strong> Nederlandse plaatsnamen
              </li>
            </ul>
            <p>
              Hoe de score per sport wordt berekend, lees je op <Link href="/hoe-werkt-het">Hoe werkt het</Link>.
            </p>
          </section>

          <CtaCard title="Bekijk het weer voor jouw sport">Zie per uur hoe het weer uitpakt, met UV en waarschuwingen ernaast.</CtaCard>
        </div>
      </main>
    </>
  );
}
