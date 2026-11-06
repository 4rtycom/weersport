import type { ShownMeasurement, WaterKind } from "@/lib/data/types";

/**
 * Open-water gates. These are source and blockage rules, not a comfort score.
 * No weight, ideal band, or location list is defined here.
 * A complete, valid set of measurements still returns NO_SCORE until a decision rule is released.
 */
export const OPEN_WATER_MODEL_VERSION = "openwaterzwemmen-v1";

export const MISSING_WATER_TEMPERATURE_REASON =
  "We missen een recente watertemperatuur voor deze zwemplek. Daarom kunnen we nog geen zwemmoment adviseren.";

export const NO_VALIDATED_SWIM_RULE_REASON =
  "De beschikbare metingen zijn vastgelegd, maar er is nog geen gevalideerde beslisregel voor een zwemmoment. Daarom geven we geen score.";

const EXPIRED_WATER_TEMPERATURE_REASON =
  "De watertemperatuur voor deze zwemplek is verlopen. Daarom kunnen we nog geen zwemmoment adviseren.";

const OTHER_STATION_REASON =
  "De watertemperatuur komt van een ander meetpunt dan deze zwemplek. Daarom kunnen we nog geen zwemmoment adviseren.";

const TIDE_IS_NOT_CURRENT_REASON =
  "Een getijdentijdstip is geen meting van de lokale stroming. Daarom kunnen we nog geen zwemmoment adviseren.";

const SWIM_BAN_REASON =
  "Een negatief zwemadvies of zwemverbod blokkeert een zwemmoment. Er is geen beste tijdvak.";

const UNLINKED_REASON =
  "Er is geen officiële zwemplek gekoppeld aan deze plaats. Zwemwater en waterdata zijn niet gekoppeld. Daarom kunnen we nog geen zwemmoment adviseren.";

const NO_SPOT_REASON =
  "Er is geen officiële zwemplek gekoppeld aan deze plaats. Daarom kunnen we nog geen zwemmoment adviseren.";

const INSUFFICIENT_COVERAGE_REASON =
  "De dekking van de zwemwaterbron is onvoldoende voor deze plek. Daarom kunnen we nog geen zwemmoment adviseren.";

const UNSUITABLE_COAST_REASON =
  "Deze kustlocatie is geen officiële zwemplek met de metingen die daarvoor nodig zijn. Daarom kunnen we nog geen zwemmoment adviseren.";

const UNKNOWN_WATER_KIND_REASON =
  "Het watertype van deze zwemplek is onbekend. Daardoor is niet vast te stellen welke stroming, richting, golfslag en blootstelling van toepassing zijn.";

export type ReadingQuality = "measured" | "predicted" | "unknown" | "expired" | "not_applicable";

export type SwimReadingId =
  | "waterTemperature"
  | "current"
  | "currentDirection"
  | "waves"
  | "exposure"
  | "swimStatus"
  | "tideTime";

export type SwimReading = {
  id: SwimReadingId;
  value: number | string | null;
  unit: string | null;
  quality: ReadingQuality;
  locationId: string | null;
  observedAt: string | null;
  validUntil: string | null;
  sourceId: string | null;
  sourceLabel: string | null;
  applicabilityNote: string | null;
};

export type SwimAssessmentInput = {
  placeId: string;
  spotId: string | null;
  spotClass: "official" | "coast-not-swim" | "missing";
  waterKind: WaterKind | null;
  coverage: "ok" | "insufficient" | "unlinked";
  readings: SwimReading[];
  now: Date;
};

export type SwimAssessment = {
  reason: string;
  missing: string[];
  blocked: boolean;
  measurements: ShownMeasurement[];
  modelVersion: string;
};

const EXPECTED_UNIT: Record<SwimReadingId, string | null> = {
  waterTemperature: "celsius",
  current: "m/s",
  currentDirection: "deg",
  waves: "m",
  exposure: null,
  swimStatus: null,
  tideTime: null,
};

const FIELD_LABEL: Record<SwimReadingId, string> = {
  waterTemperature: "watertemperatuur",
  current: "stroming",
  currentDirection: "stroomrichting",
  waves: "golfslag",
  exposure: "blootstelling",
  swimStatus: "zwemwaterkwaliteit",
  tideTime: "getij",
};

