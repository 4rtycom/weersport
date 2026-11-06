export async function lookupPlaceCoords(placeId: string) {
  const url = new URL("https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup");
  url.searchParams.set("id", placeId);
  url.searchParams.set("fl", "id,weergavenaam,centroide_ll");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("PDOK lookup mislukt");
  const body = (await response.json()) as {
    response?: { docs?: Array<{ centroide_ll?: string; weergavenaam?: string }> };
  };
  const doc = body.response?.docs?.[0];
  const match = doc?.centroide_ll?.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) throw new Error("Geen centroïde");
  return {
    longitude: Number(match[1]),
    latitude: Number(match[2]),
    label: doc?.weergavenaam ?? placeId,
  };
}
