import { collectOpenData, hasAcceptedWaterMeasurement } from "@/lib/data/orchestrator";
import { fetchOpenMeteoWeather } from "@/lib/data/adapters/open-meteo";
import { lookupPlaceCoords } from "@/lib/data/adapters/pdok-geo";
import { fetchZwemwater } from "@/lib/data/adapters/zwemwater";
import type { ForecastSnapshot } from "@/lib/data/types";
import type { SearchDraft } from "@/lib/draft";
import { scoreSportHours } from "@/lib/scoring/engine";
import { findSport } from "@/lib/sports";

export async function buildForecastSnapshot(draft: SearchDraft): Promise<ForecastSnapshot> {
  const sport = findSport(draft.sportId);
  const coords = await lookupPlaceCoords(draft.placeId);
  const [weatherPair, openData, swim] = await Promise.all([
    fetchOpenMeteoWeather({
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeLabel: draft.placeLabel,
    }),
    collectOpenData({
      placeLabel: draft.placeLabel,
      latitude: coords.latitude,
      longitude: coords.longitude,
      spot: draft.sportSpot ?? null,
    }),
    fetchZwemwater(draft.placeLabel),
  ]);

  const suitability = scoreSportHours({
    sportId: sport.id,
    hours: weatherPair.weather.value?.hours ?? [],
    hasAcceptedWaterMeasurement: hasAcceptedWaterMeasurement(openData.water),
  });

  const sources = [weatherPair.weather, weatherPair.uv, openData.warnings, openData.water, openData.airQuality, swim].map(
    (item) => ({
      id: item.sourceId,
      label: item.sourceLabel,
      status: item.status,
      message: item.message,
      rightsNote: item.rightsNote,
    }),
  );

  return {
    sportId: sport.id,
    sportName: sport.name,
    placeId: draft.placeId,
    placeLabel: draft.placeLabel,
    period: draft.period,
    generatedAt: new Date().toISOString(),
    weather: weatherPair.weather,
    uv: weatherPair.uv,
    warnings: openData.warnings,
    water: openData.water,
    airQuality: openData.airQuality,
    swim,
    safety: openData.safety,
    suitability,
    sources,
  };
}
