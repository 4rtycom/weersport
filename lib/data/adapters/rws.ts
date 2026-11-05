import type { SourceObservation, WaterBundle } from "@/lib/data/types";

/**
 * RWS WADAR / Waterinfo is listed as a source category to verify.
 * Public probes from this environment returned 404; never invent water safety from air temperature.
 */
export async function fetchRwsWater(placeLabel: string): Promise<SourceObservation<WaterBundle>> {
  return {
    sourceId: "rws-wadar",
    sourceLabel: "RWS WADAR",
    status: "NOT_LINKED",
    rightsNote: "Rijkswaterstaat WADAR/Waterinfo moet met dekking en hergebruikrechten worden gekoppeld.",
    coverageNote: "Meetpunt is niet representatief voor elk watergebied.",
    publishedAt: null,
    receivedAt: new Date().toISOString(),
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: null,
    message: "Waterdata niet gekoppeld. Geen veilige-waterclaim.",
  };
}
