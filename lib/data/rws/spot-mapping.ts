import type { CatalogLocation } from "@/lib/data/rws/catalog";
import type { SportSpotDraft } from "@/lib/data/geo/locations";

export type SpotMatch = {
  location: CatalogLocation | null;
  coverage: "EXACT" | "REPRESENTATIVE" | "NONE";
  distanceKm: number | null;
  reason: string;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((token) => token.length >= 5);
}

export function matchWaterLocation(input: {
  spot: SportSpotDraft | null;
  locations: CatalogLocation[];
  quantityCode: string;
}): SpotMatch {
  const offering = input.locations.filter((location) =>
    location.quantities.some((quantity) => quantity.compartment === "OW" && quantity.code === input.quantityCode),
  );
  if (!input.spot) {
    return {
      location: null,
      coverage: "NONE",
      distanceKm: null,
      reason: "Een woonplaatscentroïde is geen waterlocatie.",
    };
  }
  if (input.spot.rwsLocationCode) {
    const exact = offering.find((location) => location.code === input.spot?.rwsLocationCode);
    if (!exact) {
      return {
        location: null,
        coverage: "NONE",
        distanceKm: null,
        reason: "Het opgegeven meetpunt levert deze grootheid niet.",
      };
    }
    return {
      location: exact,
      coverage: "EXACT",
      distanceKm: haversineKm(input.spot.latitude, input.spot.longitude, exact.latitude, exact.longitude),
      reason: "Expliciet RWS-meetpunt voor deze grootheid.",
    };
  }
  const spotTokens = new Set([...tokens(input.spot.name), ...tokens(input.spot.waterbodyId ?? "")]);
  const named = offering
    .map((location) => {
      const nameTokens = new Set([...tokens(location.name), ...tokens(location.description)]);
      const shared = [...spotTokens].some((token) => nameTokens.has(token));
      const distanceKm = haversineKm(input.spot!.latitude, input.spot!.longitude, location.latitude, location.longitude);
      return { location, shared, distanceKm };
    })
    .filter((row) => row.shared && row.distanceKm <= 10)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (named.length === 0) {
    return {
      location: null,
      coverage: "NONE",
      distanceKm: null,
      reason: "Geen meetpunt op hetzelfde water binnen 10 km.",
    };
  }
  return {
    location: named[0].location,
    coverage: "REPRESENTATIVE",
    distanceKm: named[0].distanceKm,
    reason: "Naam van water én afstand; niet alleen de kortste hemelsbrede afstand.",
  };
}
