import type { ShownMeasurement, SourceObservation, SwimBundle, WarningBundle, WaterBundle, WeatherBundle } from "@/lib/data/types";
import type { SportDecisionProfile, WaterGateField } from "@/lib/scoring/profiles";

/**
 * Characteristic gates for every sport except open water.
 * Open water stays in swim.ts. These gates never produce a score.
 * Unit bounds below are the same sanity limits as the swim readings.
 * They are not sport thresholds, weights, or comfort bands.
 */
export type SportSources = {
  weather?: SourceObservation<WeatherBundle> | null;
  water?: SourceObservation<WaterBundle> | null;
  swim?: SourceObservation<SwimBundle> | null;
  warnings?: SourceObservation<WarningBundle> | null;
  /** Station linked to the requested place. Null means this place has no water station. */
  linkedStationId?: string | null;
};

export type CharacteristicAssessment = {
  reason: string;
  missing: string[];
  blocked: boolean;
  measurements: ShownMeasurement[];
  modelVersion: string;
};

const FIELD_UNIT: Record<WaterGateField, { unit: string; min: number; max: number; maxExclusive: boolean }> = {
  waterTemperatureC: { unit: "°C", min: -2, max: 40, maxExclusive: false },
  waveHeightM: { unit: "m", min: 0, max: 30, maxExclusive: false },
  currentMs: { unit: "m/s", min: 0, max: 10, maxExclusive: false },
  currentDirectionDeg: { unit: "°", min: 0, max: 360, maxExclusive: true },
};

function unmeasuredLabels(profile: SportDecisionProfile) {
  return profile.requiredFields
    .filter((field) => field.required && !field.measurable)
    .map((field) => field.label);
}

function fieldLabel(profile: SportDecisionProfile, field: WaterGateField) {
  return profile.requiredFields.find((item) => item.field === field)?.label ?? field;
}

function unique(labels: string[]) {
  return [...new Set(labels)];
}

function block(
  profile: SportDecisionProfile,
  reason: string,
  missing: string[],
  measurements: ShownMeasurement[] = [],
): CharacteristicAssessment {
  return {
    reason,
    missing: unique(missing),
    blocked: true,
    measurements,
    modelVersion: profile.modelVersion,
  };
}

