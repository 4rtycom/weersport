import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaCard, Meter } from "@/components/info-blocks";
import { LiveMomentCard } from "@/components/live-moment-card";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SportIcon } from "@/components/sport-icon";
import { cities, findCity, landSports, liveMoment } from "@/lib/live";
import { getScoreProfile } from "@/lib/scoring/profiles";
import { guideCopy } from "@/lib/sport-guide-copy";

type Props = { params: Promise<{ sport: string; plaats: string }> };

// Rebuilt at most every 30 minutes, so search engines and visitors get a recent forecast without a request per visit.
export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { sport: string } }) {
  if (!landSports.some((sport) => sport.id === params.sport)) return [];
  return cities.map((city) => ({ plaats: city.slug }));
}

function resolve(sportId: string, citySlug: string) {
  const sport = landSports.find((item) => item.id === sportId);
  const city = findCity(citySlug);
  if (!sport || !city) notFound();
  return { sport, city };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport, plaats } = await params;
  const resolved = resolve(sport, plaats);
  return {
    title: `${resolved.sport.name} in ${resolved.city.label}: het beste moment`,
    description: `Wanneer kun je vandaag of morgen het beste ${resolved.sport.name.toLowerCase()} in ${resolved.city.label}? Per uur doorgerekend op temperatuur, wind en regen.`,
    alternates: { canonical: `/sporten/${resolved.sport.id}/${resolved.city.slug}` },
  };
}

export default async function LocalSportPage({ params }: Props) {
  const { sport: sportId, plaats } = await params;
  const { sport, city } = resolve(sportId, plaats);
  const profile = getScoreProfile(sport.id);
  const [question, advice] = guideCopy[sport.id];
  const live = await liveMoment(sport.id, city.slug, 6000);
  const otherCities = cities.filter((item) => item.slug !== city.slug);
  const otherSports = landSports.filter((item) => item.id !== sport.id).slice(0, 8);

  return (
    <>
      <SiteHeaderBar />
      <main id="inhoud" className="page">
        <PageHero
          back={{ href: `/sporten/${sport.id}`, label: `Sportgids ${sport.name.toLowerCase()}` }}
          icon={<SportIcon src={sport.icon} size={32} />}
          title={`${sport.name} in ${city.label}`}
          lead={`Wanneer is het weer in ${city.label} het best voor ${sport.name.toLowerCase()}? Elk uur van de komende 48 uur doorgerekend op de actuele verwachting.`}
        />
        <div className="page-body page-body-narrow info">
          {live ? (
            <LiveMomentCard moment={live} showCurve headingLevel={2} />
          ) : (
            <section className="page-card">
              <h2>De verwachting is even niet beschikbaar</h2>
              <p>Probeer het zo opnieuw, of zoek je moment direct in de planner.</p>
            </section>
          )}

          <section className="page-card" aria-labelledby="weging-titel">
            <h2 id="weging-titel">Zo kijkt WeerSport naar {sport.name.toLowerCase()}</h2>
            <p className="local-question">{question}</p>
            <p>{advice}</p>
            <div className="weight-card local-weights">
              <Meter label="Temperatuur" value={Math.round(profile.weights.temperature * 100)} />
              <Meter label="Wind" value={Math.round(profile.weights.wind * 100)} />
              <Meter label="Regen" value={Math.round(profile.weights.rain * 100)} />
            </div>
            <p>
              Volle punten tussen {profile.idealTempC[0]} en {profile.idealTempC[1]} °C en bij {profile.idealWindKmh[0]}{" "}
              tot {profile.idealWindKmh[1]} km/u wind. <Link href={`/sporten/${sport.id}`}>Lees de hele sportgids</Link>.
            </p>
          </section>

          <CtaCard
            title={`Plan ${sport.name.toLowerCase()} in ${city.label}`}
            href={`/?sport=${sport.id}&plaats=${city.slug}#planner`}
            label="Open in de planner →"
          >
            Bewaar je moment en bekijk het volledige advies met UV en waarschuwingen.
          </CtaCard>

          <section className="page-card page-card-muted" aria-labelledby="meer-titel">
            <h2 id="meer-titel">Ook bekijken</h2>
            <p>{sport.name} in een andere plaats:</p>
            <ul className="link-chips">
              {otherCities.map((item) => (
                <li key={item.slug}>
                  <Link href={`/sporten/${sport.id}/${item.slug}`}>{item.label}</Link>
                </li>
              ))}
            </ul>
            <p>Andere sporten in {city.label}:</p>
            <ul className="link-chips">
              {otherSports.map((item) => (
                <li key={item.id}>
                  <Link href={`/sporten/${item.id}/${city.slug}`}>{item.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
