export type AirStation = {
  number: string;
  label: string;
  latitude: number;
  longitude: number;
  stationType: string | null;
  components: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseStationList(payload: unknown): Array<{ number: string; label: string }> {
  const root = asRecord(payload);
  const data = Array.isArray(root?.data) ? root.data : [];
  return data.flatMap((entry) => {
    const row = asRecord(entry);
    if (!row || typeof row.number !== "string") return [];
    return [{ number: row.number, label: typeof row.location === "string" ? row.location : row.number }];
  });
}

export function stationListPages(payload: unknown) {
  const root = asRecord(payload);
  const pagination = asRecord(root?.pagination);
  const last = pagination?.last_page;
  return typeof last === "number" && last > 0 ? last : 1;
}

export function parseStationDetail(number: string, label: string, payload: unknown): AirStation | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const geometry = asRecord(data?.geometry);
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;
  const components = Array.isArray(data?.components) ? data.components.filter((item): item is string => typeof item === "string") : [];
  return {
    number,
    label,
    latitude,
    longitude,
    stationType: typeof data?.type === "string" ? data.type : null,
    components,
  };
}
