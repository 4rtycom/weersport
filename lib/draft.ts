import { findSport, periods, sports } from "@/lib/sports";

export type SearchDraft = {
  sportId: string;
  sportName: string;
  placeId: string;
  placeLabel: string;
  period: (typeof periods)[number];
};

export function parseDraft(value: unknown): SearchDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const sport = sports.find((item) => item.id === record.sportId);
  const period = periods.find((item) => item === record.period);
  if (!sport || !period) return null;
  if (typeof record.placeId !== "string" || typeof record.placeLabel !== "string") return null;
  if (!record.placeId.startsWith("wpl-") || record.placeLabel.length < 2 || record.placeLabel.length > 80) {
    return null;
  }
  return {
    sportId: sport.id,
    sportName: findSport(sport.id).name,
    placeId: record.placeId,
    placeLabel: record.placeLabel,
    period,
  };
}
