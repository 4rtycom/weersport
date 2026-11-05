import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import type { SearchDraft } from "@/lib/draft";
import { findSport } from "@/lib/sports";
import { WATER_CRITICAL_SPORTS, ICE_CRITICAL_SPORTS } from "@/lib/data/types";
import {
  DEFAULT_PREFERENCES,
  type PlannedMoment,
  type SavedSearch,
  type UserPreferences,
} from "@/lib/moments/types";

let migrated = false;

export function ensureMomentsSchema() {
  if (migrated) return;
  const database = db();
  database.exec(`
    CREATE TABLE IF NOT EXISTS planned_moments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sport_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_label TEXT NOT NULL,
      period TEXT NOT NULL,
      window_label TEXT NOT NULL,
      planned_start TEXT NOT NULL,
      planned_end TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      last_snapshot_at TEXT,
      last_score_label TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sport_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_label TEXT NOT NULL,
      period TEXT NOT NULL,
      last_opened_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorite_sports (
      user_id TEXT NOT NULL,
      sport_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, sport_id)
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      weekend_focus INTEGER NOT NULL DEFAULT 1,
      uv_reminders INTEGER NOT NULL DEFAULT 1,
      save_plans_by_default INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
  `);
  migrated = true;
}

function nowIso() {
  return new Date().toISOString();
}

function requiresWaterOrIce(sportId: string) {
  return WATER_CRITICAL_SPORTS.has(sportId) || ICE_CRITICAL_SPORTS.has(sportId);
}

