/**
 * Phase 2 — operational contracts for source freshness and warning semantics.
 * Live provider purchase/keys remain Glenn-approved; fixtures drive deterministic evidence.
 */

export const WARNING_STALE_AFTER_MS = 3 * 60 * 60 * 1000; // 3h without refresh → STALE
export const WEATHER_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export const WATER_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const SWIM_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type WarningLifecycle =
  | "provider-failure"
  | "verified-all-clear"
  | "active-warning"
  | "stale"
  | "not-linked"
  | "partial-coverage";

export type WarningItem = {
  id: string;
  title: string;
  detail: string;
  /** KNMI-style code when known: geel | oranje | rood | undefined */
  code?: "geel" | "oranje" | "rood" | "none";
  /** Spatial scope description (province, coastal strip, etc.). */
  spatialScope: string;
  issuedAt: string;
  expiresAt: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  provenance: string;
};

export type LocationCoverageKind = "town-centroid" | "site-specific" | "unknown";

export type LocationCoverage = {
  kind: LocationCoverageKind;
  placeId: string;
  placeLabel: string;
  note: string;
};

/**
 * PDOK plaats lookups resolve to a town/woonplaats centroid.
 * That is never enough to claim lake, beach, or ice conditions.
 */
export function townCentroidCoverage(placeId: string, placeLabel: string): LocationCoverage {
  return {
    kind: "town-centroid",
    placeId,
    placeLabel,
    note:
      "Locatie is een woonplaatscentroïde. Die is niet representatief voor een specifiek meer, strand of ijsvlakte.",
  };
}

export function ageSeconds(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round((now - ms) / 1000));
}

export function isStale(receivedOrPublishedAt: string | null, thresholdMs: number, now = Date.now()) {
  if (!receivedOrPublishedAt) return true;
  const ms = new Date(receivedOrPublishedAt).getTime();
  if (Number.isNaN(ms)) return true;
  return now - ms > thresholdMs;
}

export type ProviderFreshness = {
  sourceId: string;
  sourceLabel: string;
  status: string;
  lifecycle: WarningLifecycle | "n/a";
  lastSuccessAt: string | null;
  ageSeconds: number | null;
  thresholdSeconds: number;
  fresh: boolean | null;
  message: string;
};
