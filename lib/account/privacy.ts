import { db } from "@/lib/auth/db";
import { verifyPassword } from "@/lib/auth/password";
import { ensureBillingSchema } from "@/lib/billing/schema";
import { ensureMomentsSchema } from "@/lib/moments/store";

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified_at: string | null;
  draft_json: string | null;
  created_at: string;
};

function userById(id: string) {
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function exportAccountData(userId: string) {
  ensureMomentsSchema();
  ensureBillingSchema();
  const user = userById(userId);
  if (!user) return null;

  const moments = db().prepare("SELECT * FROM planned_moments WHERE user_id = ?").all(userId);
  const searches = db().prepare("SELECT * FROM saved_searches WHERE user_id = ?").all(userId);
  const favorites = db().prepare("SELECT * FROM favorite_sports WHERE user_id = ?").all(userId);
  const preferences = db().prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) ?? null;
  const ledger = db()
    .prepare(
      "SELECT id, period_key, cache_key, sport_id, place_id, place_label, period, consumed, created_at FROM analysis_ledger WHERE user_id = ?",
    )
    .all(userId);
  const invoices = db().prepare("SELECT * FROM billing_invoices WHERE user_id = ?").all(userId);
  const subscription = db().prepare("SELECT * FROM billing_subscriptions WHERE user_id = ?").get(userId) ?? null;
  const checkouts = db()
    .prepare(
      "SELECT id, amount_cents, currency, state, consent_at, created_at, updated_at FROM billing_checkouts WHERE user_id = ?",
    )
    .all(userId);

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: "weersport-account-export-v1",
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.email_verified_at,
      createdAt: user.created_at,
      draft: user.draft_json ? JSON.parse(user.draft_json) : null,
    },
    plannedMoments: moments,
    savedSearches: searches,
    favoriteSports: favorites,
    preferences,
    analysisLedger: ledger,
    billing: {
      subscription,
      checkouts,
      invoices,
    },
  };
}

export function deleteAccount(userId: string, password: string) {
  ensureMomentsSchema();
  ensureBillingSchema();
  const user = userById(userId);
  if (!user) return { ok: false as const, error: "Account niet gevonden.", status: 404 };
  if (!verifyPassword(password, user.password_hash)) {
    return { ok: false as const, error: "Wachtwoord klopt niet.", status: 401 };
  }

  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM planned_moments WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM saved_searches WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM favorite_sports WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM user_preferences WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM analysis_ledger WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM analysis_cache WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM billing_customers WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM billing_checkouts WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM billing_subscriptions WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM billing_invoices WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM tokens WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM users WHERE id = ?").run(userId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return {
    ok: true as const,
    message:
      "Account en persoonlijke data zijn verwijderd. Factuur-/bewaarplichten voor productie volgen nog een aparte fiscaliteitspolicy.",
  };
}
