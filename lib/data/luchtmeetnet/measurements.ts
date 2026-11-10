import { DATA_FLAG, dataFlagEnabled } from "@/lib/data/flags";
import { recordProviderHealth } from "@/lib/data/providers/health";
import { providerRequest } from "@/lib/data/providers/http";
import { readCache, writeCache } from "@/lib/data/providers/cache";
import {
  AIR_FORMULAS,
  airIsFresh,
  selectAirStation,
  takeAirBudget,
  type AirFormula,
} from "@/lib/data/luchtmeetnet/representativeness";
import { parseStationDetail, parseStationList, stationListPages, type AirStation } from "@/lib/data/luchtmeetnet/stations";
import { readAirStations, writeAirStations } from "@/lib/data/storage/memory";
import type { AirBundle, AirReading, SourceStatus } from "@/lib/data/types";

const BASE = "https://api.luchtmeetnet.nl/open_api";

export async function ingestAirStations(): Promise<{ ok: true; records: number } | { ok: false; code: string; message: string }> {
  if (!dataFlagEnabled(DATA_FLAG.luchtmeetnet)) return { ok: false, code: "FLAG_OFF", message: "Luchtmeetnet-flag staat uit." };
  if (!takeAirBudget(1)) return { ok: false, code: "RATE_LIMITED", message: "Luchtmeetnet-limiet bereikt." };
  const first = await providerRequest({ provider: "luchtmeetnet", url: `${BASE}/stations?page=1` });
  if (!first.ok || first.json === null) return { ok: false, code: first.ok ? "SCHEMA" : first.code, message: "Stationslijst niet bereikbaar." };
  const listed = parseStationList(first.json);
  const pages = stationListPages(first.json);
  for (let page = 2; page <= pages; page += 1) {
    if (!takeAirBudget(1)) break;
    const next = await providerRequest({ provider: "luchtmeetnet", url: `${BASE}/stations?page=${page}` });
    if (next.ok && next.json) listed.push(...parseStationList(next.json));
  }
  const stations: AirStation[] = [];
  for (const row of listed) {
    if (!takeAirBudget(1)) break;
    const detail = await providerRequest({ provider: "luchtmeetnet", url: `${BASE}/stations/${encodeURIComponent(row.number)}` });
    if (!detail.ok || detail.json === null) continue;
    const station = parseStationDetail(row.number, row.label, detail.json);
    if (station) stations.push(station);
  }
  const fetchedAt = new Date().toISOString();
  writeAirStations(stations, fetchedAt);
  recordProviderHealth({
    provider: "luchtmeetnet",
    status: stations.length > 0 ? "READY" : "ERROR",
    lastSuccessAt: stations.length > 0 ? fetchedAt : null,
    lastPublishedAt: fetchedAt,
    lastErrorCode: stations.length > 0 ? null : "EMPTY",
    records: stations.length,
    requests: stations.length + 1,
    latencyMs: null,
    note: "Stationcatalogus bijgewerkt binnen de verzoeklimiet.",
  });
  return { ok: true, records: stations.length };
}

function parseMeasurement(payload: unknown, formula: string) {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const data = Array.isArray(root?.data) ? root.data : [];
  const row = data.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return (entry as { formula?: unknown }).formula === formula;
  }) as { value?: unknown; timestamp_measured?: unknown } | undefined;
  if (!row || typeof row.value !== "number") return { value: null, observedAt: null };
  return {
    value: row.value,
    observedAt: typeof row.timestamp_measured === "string" ? row.timestamp_measured : null,
  };
}

async function measurementFor(station: AirStation, formula: AirFormula | "LKI", distanceKm: number): Promise<AirReading> {
  const cacheKey = `air:${station.number}:${formula}`;
  const cached = readCache<AirReading>(cacheKey);
  if (cached) return cached;
  const empty: AirReading = {
    formula,
    value: null,
    unit: formula === "LKI" ? null : formula === "PM25" || formula === "PM10" ? "µg/m³" : "µg/m³",
    observedAt: null,
    stationId: station.number,
    stationLabel: station.label,
    stationType: station.stationType,
    distanceKm,
    fresh: false,
  };
  if (!takeAirBudget(1)) return empty;
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
  const url = `${BASE}/measurements?station_number=${encodeURIComponent(station.number)}&formula=${formula}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&page=1`;
  const response = await providerRequest({ provider: "luchtmeetnet", url });
  if (!response.ok || response.json === null) return empty;
  const parsed = parseMeasurement(response.json, formula);
  const reading: AirReading = {
    ...empty,
    value: parsed.value,
    observedAt: parsed.observedAt,
    fresh: airIsFresh(parsed.observedAt),
  };
  writeCache(cacheKey, reading, 30 * 60 * 1000);
  return reading;
}

export async function collectAir(input: { latitude: number; longitude: number }): Promise<{
  status: SourceStatus;
  message: string;
  value: AirBundle | null;
  publishedAt: string | null;
}> {
  if (!dataFlagEnabled(DATA_FLAG.luchtmeetnet)) {
    return {
      status: "NOT_LINKED",
      message: "Luchtkwaliteit niet gekoppeld. Er is geen meetwaarde ingevuld.",
      value: null,
      publishedAt: null,
    };
  }
  const catalog = readAirStations();
  if (catalog.stations.length === 0) {
    return {
      status: "NOT_COVERED",
      message: "Geen stationcatalogus. Luchtkwaliteit is niet beschikbaar.",
      value: { readings: [], note: "Geen station binnen bereik vastgesteld." },
      publishedAt: null,
    };
  }
  const readings: AirReading[] = [];
  let anchor: AirStation | null = null;
  let anchorDistance: number | null = null;
  for (const formula of AIR_FORMULAS) {
    const selected = selectAirStation({ ...input, stations: catalog.stations, formula });
    if (!selected) {
      readings.push({
        formula,
        value: null,
        unit: "µg/m³",
        observedAt: null,
        stationId: null,
        stationLabel: null,
        stationType: null,
        distanceKm: null,
        fresh: false,
      });
      continue;
    }
    anchor ??= selected.station;
    anchorDistance ??= selected.distanceKm;
    readings.push(await measurementFor(selected.station, formula, selected.distanceKm));
  }
  if (anchor && anchor.components.includes("LKI") && anchorDistance !== null) {
    readings.push(await measurementFor(anchor, "LKI", anchorDistance));
  }
  const withValues = readings.filter((reading) => reading.value !== null);
  if (withValues.length === 0) {
    return {
      status: "NOT_COVERED",
      message: "Geen bruikbare meting. Ontbrekende stoffen blijven leeg.",
      value: { readings, note: "Dit is geen luchtkwaliteit op het adres en geen voorspelling." },
      publishedAt: null,
    };
  }
  const fresh = withValues.some((reading) => reading.fresh);
  const newest = withValues.map((reading) => reading.observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return {
    status: fresh ? "READY" : "STALE",
    message: fresh
      ? `Gemeten bij ${withValues[0].stationLabel}, ${withValues[0].distanceKm?.toFixed(1) ?? "?"} km. Geen adreswaarde.`
      : "Meting is ouder dan 3 uur en wordt niet als live getoond.",
    value: { readings, note: "Uurmeting van een station, niet doorgetrokken naar de komende 48 uur." },
    publishedAt: newest,
  };
}
