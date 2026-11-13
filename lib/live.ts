import { fetchOpenMeteoWeather } from "@/lib/data/adapters/open-meteo";
import { ICE_CRITICAL_SPORTS, WATER_CRITICAL_SPORTS, type HourlyScorePoint, type UvBundle, type WeatherHour } from "@/lib/data/types";
import { parseSportTimestamp } from "@/lib/data/time";
import { scoreSportHours } from "@/lib/scoring/engine";
import { findSport, sports } from "@/lib/sports";

/** Larger Dutch places with an approximate centre. Used for the homepage example and the local sport pages. */
export const cities = [
  { slug: "amsterdam", label: "Amsterdam", latitude: 52.3676, longitude: 4.9041 },
  { slug: "rotterdam", label: "Rotterdam", latitude: 51.9244, longitude: 4.4777 },
  { slug: "den-haag", label: "Den Haag", latitude: 52.0705, longitude: 4.3007 },
  { slug: "utrecht", label: "Utrecht", latitude: 52.0907, longitude: 5.1214 },
  { slug: "eindhoven", label: "Eindhoven", latitude: 51.4416, longitude: 5.4697 },
  { slug: "groningen", label: "Groningen", latitude: 53.2194, longitude: 6.5665 },
  { slug: "nijmegen", label: "Nijmegen", latitude: 51.8126, longitude: 5.8372 },
  { slug: "arnhem", label: "Arnhem", latitude: 51.9851, longitude: 5.8987 },
  { slug: "zwolle", label: "Zwolle", latitude: 52.5168, longitude: 6.083 },
  { slug: "haarlem", label: "Haarlem", latitude: 52.3874, longitude: 4.6462 },
  { slug: "leiden", label: "Leiden", latitude: 52.1601, longitude: 4.497 },
  { slug: "maastricht", label: "Maastricht", latitude: 50.8514, longitude: 5.691 },
] as const;

export type City = (typeof cities)[number];

export function findCity(slug: string) {
  return cities.find((city) => city.slug === slug) ?? null;
}

/** Sports that get a score from the weather alone; water and ice sports need measurements we may not have. */
export const landSports = sports.filter((sport) => !WATER_CRITICAL_SPORTS.has(sport.id) && !ICE_CRITICAL_SPORTS.has(sport.id));

export type LiveMoment = {
  sportId: string;
  sportName: string;
  placeLabel: string;
  generatedAt: string;
  score: number;
  peakScore: number;
  badge: "GOED" | "MATIG" | "SLECHT";
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  bestTimeLabel: string;
  peakHour: HourlyScorePoint | null;
  hourly: HourlyScorePoint[];
  alternatives: Array<{ start: string; score: number }>;
  factors: Array<{ id: string; label: string; impact: number; explanation: string }>;
  uv: UvBundle;
  tooltip: string;
};

type CityWeather = { hours: WeatherHour[]; uv: UvBundle; fetchedAt: number };

// One forecast per place is enough for every sport; keep it for 30 minutes to stay gentle on the provider.
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CityWeather>();
const inflight = new Map<string, Promise<CityWeather | null>>();

async function cityWeather(city: { slug: string; label: string; latitude: number; longitude: number }) {
  const hit = cache.get(city.slug);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;
  const running = inflight.get(city.slug);
  if (running) return running;
  const job = fetchOpenMeteoWeather({ latitude: city.latitude, longitude: city.longitude, placeLabel: city.label })
    .then((pair) => {
      const hours = pair.weather.value?.hours ?? [];
      if (pair.weather.status !== "READY" || hours.length === 0 || !pair.uv.value) return hit ?? null;
      const entry = { hours, uv: pair.uv.value, fetchedAt: Date.now() };
      cache.set(city.slug, entry);
      return entry;
    })
    .catch(() => hit ?? null)
    .finally(() => inflight.delete(city.slug));
  inflight.set(city.slug, job);
  return job;
}

function hourKey(iso: string) {
  return parseSportTimestamp(iso).getTime();
}

/**
 * The best moment for one sport in one place, from the live Open-Meteo forecast.
 * Returns null when the forecast is unavailable or slower than `timeoutMs`, so callers can fall back.
 */
export async function liveMoment(sportId: string, citySlug: string, timeoutMs = 2500): Promise<LiveMoment | null> {
  const city = findCity(citySlug);
  if (!city) return null;
  const weather = await Promise.race([
    cityWeather(city),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (!weather) return null;
  const outcome = scoreSportHours({ sportId, hours: weather.hours });
  if (outcome.kind !== "SCORED") return null;

  const peakAt = hourKey(outcome.peakWindow.peakTime);
  const alternatives = [...outcome.hourly]
    .filter((point) => Math.abs(hourKey(point.time) - peakAt) >= 3 * 60 * 60 * 1000)
    .sort((a, b) => b.score - a.score)
    .reduce<HourlyScorePoint[]>((kept, point) => {
      if (kept.every((other) => Math.abs(hourKey(other.time) - hourKey(point.time)) >= 3 * 60 * 60 * 1000)) kept.push(point);
      return kept;
    }, [])
    .slice(0, 2)
    .map((point) => ({ start: point.time, score: point.score }));

  return {
    sportId,
    sportName: findSport(sportId).name,
    placeLabel: city.label,
    generatedAt: new Date(weather.fetchedAt).toISOString(),
    score: outcome.score,
    peakScore: outcome.peakWindow.peakScore,
    badge: outcome.badge,
    windowStart: outcome.peakWindow.start,
    windowEnd: outcome.peakWindow.end,
    windowLabel: outcome.peakWindow.label.replace(/^Beste moment\s*·\s*/, ""),
    bestTimeLabel: outcome.bestTimeLabel,
    peakHour: outcome.hourly.find((point) => point.time === outcome.peakWindow.peakTime) ?? null,
    hourly: outcome.hourly,
    alternatives,
    factors: outcome.factors,
    uv: weather.uv,
    tooltip: outcome.tooltip,
  };
}
