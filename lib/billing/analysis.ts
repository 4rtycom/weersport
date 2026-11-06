import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import type { ForecastSnapshot } from "@/lib/data/types";
import { buildForecastSnapshot } from "@/lib/data/snapshot";
import type { SearchDraft } from "@/lib/draft";
import { CACHE_TTL_MS } from "@/lib/billing/constants";
import { ensureBasisSubscription, getEntitlement } from "@/lib/billing/entitlement";
import { analysisFingerprint, calendarPeriodKey } from "@/lib/billing/period";
import { QUOTA_POLICY_SUMMARY } from "@/lib/billing/quota-policy";
import { ensureBillingSchema } from "@/lib/billing/schema";
import {
  RECOMMENDATIONS_DISABLED_REASON,
  recommendationsEnabled,
} from "@/lib/release/capabilities";

export type AnalysisResult =
  | {
      ok: true;
      booked: boolean;
      consumed: number;
      cacheHit: boolean;
      quotaExhausted: boolean;
      readOnly: boolean;
      fingerprint: string;
      snapshot: ForecastSnapshot;
      entitlement: ReturnType<typeof getEntitlement>;
    }
  | {
      ok: false;
      status: number;
      error: string;
      booked: false;
      consumed: 0;
      quotaExhausted: boolean;
      readOnly: boolean;
      fingerprint?: string;
      entitlement: ReturnType<typeof getEntitlement>;
      snapshot?: ForecastSnapshot;
      next?: string;
    };

function nowIso() {
  return new Date().toISOString();
}

function cacheKeyFor(userId: string, draft: SearchDraft) {
  return analysisFingerprint(userId, draft);
}

function shouldConsume(snapshot: ForecastSnapshot) {
  if (snapshot.weather.status === "MISSING_CRITICAL" || !snapshot.weather.value) return false;
  if (snapshot.suitability.kind === "NO_SCORE") return false;
  return snapshot.suitability.kind === "SCORED";
}

function downgradeForQuota(snapshot: ForecastSnapshot): ForecastSnapshot {
  if (snapshot.suitability.kind !== "SCORED") return snapshot;
  return {
    ...snapshot,
    suitability: {
      kind: "NO_SCORE",
      reason:
        "Maandelijks analyselimiet bereikt. UV en officiële waarschuwingen blijven beschikbaar; er is geen nieuwe scoresessie gestart.",
      missing: ["analysesquota"],
    },
  };
}

function downgradeForRecommendationsDisabled(snapshot: ForecastSnapshot): ForecastSnapshot {
  return {
    ...snapshot,
    suitability: {
      kind: "NO_SCORE",
      reason: RECOMMENDATIONS_DISABLED_REASON,
      missing: ["recommendations_disabled"],
    },
  };
}

