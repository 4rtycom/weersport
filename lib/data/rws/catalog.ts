export type CatalogQuantity = {
  id: number;
  compartment: string;
  code: string;
  description: string;
};

export type CatalogLocation = {
  id: number;
  code: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  quantities: CatalogQuantity[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseRwsCatalog(payload: unknown): CatalogLocation[] | null {
  const root = asRecord(payload);
  if (!root || root.Succesvol === false) return null;
  const metadata = Array.isArray(root.AquoMetadataLijst) ? root.AquoMetadataLijst : null;
  const links = Array.isArray(root.AquoMetadataLocatieLijst) ? root.AquoMetadataLocatieLijst : null;
  const locations = Array.isArray(root.LocatieLijst) ? root.LocatieLijst : null;
  if (!metadata || !links || !locations) return null;

  const quantities = new Map<number, CatalogQuantity>();
  for (const entry of metadata) {
    const row = asRecord(entry);
    const compartment = asRecord(row?.Compartiment);
    const quantity = asRecord(row?.Grootheid);
    const id = row?.AquoMetadata_MessageID;
    const code = quantity?.Code;
    const compartmentCode = compartment?.Code;
    if (typeof id !== "number" || typeof code !== "string" || typeof compartmentCode !== "string") continue;
    quantities.set(id, {
      id,
      compartment: compartmentCode,
      code,
      description: typeof row?.Parameter_Wat_Omschrijving === "string" ? row.Parameter_Wat_Omschrijving : code,
    });
  }

  const byLocation = new Map<number, CatalogLocation>();
  for (const entry of locations) {
    const row = asRecord(entry);
    const id = row?.Locatie_MessageID;
    const code = row?.Code;
    if (typeof id !== "number" || typeof code !== "string") continue;
    const latitude = typeof row?.Lat === "number" ? row.Lat : null;
    const longitude = typeof row?.Lon === "number" ? row.Lon : null;
    if (latitude === null || longitude === null) continue;
    byLocation.set(id, {
      id,
      code,
      name: typeof row?.Naam === "string" ? row.Naam : code,
      description: typeof row?.Omschrijving === "string" ? row.Omschrijving : "",
      latitude,
      longitude,
      quantities: [],
    });
  }

  for (const entry of links) {
    const row = asRecord(entry);
    const quantityId = row?.AquoMetaData_MessageID;
    const locationId = row?.Locatie_MessageID;
    if (typeof quantityId !== "number" || typeof locationId !== "number") continue;
    const quantity = quantities.get(quantityId);
    const location = byLocation.get(locationId);
    if (!quantity || !location) continue;
    if (!location.quantities.some((item) => item.id === quantity.id)) location.quantities.push(quantity);
  }
  return [...byLocation.values()];
}

export const WATER_QUANTITIES = [
  { code: "T", compartment: "OW", field: "temperature" },
  { code: "WATHTE", compartment: "OW", field: "level" },
  { code: "Hm0", compartment: "OW", field: "wave" },
  { code: "STROOMSHD", compartment: "OW", field: "current" },
] as const;
