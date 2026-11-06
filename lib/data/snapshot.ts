import { fetchKnmiWarnings } from "@/lib/data/adapters/knmi";
import { fetchOpenMeteoWeather } from "@/lib/data/adapters/open-meteo";
import { lookupPlaceCoords } from "@/lib/data/adapters/pdok-geo";
import { fetchRwsWater } from "@/lib/data/adapters/rws";
import { fetchZwemwater } from "@/lib/data/adapters/zwemwater";
import { townCentroidCoverage } from "@/lib/data/contracts";
import { sportDependency } from "@/lib/data/sport-dependencies";
import type { ForecastSnapshot } from "@/lib/data/types";
import type { SearchDraft } from "@/lib/draft";
import { scoreSportHours } from "@/lib/scoring/engine";
import { findSport } from "@/lib/sports";

export async function buildForecastSnapshot(draft: SearchDraft): Promise<ForecastSnapshot> {
  const sport = findSport(draft.sportId);
  const deps = sportDependency(sport.id);
  const coverage = townCentroidCoverage(draft.placeId, draft.placeLabel);
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
  const siteSpecificCoverage = coverage.kind === "site-specific";
  const suitability = scoreSportHours({
    sportId: sport.id,
    hours: weatherPair.weather.value?.hours ?? [],
    waterLinked,
    swimLinked,
    siteSpecificCoverage,
    coverageNote: coverage.note,
  });

  const sources = [weatherPair.weather, weatherPair.uv, warnings, water, swim].map((item) => ({
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
    generatedAt: new Date().toISOString(),
    weather: weatherPair.weather,
    uv: weatherPair.uv,
    warnings,
    water,
    swim,
    suitability,
    coverage: {
      kind: coverage.kind,
      note: coverage.note,
    },
    dependencies: {
      terrain: deps.terrain,
      required: deps.required,
      scoreBlocking: deps.scoreBlocking,
      coverageNote: deps.coverageNote,
    },
    sources,
  };
}
