import type { SourceObservation, SwimBundle } from "@/lib/data/types";

/**
 * Zwemwater / BIJ12 is listed as a source category to verify.
 * The public API host was unreachable here; quality advice is never improvised.
 */
export async function fetchZwemwater(placeLabel: string): Promise<SourceObservation<SwimBundle>> {
  return {
    sourceId: "zwemwater-bij12",
    sourceLabel: "Zwemwater / BIJ12",
    status: "NOT_LINKED",
    rightsNote: "Officiële zwemwaterstatus vereist tijdige data en hergebruikrechten.",
    coverageNote: "Geen realtime claim zonder tijdige officiële data.",
    publishedAt: null,
    receivedAt: new Date().toISOString(),
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: null,
    message: "Zwemwaterstatus niet gekoppeld.",
  };
}
