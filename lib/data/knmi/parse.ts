import { isWarningGeometry, type WarningGeometry } from "@/lib/data/knmi/geometry";

const PHENOMENA = new Set([
  "road-ice",
  "snow",
  "high-temperature",
  "low-temperature",
  "fog",
  "thunderstorm",
  "waterspouts",
  "wind",
  "rain",
]);

const COLORS = new Set(["yellow", "orange", "red"]);

export type KnmiColor = "geel" | "oranje" | "rood";

export type ParsedWarningPart = {
  partId: string;
  warningSetId: string;
  phenomenon: string;
  color: KnmiColor;
  headline: string;
  description: string;
  onset: string;
  expires: string;
  geometry: WarningGeometry;
};

export type ParsedKnmiSnapshot = {
  schemaVersion: string;
  publicationType: "manual" | "heartbeat" | "test";
  generatedAt: string;
  snapshotId: string;
  parts: ParsedWarningPart[];
  emptyOperational: boolean;
  rejectedAsTest: boolean;
};

export type ParseFailure = { ok: false; code: "SCHEMA" | "TEST_ONLY"; message: string };
export type ParseSuccess = { ok: true; snapshot: ParsedKnmiSnapshot };
export type ParseResult = ParseSuccess | ParseFailure;

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dutchColor(color: string): KnmiColor {
  if (color === "orange") return "oranje";
  if (color === "red") return "rood";
  return "geel";
}

function dutchPhenomenon(phenomenon: string) {
  const labels: Record<string, string> = {
    "road-ice": "gladheid",
    snow: "sneeuw",
    "high-temperature": "hitte",
    "low-temperature": "kou",
    fog: "mist",
    thunderstorm: "onweer",
    waterspouts: "waterhozen",
    wind: "wind",
    rain: "regen",
  };
  return labels[phenomenon] ?? phenomenon;
}

export function phenomenonLabel(phenomenon: string) {
  return dutchPhenomenon(phenomenon);
}

function geometryOf(value: unknown): WarningGeometry | null {
  const area = record(value);
  if (!area || !isWarningGeometry(area)) return null;
  return area;
}

function overlaps(onset: string, expires: string, from: Date, until: Date) {
  const start = new Date(onset).getTime();
  const end = new Date(expires).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start < until.getTime() && end > from.getTime();
}

export function parseKnmiSnapshot(payload: unknown): ParseResult {
  const root = record(payload);
  const metadata = record(root?.metadata);
  const warnings = root?.warnings;
  if (!root || !metadata || !Array.isArray(warnings)) {
    return { ok: false, code: "SCHEMA", message: "KNMI-snapshot mist metadata of warnings." };
  }
  const schemaVersion = text(metadata.schema_version);
  const publicationType = text(metadata.publication_type);
  const generatedAt = text(metadata.generated_at);
  const snapshotId = text(metadata.snapshot_uuid);
  if (!schemaVersion || !generatedAt || !snapshotId) {
    return { ok: false, code: "SCHEMA", message: "KNMI-metadata is onvolledig." };
  }
  if (publicationType !== "manual" && publicationType !== "heartbeat" && publicationType !== "test") {
    return { ok: false, code: "SCHEMA", message: "Onbekend KNMI-publicatietype." };
  }
  if (typeof root.num_warning_sets !== "number" || root.num_warning_sets !== warnings.length) {
    return { ok: false, code: "SCHEMA", message: "num_warning_sets komt niet overeen." };
  }
  if (publicationType === "test") {
    return {
      ok: true,
      snapshot: {
        schemaVersion,
        publicationType,
        generatedAt,
        snapshotId,
        parts: [],
        emptyOperational: false,
        rejectedAsTest: true,
      },
    };
  }

  const parts: ParsedWarningPart[] = [];
  let declaredParts = 0;
  for (const entry of warnings) {
    const set = record(entry);
    if (!set) return { ok: false, code: "SCHEMA", message: "Waarschuwingsset is ongeldig." };
    const setParts = set.parts;
    if (!Array.isArray(setParts)) return { ok: false, code: "SCHEMA", message: "Waarschuwingsset mist parts." };
    declaredParts += setParts.length;
    const operational = text(set.operational_status) ?? "Actual";
    if (operational !== "Actual") continue;
    const phenomenon = text(set.phenomenon);
    const warningSetId = text(set.warning_set_uuid);
    const texts = record(set.texts);
    const dutch = record(texts?.nl);
    const headline = text(dutch?.headline) ?? (phenomenon ? dutchPhenomenon(phenomenon) : null);
    const description = text(dutch?.description) ?? "";
    if (!phenomenon || !PHENOMENA.has(phenomenon) || !warningSetId || !headline) {
      return { ok: false, code: "SCHEMA", message: "Waarschuwingsset mist fenomeen of tekst." };
    }
    for (const partValue of setParts) {
      const part = record(partValue);
      if (!part) return { ok: false, code: "SCHEMA", message: "Waarschuwingsdeel is ongeldig." };
      const status = text(part.status) ?? "active";
      if (status === "cancelled" || status === "expired") continue;
      if (status !== "active") return { ok: false, code: "SCHEMA", message: "Onbekende deelstatus." };
      const color = text(part.color);
      const partId = text(part.part_uuid);
      const onset = text(part.onset);
      const expires = text(part.expires);
      const geometry = geometryOf(part.area);
      if (!color || !COLORS.has(color) || !partId || !onset || !expires || !geometry) {
        return { ok: false, code: "SCHEMA", message: "Waarschuwingsdeel mist kleur, tijd of geometrie." };
      }
      parts.push({
        partId,
        warningSetId,
        phenomenon,
        color: dutchColor(color),
        headline,
        description,
        onset,
        expires,
        geometry,
      });
    }
  }
  if (typeof root.num_warnings !== "number" || root.num_warnings !== declaredParts) {
    return { ok: false, code: "SCHEMA", message: "num_warnings komt niet overeen." };
  }
  return {
    ok: true,
    snapshot: {
      schemaVersion,
      publicationType,
      generatedAt,
      snapshotId,
      parts,
      emptyOperational: warnings.length === 0,
      rejectedAsTest: false,
    },
  };
}

export function partsOverlapping(parts: ParsedWarningPart[], from: Date, until: Date) {
  return parts.filter((part) => overlaps(part.onset, part.expires, from, until));
}
