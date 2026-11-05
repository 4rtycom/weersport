import { db } from "@/lib/auth/db";
import {
  BASIS_MONTHLY_LIMIT,
  PRO_MONTHLY_LIMIT,
  type BillingState,
  type PlanId,
} from "@/lib/billing/constants";
import { calendarPeriodKey, nextCalendarResetIso } from "@/lib/billing/period";
import { ensureBillingSchema } from "@/lib/billing/schema";

export type Entitlement = {
  plan: PlanId;
  state: BillingState | "basis";
  limit: number;
  used: number;
  remaining: number;
  periodKey: string;
  resetAt: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  adsEligible: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

export function getSubscriptionRow(userId: string) {
  ensureBillingSchema();
  return db()
    .prepare("SELECT * FROM billing_subscriptions WHERE user_id = ?")
    .get(userId) as
    | {
        plan: string;
        state: string;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: number;
      }
    | undefined;
}

export function isProActive(userId: string, at = new Date()) {
  const row = getSubscriptionRow(userId);
  if (!row) return false;
  if (row.plan !== "pro") return false;
  if (row.state === "subscription_active" || row.state === "cancel_requested") {
    if (row.current_period_end && new Date(row.current_period_end).getTime() < at.getTime()) {
      return false;
    }
    return true;
  }
  return false;
}

export function getEntitlement(userId: string): Entitlement {
  ensureBillingSchema();
  const periodKey = calendarPeriodKey();
  const pro = isProActive(userId);
  const row = getSubscriptionRow(userId);
  const usedRow = db()
    .prepare(
      "SELECT COALESCE(SUM(consumed), 0) AS used FROM analysis_ledger WHERE user_id = ? AND period_key = ?",
    )
    .get(userId, periodKey) as { used: number };
  const used = Number(usedRow.used) || 0;
  const limit = pro ? PRO_MONTHLY_LIMIT : BASIS_MONTHLY_LIMIT;
  const resetAt = pro && row?.current_period_end ? row.current_period_end : nextCalendarResetIso();
  return {
    plan: pro ? "pro" : "basis",
    state: pro ? ((row?.state as BillingState) ?? "subscription_active") : "basis",
    limit,
    used,
    remaining: Math.max(0, limit - used),
    periodKey,
    resetAt,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    currentPeriodEnd: row?.current_period_end ?? null,
    adsEligible: !pro,
  };
}

export function ensureBasisSubscription(userId: string) {
  ensureBillingSchema();
  const existing = getSubscriptionRow(userId);
  if (existing) return;
  const stamp = nowIso();
  db()
    .prepare(
      `INSERT INTO billing_subscriptions (
        user_id, plan, state, mollie_subscription_id, mollie_customer_id,
        current_period_start, current_period_end, cancel_at_period_end, cancelled_at, updated_at, created_at
      ) VALUES (?, 'basis', 'basis', NULL, NULL, NULL, NULL, 0, NULL, ?, ?)`,
    )
    .run(userId, stamp, stamp);
}
