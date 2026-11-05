import type { SearchDraft } from "@/lib/draft";

export type PlannedMoment = {
  id: string;
  sportId: string;
  sportName: string;
  placeId: string;
  placeLabel: string;
  period: SearchDraft["period"];
  windowLabel: string;
  plannedStart: string;
  plannedEnd: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  /** Optional last analysis age marker — never treated as live safety. */
  lastSnapshotAt: string | null;
  lastScoreLabel: string | null;
};

export type SavedSearch = {
  id: string;
  sportId: string;
  sportName: string;
  placeId: string;
  placeLabel: string;
  period: SearchDraft["period"];
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  requiresWater: boolean;
};

export type UserPreferences = {
  weekendFocus: boolean;
  uvReminders: boolean;
  savePlansByDefault: boolean;
  locale: "nl-NL";
  updatedAt: string | null;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  weekendFocus: true,
  uvReminders: true,
  savePlansByDefault: false,
  locale: "nl-NL",
  updatedAt: null,
};

/** Phase 05 never books quota. Phase 06 owns metering. */
export const PHASE05_BOOKING = {
  booked: false as const,
  consumed: 0 as const,
  message: "Opslaan en openen van plannen of filters kost geen aanvraag in fase 05.",
};
