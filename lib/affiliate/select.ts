import { db } from "@/lib/auth/db";
import type { ForecastSnapshot, HourlyScorePoint } from "@/lib/data/types";
import { ensureStarterFixtures, feedIsFresh, seedRules, starterExplanation } from "@/lib/affiliate/catalog";
import { commercialBlockReason } from "@/lib/sponsoring/commercial-policy";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { listPublicSponsors, type PublicSponsor } from "@/lib/sponsoring/directory";
import { sponsorFlags } from "@/lib/sponsoring/flags";
import { validateDestination } from "@/lib/sponsoring/validate";

export type AffiliateTip = {
  id: string;
  name: string;
  imageUrl: string;
  href: string;
  explanation: string;
  testData: boolean;
  cta: string;
};

export type CommercialBlocks = {
  affiliate: AffiliateTip | null;
  sponsors: PublicSponsor[];
};

type OfferRow = {
  id: string;
  name: string;
  image_url: string;
  tracking_url: string;
  category: string;
  sport_ids: string;
  status: string;
  stock: string | null;
  feed_at: string;
  test_data: number;
  excluded: number;
  valid_until: string | null;
};

type RuleRow = {
  id: string;
  category: string;
  condition_json: string;
  priority: number;
  specific: number;
};

type HourFacts = {
  temperatureC: number | null;
  windKmh: number | null;
  precipitationProbability: number | null;
  uvIndex: number | null;
  advicePositive: boolean;
  suitable: boolean;
};

export function resolveCommercialBlocks(input: {
  surface: string;
  plan: string;
  snapshot: Pick<ForecastSnapshot, "sportId" | "placeId" | "suitability" | "warnings" | "weather">;
  now?: Date;
  hourTime?: string | null;
}): CommercialBlocks {
  const empty: CommercialBlocks = { affiliate: null, sponsors: [] };
  try {
    const reason = commercialBlockReason({
      surface: input.surface,
      plan: input.plan,
      suitabilityKind: input.snapshot.suitability.kind,
      warningStatus: input.snapshot.warnings.status,
      warningCount: input.snapshot.warnings.value?.items.length ?? 0,
      weatherDemo: input.snapshot.weather.demo,
      weatherStatus: input.snapshot.weather.status,
    });
    const sponsors = reason ? [] : listPublicSponsors(input.snapshot.sportId, input.now);
    const affiliate = reason || !sponsorFlags().affiliate ? null : selectAffiliate(input);
    return { affiliate, sponsors };
  } catch {
    return empty;
  }
}

export function selectAffiliate(input: {
  snapshot: Pick<ForecastSnapshot, "sportId" | "suitability" | "weather">;
  now?: Date;
  hourTime?: string | null;
}): AffiliateTip | null {
  ensureCommercialSchema();
  ensureStarterFixtures(input.now);
  seedRules();
  const scored = input.snapshot.suitability.kind === "SCORED" ? input.snapshot.suitability : null;
  if (!scored) return null;
  if (scored.badge === "SLECHT") return null;
  const hour = hourFacts(scored.hourly, input.hourTime ?? scored.peakWindow.peakTime, scored.badge);
  const rules = db()
    .prepare("SELECT * FROM affiliate_rules WHERE sport_id = ? AND enabled = 1")
    .all(input.snapshot.sportId) as RuleRow[];
  const offers = db()
    .prepare("SELECT * FROM affiliate_offers WHERE status = 'active' AND excluded = 0")
    .all() as OfferRow[];
  const now = input.now ?? new Date();
  const matches: Array<{ offer: OfferRow; specific: number; priority: number }> = [];
  for (const rule of rules) {
    if (!conditionMatches(JSON.parse(rule.condition_json) as { type: string; value?: number }, hour)) continue;
    for (const offer of offers) {
      if (offer.category !== rule.category) continue;
      const sportIds = JSON.parse(offer.sport_ids) as string[];
      if (!sportIds.includes(input.snapshot.sportId)) continue;
      if (offer.test_data && !sponsorFlags().fixtures) continue;
      if (!offer.test_data && !feedIsFresh(offer.feed_at, now)) continue;
      if (offer.stock === "out") continue;
      if (offer.valid_until && Date.parse(offer.valid_until) <= now.getTime()) continue;
      let href: string | null = null;
      try {
        href = validateDestination(offer.tracking_url);
      } catch {
        href = null;
      }
      if (!href) continue;
      matches.push({ offer, specific: rule.specific, priority: rule.priority });
    }
  }
  matches.sort((a, b) => b.specific - a.specific || b.priority - a.priority || a.offer.id.localeCompare(b.offer.id));
  const winner = matches[0];
  if (!winner) return null;
  let href: string;
  try {
    href = validateDestination(winner.offer.tracking_url) ?? "";
  } catch {
    return null;
  }
  if (!href) return null;
  return {
    id: winner.offer.id,
    name: winner.offer.name,
    imageUrl: winner.offer.image_url,
    href,
    explanation: starterExplanation(winner.offer.category),
    testData: winner.offer.test_data === 1,
    cta: winner.offer.test_data === 1 ? "Testlink, geen winkel" : "Bekijk het product",
  };
}

