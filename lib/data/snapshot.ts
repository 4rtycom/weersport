import { fetchKnmiWarnings } from "@/lib/data/adapters/knmi";
import { fetchOpenMeteoWeather } from "@/lib/data/adapters/open-meteo";
import { lookupPlaceCoords } from "@/lib/data/adapters/pdok-geo";
import { fetchRwsWater } from "@/lib/data/adapters/rws";
import { fetchZwemwater } from "@/lib/data/adapters/zwemwater";
import type { ForecastSnapshot } from "@/lib/data/types";
import type { SearchDraft } from "@/lib/draft";
import { scoreSportHours } from "@/lib/scoring/engine";
import { findSport } from "@/lib/sports";

export async function buildForecastSnapshot(draft: SearchDraft): Promise<ForecastSnapshot> {
  const sport = findSport(draft.sportId);
  const coords = await lookupPlaceCoords(draft.placeId);
  const [weatherPair, warnings, water, swim] = await Promise.all([
    fetchOpenMeteoWeather({
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeLabel: draft.placeLabel,
    }),
    fetchKnmiWarnings(draft.placeLabel),
    fetchRwsWater(draft.placeLabel),
    fetchZwemwater(draft.placeLabel),
  ]);

  const waterLinked = water.status === "READY" || water.status === "PARTIAL";
  const swimLinked = swim.status === "READY" || swim.status === "PARTIAL";
  const suitability = scoreSportHours({
    sportId: sport.id,
    hours: weatherPair.weather.value?.hours ?? [],
    waterLinked,
    swimLinked,
  });

  const sources = [
    weatherPair.weather,
    weatherPair.uv,
    warnings,
    water,
    swim,
  ].map((item) => ({
    id: item.sourceId,
    label: item.sourceLabel,
    status: item.status,
    message: item.message,
    rightsNote: item.rightsNote,
  }));

  return {
    sportId: sport.id,
    sportName: sport.name,
    placeLabel: draft.placeLabel,
    period: draft.period,
    generatedAt: new Date().toISOString(),
    weather: weatherPair.weather,
    uv: weatherPair.uv,
    warnings,
    water,
    swim,
    suitability,
    sources,
  };
}
