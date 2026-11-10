import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import type { ForecastSnapshot } from "@/lib/data/types";
import { buildForecastSnapshot } from "@/lib/data/snapshot";
import type { SearchDraft } from "@/lib/draft";
import { CACHE_TTL_MS } from "@/lib/billing/constants";
import { ensureBasisSubscription, getEntitlement } from "@/lib/billing/entitlement";
import { calendarPeriodKey, hourBucketKey } from "@/lib/billing/period";
import { ensureBillingSchema } from "@/lib/billing/schema";

export type AnalysisResult =
  | {
      ok: true;
      booked: boolean;
      consumed: number;
      cacheHit: boolean;
      snapshot: ForecastSnapshot;
      entitlement: ReturnType<typeof getEntitlement>;
    }
  | {
      ok: false;
      status: number;
      error: string;
      booked: false;
      consumed: 0;
      entitlement: ReturnType<typeof getEntitlement>;
      next?: string;
    };

function nowIso() {
  return new Date().toISOString();
}

export function isUniqueConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error && error.code != null ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return code === "23505" || /duplicate key value violates unique constraint/i.test(message) || /UNIQUE constraint failed/i.test(message);
}

function cacheKeyFor(userId: string, draft: SearchDraft) {
  const base = `${userId}:${draft.sportId}:${draft.placeId}:${draft.period}:${hourBucketKey()}`;
  return draft.sportSpot ? `${base}:spot:${draft.sportSpot.id}` : base;
}

export function buildAnalysisCacheKey(userId: string, draft: SearchDraft) {
  return cacheKeyFor(userId, draft);
}

function shouldConsume(snapshot: ForecastSnapshot) {
  if (snapshot.weather.status === "MISSING_CRITICAL" || !snapshot.weather.value) return false;
  if (snapshot.suitability.kind === "NO_SCORE") return false;
  return snapshot.suitability.kind === "SCORED";
}

function readCache(userId: string, cacheKey: string) {
  const row = db()
    .prepare("SELECT snapshot_json, expires_at FROM analysis_cache WHERE cache_key = ? AND user_id = ?")
    .get(cacheKey, userId) as { snapshot_json: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db().prepare("DELETE FROM analysis_cache WHERE cache_key = ?").run(cacheKey);
    return null;
  }
  try {
    return JSON.parse(row.snapshot_json) as ForecastSnapshot;
  } catch {
    return null;
  }
}

function writeCache(userId: string, cacheKey: string, snapshot: ForecastSnapshot) {
  const stamp = nowIso();
  const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  db()
    .prepare(
      `INSERT INTO analysis_cache (cache_key, user_id, snapshot_json, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         snapshot_json = excluded.snapshot_json,
         expires_at = excluded.expires_at`,
    )
    .run(cacheKey, userId, JSON.stringify(snapshot), expires, stamp);
}

export async function runMeteredAnalysis(input: {
  userId: string;
  draft: SearchDraft;
  idempotencyKey?: string | null;
}): Promise<AnalysisResult> {
  ensureBillingSchema();
  ensureBasisSubscription(input.userId);
  const entitlement = getEntitlement(input.userId);
  const cacheKey = cacheKeyFor(input.userId, input.draft);

  if (input.idempotencyKey) {
    const prior = db()
      .prepare("SELECT cache_key FROM analysis_ledger WHERE user_id = ? AND idempotency_key = ?")
      .get(input.userId, input.idempotencyKey) as { cache_key: string } | undefined;
    if (prior) {
      const cached = readCache(input.userId, prior.cache_key) ?? readCache(input.userId, cacheKey);
      if (cached) {
        return {
          ok: true,
          booked: false,
          consumed: 0,
          cacheHit: true,
          snapshot: cached,
          entitlement: getEntitlement(input.userId),
        };
      }
    }
  }

  const cached = readCache(input.userId, cacheKey);
  if (cached) {
    return {
      ok: true,
      booked: false,
      consumed: 0,
      cacheHit: true,
      snapshot: cached,
      entitlement,
    };
  }

  if (entitlement.remaining <= 0) {
    return {
      ok: false,
      status: 402,
      error: "Maandelijks analyselimiet bereikt. Opgeslagen plannen blijven beschikbaar; upgrade naar Pro voor meer analyses.",
      booked: false,
      consumed: 0,
      entitlement,
      next: "/account/abonnement",
    };
  }

  let snapshot: ForecastSnapshot;
  try {
    snapshot = await buildForecastSnapshot(input.draft);
  } catch {
    return {
      ok: false,
      status: 503,
      error: "De bronketen is niet volledig bereikbaar. Er is geen score of veiligheidsclaim gemaakt en er is niets verbruikt.",
      booked: false,
      consumed: 0,
      entitlement,
    };
  }

  writeCache(input.userId, cacheKey, snapshot);

  if (!shouldConsume(snapshot)) {
    return {
      ok: true,
      booked: false,
      consumed: 0,
      cacheHit: false,
      snapshot,
      entitlement: getEntitlement(input.userId),
    };
  }

  const periodKey = calendarPeriodKey();
  const stamp = nowIso();
  const id = randomUUID();

  try {
    db().exec("BEGIN IMMEDIATE");
    const latest = getEntitlement(input.userId);
    if (latest.remaining <= 0) {
      db().exec("ROLLBACK");
      return {
        ok: false,
        status: 402,
        error: "Maandelijks analyselimiet bereikt. Opgeslagen plannen blijven beschikbaar.",
        booked: false,
        consumed: 0,
        entitlement: latest,
        next: "/account/abonnement",
      };
    }
    const duplicate = db()
      .prepare("SELECT id FROM analysis_ledger WHERE user_id = ? AND cache_key = ?")
      .get(input.userId, cacheKey) as { id: string } | undefined;
    if (duplicate) {
      db().exec("COMMIT");
      return {
        ok: true,
        booked: false,
        consumed: 0,
        cacheHit: true,
        snapshot,
        entitlement: getEntitlement(input.userId),
      };
    }
    if (input.idempotencyKey) {
      const sameKey = db()
        .prepare("SELECT id FROM analysis_ledger WHERE user_id = ? AND idempotency_key = ?")
        .get(input.userId, input.idempotencyKey) as { id: string } | undefined;
      if (sameKey) {
        db().exec("COMMIT");
        return {
          ok: true,
          booked: false,
          consumed: 0,
          cacheHit: true,
          snapshot,
          entitlement: getEntitlement(input.userId),
        };
      }
    }
    db()
      .prepare(
        `INSERT INTO analysis_ledger (
          id, user_id, period_key, cache_key, idempotency_key, sport_id, place_id, place_label, period, consumed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(
        id,
        input.userId,
        periodKey,
        cacheKey,
        input.idempotencyKey ?? null,
        input.draft.sportId,
        input.draft.placeId,
        input.draft.placeLabel,
        input.draft.period,
        stamp,
      );
    db().exec("COMMIT");
  } catch (error) {
    try {
      db().exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    if (isUniqueConflict(error)) {
      return {
        ok: true,
        booked: false,
        consumed: 0,
        cacheHit: true,
        snapshot,
        entitlement: getEntitlement(input.userId),
      };
    }
    throw error;
  }

  return {
    ok: true,
    booked: true,
    consumed: 1,
    cacheHit: false,
    snapshot,
    entitlement: getEntitlement(input.userId),
  };
}
