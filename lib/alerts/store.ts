import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";

export type AlertDays = "any" | "weekend";

export type WeatherAlert = {
  id: string;
  userId: string;
  sportId: string;
  placeId: string;
  placeLabel: string;
  latitude: number;
  longitude: number;
  minScore: number;
  days: AlertDays;
  email: boolean;
  push: boolean;
  active: boolean;
  unsubscribeToken: string;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  createdAt: string;
};

export type PushSubscriptionRow = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };

let migrated = false;

export function ensureAlertsSchema() {
  if (migrated) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS weather_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sport_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_label TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      min_score INTEGER NOT NULL DEFAULT 80,
      days TEXT NOT NULL DEFAULT 'any',
      channel_email INTEGER NOT NULL DEFAULT 1,
      channel_push INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      unsubscribe_token TEXT NOT NULL UNIQUE,
      last_checked_at TEXT,
      last_notified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alert_deliveries (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      window_date TEXT NOT NULL,
      window_label TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (alert_id, window_date, channel)
    );
  `);
  migrated = true;
}

const now = () => new Date().toISOString();

function mapAlert(row: Record<string, unknown>): WeatherAlert {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sportId: String(row.sport_id),
    placeId: String(row.place_id),
    placeLabel: String(row.place_label),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    minScore: Number(row.min_score),
    days: row.days === "weekend" ? "weekend" : "any",
    email: Number(row.channel_email) === 1,
    push: Number(row.channel_push) === 1,
    active: Number(row.active) === 1,
    unsubscribeToken: String(row.unsubscribe_token),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    lastNotifiedAt: row.last_notified_at ? String(row.last_notified_at) : null,
    createdAt: String(row.created_at),
  };
}

export const MAX_ALERTS_PER_USER = 10;

export function listAlerts(userId: string) {
  ensureAlertsSchema();
  return db()
    .prepare("SELECT * FROM weather_alerts WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId)
    .map((row) => mapAlert(row as Record<string, unknown>));
}

export function createAlert(input: {
  userId: string;
  sportId: string;
  placeId: string;
  placeLabel: string;
  latitude: number;
  longitude: number;
}): { ok: true; alert: WeatherAlert } | { ok: false; error: string } {
  ensureAlertsSchema();
  const existing = listAlerts(input.userId);
  const duplicate = existing.find((alert) => alert.sportId === input.sportId && alert.placeId === input.placeId);
  if (duplicate) {
    if (!duplicate.active) updateAlert(input.userId, duplicate.id, { active: true });
    return { ok: true, alert: { ...duplicate, active: true } };
  }
  if (existing.length >= MAX_ALERTS_PER_USER) {
    return { ok: false, error: `Je kunt maximaal ${MAX_ALERTS_PER_USER} meldingen hebben. Verwijder er eerst een.` };
  }
  const stamp = now();
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO weather_alerts (id, user_id, sport_id, place_id, place_label, latitude, longitude, min_score, days,
        channel_email, channel_push, active, unsubscribe_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 80, 'any', 1, ?, 1, ?, ?, ?)`,
    )
    .run(
      id,
      input.userId,
      input.sportId,
      input.placeId,
      input.placeLabel,
      input.latitude,
      input.longitude,
      hasPushSubscription(input.userId) ? 1 : 0,
      randomBytes(24).toString("base64url"),
      stamp,
      stamp,
    );
  const row = db().prepare("SELECT * FROM weather_alerts WHERE id = ?").get(id) as Record<string, unknown>;
  return { ok: true, alert: mapAlert(row) };
}

