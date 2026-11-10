import { freePlaces, lookupPlace, type PdokDoc } from "@/lib/data/pdok/client";

export type DutchPlace = {
  id: string;
  label: string;
  detail: string;
};

function shortLabel(name: string) {
  return name.split(",")[0]?.trim() ?? name;
}

export function toPlace(doc: PdokDoc): DutchPlace | null {
  if (doc.type !== "woonplaats" || !doc.id?.startsWith("wpl-") || !doc.weergavenaam) return null;
  return { id: doc.id, label: shortLabel(doc.weergavenaam), detail: doc.weergavenaam };
}

export function selectWoonplaats(places: DutchPlace[], needle: string): DutchPlace | null {
  const exact = places.filter((place) => place.label.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  return (
    exact.find((place) => {
      const parts = place.detail.split(",").map((part) => part.trim().toLowerCase());
      return parts[0] === needle && parts[1] === needle;
    }) ?? null
  );
}

export async function searchPlaces(query: string) {
  const q = query.trim();
  if (q.length < 2 || q.length > 80) return [];
  const docs = await freePlaces(q);
  return docs.map(toPlace).filter((place): place is DutchPlace => place !== null);
}

export async function resolveDutchPlace(placeId: string, placeLabel: string) {
  if (placeId.startsWith("wpl-")) {
    const docs = await lookupPlace(placeId, "id,weergavenaam,type");
    const place = toPlace(docs[0] ?? {});
    if (!place) return null;
    return place;
  }

  const needle = placeLabel.trim().toLowerCase();
  if (needle.length < 2) return null;
  const places = await searchPlaces(placeLabel);
  return selectWoonplaats(places, needle);
}