function mapMoment(row: Record<string, unknown>): PlannedMoment {
  const sport = findSport(String(row.sport_id));
  return {
    id: String(row.id),
    sportId: sport.id,
    sportName: sport.name,
    placeId: String(row.place_id),
    placeLabel: String(row.place_label),
    period: row.period as SearchDraft["period"],
    windowLabel: String(row.window_label),
    plannedStart: String(row.planned_start),
    plannedEnd: String(row.planned_end),
    note: String(row.note ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastSnapshotAt: row.last_snapshot_at ? String(row.last_snapshot_at) : null,
    lastScoreLabel: row.last_score_label ? String(row.last_score_label) : null,
  };
}

function mapSearch(row: Record<string, unknown>): SavedSearch {
  const sport = findSport(String(row.sport_id));
  return {
    id: String(row.id),
    sportId: sport.id,
    sportName: sport.name,
    placeId: String(row.place_id),
    placeLabel: String(row.place_label),
    period: row.period as SearchDraft["period"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastOpenedAt: row.last_opened_at ? String(row.last_opened_at) : null,
    requiresWater: requiresWaterOrIce(sport.id),
  };
}

export function listPlannedMoments(userId: string) {
  ensureMomentsSchema();
  const rows = db()
    .prepare("SELECT * FROM planned_moments WHERE user_id = ? ORDER BY planned_start ASC, created_at DESC")
    .all(userId) as Array<Record<string, unknown>>;
  return rows.map(mapMoment);
}

export function nextPlannedMoment(moments: PlannedMoment[]) {
  const now = Date.now();
  return (
    moments.find((moment) => {
      const end = Date.parse(moment.plannedEnd);
      return Number.isFinite(end) && end > now;
    }) ?? null
  );
}

export function getPlannedMoment(userId: string, id: string) {
  ensureMomentsSchema();
  const row = db()
    .prepare("SELECT * FROM planned_moments WHERE user_id = ? AND id = ?")
    .get(userId, id) as Record<string, unknown> | undefined;
  return row ? mapMoment(row) : null;
}

export function createPlannedMoment(
  userId: string,
  input: {
    draft: SearchDraft;
    windowLabel: string;
    plannedStart: string;
    plannedEnd: string;
    note?: string;
    lastSnapshotAt?: string | null;
    lastScoreLabel?: string | null;
  },
) {
  ensureMomentsSchema();
  const id = randomUUID();
  const stamp = nowIso();
  db()
    .prepare(
      `INSERT INTO planned_moments (
        id, user_id, sport_id, place_id, place_label, period, window_label,
        planned_start, planned_end, note, last_snapshot_at, last_score_label, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      input.draft.sportId,
      input.draft.placeId,
      input.draft.placeLabel,
      input.draft.period,
      input.windowLabel,
      input.plannedStart,
      input.plannedEnd,
      input.note ?? "",
      input.lastSnapshotAt ?? null,
      input.lastScoreLabel ?? null,
      stamp,
      stamp,
    );
  return getPlannedMoment(userId, id)!;
}

export function deletePlannedMoment(userId: string, id: string) {
  ensureMomentsSchema();
  const result = db().prepare("DELETE FROM planned_moments WHERE user_id = ? AND id = ?").run(userId, id);
  return Number(result.changes) > 0;
}

export function listSavedSearches(userId: string) {
  ensureMomentsSchema();
  const rows = db()
    .prepare("SELECT * FROM saved_searches WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as Array<Record<string, unknown>>;
  return rows.map(mapSearch);
}

export function saveSearch(userId: string, draft: SearchDraft) {
  ensureMomentsSchema();
  const existing = db()
    .prepare(
      `SELECT id FROM saved_searches
       WHERE user_id = ? AND sport_id = ? AND place_id = ? AND period = ?`,
    )
    .get(userId, draft.sportId, draft.placeId, draft.period) as { id: string } | undefined;
  const stamp = nowIso();
  if (existing) {
    db()
      .prepare("UPDATE saved_searches SET place_label = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(draft.placeLabel, stamp, existing.id, userId);
    return listSavedSearches(userId).find((item) => item.id === existing.id)!;
  }
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO saved_searches (
        id, user_id, sport_id, place_id, place_label, period, last_opened_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
    .run(id, userId, draft.sportId, draft.placeId, draft.placeLabel, draft.period, stamp, stamp);
  return listSavedSearches(userId).find((item) => item.id === id)!;
}

export function touchSavedSearch(userId: string, id: string) {
  ensureMomentsSchema();
  const stamp = nowIso();
  db()
    .prepare("UPDATE saved_searches SET last_opened_at = ?, updated_at = ? WHERE user_id = ? AND id = ?")
    .run(stamp, stamp, userId, id);
  return listSavedSearches(userId).find((item) => item.id === id) ?? null;
}

export function deleteSavedSearch(userId: string, id: string) {
  ensureMomentsSchema();
  const result = db().prepare("DELETE FROM saved_searches WHERE user_id = ? AND id = ?").run(userId, id);
  return Number(result.changes) > 0;
}

export function listFavoriteSports(userId: string) {
  ensureMomentsSchema();
  const rows = db()
    .prepare("SELECT sport_id FROM favorite_sports WHERE user_id = ? ORDER BY created_at ASC")
    .all(userId) as Array<{ sport_id: string }>;
  return rows.map((row) => findSport(row.sport_id));
}

export function setFavoriteSport(userId: string, sportId: string, favorite: boolean) {
  ensureMomentsSchema();
  const sport = findSport(sportId);
  if (favorite) {
    db()
      .prepare(
        "INSERT OR IGNORE INTO favorite_sports (user_id, sport_id, created_at) VALUES (?, ?, ?)",
      )
      .run(userId, sport.id, nowIso());
  } else {
    db().prepare("DELETE FROM favorite_sports WHERE user_id = ? AND sport_id = ?").run(userId, sport.id);
  }
  return listFavoriteSports(userId);
}

export function getPreferences(userId: string): UserPreferences {
  ensureMomentsSchema();
  const row = db()
    .prepare("SELECT * FROM user_preferences WHERE user_id = ?")
    .get(userId) as
    | {
        weekend_focus: number;
        uv_reminders: number;
        save_plans_by_default: number;
        updated_at: string | null;
      }
    | undefined;
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    weekendFocus: Boolean(row.weekend_focus),
    uvReminders: Boolean(row.uv_reminders),
    savePlansByDefault: Boolean(row.save_plans_by_default),
    locale: "nl-NL",
    updatedAt: row.updated_at,
  };
}

export function updatePreferences(
  userId: string,
  patch: Partial<Pick<UserPreferences, "weekendFocus" | "uvReminders" | "savePlansByDefault">>,
) {
  ensureMomentsSchema();
  const current = getPreferences(userId);
  const next = {
    weekendFocus: patch.weekendFocus ?? current.weekendFocus,
    uvReminders: patch.uvReminders ?? current.uvReminders,
    savePlansByDefault: patch.savePlansByDefault ?? current.savePlansByDefault,
  };
  const stamp = nowIso();
  db()
    .prepare(
      `INSERT INTO user_preferences (user_id, weekend_focus, uv_reminders, save_plans_by_default, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         weekend_focus = excluded.weekend_focus,
         uv_reminders = excluded.uv_reminders,
         save_plans_by_default = excluded.save_plans_by_default,
         updated_at = excluded.updated_at`,
    )
    .run(
      userId,
      next.weekendFocus ? 1 : 0,
      next.uvReminders ? 1 : 0,
      next.savePlansByDefault ? 1 : 0,
      stamp,
    );
  return getPreferences(userId);
}

const AGE_COPY = {
  analysis: { empty: "Nog geen analyse gekoppeld", fresh: "Zojuist opgeslagen" },
  opened: { empty: "Nog niet geopend", fresh: "Zojuist geopend" },
  updated: { empty: "Nog niet bijgewerkt", fresh: "Zojuist bijgewerkt" },
} as const;

export function ageLabel(iso: string | null, kind: keyof typeof AGE_COPY = "analysis") {
  const copy = AGE_COPY[kind];
  if (!iso) return copy.empty;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "Leeftijd onbekend";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return copy.fresh;
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} dag${days === 1 ? "" : "en"} geleden`;
}

export function draftFromMoment(moment: PlannedMoment): SearchDraft {
  return {
    sportId: moment.sportId,
    sportName: moment.sportName,
    placeId: moment.placeId,
    placeLabel: moment.placeLabel,
    period: moment.period,
  };
}

export function draftFromSearch(search: SavedSearch): SearchDraft {
  return {
    sportId: search.sportId,
    sportName: search.sportName,
    placeId: search.placeId,
    placeLabel: search.placeLabel,
    period: search.period,
  };
}