/** Unit sanity only. These bounds are not sport thresholds. */
function valueMatchesUnit(id: SwimReadingId, value: number | string | null, unit: string | null) {
  if (EXPECTED_UNIT[id] === null) return typeof value === "string" && value.trim().length > 0;
  if (unit !== EXPECTED_UNIT[id] || typeof value !== "number" || !Number.isFinite(value)) return false;
  if (id === "waterTemperature") return value >= -2 && value <= 40;
  if (id === "current") return value >= 0 && value <= 10;
  if (id === "currentDirection") return value >= 0 && value < 360;
  if (id === "waves") return value >= 0 && value <= 30;
  return false;
}

function isBan(value: string) {
  const text = value.toLowerCase();
  return text.includes("zwemverbod") || text.includes("negatief");
}

type RejectReason = "expired" | "other-station" | "not-measured" | "invalid" | "missing";

function classifyReading(reading: SwimReading, spotId: string, now: Date): { ok: true } | { ok: false; reason: RejectReason } {
  if (reading.quality === "unknown") return { ok: false, reason: "missing" };
  if (reading.quality === "expired") return { ok: false, reason: "expired" };
  if (reading.quality === "not_applicable") {
    return reading.applicabilityNote && reading.applicabilityNote.trim().length > 0
      ? { ok: true }
      : { ok: false, reason: "invalid" };
  }
  if (reading.quality === "predicted") return { ok: false, reason: "not-measured" };
  if (reading.locationId !== spotId) return { ok: false, reason: "other-station" };
  const observed = reading.observedAt ? new Date(reading.observedAt).getTime() : NaN;
  const until = reading.validUntil ? new Date(reading.validUntil).getTime() : NaN;
  if (!Number.isFinite(observed) || observed > now.getTime()) return { ok: false, reason: "invalid" };
  if (!Number.isFinite(until) || until <= now.getTime()) return { ok: false, reason: "expired" };
  if (!valueMatchesUnit(reading.id, reading.value, reading.unit)) return { ok: false, reason: "invalid" };
  return { ok: true };
}

function displayOf(reading: SwimReading) {
  if (reading.quality === "not_applicable") return reading.applicabilityNote?.trim() || "niet van toepassing";
  if (typeof reading.value === "number") {
    const digits = Number.isInteger(reading.value) ? 0 : 1;
    const unit = reading.unit === "celsius" ? "°C" : reading.unit === "m/s" ? "m/s" : reading.unit === "deg" ? "°" : reading.unit === "m" ? "m" : "";
    return `${reading.value.toFixed(digits)}${unit ? ` ${unit}` : ""}`.trim();
  }
  return typeof reading.value === "string" ? reading.value : "—";
}

function shown(reading: SwimReading): ShownMeasurement {
  return {
    id: reading.id,
    label: FIELD_LABEL[reading.id],
    display: displayOf(reading),
    sourceLabel: reading.sourceLabel || reading.sourceId || "Bron onbekend",
    observedAt: reading.observedAt,
    quality: reading.quality,
  };
}

function fallbackReason(missing: Set<string>) {
  if (missing.has("watertemperatuur")) return MISSING_WATER_TEMPERATURE_REASON;
  if (missing.has("zwemwaterkwaliteit")) {
    return "We missen de officiële zwemstatus voor deze zwemplek. Daarom kunnen we nog geen zwemmoment adviseren.";
  }
  if (missing.has("stroming")) {
    return "We missen een stromingsmeting die bij dit watertype hoort. Daarom kunnen we nog geen zwemmoment adviseren.";
  }
  if (missing.has("stroomrichting")) {
    return "We missen de stroomrichting voor deze zwemplek. Daarom kunnen we nog geen zwemmoment adviseren.";
  }
  if (missing.has("golfslag")) {
    return "We missen de golfslag voor deze zwemplek. Daarom kunnen we nog geen zwemmoment adviseren.";
  }
  if (missing.has("blootstelling")) {
    return "We missen de blootstelling van deze zwemplek. Daarom kunnen we nog geen zwemmoment adviseren.";
  }
  return "Essentiële zwemwatergegevens ontbreken. Daarom kunnen we nog geen zwemmoment adviseren.";
}

function findReading(readings: SwimReading[], id: SwimReadingId) {
  return readings.find((reading) => reading.id === id) ?? null;
}

type Slot = "measured" | "not_applicable" | "measured_or_not_applicable";

