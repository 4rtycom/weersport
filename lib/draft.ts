import { resolveOfficialSwimSpot, type OfficialSwimSpot } from "@/lib/data/swim-spots";
import { findSport, periods, sports } from "@/lib/sports";

export type SearchDraft = {
  sportId: string;
  sportName: string;
  placeId: string;
  placeLabel: string;
  period: (typeof periods)[number];
  /** Official swim spot for this place. Cleared when the sport or place no longer matches. */
  spotId: string | null;
};

const SPOT_ID = /^[A-Za-z0-9:_-]{1,80}$/;

export function reconcileDraftSpot(draft: SearchDraft, resolved: OfficialSwimSpot | null): SearchDraft {
  if (draft.sportId !== "openwaterzwemmen" || !draft.spotId) return { ...draft, spotId: null };
  if (!resolved || resolved.spotId !== draft.spotId || resolved.placeId !== draft.placeId) {
    return { ...draft, spotId: null };
  }
  return { ...draft, spotId: resolved.spotId };
}

export function parseDraft(
  value: unknown,
  options?: { resolvedSpot?: OfficialSwimSpot | null },
): SearchDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const sport = sports.find((item) => item.id === record.sportId);
  const period = periods.find((item) => item === record.period);
  if (!sport || !period) return null;
  if (typeof record.placeId !== "string" || typeof record.placeLabel !== "string") return null;
  if (!record.placeId.startsWith("wpl-") || record.placeLabel.length < 2 || record.placeLabel.length > 80) {
    return null;
  }
  const requestedSpot = typeof record.spotId === "string" && SPOT_ID.test(record.spotId) ? record.spotId : null;
  const draft: SearchDraft = {
    sportId: sport.id,
    sportName: findSport(sport.id).name,
    placeId: record.placeId,
    placeLabel: record.placeLabel,
    period,
    spotId: requestedSpot,
  };
  const resolved =
    options && "resolvedSpot" in options ? (options.resolvedSpot ?? null) : resolveOfficialSwimSpot(draft.placeId);
  return reconcileDraftSpot(draft, resolved);
}
