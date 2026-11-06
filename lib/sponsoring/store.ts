import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { normalizeEmail, validateEmail } from "@/lib/auth/service";
import { resolveDutchPlace } from "@/lib/places";
import { PILOT_DAYS, PILOT_PRICE_CENTS, pilotBookable } from "@/lib/sponsoring/constants";
import { ensureSponsorSchema } from "@/lib/sponsoring/schema";
import { desiredStartOrNull, knownSport, placeShape, plainText } from "@/lib/sponsoring/validate";

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
  /**
   * Honeypot. A filled value is rejected without storage.
   * Must not resemble a website or company field: browsers autofill those and drop real requests.
   */
  wsHp?: unknown;
  /** Absent on older clients. Public callers cannot set status, price or a live period. */
  intent?: unknown;
  sportId?: unknown;
  placeId?: unknown;
  placeLabel?: unknown;
  desiredStart?: unknown;
};

export type SponsorshipErrors = Partial<
  Record<"name" | "organisation" | "email" | "message" | "form" | "intent" | "sport" | "region" | "start", string>
>;

export type SponsorshipRequest = {
  id: string;
  name: string;
  organisation: string;
  email: string;
  message: string;
  inbox: string | null;
  createdAt: string;
  intent: "pilot" | "custom" | null;
  inquiry: "interest" | "request" | null;
  sportId: string | null;
  placeId: string | null;
  placeLabel: string | null;
  desiredStart: string | null;
  quotedPriceCents: number | null;
  quotedDays: number | null;
  status: "received";
};

type PlaceResolver = (
  placeId: string,
  placeLabel: string,
) => Promise<{ id: string; label: string } | null>;

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

export function validateSponsorship(
  input: SponsorshipInput,
):
  | {
      ok: true;
      value: Omit<SponsorshipRequest, "id" | "createdAt" | "inbox" | "status"> & { status: "received" };
    }
  | { ok: false; errors: SponsorshipErrors } {
  if (typeof input.wsHp === "string" && input.wsHp.trim()) {
    return { ok: false, errors: { form: "De aanvraag kon niet worden verwerkt." } };
  }
  const name = plainText(typeof input.name === "string" ? input.name : "");
  const organisation = plainText(typeof input.organisation === "string" ? input.organisation : "");
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

  const intentRaw = input.intent;
  let intent: "pilot" | "custom" | null = null;
  if (intentRaw == null || intentRaw === "") {
    intent = null;
  } else if (intentRaw === "pilot" || intentRaw === "custom") {
    intent = intentRaw;
  } else {
    errors.intent = "Kies pilot of maatwerk.";
  }

  let sportId: string | null = null;
  let placeId: string | null = null;
  let placeLabel: string | null = null;
  let desiredStart: string | null = null;
  if (intent === "pilot") {
    const sport = knownSport(input.sportId);
    if (!sport) errors.sport = "Kies één sport uit het overzicht.";
    else sportId = sport.id;
    if (!placeShape(input.placeId, input.placeLabel)) {
      errors.region = "Kies één Nederlandse plaats.";
    } else {
      placeId = input.placeId as string;
      placeLabel = plainText(input.placeLabel as string);
    }
    const start = desiredStartOrNull(input.desiredStart);
    if (!start.ok) errors.start = "Vul een geldige startdatum in of laat het veld leeg.";
    else desiredStart = start.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const bookable = pilotBookable();
  return {
    ok: true,
    value: {
      name,
      organisation,
      email,
      message,
      intent,
      inquiry: intent === "pilot" ? (bookable ? "request" : "interest") : intent === "custom" ? "request" : null,
      sportId,
      placeId,
      placeLabel,
      desiredStart,
      quotedPriceCents: intent === "pilot" ? PILOT_PRICE_CENTS : null,
      quotedDays: intent === "pilot" ? PILOT_DAYS : null,
      status: "received",
    },
  };
}

export async function saveSponsorship(
  input: SponsorshipInput,
  options?: { resolvePlace?: PlaceResolver; bookable?: boolean },
): Promise<
  | { ok: true; request: SponsorshipRequest; mailed: false }
  | { ok: false; status: number; errors: SponsorshipErrors }
> {
  const previous = process.env.WEERSPORT_SPONSOR_PILOT_BOOKABLE;
  if (options && "bookable" in options) {
    process.env.WEERSPORT_SPONSOR_PILOT_BOOKABLE = options.bookable ? "1" : "0";
  }
  let parsed: ReturnType<typeof validateSponsorship>;
  try {
    parsed = validateSponsorship(input);
  } finally {
    if (options && "bookable" in options) {
      if (previous === undefined) delete process.env.WEERSPORT_SPONSOR_PILOT_BOOKABLE;
      else process.env.WEERSPORT_SPONSOR_PILOT_BOOKABLE = previous;
    }
  }
  if (!parsed.ok) return { ok: false, status: 400, errors: parsed.errors };

  if (parsed.value.intent === "pilot" && parsed.value.placeId && parsed.value.placeLabel) {
    const resolvePlace = options?.resolvePlace ?? resolveDutchPlace;
    let place: { id: string; label: string } | null;
    try {
      place = await resolvePlace(parsed.value.placeId, parsed.value.placeLabel);
    } catch {
      return {
        ok: false,
        status: 503,
        errors: { region: "De plaatscontrole is nu niet bereikbaar. Probeer het later opnieuw." },
      };
    }
    if (!place || place.label.toLowerCase() !== parsed.value.placeLabel.toLowerCase()) {
      return { ok: false, status: 400, errors: { region: "Kies één Nederlandse plaats uit de lijst." } };
    }
    parsed.value.placeId = place.id;
    parsed.value.placeLabel = place.label;
  }

  ensureSponsorSchema();
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
      `INSERT INTO sponsorship_requests (
        id, name, organisation, email, message, inbox, created_at,
        intent, inquiry, sport_id, place_id, place_label, desired_start,
        quoted_price_cents, quoted_days, status, agreed_price_cents, agreed_at, price_kind
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
    )
    .run(
      request.id,
      request.name,
      request.organisation,
      request.email,
      request.message,
      request.inbox,
      request.createdAt,
      request.intent,
      request.inquiry,
      request.sportId,
      request.placeId,
      request.placeLabel,
      request.desiredStart,
      request.quotedPriceCents,
      request.quotedDays,
      request.status,
    );
  return { ok: true, request, mailed: false };
}