export function updateAlert(
  userId: string,
  id: string,
  patch: Partial<{ minScore: number; days: AlertDays; email: boolean; push: boolean; active: boolean }>,
) {
  ensureAlertsSchema();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (typeof patch.minScore === "number") {
    sets.push("min_score = ?");
    values.push(Math.max(50, Math.min(95, Math.round(patch.minScore))));
  }
  if (patch.days) {
    sets.push("days = ?");
    values.push(patch.days === "weekend" ? "weekend" : "any");
  }
  if (typeof patch.email === "boolean") {
    sets.push("channel_email = ?");
    values.push(patch.email ? 1 : 0);
  }
  if (typeof patch.push === "boolean") {
    sets.push("channel_push = ?");
    values.push(patch.push ? 1 : 0);
  }
  if (typeof patch.active === "boolean") {
    sets.push("active = ?");
    values.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) return false;
  sets.push("updated_at = ?");
  values.push(now());
  const result = db()
    .prepare(`UPDATE weather_alerts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .run(...values, id, userId);
  return result.changes > 0;
}

export function deleteAlert(userId: string, id: string) {
  ensureAlertsSchema();
  return db().prepare("DELETE FROM weather_alerts WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

export function deactivateByToken(token: string) {
  ensureAlertsSchema();
  if (!token || token.length < 20) return null;
  const row = db().prepare("SELECT * FROM weather_alerts WHERE unsubscribe_token = ?").get(token) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  db().prepare("UPDATE weather_alerts SET active = 0, updated_at = ? WHERE id = ?").run(now(), String(row.id));
  return mapAlert({ ...row, active: 0 });
}

export function findAlertByToken(token: string) {
  ensureAlertsSchema();
  if (!token || token.length < 20) return null;
  const row = db().prepare("SELECT * FROM weather_alerts WHERE unsubscribe_token = ?").get(token);
  return row ? mapAlert(row as Record<string, unknown>) : null;
}

/** Active alerts of verified accounts, with the address to mail. */
export function listDueAlerts() {
  ensureAlertsSchema();
  return db()
    .prepare(
      `SELECT a.*, u.email AS user_email, u.name AS user_name FROM weather_alerts a
       JOIN users u ON u.id = a.user_id
       WHERE a.active = 1 AND u.email_verified_at IS NOT NULL`,
    )
    .all()
    .map((row) => {
      const record = row as Record<string, unknown>;
      return { alert: mapAlert(record), email: String(record.user_email), name: String(record.user_name) };
    });
}

export function markChecked(id: string, notified: boolean) {
  const stamp = now();
  db()
    .prepare(
      notified
        ? "UPDATE weather_alerts SET last_checked_at = ?, last_notified_at = ? WHERE id = ?"
        : "UPDATE weather_alerts SET last_checked_at = ? WHERE id = ?",
    )
    .run(...(notified ? [stamp, stamp, id] : [stamp, id]));
}

/** Claims one delivery slot. Returns false when this alert already went out for that day on that channel. */
export function claimDelivery(alertId: string, windowDate: string, windowLabel: string, channel: "email" | "push") {
  try {
    db()
      .prepare(
        `INSERT INTO alert_deliveries (id, alert_id, window_date, window_label, channel, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(randomUUID(), alertId, windowDate, windowLabel, channel, now());
    return true;
  } catch {
    return false;
  }
}

export function finishDelivery(alertId: string, windowDate: string, channel: "email" | "push", status: string, detail: string | null) {
  db()
    .prepare("UPDATE alert_deliveries SET status = ?, detail = ? WHERE alert_id = ? AND window_date = ? AND channel = ?")
    .run(status, detail, alertId, windowDate, channel);
}

export function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  ensureAlertsSchema();
  db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
  db()
    .prepare("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, sub.endpoint, sub.p256dh, sub.auth, now());
}

export function deletePushSubscription(userId: string, endpoint: string) {
  ensureAlertsSchema();
  db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(endpoint, userId);
}

export function dropPushSubscription(endpoint: string) {
  db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function listPushSubscriptions(userId: string): PushSubscriptionRow[] {
  ensureAlertsSchema();
  return db()
    .prepare("SELECT * FROM push_subscriptions WHERE user_id = ?")
    .all(userId)
    .map((row) => {
      const r = row as Record<string, unknown>;
      return { id: String(r.id), userId: String(r.user_id), endpoint: String(r.endpoint), p256dh: String(r.p256dh), auth: String(r.auth) };
    });
}

export function hasPushSubscription(userId: string) {
  return listPushSubscriptions(userId).length > 0;
}