function formatValue(value: number, unit: string) {
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`;
}

function inUnitRange(field: WaterGateField, value: number) {
  const unit = FIELD_UNIT[field];
  if (!Number.isFinite(value)) return false;
  if (value < unit.min) return false;
  return unit.maxExclusive ? value < unit.max : value <= unit.max;
}

function tideText(water: SourceObservation<WaterBundle> | null | undefined) {
  const tide = water?.value?.tideTime;
  return typeof tide === "string" && tide.trim().length > 0 ? tide.trim() : null;
}

type WaterRead =
  | { ok: true; measurement: ShownMeasurement }
  | { ok: false; fail: "absent" | "insufficient" | "expired" | "undated" | "no-location" | "other-station" | "invalid" | "tide" };

function readWaterField(
  water: SourceObservation<WaterBundle> | null | undefined,
  field: WaterGateField,
  label: string,
  linkedStationId: string | null | undefined,
  now: Date,
  acceptTide: boolean,
): WaterRead {
  if (
    !water ||
    !water.value ||
    water.status === "NOT_LINKED" ||
    water.status === "MISSING_CRITICAL" ||
    water.status === "OFFICIAL_WARNING" ||
    water.status === "TEST_ONLY"
  ) {
    return { ok: false, fail: "absent" };
  }
  if (water.status === "PARTIAL") return { ok: false, fail: "insufficient" };
  if (water.status === "STALE") return { ok: false, fail: "expired" };
  if (water.status !== "READY") return { ok: false, fail: "absent" };

  if (water.validUntil === null) return { ok: false, fail: "undated" };
  const until = new Date(water.validUntil).getTime();
  if (!Number.isFinite(until) || until <= now.getTime()) return { ok: false, fail: "expired" };

  const published = water.publishedAt ? new Date(water.publishedAt).getTime() : NaN;
  const received = new Date(water.receivedAt).getTime();
  const observed = Number.isFinite(published) ? published : received;
  if (!water.sourceId.trim() || !Number.isFinite(observed) || observed > now.getTime()) return { ok: false, fail: "undated" };

  const raw = water.value[field];
  if (typeof raw !== "number") {
    return acceptTide && tideText(water) ? { ok: false, fail: "tide" } : { ok: false, fail: "absent" };
  }

  const stationId = water.value.stationId?.trim() ?? "";
  if (!stationId) return { ok: false, fail: "no-location" };
  if (!linkedStationId || linkedStationId !== stationId) return { ok: false, fail: "other-station" };
  if (!inUnitRange(field, raw)) return { ok: false, fail: "invalid" };

  const unit = FIELD_UNIT[field];
  return {
    ok: true,
    measurement: {
      id: field,
      label,
      display: formatValue(raw, unit.unit),
      sourceLabel: water.sourceLabel || water.sourceId,
      observedAt: water.publishedAt ?? water.receivedAt,
      quality: "measured",
    },
  };
}

function validityReason(label: string, fail: Exclude<WaterRead, { ok: true }>["fail"]) {
  if (fail === "insufficient") {
    return "De dekking van de waterbron is onvoldoende voor deze plek. Daarom kunnen we nog geen moment adviseren.";
  }
  if (fail === "expired") {
    return `De ${label} voor deze plek is verlopen. Daarom kunnen we nog geen moment adviseren.`;
  }
  if (fail === "undated") {
    return `De ${label} heeft geen geldige bron of geldigheidsduur. Daarom kunnen we nog geen moment adviseren.`;
  }
  if (fail === "no-location") {
    return "De waterbron noemt geen locatie-id voor deze meting. Daarom kunnen we nog geen moment adviseren.";
  }
  if (fail === "other-station") {
    return `De ${label} komt van een ander meetpunt dan deze plaats. Daarom kunnen we nog geen moment adviseren.`;
  }
  if (fail === "invalid") {
    return `De ${label} is geen geldige meting. Daarom kunnen we nog geen moment adviseren.`;
  }
  return null;
}

/**
 * Weather, warnings and swim are accepted so a snapshot can pass the same bundles.
 * They are not a fallback score: air, wind, rain, a warning title, or a swim ban
 * do not change the outcome for these sports.
 */
export function assessCharacteristic(input: {
  profile: SportDecisionProfile;
  now: Date;
  sources?: SportSources | null;
}): CharacteristicAssessment {
  const profile = input.profile;
  const gate = profile.gate;
  const missing = unmeasuredLabels(profile);
  if (!gate) {
    return block(profile, profile.withheldReason, profile.missing);
  }

  if (gate.kind === "unmeasured") {
    const water = input.sources?.water;
    if (gate.tideReason && tideText(water) && water?.status === "READY") {
      return block(profile, gate.tideReason, unique([...missing, "getij"]));
    }
    return block(profile, gate.blockedReason, missing);
  }

  const label = fieldLabel(profile, gate.field);
  const reading = readWaterField(
    input.sources?.water,
    gate.field,
    label,
    input.sources?.linkedStationId,
    input.now,
    Boolean(gate.tideReason),
  );
  if (!reading.ok && reading.fail === "tide" && gate.tideReason) {
    return block(profile, gate.tideReason, unique([label, ...missing, "getij"]));
  }
  if (!reading.ok && reading.fail === "absent") {
    return block(profile, gate.blockedReason, [label, ...missing]);
  }
  if (!reading.ok) {
    const reason = validityReason(label, reading.fail) ?? gate.blockedReason;
    return block(profile, reason, [label, ...missing]);
  }

  return block(profile, gate.recordedReason, missing, [reading.measurement]);
}
