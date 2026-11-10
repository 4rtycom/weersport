import { createHash } from "node:crypto";
import type { ParsedKnmiSnapshot } from "@/lib/data/knmi/parse";
import type { CatalogLocation } from "@/lib/data/rws/catalog";
import type { AirStation } from "@/lib/data/luchtmeetnet/stations";

export type StoredKnmi = {
  hash: string;
  filename: string;
  fetchedAt: string;
  snapshot: ParsedKnmiSnapshot;
};

type Store = {
  knmi: StoredKnmi | null;
  rwsLocations: CatalogLocation[];
  rwsFetchedAt: string | null;
  airStations: AirStation[];
  airFetchedAt: string | null;
  airMeasurements: Map<string, AirMeasurementCache>;
};

export type AirMeasurementCache = {
  formula: string;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  fetchedAt: string;
};

const store: Store = {
  knmi: null,
  rwsLocations: [],
  rwsFetchedAt: null,
  airStations: [],
  airFetchedAt: null,
  airMeasurements: new Map(),
};

export function hashPayload(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function readKnmiStore() {
  return store.knmi;
}

export function writeKnmiStore(next: StoredKnmi) {
  store.knmi = next;
}

export function readRwsCatalog() {
  return { locations: store.rwsLocations, fetchedAt: store.rwsFetchedAt };
}

export function writeRwsCatalog(locations: CatalogLocation[], fetchedAt: string) {
  store.rwsLocations = locations;
  store.rwsFetchedAt = fetchedAt;
}

export function readAirStations() {
  return { stations: store.airStations, fetchedAt: store.airFetchedAt };
}

export function writeAirStations(stations: AirStation[], fetchedAt: string) {
  store.airStations = stations;
  store.airFetchedAt = fetchedAt;
}

export function readAirMeasurement(key: string) {
  return store.airMeasurements.get(key) ?? null;
}

export function writeAirMeasurement(key: string, value: AirMeasurementCache) {
  store.airMeasurements.set(key, value);
}

export function resetDataStoreForTests() {
  store.knmi = null;
  store.rwsLocations = [];
  store.rwsFetchedAt = null;
  store.airStations = [];
  store.airFetchedAt = null;
  store.airMeasurements.clear();
}
