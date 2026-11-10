import { collectWater } from "@/lib/data/rws/measurements";
import { PROVIDER_RIGHTS } from "@/lib/data/providers/contracts";
import type { SourceObservation, WaterBundle } from "@/lib/data/types";

/** Rijkswaterstaat WaterWebservices. A place name alone is not a waterbody match. */
export async function fetchRwsWater(placeLabel: string): Promise<SourceObservation<WaterBundle>> {
  const water = await collectWater(null);
  return {
    sourceId: "rws-waterwebservices",
    sourceLabel: "Rijkswaterstaat WaterWebservices",
    status: water.status,
    rightsNote: `${PROVIDER_RIGHTS.rws.attribution} ${PROVIDER_RIGHTS.rws.license}.`,
    coverageNote: "Meetpunt is niet representatief voor elk watergebied.",
    publishedAt: water.publishedAt,
    receivedAt: new Date().toISOString(),
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: water.value,
    message: water.message,
  };
}
