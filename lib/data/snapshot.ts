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

  const linked = water.status !== "NOT_LINKED" && swim.status !== "NOT_LINKED";
  const suitability = scoreSportHours({
    sportId: sport.id,
    hours: weatherPair.weather.value?.hours ?? [],
    placeId: draft.placeId,
    spotId: draft.spotId,
    swim:
      sport.id === "openwaterzwemmen"
        ? {
            placeId: draft.placeId,
            spotId: draft.spotId,
            spotClass: draft.spotId ? "official" : "missing",
            waterKind: water.value?.waterKind ?? null,
            coverage: linked ? (water.status === "PARTIAL" || swim.status === "PARTIAL" ? "insufficient" : "ok") : "unlinked",
            readings: [],
            now: new Date(),
          }
        : null,
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
    placeId: draft.placeId,
    placeLabel: draft.placeLabel,
    period: draft.period,
    spotId: draft.spotId,
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
