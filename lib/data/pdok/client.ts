import { readCache, writeCache } from "@/lib/data/providers/cache";
import { PROVIDER_RIGHTS } from "@/lib/data/providers/contracts";

const BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

export type PdokDoc = {
  id?: string;
  weergavenaam?: string;
  type?: string;
  centroide_ll?: string;
};

export type Wgs84Point = { latitude: number; longitude: number };

const NL = { minLat: 50.7, maxLat: 53.7, minLon: 3.2, maxLon: 7.3 };

export function parseCentroide(value: string | undefined): Wgs84Point | null {
  const match = value?.match(/POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function validateNlPoint(point: Wgs84Point): boolean {
  return point.latitude >= NL.minLat && point.latitude <= NL.maxLat && point.longitude >= NL.minLon && point.longitude <= NL.maxLon;
}

export function assertNlPoint(point: Wgs84Point): Wgs84Point {
  if (!validateNlPoint(point)) throw new Error("Coördinaat ligt buiten Nederland of is verwisseld.");
  return point;
}

async function pdok(path: string, params: Record<string, string>, ttlMs: number): Promise<PdokDoc[]> {
  const url = new URL(`${BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const cacheKey = url.toString();
  const cached = readCache<PdokDoc[]>(cacheKey);
  if (cached) return cached;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("PDOK is niet bereikbaar.");
  const body = (await response.json()) as { response?: { docs?: PdokDoc[] } };
  const docs = body.response?.docs ?? [];
  writeCache(cacheKey, docs, ttlMs);
  return docs;
}

export function pdokRights() {
  return PROVIDER_RIGHTS.pdok;
}

export function suggestPlaces(query: string) {
  return pdok("suggest", { q: query, rows: "6", fq: "type:woonplaats", fl: "id,weergavenaam,type,centroide_ll" }, 60_000);
}

export function freePlaces(query: string) {
  return pdok("free", { q: query, rows: "6", fq: "type:woonplaats", fl: "id,weergavenaam,type" }, 60_000);
}

export function lookupPlace(id: string, fields: string) {
  return pdok("lookup", { id, fl: fields }, 7 * 24 * 60 * 60 * 1000);
}

export function reversePlace(latitude: number, longitude: number) {
  return pdok(
    "reverse",
    { lat: String(latitude), lon: String(longitude), rows: "5", fl: "id,weergavenaam,type,centroide_ll" },
    60_000,
  );
}
