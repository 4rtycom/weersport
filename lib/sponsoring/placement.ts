import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import type { ForecastSnapshot } from "@/lib/data/types";
import { allowTestCampaigns } from "@/lib/sponsoring/constants";
import { windowContains } from "@/lib/sponsoring/period";
import { ensureSponsorSchema } from "@/lib/sponsoring/schema";
import {
  placementSignatureMatches,
  signPlacement,
  sponsorBlockedReason,
  validateDestination,
  type PlacementToken,
} from "@/lib/sponsoring/validate";
import type { CampaignRow } from "@/lib/sponsoring/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_LIMIT = 60;
const MINUTE_MS = 60 * 1000;

export type SponsorCreative = {
  campaignId: string;
  partnerName: string;
  headline: string;
  body: string;
  destinationUrl: string | null;
  placementId: string;
  signature: string;
  sportId: string;
  placeId: string;
};

export type SponsorSlot =
  | { mode: "show"; creative: SponsorCreative }
  | { mode: "eligible"; creative: SponsorCreative }
  | { mode: "none"; reason: string };

export function findMatchingCampaigns(sportId: string, placeId: string, now: Date) {
  ensureSponsorSchema();
  const rows = db()
    .prepare(
      `SELECT * FROM sponsor_campaigns
       WHERE sport_id = ? AND place_id = ? AND status IN ('scheduled', 'paused')`,
    )
    .all(sportId, placeId) as CampaignRow[];
  return rows.filter((row) => windowContains(row.starts_at, row.ends_at, now));
}

export function resolveSponsorSlot(input: {
  surface: string;
  plan: string;
  consentGranted: boolean;
  snapshot: Pick<ForecastSnapshot, "sportId" | "placeId" | "suitability" | "warnings" | "weather">;
  now?: Date;
  allowTest?: boolean;
}): SponsorSlot {
  const scored = input.snapshot.suitability.kind === "SCORED" ? input.snapshot.suitability : null;
  const reason = sponsorBlockedReason({
    surface: input.surface,
    plan: input.plan,
    consentGranted: input.consentGranted,
    suitabilityKind: input.snapshot.suitability.kind,
    score: scored?.score ?? null,
    warningStatus: input.snapshot.warnings.status,
    warningCount: input.snapshot.warnings.value?.items.length ?? 0,
    weatherDemo: input.snapshot.weather.demo,
  });
  if (reason) return { mode: "none", reason };
  const now = input.now ?? new Date();
  const allowTest = input.allowTest ?? allowTestCampaigns();
  let matches: CampaignRow[];
  try {
    matches = findMatchingCampaigns(input.snapshot.sportId, input.snapshot.placeId, now);
  } catch {
    return { mode: "none", reason: "error" };
  }
  const visible = matches.filter((row) => {
    if (row.audience === "demo" || row.audience === "adminpreview") return false;
    if (row.audience === "test" && !allowTest) return false;
    return row.audience === "production" || row.audience === "test";
  });
  if (visible.length !== 1) return { mode: "none", reason: visible.length === 0 ? "none" : "ambiguous" };
  const campaign = visible[0];
  const placementId = randomUUID();
  const token: PlacementToken = {
    placementId,
    campaignId: campaign.id,
    sportId: campaign.sport_id,
    placeId: campaign.place_id,
  };
  const signature = signPlacement(token);
  if (!signature) return { mode: "none", reason: "secret" };
  let destinationUrl: string | null = null;
  if (campaign.destination_url) {
    try {
      destinationUrl = validateDestination(campaign.destination_url);
    } catch {
      destinationUrl = null;
    }
  }
  const creative: SponsorCreative = {
    campaignId: campaign.id,
    partnerName: campaign.partner_name,
    headline: campaign.headline,
    body: campaign.body,
    destinationUrl,
    placementId,
    signature,
    sportId: campaign.sport_id,
    placeId: campaign.place_id,
  };
  if (campaign.status === "paused") return { mode: "eligible", creative };
  return { mode: "show", creative };
}

export function recordSponsorEvent(input: {
  placementId?: unknown;
  signature?: unknown;
  campaignId?: unknown;
  sportId?: unknown;
  placeId?: unknown;
  kind?: unknown;
  now?: Date;
}) {
  const kind = input.kind;
  if (kind !== "eligible" && kind !== "impression" && kind !== "click") {
    return { ok: false as const, status: 400, error: "Onbekend meetevent." };
  }
  if (typeof input.placementId !== "string" || !UUID.test(input.placementId)) {
    return { ok: false as const, status: 400, error: "Plaatsing ontbreekt." };
  }
  if (
    typeof input.campaignId !== "string" ||
    typeof input.sportId !== "string" ||
    typeof input.placeId !== "string"
  ) {
    return { ok: false as const, status: 400, error: "Campagnecontext ontbreekt." };
  }
  const token = {
    placementId: input.placementId,
    campaignId: input.campaignId,
    sportId: input.sportId,
    placeId: input.placeId,
  };
  if (!placementSignatureMatches(token, input.signature)) {
    return { ok: false as const, status: 403, error: "Campagnecontext klopt niet." };
  }
  ensureSponsorSchema();
  const campaign = db().prepare("SELECT * FROM sponsor_campaigns WHERE id = ?").get(input.campaignId) as
    | CampaignRow
    | undefined;
  if (!campaign || campaign.sport_id !== input.sportId || campaign.place_id !== input.placeId) {
    return { ok: false as const, status: 403, error: "Campagnecontext klopt niet." };
  }
  if (campaign.audience === "demo" || campaign.audience === "adminpreview") {
    return { ok: false as const, status: 403, error: "Deze campagne wordt niet gemeten." };
  }
  const now = input.now ?? new Date();
  if (!windowContains(campaign.starts_at, campaign.ends_at, now)) {
    return { ok: false as const, status: 403, error: "Campagne is niet actief." };
  }
  if ((kind === "impression" || kind === "click") && campaign.status !== "scheduled") {
    return { ok: false as const, status: 403, error: "Campagne toont niet." };
  }
  if (kind === "eligible" && campaign.status !== "scheduled" && campaign.status !== "paused") {
    return { ok: false as const, status: 403, error: "Campagne is niet actief." };
  }
  const eventId = `${input.placementId}:${kind}`;
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const prior = database.prepare("SELECT id FROM sponsor_events WHERE id = ?").get(eventId) as
      | { id: string }
      | undefined;
    if (prior) {
      database.exec("COMMIT");
      return { ok: true as const, duplicate: true };
    }
    const since = new Date(now.getTime() - MINUTE_MS).toISOString();
    const recent = database
      .prepare("SELECT COUNT(*) AS count FROM sponsor_events WHERE campaign_id = ? AND created_at > ?")
      .get(campaign.id, since) as { count: number };
    if (Number(recent.count) >= EVENT_LIMIT) {
      database.exec("ROLLBACK");
      return { ok: false as const, status: 429, error: "Te veel meetevents." };
    }
    database
      .prepare(
        "INSERT INTO sponsor_events (id, campaign_id, placement_id, kind, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(eventId, campaign.id, input.placementId, kind, now.toISOString());
    database.exec("COMMIT");
    return { ok: true as const, duplicate: false };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* transaction already closed */
    }
    throw error;
  }
}
