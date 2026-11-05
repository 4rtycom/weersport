import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { hashPassword, hashToken, newToken, verifyPassword } from "@/lib/auth/password";
import { parseDraft, type SearchDraft } from "@/lib/draft";

export type Account = {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  draft: SearchDraft | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified_at: string | null;
  draft_json: string | null;
};

const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function plus(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function accountFrom(row: UserRow): Account {
  let draft: SearchDraft | null = null;
  if (row.draft_json) {
    try {
      draft = parseDraft(JSON.parse(row.draft_json));
    } catch {
      draft = null;
    }
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    verified: Boolean(row.email_verified_at),
    draft,
  };
}

function userById(id: string) {
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

function userByEmail(email: string) {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}

export function validatePassword(value: string) {
  return value.length >= 12 && value.length <= 200;
}

export function validateName(value: string) {
  const name = value.trim();
  return name.length >= 1 && name.length <= 60 && !/[\u0000-\u001f]/.test(name);
}

export function registerAccount(input: { name: string; email: string; password: string; terms: boolean }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!validateName(name)) return { ok: false as const, error: "Vul een naam van maximaal 60 tekens in." };
  if (!validateEmail(email)) return { ok: false as const, error: "Vul een geldig e-mailadres in." };
  if (!validatePassword(input.password)) return { ok: false as const, error: "Gebruik een wachtwoord van minimaal 12 tekens." };
  if (!input.terms) return { ok: false as const, error: "Vink de voorwaarden en het privacybeleid aan." };
  if (userByEmail(email)) {
    return { ok: false as const, error: "Dit e-mailadres heeft al een account. Log in of herstel je wachtwoord." };
  }
  const id = randomUUID();
  db()
    .prepare(
      "INSERT INTO users (id, email, name, password_hash, email_verified_at, draft_json, created_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)",
    )
    .run(id, email, name, hashPassword(input.password), nowIso());
  const token = issueToken(id, "verify");
  const session = createSession(id);
  return { ok: true as const, token, session, account: accountFrom(userById(id)!) };
}

export function tooManyAttempts(email: string) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = db()
    .prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE email = ? AND created_at > ?")
    .get(email, since) as { count: number };
  return row.count >= 8;
}

export function loginAccount(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (tooManyAttempts(email)) {
    return { ok: false as const, error: "Te veel pogingen. Probeer het over een kwartier opnieuw." };
  }
  const user = validateEmail(email) ? userByEmail(email) : undefined;
  const valid = user ? verifyPassword(password, user.password_hash) : false;
  if (!user || !valid) {
    db().prepare("INSERT INTO login_attempts (email, created_at) VALUES (?, ?)").run(email || "ongeldig", nowIso());
    return { ok: false as const, error: "E-mail of wachtwoord klopt niet. Probeer opnieuw." };
  }
  return { ok: true as const, session: createSession(user.id), account: accountFrom(user) };
}

export function createSession(userId: string) {
  const token = newToken();
  db()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), userId, plus(SESSION_MS));
  return token;
}

export function accountFromSession(token: string | undefined) {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(hashToken(token), nowIso()) as UserRow | undefined;
  return row ? accountFrom(row) : null;
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function saveDraft(userId: string, draft: SearchDraft) {
  db().prepare("UPDATE users SET draft_json = ? WHERE id = ?").run(JSON.stringify(draft), userId);
}

function issueToken(userId: string, purpose: "verify" | "reset") {
  db().prepare("DELETE FROM tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL").run(userId, purpose);
  const token = newToken();
  db()
    .prepare("INSERT INTO tokens (token_hash, user_id, purpose, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)")
    .run(hashToken(token), userId, purpose, plus(purpose === "verify" ? VERIFY_MS : RESET_MS));
  return token;
}

export function resendVerification(userId: string) {
  const user = userById(userId);
  if (!user) return null;
  if (user.email_verified_at) return null;
  return issueToken(userId, "verify");
}

export function changeUnverifiedEmail(userId: string, emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!validateEmail(email)) return { ok: false as const, error: "Vul een geldig e-mailadres in." };
  const user = userById(userId);
  if (!user) return { ok: false as const, error: "Log opnieuw in." };
  if (user.email_verified_at) return { ok: false as const, error: "Dit adres is al geverifieerd." };
  const existing = userByEmail(email);
  if (existing && existing.id !== userId) {
    return { ok: false as const, error: "Dit e-mailadres heeft al een account. Log in of herstel je wachtwoord." };
  }
  db().prepare("UPDATE users SET email = ? WHERE id = ?").run(email, userId);
  return { ok: true as const, token: issueToken(userId, "verify"), email };
}

function consume(raw: string, purpose: "verify" | "reset") {
  const row = db()
    .prepare("SELECT token_hash, user_id FROM tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?")
    .get(hashToken(raw), purpose, nowIso()) as { token_hash: string; user_id: string } | undefined;
  if (!row) return null;
  db().prepare("UPDATE tokens SET used_at = ? WHERE token_hash = ?").run(nowIso(), row.token_hash);
  return row.user_id;
}

export function confirmVerification(raw: string) {
  const userId = consume(raw, "verify");
  if (!userId) return null;
  db().prepare("UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL").run(nowIso(), userId);
  return accountFrom(userById(userId)!);
}

export function confirmPrototypeVerification(userId: string) {
  const row = db()
    .prepare(
      "SELECT token_hash FROM tokens WHERE user_id = ? AND purpose = 'verify' AND used_at IS NULL AND expires_at > ? ORDER BY expires_at DESC LIMIT 1",
    )
    .get(userId, nowIso()) as { token_hash: string } | undefined;
  if (!row) return null;
  db().prepare("UPDATE tokens SET used_at = ? WHERE token_hash = ?").run(nowIso(), row.token_hash);
  db().prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(nowIso(), userId);
  return accountFrom(userById(userId)!);
}

export function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = validateEmail(email) ? userByEmail(email) : undefined;
  if (!user) return null;
  return { email: user.email, token: issueToken(user.id, "reset") };
}

export function resetPassword(raw: string, password: string) {
  if (!validatePassword(password)) return { ok: false as const, error: "Gebruik een wachtwoord van minimaal 12 tekens." };
  const userId = consume(raw, "reset");
  if (!userId) return { ok: false as const, error: "Deze herstel-link is ongeldig of verlopen." };
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return { ok: true as const };
}
