import type { Metadata } from "next";
import Link from "next/link";
import { CtaCard, Faq, Meter } from "@/components/info-blocks";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { BASIS_MONTHLY_LIMIT, PRO_MONTHLY_LIMIT, PRO_PRICE_EUR } from "@/lib/billing/constants";
import { getScoreProfile } from "@/lib/scoring/profiles";
import { formatEuro } from "@/lib/site";
import { findSport, sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hoe werkt het",
  description:
    "Zo vertaalt WeerSport de weersverwachting naar het beste moment voor jouw buitensport: per uur, per sport en met uitleg.",
};

const examples = ["wielrennen", "hardlopen", "golf"];

export default async function HowItWorksPage() {
  const account = await readSession();
  return (
    <>
      <SiteHeaderBar account={Boolean(account)} />
      <main id="inhoud" className="page">
        <PageHero
          eyebrow="Hoe werkt het"
          title="Van weerbericht naar jouw sportmoment"
          lead="Een gewone weersverwachting vertelt wat voor weer het wordt. WeerSport vertelt wanneer dat weer het beste past bij de sport die jij gaat doen."
        />
        <div className="page-body page-body-narrow info">
          <section className="page-card" aria-labelledby="stappen-titel">
            <h2 id="stappen-titel">In vier stappen</h2>
            <ol className="step-list">
              <li>
                <h3>Kies je sport</h3>
                <p>
                  Kies uit {sports.length} buitensporten, van wandelen tot kitesurfen. Elke sport heeft een eigen profiel:
                  wat voor een hardloper prettig weer is, is voor een zeiler te windstil.
                </p>
              </li>
              <li>
                <h3>Kies je plek</h3>
                <p>
                  Typ een woonplaats in Nederland. WeerSport controleert de plaats bij de officiële Nederlandse
                  adresgegevens van PDOK, zodat het advies over de juiste plek gaat.
                </p>
              </li>
              <li>
                <h3>WeerSport rekent elk uur door</h3>
                <p>
                  Voor de komende 48 uur krijgt elk uur een score van 0 tot 100, op basis van temperatuur, wind en
                  regenkans uit de verwachting van Open-Meteo. Hoe zwaar elk onderdeel telt, verschilt per sport.
                </p>
              </li>
              <li>
                <h3>Je ziet je beste moment</h3>
                <p>
                  Je krijgt het beste tijdvak van twee uur, met de dag, de score en waarom juist dat moment wint. Daaronder
                  zie je het verloop per uur, zodat je ook een goed alternatief vindt.
                </p>
              </li>
            </ol>
          </section>

          <section className="page-card" aria-labelledby="weging-titel">
            <h2 id="weging-titel">Elke sport weegt het weer anders</h2>
            <p>
              Drie voorbeelden van hoe zwaar temperatuur, wind en regen meetellen. In de{" "}
              <Link href="/sporten">sportgidsen</Link> zie je dit voor alle {sports.length} sporten, met een
              rekenvoorbeeld.
            </p>
            <div className="weight-grid">
              {examples.map((id) => {
                const sport = findSport(id);
                const profile = getScoreProfile(id);
                return (
                  <article key={id} className="weight-card">
                    <Link href={`/sporten/${id}`} className="weight-card-head">
                      <span className="icon-badge">
                        <SportIcon src={sport.icon} size={24} />
                      </span>
                      <strong>{sport.name}</strong>
                    </Link>
                    <Meter label="Temperatuur" value={Math.round(profile.weights.temperature * 100)} />
                    <Meter label="Wind" value={Math.round(profile.weights.wind * 100)} />
                    <Meter label="Regen" value={Math.round(profile.weights.rain * 100)} />
                  </article>
                );
              })}
            </div>
          </section>

          <section className="page-card" aria-labelledby="geen-score-titel">
            <h2 id="geen-score-titel">Soms krijg je bewust geen score</h2>
            <p>
              Voor schaatsen op natuurijs, openwaterzwemmen en watersporten is het weer in de lucht niet genoeg. Daar
              gaat het om de dikte van het ijs, de waterkwaliteit of metingen op het water. Ontbreken die gegevens, dan
              geeft WeerSport geen score in plaats van een geruststellend cijfer. Je ziet dan precies wat er ontbreekt.
            </p>
          </section>

          <section className="page-card" aria-labelledby="apart-titel">
            <h2 id="apart-titel">UV en waarschuwingen staan altijd apart</h2>
            <p>
              Een mooie zomerdag kan een hoge score geven en tegelijk een hoge UV-index hebben. Daarom telt UV niet mee in
              de score, maar staat het er los naast, net als officiële weerwaarschuwingen. Een score zegt hoe prettig het
              weer is voor je sport, niet of het veilig is.{" "}
              <Link href="/weer-en-uv">Meer over weer en UV</Link>.
            </p>
          </section>

          <section className="page-card" id="vragen" aria-labelledby="vragen-titel">
            <h2 id="vragen-titel">Veelgestelde vragen</h2>
            <Faq
              items={[
                {
                  q: "Wat kost WeerSport?",
                  a: (
                    <p>
                      Met een gratis Basis-account krijg je {BASIS_MONTHLY_LIMIT} adviezen per maand. Pro kost{" "}
                      {formatEuro(PRO_PRICE_EUR)} per maand en geeft {PRO_MONTHLY_LIMIT} adviezen, zonder advertenties.{" "}
                      <Link href="/prijzen">Bekijk de prijzen</Link>.
                    </p>
                  ),
                },
                {
                  q: "Waarom heb ik een account nodig?",
                  a: (
                    <p>
                      Elk advies haalt een verse verwachting op. Met een account houden we bij hoeveel adviezen je deze
                      maand hebt gebruikt, en kun je momenten en zoekopdrachten bewaren.
                    </p>
                  ),
                },
                {
                  q: "Wanneer telt iets als advies?",
                  a: (
                    <p>
                      Alleen wanneer je een nieuw advies opent. Kiezen, bewaren en terugkijken kost niets. Open je binnen een
                      uur hetzelfde advies opnieuw, dan telt dat niet nog een keer.
                    </p>
                  ),
                },
                {
                  q: "Waarom alleen Nederland?",
                  a: (
                    <p>
                      WeerSport gebruikt Nederlandse plaatsgegevens en, waar gekoppeld, Nederlandse bronnen zoals het KNMI
                      en Rijkswaterstaat. Daardoor kunnen we alleen voor plekken in Nederland een betrouwbaar advies geven.
                    </p>
                  ),
                },
                {
                  q: "Heeft sponsoring invloed op de score?",
                  a: (
                    <p>
                      Nee. Sponsors staan duidelijk herkenbaar naast het advies en betalen voor zichtbaarheid bij een sport,
                      nooit voor een hogere score.
                    </p>
                  ),
                },
                {
                  q: "Is een hoge score een veiligheidsadvies?",
                  a: (
                    <p>
                      Nee. De score zegt hoe goed het verwachte weer bij je sport past. Kijk bij twijfel altijd naar de
                      officiële waarschuwingen van het KNMI en naar de situatie ter plekke.
                    </p>
                  ),
                },
              ]}
            />
          </section>

          <CtaCard title="Probeer het voor jouw sport">Kies je sport en plek en zie je beste moment in de komende 48 uur.</CtaCard>
        </div>
      </main>
    </>
  );
}
