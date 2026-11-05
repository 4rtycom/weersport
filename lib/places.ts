export type DutchPlace = {
  id: string;
  label: string;
  detail: string;
};

const PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

type PdokDoc = { id?: string; weergavenaam?: string; type?: string };

function shortLabel(name: string) {
  return name.split(",")[0]?.trim() ?? name;
}

async function pdok(path: string, params: Record<string, string>) {
  const url = new URL(`${PDOK}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("PDOK is niet bereikbaar.");
  const body = (await response.json()) as { response?: { docs?: PdokDoc[] } };
  return body.response?.docs ?? [];
}

function toPlace(doc: PdokDoc): DutchPlace | null {
  if (doc.type !== "woonplaats" || !doc.id?.startsWith("wpl-") || !doc.weergavenaam) return null;
  return { id: doc.id, label: shortLabel(doc.weergavenaam), detail: doc.weergavenaam };
}

export async function searchPlaces(query: string) {
  const q = query.trim();
  if (q.length < 2 || q.length > 80) return [];
  const docs = await pdok("free", {
    q,
    rows: "6",
    fq: "type:woonplaats",
    fl: "id,weergavenaam,type",
  });
  return docs.map(toPlace).filter((place): place is DutchPlace => place !== null);
}

export async function resolveDutchPlace(placeId: string, placeLabel: string) {
  if (placeId.startsWith("wpl-")) {
    const docs = await pdok("lookup", { id: placeId, fl: "id,weergavenaam,type" });
    const place = toPlace(docs[0] ?? {});
    if (!place) return null;
    return place;
  }

  const needle = placeLabel.trim().toLowerCase();
  if (needle.length < 2) return null;
  const places = await searchPlaces(placeLabel);
  const exact = places.filter((place) => place.label.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const hometown = exact.find((place) => {
    const parts = place.detail.split(",").map((part) => part.trim().toLowerCase());
    return parts[0] === needle && parts[1] === needle;
  });
  return hometown ?? null;
}
