import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { resolveDutchPlace } from "@/lib/places";
import { sports } from "@/lib/sports";
import {
  COMPLIMENTARY_PRICE_CENTS,
  MEASUREMENT_DEFINITION,
  MEASUREMENT_LIMITATION,
  PILOT_PRICE_CENTS,
  PILOT_TIMEZONE,
} from "@/lib/sponsoring/constants";
import {
  effectiveCpmCents,
  formatAmsterdam,
  formatEuroCents,
  formatEuroDot,
  isIsoDate,
  pilotWindow,
} from "@/lib/sponsoring/period";
import { ensureSponsorSchema } from "@/lib/sponsoring/schema";
import { knownSport, plainText, validateDestination } from "@/lib/sponsoring/validate";

export type RequestRow = {
  id: string;
  name: string;
  organisation: string;
  email: string;
  message: string | null;
  inbox: string | null;
  created_at: string;
  intent: string | null;
  inquiry: string | null;
  sport_id: string | null;
  place_id: string | null;
  place_label: string | null;
  desired_start: string | null;
  quoted_price_cents: number | null;
  quoted_days: number | null;
  status: string | null;
  agreed_price_cents: number | null;
  agreed_at: string | null;
  price_kind: string | null;
  request_type: string | null;
  area_kind: string | null;
  radius_km: number | null;
  duration_weeks: number | null;
  end_date: string | null;
  province: string | null;
  idempotency_key: string | null;
};

export type CampaignRow = {
  id: string;
  request_id: string;
  sport_id: string;
  place_id: string;
  place_label: string;
  partner_name: string;
  headline: string;
  body: string;
  destination_url: string | null;
  agreed_at: string;
  price_cents: number;
  price_kind: string;
  starts_at: string;
  ends_at: string;
  status: string;
  audience: string;
  created_at: string;
};

export type Audience = "test" | "production" | "demo" | "adminpreview";

type PlaceResolver = (placeId: string, placeLabel: string) => Promise<{ id: string; label: string } | null>;

export function getRequest(id: string) {
  ensureSponsorSchema();
  return (
    (db().prepare("SELECT * FROM sponsorship_requests WHERE id = ?").get(id) as RequestRow | undefined) ?? null
  );
}

export function getCampaign(id: string) {
  ensureSponsorSchema();
  return (db().prepare("SELECT * FROM sponsor_campaigns WHERE id = ?").get(id) as CampaignRow | undefined) ?? null;
}

export function campaignForRequest(requestId: string) {
  ensureSponsorSchema();
  return (
    (db().prepare("SELECT * FROM sponsor_campaigns WHERE request_id = ?").get(requestId) as CampaignRow | undefined) ??
    null
  );
}

export function listRequests() {
  ensureSponsorSchema();
  return db()
    .prepare(
      `SELECT r.*, c.id AS campaign_id, c.status AS campaign_status, c.audience AS campaign_audience
       FROM sponsorship_requests r
       LEFT JOIN sponsor_campaigns c ON c.request_id = r.id
       ORDER BY r.created_at DESC`,
    )
    .all() as Array<RequestRow & { campaign_id: string | null; campaign_status: string | null; campaign_audience: string | null }>;
}

export function agreeRequest(id: string, kind: "standard" | "complimentary") {
  ensureSponsorSchema();
  const cents = kind === "complimentary" ? COMPLIMENTARY_PRICE_CENTS : PILOT_PRICE_CENTS;
  const current = getRequest(id);
  if (!current) return { ok: false as const, error: "Aanvraag niet gevonden." };
  if (current.agreed_at) {
    if (current.price_kind === kind && current.agreed_price_cents === cents) {
      return { ok: true as const, reused: true, request: current };
    }
    return { ok: false as const, error: "Akkoord is al vastgelegd." };
  }
  const agreedAt = new Date().toISOString();
  const result = db()
    .prepare(
      `UPDATE sponsorship_requests
       SET status = 'agreed', agreed_price_cents = ?, agreed_at = ?, price_kind = ?
       WHERE id = ? AND agreed_at IS NULL`,
    )
    .run(cents, agreedAt, kind, id);
  const saved = getRequest(id);
  if (!saved) return { ok: false as const, error: "Aanvraag niet gevonden." };
  if (result.changes === 0) {
    if (saved.price_kind === kind && saved.agreed_price_cents === cents) {
      return { ok: true as const, reused: true, request: saved };
    }
    return { ok: false as const, error: "Akkoord is al vastgelegd." };
  }
  return { ok: true as const, reused: false, request: saved };
}

