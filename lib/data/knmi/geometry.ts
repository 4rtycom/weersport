export type LngLat = [number, number];

export type GeoPolygon = { type: "Polygon"; coordinates: LngLat[][] };
export type GeoMultiPolygon = { type: "MultiPolygon"; coordinates: LngLat[][][] };
export type WarningGeometry = GeoPolygon | GeoMultiPolygon;

function same(a: LngLat, b: LngLat) {
  return Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}

function onSegment(lon: number, lat: number, a: LngLat, b: LngLat) {
  const cross = (b[0] - a[0]) * (lat - a[1]) - (b[1] - a[1]) * (lon - a[0]);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (lon - a[0]) * (b[0] - a[0]) + (lat - a[1]) * (b[1] - a[1]);
  if (dot < -1e-9) return false;
  const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  return dot - len2 <= 1e-9;
}

export function pointInRing(lon: number, lat: number, ring: LngLat[]): boolean {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  if (ring.some((pair) => !Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== "number" || typeof pair[1] !== "number")) {
    return false;
  }
  const closed = ring.length > 1 && same(ring[0], ring[ring.length - 1]);
  const count = closed ? ring.length - 1 : ring.length;
  for (let index = 0; index < count; index += 1) {
    const next = ring[(index + 1) % count];
    if (onSegment(lon, lat, ring[index], next)) return true;
  }
  let inside = false;
  for (let index = 0, previous = count - 1; index < count; previous = index, index += 1) {
    const xi = ring[index][0];
    const yi = ring[index][1];
    const xj = ring[previous][0];
    const yj = ring[previous][1];
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, rings: LngLat[][]): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !pointInRing(lon, lat, outer)) return false;
  return !holes.some((ring) => pointInRing(lon, lat, ring));
}

export function pointInGeometry(lon: number, lat: number, geometry: WarningGeometry): boolean {
  if (geometry.type === "Polygon") return pointInPolygon(lon, lat, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon));
}

export function isWarningGeometry(value: unknown): value is WarningGeometry {
  if (!value || typeof value !== "object") return false;
  const record = value as { type?: unknown; coordinates?: unknown };
  if (record.type !== "Polygon" && record.type !== "MultiPolygon") return false;
  return Array.isArray(record.coordinates);
}