async function buildSnapshotRespectingCapabilities(draft: SearchDraft) {
  const snapshot = await buildSnapshot(draft);
  if (!recommendationsEnabled()) {
    return downgradeForRecommendationsDisabled(snapshot);
  }
  return snapshot;
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

async function buildSnapshot(draft: SearchDraft) {
  if (process.env.WEERSPORT_FORCE_WEATHER_FAIL === "1") {
    throw new Error("Forced weather failure");
  }
  return buildForecastSnapshot(draft);
}

/** Read-only peek: cache or nothing. Never books quota. */
export function peekMeteredAnalysis(input: {
  userId: string;
  draft: SearchDraft;
}): AnalysisResult {
  ensureBillingSchema();
  ensureBasisSubscription(input.userId);
  const fingerprint = cacheKeyFor(input.userId, input.draft);
  const entitlement = getEntitlement(input.userId);
  const cached = readCache(input.userId, fingerprint);
  if (cached) {
    return {
      ok: true,
      booked: false,
      consumed: 0,
      cacheHit: true,
      quotaExhausted: entitlement.remaining <= 0,
      readOnly: true,
      fingerprint,
      snapshot: cached,
      entitlement,
    };
  }
  return {
    ok: false,
    status: 404,
    error: "Geen opgeslagen analyse voor deze zoekopdracht. Start expliciet een nieuwe analyse.",
    booked: false,
    consumed: 0,
    quotaExhausted: entitlement.remaining <= 0,
    readOnly: true,
    fingerprint,
    entitlement,
  };
}

/**
 * Explicit metered analysis (POST only).
 * Cache is written only after a successful free NO_SCORE path or after ledger commit.
 * A rolled-back quota race must not leave a chargeable SCORED cache behind.
 */
export async function runMeteredAnalysis(input: {
  userId: string;
  draft: SearchDraft;
  idempotencyKey?: string | null;
}): Promise<AnalysisResult> {
  ensureBillingSchema();
  ensureBasisSubscription(input.userId);
  const entitlement = getEntitlement(input.userId);
  const fingerprint = cacheKeyFor(input.userId, input.draft);
  const cacheKey = fingerprint;

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
          quotaExhausted: false,
          readOnly: false,
          fingerprint,
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
      quotaExhausted: entitlement.remaining <= 0,
      readOnly: false,
      fingerprint,
      snapshot: cached,
      entitlement,
    };
  }

  if (entitlement.remaining <= 0) {
    let snapshot: ForecastSnapshot;
    try {
      snapshot = downgradeForQuota(await buildSnapshotRespectingCapabilities(input.draft));
    } catch {
      return {
        ok: false,
        status: 402,
        error: `Maandelijks analyselimiet bereikt. ${QUOTA_POLICY_SUMMARY}`,
        booked: false,
        consumed: 0,
        quotaExhausted: true,
        readOnly: false,
        fingerprint,
        entitlement,
        next: "/account/abonnement",
      };
    }
    // Cache only the downgraded (non-SCORED) safety view — never a free scored result.
    writeCache(input.userId, cacheKey, snapshot);
    return {
      ok: true,
      booked: false,
      consumed: 0,
      cacheHit: false,
      quotaExhausted: true,
      readOnly: false,
      fingerprint,
      snapshot,
      entitlement,
    };
  }

  let snapshot: ForecastSnapshot;
  try {
    snapshot = await buildSnapshotRespectingCapabilities(input.draft);
  } catch {
    return {
      ok: false,
      status: 503,
      error:
        "De bronketen is niet volledig bereikbaar. Er is geen score of veiligheidsclaim gemaakt en er is niets verbruikt.",
      booked: false,
      consumed: 0,
      quotaExhausted: false,
      readOnly: false,
      fingerprint,
      entitlement,
    };
  }

  if (!shouldConsume(snapshot)) {
    writeCache(input.userId, cacheKey, snapshot);
    return {
      ok: true,
      booked: false,
      consumed: 0,
      cacheHit: false,
      quotaExhausted: false,
      readOnly: false,
      fingerprint,
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
      // Do not publish SCORED cache after a denied race.
      return {
        ok: true,
        booked: false,
        consumed: 0,
        cacheHit: false,
        quotaExhausted: true,
        readOnly: false,
        fingerprint,
        snapshot: downgradeForQuota(snapshot),
        entitlement: latest,
      };
    }
    const duplicate = db()
      .prepare("SELECT id FROM analysis_ledger WHERE user_id = ? AND cache_key = ?")
      .get(input.userId, cacheKey) as { id: string } | undefined;
    if (duplicate) {
      writeCache(input.userId, cacheKey, snapshot);
      db().exec("COMMIT");
      return {
        ok: true,
        booked: false,
        consumed: 0,
        cacheHit: true,
        quotaExhausted: false,
        readOnly: false,
        fingerprint,
        snapshot,
        entitlement: getEntitlement(input.userId),
      };
    }
    if (input.idempotencyKey) {
      const sameKey = db()
        .prepare("SELECT id, cache_key FROM analysis_ledger WHERE user_id = ? AND idempotency_key = ?")
        .get(input.userId, input.idempotencyKey) as { id: string; cache_key: string } | undefined;
      if (sameKey) {
        const priorSnap = readCache(input.userId, sameKey.cache_key) ?? snapshot;
        writeCache(input.userId, cacheKey, priorSnap);
        db().exec("COMMIT");
        return {
          ok: true,
          booked: false,
          consumed: 0,
          cacheHit: true,
          quotaExhausted: false,
          readOnly: false,
          fingerprint,
          snapshot: priorSnap,
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
    writeCache(input.userId, cacheKey, snapshot);
    db().exec("COMMIT");
  } catch (error) {
    try {
      db().exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }

  return {
    ok: true,
    booked: true,
    consumed: 1,
    cacheHit: false,
    quotaExhausted: false,
    readOnly: false,
    fingerprint,
    snapshot,
    entitlement: getEntitlement(input.userId),
  };
}
