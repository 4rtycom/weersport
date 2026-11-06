import {
  WARNING_STALE_AFTER_MS,
  WEATHER_STALE_AFTER_MS,
  WATER_STALE_AFTER_MS,
  SWIM_STALE_AFTER_MS,
  ageSeconds,
  type ProviderFreshness,
  type WarningLifecycle,
} from "@/lib/data/contracts";
import { fetchKnmiWarnings } from "@/lib/data/adapters/knmi";
import { fetchRwsWater } from "@/lib/data/adapters/rws";
import { fetchZwemwater } from "@/lib/data/adapters/zwemwater";
import { rightsFor } from "@/lib/data/sources";
import type { SourceObservation } from "@/lib/data/types";

function lifecycleOf(warnings: SourceObservation<{ lifecycle?: WarningLifecycle }>): WarningLifecycle | "n/a" {
  return warnings.value?.lifecycle ?? (warnings.status === "NOT_LINKED" ? "not-linked" : "n/a");
}

function row(
  observation: SourceObservation<unknown>,
  thresholdMs: number,
  lifecycle: WarningLifecycle | "n/a" = "n/a",
): ProviderFreshness {
  const lastSuccessAt =
    (observation.value &&
    typeof observation.value === "object" &&
    observation.value !== null &&
    "lastSuccessAt" in observation.value
      ? ((observation.value as { lastSuccessAt?: string | null }).lastSuccessAt ?? null)
      : null) ?? observation.publishedAt;
  const age = ageSeconds(lastSuccessAt);
  const linked = observation.status !== "NOT_LINKED";
  const fresh = !linked
    ? null
    : observation.status === "STALE" || observation.status === "MISSING_CRITICAL"
      ? false
      : age === null
        ? null
        : age * 1000 <= thresholdMs;
  return {
    sourceId: observation.sourceId,
    sourceLabel: observation.sourceLabel,
    status: observation.status,
    lifecycle,
    lastSuccessAt,
    ageSeconds: age,
    thresholdSeconds: Math.round(thresholdMs / 1000),
    fresh,
    message: observation.message,
  };
}

/**
 * Provider freshness probe — independent of database health.
 * Uses the same adapters as snapshots (including fixtures when enabled).
 */
export async function probeProviderFreshness(placeLabel = "Amsterdam"): Promise<{
  generatedAt: string;
  rights: ReturnType<typeof rightsFor>[];
  providers: ProviderFreshness[];
}> {
  const [warnings, water, swim] = await Promise.all([
    fetchKnmiWarnings(placeLabel),
    fetchRwsWater(placeLabel),
    fetchZwemwater(placeLabel),
  ]);

  // Open-Meteo freshness is evaluated when a forecast runs; here we report contract thresholds only.
  const openMeteoPlaceholder: ProviderFreshness = {
    sourceId: "open-meteo",
    sourceLabel: "Open-Meteo",
    status: "READY",
    lifecycle: "n/a",
    lastSuccessAt: null,
    ageSeconds: null,
    thresholdSeconds: Math.round(WEATHER_STALE_AFTER_MS / 1000),
    fresh: null,
    message: "Freshness gemeten per forecast-aanvraag; drempel 2 uur.",
  };

  return {
    generatedAt: new Date().toISOString(),
    rights: ["open-meteo", "knmi-warnings", "rws-wadar", "zwemwater-bij12", "ice-evidence", "pdok-geo"].map(
      (id) => rightsFor(id),
    ),
    providers: [
      openMeteoPlaceholder,
      row(warnings, WARNING_STALE_AFTER_MS, lifecycleOf(warnings)),
      row(water, WATER_STALE_AFTER_MS),
      row(swim, SWIM_STALE_AFTER_MS),
    ],
  };
}
