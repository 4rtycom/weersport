import { assertNlPoint, parseCentroide, reversePlace, validateNlPoint, type Wgs84Point } from "@/lib/data/pdok/client";

const KINDS = new Set(["coast", "lake", "river", "beach", "harbour", "other"]);

export type SportSpotDraft = {
  id: string;
  name: string;
  kind: "coast" | "lake" | "river" | "beach" | "harbour" | "other";
  latitude: number;
  longitude: number;
  waterbodyId?: string;
  rwsLocationCode?: string;
};

export function parseSportSpot(value: unknown): SportSpotDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const kind = typeof record.kind === "string" ? record.kind : "";
  const latitude = typeof record.latitude === "number" ? record.latitude : null;
  const longitude = typeof record.longitude === "number" ? record.longitude : null;
  if (!id || id.length > 80 || !name || name.length > 80 || !KINDS.has(kind) || latitude === null || longitude === null) {
    return null;
  }
  const point = { latitude, longitude };
  if (!validateNlPoint(point)) return null;
  const spot: SportSpotDraft = { id, name, kind: kind as SportSpotDraft["kind"], latitude, longitude };
  if (typeof record.waterbodyId === "string" && record.waterbodyId.trim()) spot.waterbodyId = record.waterbodyId.trim();
  if (typeof record.rwsLocationCode === "string" && record.rwsLocationCode.trim()) {
    spot.rwsLocationCode = record.rwsLocationCode.trim();
  }
  return spot;
}

export async function reverseNlPoint(point: Wgs84Point) {
  assertNlPoint(point);
  const docs = await reversePlace(point.latitude, point.longitude);
  const doc = docs.find((item) => item.type === "woonplaats") ?? docs[0];
  if (!doc?.id || !doc.weergavenaam) return null;
  const centroid = parseCentroide(doc.centroide_ll);
  if (centroid && !validateNlPoint(centroid)) return null;
  return {
    id: doc.id,
    label: doc.weergavenaam.split(",")[0]?.trim() ?? doc.weergavenaam,
    detail: doc.weergavenaam,
    type: doc.type ?? "onbekend",
    latitude: centroid?.latitude ?? point.latitude,
    longitude: centroid?.longitude ?? point.longitude,
  };
}
