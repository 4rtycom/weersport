import { matchKnmiWarnings } from "@/lib/data/knmi/ingest";
import { PROVIDER_RIGHTS } from "@/lib/data/providers/contracts";
import type { SourceObservation, WarningBundle } from "@/lib/data/types";

/**
 * KNMI public weather warnings 1.0. Without the flag, or without a usable server key,
 * the status stays NOT_LINKED. A missing feed is never reported as an empty warning list.
 */
export async function fetchKnmiWarnings(
  placeLabel: string,
  point?: { latitude: number; longitude: number },
): Promise<SourceObservation<WarningBundle>> {
  const receivedAt = new Date().toISOString();
  const from = new Date();
  const until = new Date(from.getTime() + 48 * 60 * 60 * 1000);
  const match = point
    ? matchKnmiWarnings({ latitude: point.latitude, longitude: point.longitude, from, until })
    : {
        status: "NOT_LINKED" as const,
        publishedAt: null,
        message: "Bron niet gekoppeld / geen veiligheidsoordeel",
        items: [],
      };
  return {
    sourceId: "knmi-warnings",
    sourceLabel: "KNMI waarschuwingen",
    status: match.status,
    rightsNote: `${PROVIDER_RIGHTS.knmi.attribution} ${PROVIDER_RIGHTS.knmi.license}.`,
    coverageNote: "Gebiedsgerichte officiële waarschuwingen voor Nederland.",
    publishedAt: match.publishedAt,
    receivedAt,
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: { items: match.items },
    message: match.message,
  };
}
