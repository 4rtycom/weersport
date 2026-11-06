import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { normalizeEmail, validateEmail } from "@/lib/auth/service";
import { resolveDutchPlace } from "@/lib/places";
import {
  CAMPAIGN_REQUEST_TYPE,
  inclusiveCampaignEnd,
  isIdempotencyKey,
  parseAreaFields,
  parseCampaignStart,
  parseWeeks,
  plainLine,
  provinceForPlace,
  type AreaKind,
} from "@/lib/sponsoring/campaign";
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
  /** Absent on historical message requests. New campaign requests send campaign_v1. */
  requestType?: unknown;
  areaKind?: unknown;
  radiusKm?: unknown;
  durationWeeks?: unknown;
  /** One key per send attempt. Retries of the same payload reuse it. */
  idempotencyKey?: unknown;
};

export type SponsorshipErrors = Partial<
  Record<
    | "name"
    | "organisation"
    | "email"
    | "message"
    | "form"
    | "intent"
    | "sport"
    | "region"
    | "area"
    | "start"
    | "weeks",
    string
  >
>;

export type SponsorshipRequest = {
  id: string;
  name: string;
  organisation: string;
  email: string;
  message: string | null;
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
  status: "received" | "ontvangen";
  requestType: "campaign_v1" | null;
  areaKind: AreaKind | null;
  radiusKm: number | null;
  durationWeeks: number | null;
  endDate: string | null;
  province: string | null;
};

type PlaceResolver = (
  placeId: string,
  placeLabel: string,
) => Promise<{ id: string; label: string; detail?: string } | null>;

type CampaignRow = {
  id: string;
  name: string;
  organisation: string;
  email: string;
  message: string | null;
  inbox: string | null;
  created_at: string;
  sport_id: string | null;
  place_id: string | null;
  place_label: string | null;
  province: string | null;
  area_kind: string | null;
  radius_km: number | null;
  desired_start: string | null;
  duration_weeks: number | null;
  end_date: string | null;
  status: string | null;
  request_type: string | null;
};

const EMPTY_CAMPAIGN = {
  requestType: null,
  areaKind: null,
  radiusKm: null,
  durationWeeks: null,
  endDate: null,
  province: null,
} as const;

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
      ...EMPTY_CAMPAIGN,
    },
  };
}

function campaignRequestFromRow(row: CampaignRow, inbox: string | null): SponsorshipRequest {
  const areaKind = row.area_kind === "place" || row.area_kind === "radius" ? row.area_kind : null;
  return {
    id: row.id,
    name: row.name,
    organisation: row.organisation,
    email: row.email,
    message: row.message,
    inbox,
    createdAt: row.created_at,
    intent: null,
    inquiry: null,
    sportId: row.sport_id,
    placeId: row.place_id,
    placeLabel: row.place_label,
    desiredStart: row.desired_start,
    quotedPriceCents: null,
    quotedDays: null,
    status: "ontvangen",
    requestType: "campaign_v1",
    areaKind,
    radiusKm: row.radius_km,
    durationWeeks: row.duration_weeks,
    endDate: row.end_date,
    province: row.province,
  };
}

function sameCampaign(row: CampaignRow, value: {
  sportId: string;
  placeId: string;
  placeLabel: string;
  province: string;
  areaKind: AreaKind;
  radiusKm: number | null;
  desiredStart: string;
  durationWeeks: number;
  endDate: string;
  name: string;
  organisation: string;
  email: string;
}) {
  return (
    row.request_type === CAMPAIGN_REQUEST_TYPE &&
    row.sport_id === value.sportId &&
    row.place_id === value.placeId &&
    row.place_label === value.placeLabel &&
    (row.province ?? "") === value.province &&
    row.area_kind === value.areaKind &&
    (row.radius_km ?? null) === value.radiusKm &&
    row.desired_start === value.desiredStart &&
    row.duration_weeks === value.durationWeeks &&
    row.end_date === value.endDate &&
    row.name === value.name &&
    row.organisation === value.organisation &&
    row.email === value.email
  );
}

function isUniqueConstraint(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const errcode = "errcode" in error && typeof error.errcode === "number" ? error.errcode : 0;
  return code.includes("SQLITE_CONSTRAINT") || errcode === 19 || /UNIQUE constraint failed/i.test(error.message);
}

function validateCampaign(input: SponsorshipInput) {
  if (typeof input.wsHp === "string" && input.wsHp.trim()) {
    return { ok: false as const, errors: { form: "De aanvraag kon niet worden verwerkt." } };
  }
  if (input.requestType !== CAMPAIGN_REQUEST_TYPE) {
    return { ok: false as const, errors: { form: "Onbekend aanvraagtype." } };
  }
  const errors: SponsorshipErrors = {};
  const name = plainLine(typeof input.name === "string" ? input.name : "");
  const organisation = plainLine(typeof input.organisation === "string" ? input.organisation : "");
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const sport = knownSport(input.sportId);
  const area = parseAreaFields(input.areaKind, input.radiusKm);
  const start = parseCampaignStart(input.desiredStart);
  const weeks = parseWeeks(input.durationWeeks);
  if (!sport) errors.sport = "Kies een sport.";
  if (!placeShape(input.placeId, input.placeLabel)) errors.region = "Kies een plaats uit de lijst.";
  if (!area) errors.area = "Kies het bereik rondom de plaats.";
  if (!start.ok) errors.start = "Kies vandaag of een latere datum.";
  if (weeks == null) errors.weeks = "Vul een geheel aantal weken in, van 1 tot en met 52.";
  if (name.length < 2 || name.length > NAME_MAX) errors.name = "Vul de contactpersoon in (2–80 tekens).";
  if (organisation.length < 2 || organisation.length > ORGANISATION_MAX) {
    errors.organisation = "Vul de organisatienaam in (2–120 tekens).";
  }
  if (!validateEmail(email)) errors.email = "Vul een geldig zakelijk e-mailadres in.";
  if (!isIdempotencyKey(input.idempotencyKey)) {
    errors.form = "De verzending is onvolledig. Probeer het opnieuw.";
  }
  if (Object.keys(errors).length > 0) return { ok: false as const, errors };
  return {
    ok: true as const,
    value: {
      name,
      organisation,
      email,
      sportId: sport!.id,
      placeId: input.placeId as string,
      placeLabel: plainLine(input.placeLabel as string),
      areaKind: area!.areaKind,
      radiusKm: area!.radiusKm,
      desiredStart: start.ok ? start.value : "",
      durationWeeks: weeks!,
      idempotencyKey: input.idempotencyKey as string,
    },
  };
}