const REQUIREMENTS: Record<Exclude<WaterKind, "onbekend">, Record<"current" | "currentDirection" | "waves" | "exposure", Slot>> = {
  stilstaand: {
    current: "not_applicable",
    currentDirection: "not_applicable",
    waves: "measured_or_not_applicable",
    exposure: "measured_or_not_applicable",
  },
  stromend: {
    current: "measured",
    currentDirection: "measured",
    waves: "measured_or_not_applicable",
    exposure: "measured_or_not_applicable",
  },
  kust: {
    current: "measured",
    currentDirection: "measured",
    waves: "measured",
    exposure: "measured",
  },
};

function slotAccepts(slot: Slot, reading: SwimReading) {
  if (reading.quality === "not_applicable") return slot !== "measured";
  return slot !== "not_applicable" && reading.quality === "measured";
}

export function assessOpenWater(input: SwimAssessmentInput): SwimAssessment {
  const measurements: ShownMeasurement[] = [];
  const missing = new Set<string>();
  const now = input.now;

  if (input.coverage === "unlinked") {
    missing.add("officiële zwemplek");
    missing.add("watertemperatuur");
    missing.add("zwemwaterkwaliteit");
    return {
      reason: UNLINKED_REASON,
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }

  if (input.coverage === "insufficient") {
    missing.add("dekking");
    return {
      reason: INSUFFICIENT_COVERAGE_REASON,
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }

  if (input.spotClass === "coast-not-swim") {
    missing.add("officiële zwemplek");
    return {
      reason: UNSUITABLE_COAST_REASON,
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }

  if (input.spotClass === "missing" || !input.spotId) {
    missing.add("officiële zwemplek");
    missing.add("watertemperatuur");
    missing.add("zwemwaterkwaliteit");
    return {
      reason: NO_SPOT_REASON,
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }

  const spotId = input.spotId;
  const status = findReading(input.readings, "swimStatus");
  const statusCheck = status ? classifyReading(status, spotId, now) : { ok: false as const, reason: "missing" as const };
  if (status && statusCheck.ok) measurements.push(shown(status));
  if (status && statusCheck.ok && typeof status.value === "string" && isBan(status.value)) {
    missing.add("zwemwaterkwaliteit");
    return {
      reason: SWIM_BAN_REASON,
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }
  if (!status || !statusCheck.ok) missing.add("zwemwaterkwaliteit");

  if (!input.waterKind || input.waterKind === "onbekend") {
    missing.add("watertype");
    return {
      reason: UNKNOWN_WATER_KIND_REASON,
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }

  const requirements = REQUIREMENTS[input.waterKind];
  const temp = findReading(input.readings, "waterTemperature");
  const tempCheck = temp ? classifyReading(temp, spotId, now) : { ok: false as const, reason: "missing" as const };
  if (temp && tempCheck.ok) measurements.push(shown(temp));

  let specific: string | null = null;
  if (!temp || !tempCheck.ok) {
    missing.add("watertemperatuur");
    const reason = !tempCheck.ok ? tempCheck.reason : "missing";
    if (reason === "expired") specific = EXPIRED_WATER_TEMPERATURE_REASON;
    else if (reason === "other-station") specific = OTHER_STATION_REASON;
    else specific = MISSING_WATER_TEMPERATURE_REASON;
  }

  const tide = findReading(input.readings, "tideTime");
  for (const id of ["current", "currentDirection", "waves", "exposure"] as const) {
    const reading = findReading(input.readings, id);
    const check = reading ? classifyReading(reading, spotId, now) : { ok: false as const, reason: "missing" as const };
    const accepted = Boolean(reading && check.ok && slotAccepts(requirements[id], reading));
    if (accepted && reading) measurements.push(shown(reading));
    if (!accepted) {
      missing.add(FIELD_LABEL[id]);
      if (id === "current" && requirements[id] === "measured" && tide && !specific) {
        specific = TIDE_IS_NOT_CURRENT_REASON;
      }
      if (id === "current" && requirements[id] === "not_applicable" && !specific) {
        specific =
          "Voor stilstaand water is stroming niet van toepassing, maar die onderbouwing ontbreekt. Daarom kunnen we nog geen zwemmoment adviseren.";
      }
    }
  }

  if (missing.size > 0) {
    return {
      reason: specific ?? fallbackReason(missing),
      missing: [...missing],
      blocked: true,
      measurements,
      modelVersion: OPEN_WATER_MODEL_VERSION,
    };
  }

  return {
    reason: NO_VALIDATED_SWIM_RULE_REASON,
    missing: [],
    blocked: false,
    measurements,
    modelVersion: OPEN_WATER_MODEL_VERSION,
  };
}