function hourFacts(hourly: HourlyScorePoint[], time: string, badge: string): HourFacts {
  const point = hourly.find((item) => item.time === time) ?? hourly[0];
  return {
    temperatureC: numberOrNull(point?.temperatureC),
    windKmh: numberOrNull(point?.windKmh),
    precipitationProbability: numberOrNull(point?.precipitationProbability),
    uvIndex: numberOrNull(point?.uvIndex),
    advicePositive: badge === "GOED",
    suitable: badge === "GOED" || badge === "MATIG",
  };
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function conditionMatches(condition: { type: string; value?: number }, hour: HourFacts) {
  switch (condition.type) {
    case "always":
      return true;
    case "precip_gte":
      return hour.precipitationProbability !== null && hour.precipitationProbability >= (condition.value ?? 101);
    case "temp_lte":
      return hour.temperatureC !== null && hour.temperatureC <= (condition.value ?? -999);
    case "temp_gte":
      return hour.temperatureC !== null && hour.temperatureC >= (condition.value ?? 999);
    case "uv_gte":
      return hour.uvIndex !== null && hour.uvIndex >= (condition.value ?? 99);
    case "wind_gte":
      return hour.windKmh !== null && hour.windKmh >= (condition.value ?? 999);
    case "advice_positive":
      return hour.advicePositive;
    case "suitable":
      return hour.suitable;
    default:
      return false;
  }
}

export function affiliateAdminReason(input: Parameters<typeof selectAffiliate>[0] & { plan: string; surface: string; warnings: ForecastSnapshot["warnings"] }) {
  const blocked = commercialBlockReason({
    surface: input.surface,
    plan: input.plan,
    suitabilityKind: input.snapshot.suitability.kind,
    warningStatus: input.warnings.status,
    warningCount: input.warnings.value?.items.length ?? 0,
    weatherDemo: input.snapshot.weather.demo,
    weatherStatus: input.snapshot.weather.status,
  });
  if (blocked) return blocked;
  if (!sponsorFlags().affiliate) return "flag";
  const selected = selectAffiliate(input);
  if (selected) return selected.testData ? "testfixture gekozen" : "regel gekozen";
  const offers = db().prepare("SELECT feed_at, test_data, tracking_url FROM affiliate_offers WHERE status = 'active'").all() as Array<{
    feed_at: string;
    test_data: number;
    tracking_url: string;
  }>;
  if (offers.length === 0) return "geen feed";
  if (offers.every((offer) => offer.test_data === 0 && !feedIsFresh(offer.feed_at))) return "feed verlopen";
  if (offers.every((offer) => {
    try {
      return !validateDestination(offer.tracking_url);
    } catch {
      return true;
    }
  })) {
    return "geen geldige link";
  }
  return "geen passende regel";
}

export function recordAffiliateMeasure(input: { placementId: string; kind: "impression" | "click"; offerId: string; sportId: string; day: string }) {
  ensureCommercialSchema();
  const database = db();
  const inserted = database
    .prepare("INSERT INTO affiliate_events (placement_id, kind, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
    .run(input.placementId, input.kind, new Date().toISOString());
  if (inserted.changes === 0) return { ok: true as const, duplicate: true };
  const column = input.kind === "impression" ? "impressions" : "clicks";
  database
    .prepare(
      `INSERT INTO affiliate_daily (sport_id, offer_id, day, impressions, clicks) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(sport_id, offer_id, day) DO UPDATE SET ${column} = ${column} + 1`,
    )
    .run(
      input.sportId,
      input.offerId,
      input.day,
      input.kind === "impression" ? 1 : 0,
      input.kind === "click" ? 1 : 0,
    );
  return { ok: true as const, duplicate: false };
}
