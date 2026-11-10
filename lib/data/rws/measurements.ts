import { DATA_FLAG, dataFlagEnabled } from "@/lib/data/flags";
import { recordProviderHealth } from "@/lib/data/providers/health";
import { providerRequest } from "@/lib/data/providers/http";
import { parseRwsCatalog, WATER_QUANTITIES, type CatalogLocation } from "@/lib/data/rws/catalog";
import { interpretRwsQuality, metresFrom } from "@/lib/data/rws/quality";
import { matchWaterLocation } from "@/lib/data/rws/spot-mapping";
import { readRwsCatalog, writeRwsCatalog } from "@/lib/data/storage/memory";
import type { SportSpotDraft } from "@/lib/data/geo/locations";
import type { WaterBundle, WaterReading } from "@/lib/data/types";
import type { SourceStatus } from "@/lib/data/types";

const BASE = "https://ddapi20-waterwebservices.rijkswaterstaat.nl";

export async function ingestRwsCatalog(): Promise<{ ok: true; records: number } | { ok: false; code: string; message: string }> {
  if (!dataFlagEnabled(DATA_FLAG.rws)) return { ok: false, code: "FLAG_OFF", message: "RWS-flag staat uit." };
  const started = Date.now();
  const response = await providerRequest({
    provider: "rws",
    url: `${BASE}/METADATASERVICES/OphalenCatalogus`,
    timeoutMs: 20_000,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ CatalogusFilter: { Compartimenten: true, Grootheden: true } }),
    },
  });
  if (!response.ok || response.json === null) {
    recordProviderHealth({
      provider: "rws",
      status: "ERROR",
      lastSuccessAt: readRwsCatalog().fetchedAt,
      lastPublishedAt: null,
      lastErrorCode: response.ok ? "SCHEMA" : response.code,
      records: 0,
      requests: 1,
      latencyMs: Date.now() - started,
      note: "Catalogus niet bereikbaar.",
    });
    return { ok: false, code: response.ok ? "SCHEMA" : response.code, message: "RWS-catalogus is niet bereikbaar." };
  }
  const locations = parseRwsCatalog(response.json);
  if (!locations) return { ok: false, code: "SCHEMA", message: "RWS-catalogus is onvolledig." };
  const fetchedAt = new Date().toISOString();
  writeRwsCatalog(locations, fetchedAt);
  recordProviderHealth({
    provider: "rws",
    status: "READY",
    lastSuccessAt: fetchedAt,
    lastPublishedAt: fetchedAt,
    lastErrorCode: null,
    records: locations.length,
    requests: 1,
    latencyMs: Date.now() - started,
    note: "Catalogus bijgewerkt.",
  });
  return { ok: true, records: locations.length };
}

function numericOf(measurement: Record<string, unknown>) {
  const value = measurement.Meetwaarde;
  if (!value || typeof value !== "object") return null;
  const numeric = (value as { Waarde_Numeriek?: unknown }).Waarde_Numeriek;
  return typeof numeric === "number" ? numeric : null;
}

