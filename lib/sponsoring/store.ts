import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { normalizeEmail, validateEmail } from "@/lib/auth/service";

const NAME_MAX = 80;
const ORGANISATION_MAX = 120;
const MESSAGE_MIN = 20;
const MESSAGE_MAX = 2000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

export type SponsorshipInput = {
  name?: unknown;
  organisation?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot. A filled value is rejected without storage. */
  companyWebsite?: unknown;
};

export type SponsorshipErrors = Partial<Record<"name" | "organisation" | "email" | "message" | "form", string>>;

export type SponsorshipRequest = {
  id: string;
  name: string;
  organisation: string;
  email: string;
  message: string;
  inbox: string | null;
  createdAt: string;
};

/**
 * Configured business inbox. The address is stored with the request.
 * This module never sends mail.
 */
export function businessInbox() {
  const configured =
    process.env.WEERSPORT_BUSINESS_INBOX?.trim() || process.env.WEERSPORT_PARTNERSHIP_EMAIL?.trim() || "";
  if (!configured || !validateEmail(configured)) return null;
  return normalizeEmail(configured);
}

function ensureTable() {
  db().exec(`
    CREATE TABLE IF NOT EXISTS sponsorship_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      organisation TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      inbox TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function validateSponsorship(input: SponsorshipInput): { ok: true; value: Omit<SponsorshipRequest, "id" | "createdAt" | "inbox"> } | { ok: false; errors: SponsorshipErrors } {
  if (typeof input.companyWebsite === "string" && input.companyWebsite.trim()) {
    return { ok: false, errors: { form: "De aanvraag kon niet worden verwerkt." } };
  }
  const name = cleanText(input.name);
  const organisation = cleanText(input.organisation);
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const errors: SponsorshipErrors = {};
  if (name.length < 2 || name.length > NAME_MAX) errors.name = "Vul je naam in (2–80 tekens).";
  if (organisation.length < 2 || organisation.length > ORGANISATION_MAX) {
    errors.organisation = "Vul de organisatie in (2–120 tekens).";
  }
  if (!validateEmail(email)) errors.email = "Vul een geldig e-mailadres in.";
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    errors.message = "Beschrijf de samenwerking in 20–2000 tekens.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, organisation, email, message } };
}

export function saveSponsorship(input: SponsorshipInput):
  | { ok: true; request: SponsorshipRequest; mailed: false }
  | { ok: false; status: number; errors: SponsorshipErrors } {
  const parsed = validateSponsorship(input);
  if (!parsed.ok) return { ok: false, status: 400, errors: parsed.errors };
  ensureTable();
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const recent = db()
    .prepare("SELECT COUNT(*) AS count FROM sponsorship_requests WHERE email = ? AND created_at > ?")
    .get(parsed.value.email, since) as { count: number };
  if (recent.count >= MAX_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      errors: { form: "Er zijn net al meerdere aanvragen ontvangen. Probeer het later opnieuw." },
    };
  }
  const request: SponsorshipRequest = {
    id: randomUUID(),
    ...parsed.value,
    inbox: businessInbox(),
    createdAt: new Date().toISOString(),
  };
  db()
    .prepare(
      "INSERT INTO sponsorship_requests (id, name, organisation, email, message, inbox, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(request.id, request.name, request.organisation, request.email, request.message, request.inbox, request.createdAt);
  return { ok: true, request, mailed: false };
}
