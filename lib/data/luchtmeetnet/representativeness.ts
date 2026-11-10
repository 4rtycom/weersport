import type { AirStation } from "@/lib/data/luchtmeetnet/stations";

export const AIR_FORMULAS = ["PM25", "PM10", "NO2", "O3"] as const;
export type AirFormula = (typeof AIR_FORMULAS)[number];
export const MAX_AIR_DISTANCE_KM = 20;
export const AIR_FRESH_MS = 3 * 60 * 60 * 1000;

const stamps: number[] = [];

export function takeAirBudget(count: number) {
  const now = Date.now();
  while (stamps.length > 0 && now - stamps[0] > 5 * 60 * 1000) stamps.shift();
  if (stamps.length + count > 90) return false;
  for (let index = 0; index < count; index += 1) stamps.push(now);
  return true;
}

export function resetAirBudgetForTests() {
  stamps.length = 0;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function preference(station: AirStation) {
  const type = (station.stationType ?? "").toLowerCase();
  if (type.includes("traffic") || type.includes("straat")) return 2;
  if (type.includes("industry") || type.includes("industrie")) return 1;
  return 0;
}

export function selectAirStation(input: {
  stations: AirStation[];
  latitude: number;
  longitude: number;
  formula: AirFormula;
}): { station: AirStation; distanceKm: number } | null {
  const ranked = input.stations
    .filter((station) => station.components.includes(input.formula))
    .map((station) => ({
      station,
      distanceKm: haversineKm(input.latitude, input.longitude, station.latitude, station.longitude),
    }))
    .filter((row) => row.distanceKm <= MAX_AIR_DISTANCE_KM)
    .sort((a, b) => preference(a.station) - preference(b.station) || a.distanceKm - b.distanceKm);
  return ranked[0] ?? null;
}

export function airIsFresh(observedAt: string | null, now = Date.now()) {
  if (!observedAt) return false;
  const stamp = new Date(observedAt).getTime();
  if (Number.isNaN(stamp)) return false;
  return now - stamp <= AIR_FRESH_MS;
}
