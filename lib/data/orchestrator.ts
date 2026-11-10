import { matchKnmiWarnings } from "@/lib/data/knmi/ingest";
import { collectAir } from "@/lib/data/luchtmeetnet/measurements";
import { PROVIDER_RIGHTS } from "@/lib/data/providers/contracts";
import { collectWater } from "@/lib/data/rws/measurements";
import { safetyFromWarnings } from "@/lib/data/safety-gate";
import type { SportSpotDraft } from "@/lib/data/geo/locations";
import type { AirBundle, SourceObservation, WarningBundle, WaterBundle } from "@/lib/data/types";

function observation<T>(input: {
  sourceId: string;
  sourceLabel: string;
  status: SourceObservation<T>["status"];
  rightsNote: string;
  coverageNote: string;
  publishedAt: string | null;
  locationLabel: string | null;
  value: T | null;
  message: string;
}): SourceObservation<T> {
  return { ...input, receivedAt: new Date().toISOString(), validUntil: null, demo: false };
}

export async function collectOpenData(input: {
  placeLabel: string;
  latitude: number;
  longitude: number;
  spot: SportSpotDraft | null;
}) {
  const from = new Date();
  const until = new Date(from.getTime() + 48 * 60 * 60 * 1000);
  const latitude = input.spot?.latitude ?? input.latitude;
  const longitude = input.spot?.longitude ?? input.longitude;
  const knmi = matchKnmiWarnings({ latitude, longitude, from, until });
  const [water, air] = await Promise.all([
    collectWater(input.spot),
    collectAir({ latitude, longitude }),
  ]);
  const warnings: SourceObservation<WarningBundle> = observation({
    sourceId: "knmi-warnings",
    sourceLabel: "KNMI waarschuwingen",
    status: knmi.status,
    rightsNote: `${PROVIDER_RIGHTS.knmi.attribution} ${PROVIDER_RIGHTS.knmi.license}. ${PROVIDER_RIGHTS.knmi.sourceUrl}`,
    coverageNote: "Alleen een geldige operationele snapshot mag een leeg waarschuwingsbeeld tonen.",
    publishedAt: knmi.publishedAt,
    locationLabel: input.spot?.name ?? input.placeLabel,
    value: { items: knmi.items },
    message: knmi.message,
  });
  const waterObservation: SourceObservation<WaterBundle> = observation({
    sourceId: "rws-waterwebservices",
    sourceLabel: "Rijkswaterstaat WaterWebservices",
    status: water.status,
    rightsNote: `${PROVIDER_RIGHTS.rws.attribution} ${PROVIDER_RIGHTS.rws.license}. ${PROVIDER_RIGHTS.rws.sourceUrl}`,
    coverageNote: "Meting op een meetpunt, niet vanzelf de gekozen woonplaats en geen voorspelling.",
    publishedAt: water.publishedAt,
    locationLabel: input.spot?.name ?? input.placeLabel,
    value: water.value,
    message: water.message,
  });
  const airQuality: SourceObservation<AirBundle> = observation({
    sourceId: "luchtmeetnet",
    sourceLabel: "Luchtmeetnet",
    status: air.status,
    rightsNote: `${PROVIDER_RIGHTS.luchtmeetnet.attribution}. ${PROVIDER_RIGHTS.luchtmeetnet.license}. ${PROVIDER_RIGHTS.luchtmeetnet.sourceUrl}`,
    coverageNote: "Uurmeting van een station. Niet de lucht op het adres en niet een 48-uursverwachting.",
    publishedAt: air.publishedAt,
    locationLabel: input.placeLabel,
    value: air.value,
    message: air.message,
  });
  return { warnings, water: waterObservation, airQuality, safety: safetyFromWarnings(knmi) };
}

export function hasAcceptedWaterMeasurement(water: SourceObservation<WaterBundle>) {
  return (water.value?.readings ?? []).some((reading) => reading.value !== null && reading.coverage !== "NONE");
}
