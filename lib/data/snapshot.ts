import { fetchKnmiWarnings } from "@/lib/data/adapters/knmi";
import { fetchOpenMeteoWeather } from "@/lib/data/adapters/open-meteo";
import { lookupPlaceCoords } from "@/lib/data/adapters/pdok-geo";
import { fetchRwsWater } from "@/lib/data/adapters/rws";
import { fetchZwemwater } from "@/lib/data/adapters/zwemwater";
import {
  ICE_CRITICAL_SPORTS,
  WATER_CRITICAL_SPORTS,
  type ForecastSnapshot,
  type SuitabilityOutcome,
} from "@/lib/data/types";
import type { SearchDraft } from "@/lib/draft";
import { findSport } from "@/lib/sports";

function suitabilityFor(sportId: string, waterLinked: boolean, swimLinked: boolean): SuitabilityOutcome {
  if (ICE_CRITICAL_SPORTS.has(sportId)) {
    return {
      kind: "NO_SCORE",
      reason:
        "Natuurijs wordt nooit veilig verklaard op basis van luchttemperatuur alleen. IJsdata ontbreekt → NO_SCORE.",
    };
  }
  if (WATER_CRITICAL_SPORTS.has(sportId)) {
    if (!waterLinked || (sportId === "openwaterzwemmen" && !swimLinked)) {
      return {
        kind: "NO_SCORE",
        reason:
          "Kritieke water- of zwemwaterdata ontbreekt. Er is geen geruststellende sportgeschiktheidsscore.",
      };
    }
  }
  return {
    kind: "PENDING_PHASE_04",
    reason:
      "Weer- en veiligheidsbronnen zijn aangesloten of gemarkeerd. Gevalideerde sportscore 0–100 volgt in fase 04.",
  };
}

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
  const suitability = suitabilityFor(sport.id, waterLinked, swimLinked);

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