async function saveCampaignRequest(
  input: SponsorshipInput,
  options?: { resolvePlace?: PlaceResolver },
): Promise<
  | { ok: true; request: SponsorshipRequest; mailed: false }
  | { ok: false; status: number; errors: SponsorshipErrors }
> {
  const parsed = validateCampaign(input);
  if (!parsed.ok) return { ok: false, status: 400, errors: parsed.errors };

  const resolvePlace = options?.resolvePlace ?? resolveDutchPlace;
  let place: { id: string; label: string; detail?: string } | null;
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
    return { ok: false, status: 400, errors: { region: "Kies een plaats uit de lijst." } };
  }
  const province = provinceForPlace(place.detail ?? "", place.label);
  const endDate = inclusiveCampaignEnd(parsed.value.desiredStart, parsed.value.durationWeeks);
  const value = {
    ...parsed.value,
    placeId: place.id,
    placeLabel: place.label,
    province,
    endDate,
  };
  ensureSponsorSchema();
  const database = db();
  const readExisting = () =>
    database.prepare("SELECT * FROM sponsorship_requests WHERE idempotency_key = ?").get(value.idempotencyKey) as
      | CampaignRow
      | undefined;

  const finishExisting = (existing: CampaignRow) => {
    if (!sameCampaign(existing, value)) {
      return {
        ok: false as const,
        status: 409,
        errors: {
          form: "Deze verzending hoort bij een andere aanvraag. Controleer de gegevens en verstuur opnieuw.",
        },
      };
    }
    return {
      ok: true as const,
      request: campaignRequestFromRow(existing, existing.inbox),
      mailed: false as const,
    };
  };

  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = readExisting();
    if (existing) {
      database.exec("COMMIT");
      return finishExisting(existing);
    }
    const since = new Date(Date.now() - HOUR_MS).toISOString();
    const recent = database
      .prepare("SELECT COUNT(*) AS count FROM sponsorship_requests WHERE email = ? AND created_at > ?")
      .get(value.email, since) as { count: number };
    if (recent.count >= MAX_PER_HOUR) {
      database.exec("ROLLBACK");
      return {
        ok: false,
        status: 429,
        errors: { form: "Er zijn net al meerdere aanvragen ontvangen. Probeer het later opnieuw." },
      };
    }
    const request: SponsorshipRequest = {
      id: randomUUID(),
      name: value.name,
      organisation: value.organisation,
      email: value.email,
      message: null,
      inbox: businessInbox(),
      createdAt: new Date().toISOString(),
      intent: null,
      inquiry: null,
      sportId: value.sportId,
      placeId: value.placeId,
      placeLabel: value.placeLabel,
      desiredStart: value.desiredStart,
      quotedPriceCents: null,
      quotedDays: null,
      status: "ontvangen",
      requestType: "campaign_v1",
      areaKind: value.areaKind,
      radiusKm: value.radiusKm,
      durationWeeks: value.durationWeeks,
      endDate: value.endDate,
      province: value.province || null,
    };
    database
      .prepare(
        `INSERT INTO sponsorship_requests (
          id, name, organisation, email, message, inbox, created_at,
          intent, inquiry, sport_id, place_id, place_label, desired_start,
          quoted_price_cents, quoted_days, status, agreed_price_cents, agreed_at, price_kind,
          request_type, area_kind, radius_km, duration_weeks, end_date, province, idempotency_key
        ) VALUES (
          ?, ?, ?, ?, NULL, ?, ?,
          NULL, NULL, ?, ?, ?, ?,
          NULL, NULL, ?, NULL, NULL, NULL,
          ?, ?, ?, ?, ?, ?, ?
        )`,
      )
      .run(
        request.id,
        request.name,
        request.organisation,
        request.email,
        request.inbox,
        request.createdAt,
        request.sportId,
        request.placeId,
        request.placeLabel,
        request.desiredStart,
        request.status,
        request.requestType,
        request.areaKind,
        request.radiusKm,
        request.durationWeeks,
        request.endDate,
        request.province,
        value.idempotencyKey,
      );
    database.exec("COMMIT");
    return { ok: true, request, mailed: false };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* transaction already closed */
    }
    if (isUniqueConstraint(error)) {
      const existing = readExisting();
      if (existing) return finishExisting(existing);
    }
    throw error;
  }
}

export async function saveSponsorship(
  input: SponsorshipInput,
  options?: { resolvePlace?: PlaceResolver; bookable?: boolean },
): Promise<
  | { ok: true; request: SponsorshipRequest; mailed: false }
  | { ok: false; status: number; errors: SponsorshipErrors }
> {
  if (input.requestType != null && input.requestType !== "") {
    return saveCampaignRequest(input, options);
  }
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