export async function scheduleCampaign(
  input: {
    requestId: string;
    sportId: string;
    placeId: string;
    startDate: string;
    headline: string;
    body: string;
    destinationUrl?: string | null;
    partnerName?: string | null;
    audience?: Audience;
  },
  deps?: { resolvePlace?: PlaceResolver },
) {
  const sport = knownSport(input.sportId);
  if (!sport) return { ok: false as const, error: "Onbekende sport." };
  if (!isIsoDate(input.startDate)) return { ok: false as const, error: "Ongeldige startdatum." };
  const headline = plainText(input.headline ?? "");
  const body = plainText(input.body ?? "");
  if (headline.length < 4 || headline.length > 80) return { ok: false as const, error: "Kop moet 4–80 tekens zijn." };
  if (body.length < 10 || body.length > 400) return { ok: false as const, error: "Tekst moet 10–400 tekens zijn." };
  let destination: string | null;
  try {
    destination = validateDestination(input.destinationUrl ?? null);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Bestemmingslink is ongeldig." };
  }
  const audience = input.audience ?? "test";
  if (!["test", "production", "demo", "adminpreview"].includes(audience)) {
    return { ok: false as const, error: "Ongeldig publiek." };
  }
  const partner = plainText(input.partnerName ?? "");
  ensureSponsorSchema();
  const request = getRequest(input.requestId);
  if (!request) return { ok: false as const, error: "Aanvraag niet gevonden." };
  if (request.agreed_price_cents === null || request.agreed_price_cents === undefined || !request.agreed_at || !request.price_kind) {
    return { ok: false as const, error: "Leg eerst het akkoord en het tarief vast." };
  }
  const partnerName = partner || request.organisation;
  if (partnerName.length < 2 || partnerName.length > 120) {
    return { ok: false as const, error: "Partnernaam ontbreekt." };
  }
  const existing = campaignForRequest(input.requestId);
  if (existing) return { ok: true as const, reused: true, campaign: existing };

  const resolvePlace = deps?.resolvePlace ?? resolveDutchPlace;
  let place: { id: string; label: string } | null;
  try {
    place = await resolvePlace(input.placeId, partnerName);
  } catch {
    return { ok: false as const, error: "De plaatscontrole is nu niet bereikbaar." };
  }
  if (!place || place.id !== input.placeId) return { ok: false as const, error: "Onbekende plaats." };

  const window = pilotWindow(input.startDate);
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const again = database.prepare("SELECT * FROM sponsor_campaigns WHERE request_id = ?").get(input.requestId) as
      | CampaignRow
      | undefined;
    if (again) {
      database.exec("COMMIT");
      return { ok: true as const, reused: true, campaign: again };
    }
    const overlap = database
      .prepare(
        `SELECT id FROM sponsor_campaigns
         WHERE sport_id = ? AND place_id = ?
           AND status IN ('scheduled', 'paused')
           AND starts_at < ? AND ends_at > ?`,
      )
      .get(sport.id, place.id, window.endsAt, window.startsAt) as { id: string } | undefined;
    if (overlap) {
      database.exec("ROLLBACK");
      return {
        ok: false as const,
        error: `Overlappende boeking voor ${sport.name} in ${place.label} (${overlap.id}).`,
      };
    }
    const campaign: CampaignRow = {
      id: randomUUID(),
      request_id: request.id,
      sport_id: sport.id,
      place_id: place.id,
      place_label: place.label,
      partner_name: partnerName,
      headline,
      body,
      destination_url: destination,
      agreed_at: request.agreed_at,
      price_cents: request.agreed_price_cents,
      price_kind: request.price_kind,
      starts_at: window.startsAt,
      ends_at: window.endsAt,
      status: "scheduled",
      audience,
      created_at: new Date().toISOString(),
    };
    database
      .prepare(
        `INSERT INTO sponsor_campaigns (
          id, request_id, sport_id, place_id, place_label, partner_name, headline, body,
          destination_url, agreed_at, price_cents, price_kind, starts_at, ends_at, status, audience, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        campaign.id,
        campaign.request_id,
        campaign.sport_id,
        campaign.place_id,
        campaign.place_label,
        campaign.partner_name,
        campaign.headline,
        campaign.body,
        campaign.destination_url,
        campaign.agreed_at,
        campaign.price_cents,
        campaign.price_kind,
        campaign.starts_at,
        campaign.ends_at,
        campaign.status,
        campaign.audience,
        campaign.created_at,
      );
    database.exec("COMMIT");
    return { ok: true as const, reused: false, campaign };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* transaction already closed */
    }
    throw error;
  }
}

export function pauseCampaign(id: string) {
  ensureSponsorSchema();
  const campaign = getCampaign(id);
  if (!campaign) return { ok: false as const, error: "Campagne niet gevonden." };
  if (campaign.status === "paused") return { ok: true as const, reused: true, campaign };
  if (campaign.status !== "scheduled") return { ok: false as const, error: "Campagne kan niet worden gepauzeerd." };
  db().prepare("UPDATE sponsor_campaigns SET status = 'paused' WHERE id = ? AND status = 'scheduled'").run(id);
  return { ok: true as const, reused: false, campaign: getCampaign(id)! };
}

export function resumeCampaign(id: string, now = new Date()) {
  ensureSponsorSchema();
  const campaign = getCampaign(id);
  if (!campaign) return { ok: false as const, error: "Campagne niet gevonden." };
  if (Date.parse(campaign.ends_at) <= now.getTime()) {
    return { ok: false as const, error: "Campagne is afgelopen." };
  }
  if (campaign.status === "scheduled") return { ok: true as const, reused: true, campaign };
  if (campaign.status !== "paused") return { ok: false as const, error: "Campagne kan niet worden hervat." };
  db().prepare("UPDATE sponsor_campaigns SET status = 'scheduled' WHERE id = ? AND status = 'paused'").run(id);
  return { ok: true as const, reused: false, campaign: getCampaign(id)! };
}

export type CampaignReport = {
  partner: string;
  sport: string;
  sportId: string;
  region: string;
  placeId: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  impressions: number;
  clicks: number;
  eligible: number;
  cpmCents: number | null;
  audience: string;
  countsInProduction: boolean;
  definition: string;
  limitation: string;
  campaignId: string;
  requestId: string;
};

function eventCounts(campaignId: string) {
  const rows = db()
    .prepare("SELECT kind, COUNT(*) AS count FROM sponsor_events WHERE campaign_id = ? GROUP BY kind")
    .all(campaignId) as Array<{ kind: string; count: number }>;
  const counts = { eligible: 0, impression: 0, click: 0 };
  for (const row of rows) {
    if (row.kind === "eligible" || row.kind === "impression" || row.kind === "click") {
      counts[row.kind] = Number(row.count) || 0;
    }
  }
  return counts;
}

export function campaignReport(campaignId: string): CampaignReport | null {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const counts = eventCounts(campaign.id);
  const sport = sports.find((item) => item.id === campaign.sport_id);
  return {
    partner: campaign.partner_name,
    sport: sport?.name ?? campaign.sport_id,
    sportId: campaign.sport_id,
    region: campaign.place_label,
    placeId: campaign.place_id,
    startsAt: campaign.starts_at,
    endsAt: campaign.ends_at,
    priceCents: campaign.price_cents,
    impressions: counts.impression,
    clicks: counts.click,
    eligible: counts.eligible,
    cpmCents: effectiveCpmCents(campaign.price_cents, counts.impression),
    audience: campaign.audience,
    countsInProduction: campaign.audience === "production",
    definition: MEASUREMENT_DEFINITION,
    limitation: MEASUREMENT_LIMITATION,
    campaignId: campaign.id,
    requestId: campaign.request_id,
  };
}

/** Sum of production campaigns only. Test, demo and admin preview stay out. */
export function productionTotals() {
  ensureSponsorSchema();
  const rows = db()
    .prepare(
      `SELECT e.kind AS kind, COUNT(*) AS count
       FROM sponsor_events e
       JOIN sponsor_campaigns c ON c.id = e.campaign_id
       WHERE c.audience = 'production'
       GROUP BY e.kind`,
    )
    .all() as Array<{ kind: string; count: number }>;
  const counts = { eligible: 0, impression: 0, click: 0 };
  for (const row of rows) {
    if (row.kind === "eligible" || row.kind === "impression" || row.kind === "click") {
      counts[row.kind] = Number(row.count) || 0;
    }
  }
  return counts;
}

export function formatReport(report: CampaignReport) {
  const cpm =
    report.cpmCents === null
      ? "Geen effectieve CPM bij 0 zichtbare vertoningen."
      : formatEuroCents(report.cpmCents);
  const production = report.countsInProduction
    ? "Deze campagne telt mee in productierapporten."
    : "Deze campagne telt niet mee in productierapporten.";
  return [
    `Partner: ${report.partner}`,
    `Sport: ${report.sport} (${report.sportId})`,
    `Regio: ${report.region} (${report.placeId})`,
    `Start: ${formatAmsterdam(report.startsAt)} (${PILOT_TIMEZONE})`,
    `Einde (exclusief): ${formatAmsterdam(report.endsAt)} (${PILOT_TIMEZONE})`,
    `Prijs excl. btw: ${formatEuroCents(report.priceCents)}`,
    `Geschikte resultaatweergaven: ${report.eligible}`,
    `Zichtbare vertoningen: ${report.impressions}`,
    `Klikken: ${report.clicks}`,
    `Effectieve CPM: ${cpm}`,
    `Meetdefinitie: ${report.definition}`,
    `Beperking: ${report.limitation}`,
    production,
    `Aanvraag: ${report.requestId}`,
    `Campagne: ${report.campaignId}`,
  ].join("\n");
}

export function formatReportCsv(report: CampaignReport) {
  const header = [
    "partner",
    "sport",
    "regio",
    "start",
    "einde",
    "prijs_excl_btw",
    "zichtbare_vertoningen",
    "klikken",
    "geschikte_resultaatweergaven",
    "effectieve_cpm",
    "meetdefinitie",
  ];
  const row = [
    report.partner,
    report.sport,
    report.region,
    report.startsAt,
    report.endsAt,
    formatEuroDot(report.priceCents),
    String(report.impressions),
    String(report.clicks),
    String(report.eligible),
    report.cpmCents === null ? "" : formatEuroDot(report.cpmCents),
    report.definition,
  ];
  return `${header.join(",")}\n${row.map(csvCell).join(",")}\n`;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function formatCampaignRequest(row: RequestRow) {
  const sport = row.sport_id ? (sports.find((item) => item.id === row.sport_id)?.name ?? row.sport_id) : "—";
  const place = [row.place_label, row.province].filter(Boolean).join(", ") || "—";
  const area = row.area_kind === "radius" ? `straal ${row.radius_km ?? "—"} km` : "alleen deze plaats";
  return [
    "Campagneaanvraag",
    `Aanvraag: ${row.id}`,
    `Status: ${row.status ?? "ontvangen"}`,
    `Sport: ${sport} (${row.sport_id ?? "—"})`,
    `Plaats: ${place} (${row.place_id ?? "—"})`,
    `Gebied: ${area}`,
    `Start: ${row.desired_start ?? "—"}`,
    `Einde (inclusief): ${row.end_date ?? "—"}`,
    `Looptijd: ${row.duration_weeks ?? "—"} weken`,
    `Organisatie: ${row.organisation}`,
    `Contactpersoon: ${row.name}`,
    `E-mail: ${row.email}`,
    `Ontvangen: ${row.created_at}`,
  ].join("\n");
}

export function formatRequestList(rows: ReturnType<typeof listRequests>) {
  if (rows.length === 0) return "Geen aanvragen.";
  return rows
    .map((row) => {
      const sport = row.sport_id ? (sports.find((item) => item.id === row.sport_id)?.name ?? row.sport_id) : "—";
      if (row.request_type === "campaign_v1") {
        const place = [row.place_label, row.province].filter(Boolean).join(", ") || "—";
        const area = row.area_kind === "radius" ? `straal ${row.radius_km ?? "—"} km` : "alleen deze plaats";
        return [
          row.id,
          "campaign_v1",
          row.status ?? "ontvangen",
          sport,
          place,
          row.place_id ?? "—",
          area,
          row.desired_start ?? "—",
          row.end_date ?? "—",
          row.duration_weeks ? `${row.duration_weeks} weken` : "—",
          row.organisation,
          row.name,
          row.email,
        ].join(" · ");
      }
      const price =
        row.agreed_price_cents === null || row.agreed_price_cents === undefined
          ? row.quoted_price_cents === null || row.quoted_price_cents === undefined
            ? "geen offerte"
            : `offerte ${formatEuroCents(row.quoted_price_cents)}`
          : `${row.price_kind ?? "tarief"} ${formatEuroCents(row.agreed_price_cents)}`;
      return [
        row.id,
        row.created_at,
        row.organisation,
        row.email,
        row.intent ?? "legacy",
        row.inquiry ?? "—",
        sport,
        row.place_label ?? "—",
        row.status ?? "received",
        price,
        row.campaign_id ? `campagne ${row.campaign_id} (${row.campaign_status}, ${row.campaign_audience})` : "geen campagne",
      ].join(" · ");
    })
    .join("\n");
}
