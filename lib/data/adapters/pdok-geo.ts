import { lookupPlace, parseCentroide, assertNlPoint } from "@/lib/data/pdok/client";

export async function lookupPlaceCoords(placeId: string) {
  let docs;
  try {
    docs = await lookupPlace(placeId, "id,weergavenaam,centroide_ll");
  } catch {
    throw new Error("PDOK lookup mislukt");
  }
  const doc = docs[0];
  const point = parseCentroide(doc?.centroide_ll);
  if (!point) throw new Error("Geen centroïde");
  try {
    assertNlPoint(point);
  } catch {
    throw new Error("Geen centroïde");
  }
  return {
    longitude: point.longitude,
    latitude: point.latitude,
    label: doc?.weergavenaam ?? placeId,
  };
}