export function readingFromObservation(input: {
  payload: unknown;
  quantityCode: string;
  location: CatalogLocation;
  distanceKm: number | null;
  coverage: WaterReading["coverage"];
}): WaterReading | null {
  const root = input.payload && typeof input.payload === "object" ? (input.payload as Record<string, unknown>) : null;
  const list = Array.isArray(root?.WaarnemingenLijst) ? root.WaarnemingenLijst : [];
  const first = list[0] && typeof list[0] === "object" ? (list[0] as Record<string, unknown>) : null;
  const meta = first?.AquoMetadata && typeof first.AquoMetadata === "object" ? (first.AquoMetadata as Record<string, unknown>) : null;
  const unitRecord = meta?.Eenheid && typeof meta.Eenheid === "object" ? (meta.Eenheid as Record<string, unknown>) : null;
  const unit = typeof unitRecord?.Code === "string" ? unitRecord.Code : null;
  const quantity = meta?.Grootheid && typeof meta.Grootheid === "object" ? (meta.Grootheid as Record<string, unknown>) : null;
  if (quantity?.Code !== input.quantityCode) return null;
  const measurements = Array.isArray(first?.MetingenLijst) ? first.MetingenLijst : [];
  const measurement = measurements[0] && typeof measurements[0] === "object" ? (measurements[0] as Record<string, unknown>) : null;
  if (!measurement) return null;
  const observed = measurement.WaarnemingMetadata && typeof measurement.WaarnemingMetadata === "object"
    ? (measurement.WaarnemingMetadata as Record<string, unknown>)
    : null;
  const quality = typeof observed?.Kwaliteitswaardecode === "string" ? observed.Kwaliteitswaardecode : null;
  const interpreted = interpretRwsQuality(quality, numericOf(measurement));
  const description = WATER_QUANTITIES.find((item) => item.code === input.quantityCode);
  const catalogQuantity = input.location.quantities.find((item) => item.code === input.quantityCode);
  let value = interpreted.value;
  let reportedUnit = unit;
  if (description?.field === "wave" || description?.field === "level") {
    const metres = value === null ? null : metresFrom(value, unit);
    if (value !== null && metres === null) value = null;
    else value = metres;
    reportedUnit = value === null ? unit : "m";
  }
  if (description?.field === "current" && unit && unit.toLowerCase() !== "m/s") value = null;
  return {
    parameter: input.quantityCode,
    label: catalogQuantity?.description ?? input.quantityCode,
    value,
    unit: reportedUnit,
    observedAt: typeof measurement.Tijdstip === "string" ? measurement.Tijdstip : null,
    stationId: input.location.code,
    stationLabel: input.location.name,
    distanceKm: input.distanceKm,
    qualityCode: quality,
    coverage: interpreted.accepted ? input.coverage : "NONE",
  };
}

export async function collectWater(spot: SportSpotDraft | null): Promise<{
  status: SourceStatus;
  message: string;
  value: WaterBundle | null;
  publishedAt: string | null;
}> {
  if (!dataFlagEnabled(DATA_FLAG.rws)) {
    return {
      status: "NOT_LINKED",
      message: "Waterdata niet gekoppeld. Geen veilige-waterclaim.",
      value: null,
      publishedAt: null,
    };
  }
  const catalog = readRwsCatalog();
  if (catalog.locations.length === 0) {
    return {
      status: "NOT_COVERED",
      message: "RWS-catalogus is nog niet ingelezen. Er is geen watermeting.",
      value: null,
      publishedAt: null,
    };
  }
  const readings: WaterReading[] = [];
  for (const quantity of WATER_QUANTITIES) {
    const match = matchWaterLocation({ spot, locations: catalog.locations, quantityCode: quantity.code });
    if (!match.location || match.coverage === "NONE") continue;
    const response = await providerRequest({
      provider: "rws",
      url: `${BASE}/ONLINEWAARNEMINGENSERVICES/OphalenLaatsteWaarnemingen`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          AquoPlusWaarnemingMetadataLijst: [
            { AquoMetadata: { Compartiment: { Code: "OW" }, Grootheid: { Code: quantity.code } } },
          ],
          LocatieLijst: [{ Code: match.location.code }],
        }),
      },
    });
    if (!response.ok || response.json === null) continue;
    const reading = readingFromObservation({
      payload: response.json,
      quantityCode: quantity.code,
      location: match.location,
      distanceKm: match.distanceKm,
      coverage: match.coverage,
    });
    if (reading) readings.push(reading);
  }
  const accepted = readings.filter((reading) => reading.value !== null && reading.coverage !== "NONE");
  if (accepted.length === 0) {
    return {
      status: "NOT_COVERED",
      message: "Geen bruikbaar meetpunt voor deze waterlocatie. Er is geen stroming of temperatuur verzonnen.",
      value: { waterTemperatureC: null, waveHeightM: null, currentMs: null, readings },
      publishedAt: null,
    };
  }
  const temperature = accepted.find((reading) => reading.parameter === "T");
  const wave = accepted.find((reading) => reading.parameter === "Hm0");
  const current = accepted.find((reading) => reading.parameter === "STROOMSHD");
  const newest = accepted
    .map((reading) => reading.observedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  return {
    status: readings.some((reading) => reading.value === null) ? "PARTIAL" : "READY",
    message: `Gemeten bij ${accepted[0].stationLabel}${accepted[0].distanceKm !== null ? `, ${accepted[0].distanceKm.toFixed(1)} km` : ""}.`,
    value: {
      waterTemperatureC: temperature?.value ?? null,
      waveHeightM: wave?.value ?? null,
      currentMs: current?.value ?? null,
      readings: accepted,
    },
    publishedAt: newest,
  };
}
