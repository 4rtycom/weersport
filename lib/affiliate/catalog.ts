import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { sponsorFlags } from "@/lib/sponsoring/flags";
import { validateDestination } from "@/lib/sponsoring/validate";
import { sports } from "@/lib/sports";

export type FeedItem = {
  externalId: string;
  name: string;
  imageUrl: string;
  destinationUrl: string;
  trackingUrl: string;
  category: string;
  sportIds: string[];
  stock?: string | null;
};

const knownSports = new Set(sports.map((sport) => sport.id));

export type FeedImportResult = {
  ok: boolean;
  published: boolean;
  keptPrevious: boolean;
  reason: string;
  generation: string | null;
};

function safeHttps(value: string) {
  try {
    return validateDestination(value);
  } catch {
    return null;
  }
}

function validItem(item: FeedItem) {
  if (!item.externalId || !item.name || !item.category) return false;
  if (!item.sportIds.length || item.sportIds.some((id) => !knownSports.has(id))) return false;
  const destination = safeHttps(item.destinationUrl);
  const tracking = safeHttps(item.trackingUrl);
  const imageOk = item.imageUrl.startsWith("/") || Boolean(safeHttps(item.imageUrl));
  if (!destination || !tracking || !imageOk) return false;
  const host = new URL(destination).hostname;
  if (host === "localhost" || host.endsWith(".local") || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.")) {
    return false;
  }
  return true;
}

/**
 * Stage a feed, then publish one generation. A partial, empty or corrupt
 * download leaves the previous generation in place.
 */
export function importAffiliateFeed(input: {
  provider: string;
  items: FeedItem[] | null;
  complete: boolean;
  now?: Date;
  testData?: boolean;
}): FeedImportResult {
  ensureCommercialSchema();
  const now = input.now ?? new Date();
  const generation = randomUUID();
  const previous = db()
    .prepare(
      `SELECT generation FROM affiliate_offers WHERE provider = ? AND status = 'active' ORDER BY feed_at DESC LIMIT 1`,
    )
    .get(input.provider) as { generation: string } | undefined;
  if (!input.complete || !input.items || input.items.length === 0 || input.items.some((item) => !validItem(item))) {
    db()
      .prepare(
        `INSERT INTO affiliate_generations (id, provider, status, item_count, created_at, published_at, note)
         VALUES (?, ?, 'rejected', ?, ?, NULL, ?)`,
      )
      .run(generation, input.provider, input.items?.length ?? 0, now.toISOString(), "Ongeldige of onvolledige feed. Vorige generatie blijft.");
    return { ok: false, published: false, keptPrevious: true, reason: "invalid_feed", generation: previous?.generation ?? null };
  }
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const item of input.items) {
      database
        .prepare(
          `INSERT INTO affiliate_offers (
            id, provider, external_id, name, image_url, destination_url, tracking_url, category, sport_ids,
            status, stock, valid_from, valid_until, feed_at, generation, test_data, excluded
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, ?, ?, ?, 0)
          ON CONFLICT(provider, external_id) DO UPDATE SET
            name = excluded.name,
            image_url = excluded.image_url,
            destination_url = excluded.destination_url,
            tracking_url = excluded.tracking_url,
            category = excluded.category,
            sport_ids = excluded.sport_ids,
            status = 'active',
            stock = excluded.stock,
            feed_at = excluded.feed_at,
            generation = excluded.generation,
            test_data = excluded.test_data`,
        )
        .run(
          randomUUID(),
          input.provider,
          item.externalId,
          item.name,
          item.imageUrl,
          item.destinationUrl,
          item.trackingUrl,
          item.category,
          JSON.stringify(item.sportIds),
          item.stock ?? null,
          now.toISOString(),
          now.toISOString(),
          generation,
          input.testData ? 1 : 0,
        );
    }
    const ids = input.items.map((item) => item.externalId);
    const current = database.prepare("SELECT external_id FROM affiliate_offers WHERE provider = ? AND status = 'active'").all(input.provider) as Array<{
      external_id: string;
    }>;
    for (const row of current) {
      if (!ids.includes(row.external_id)) {
        database
          .prepare("UPDATE affiliate_offers SET status = 'expired', valid_until = ? WHERE provider = ? AND external_id = ?")
          .run(now.toISOString(), input.provider, row.external_id);
      }
    }
    database
      .prepare(
        `INSERT INTO affiliate_generations (id, provider, status, item_count, created_at, published_at, note)
         VALUES (?, ?, 'published', ?, ?, ?, NULL)`,
      )
      .run(generation, input.provider, input.items.length, now.toISOString(), now.toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, published: true, keptPrevious: false, reason: "published", generation };
}

export function excludeOffer(provider: string, externalId: string, actor: string, reason: string) {
  ensureCommercialSchema();
  db()
    .prepare("UPDATE affiliate_offers SET excluded = 1, status = 'excluded' WHERE provider = ? AND external_id = ?")
    .run(provider, externalId);
  db()
    .prepare("INSERT INTO sponsor_audit (id, actor, action, subject, reason, created_at) VALUES (?, ?, 'affiliate_exclude', ?, ?, ?)")
    .run(randomUUID(), actor, `${provider}:${externalId}`, reason, new Date().toISOString());
}

export function maxFeedAgeMs() {
  const hours = Number(process.env.WEERSPORT_AFFILIATE_MAX_AGE_HOURS ?? "48");
  if (!Number.isFinite(hours) || hours <= 0) return 48 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function feedIsFresh(feedAt: string, now = new Date()) {
  return now.getTime() - Date.parse(feedAt) <= maxFeedAgeMs();
}

const STARTER: Array<FeedItem & { explanation: string }> = [
  { externalId: "fixture-fietsen-regen", name: "Testfixture regenhoes", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/fietsen", trackingUrl: "https://example.com/weersport-affiliate-test/fietsen?sub=test", category: "regenhoes", sportIds: ["fietsen"], explanation: "Bij regen kan een hoes of poncho handig zijn." },
  { externalId: "fixture-wielrennen-arm", name: "Testfixture armstukken", imageUrl: "/weather/temperature.svg", destinationUrl: "https://example.com/weersport-affiliate-test/wielrennen", trackingUrl: "https://example.com/weersport-affiliate-test/wielrennen?sub=test", category: "armstukken", sportIds: ["wielrennen"], explanation: "Bij een frisse start kunnen armstukken helpen." },
  { externalId: "fixture-gravel-spatbord", name: "Testfixture spatbord", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/gravel", trackingUrl: "https://example.com/weersport-affiliate-test/gravel?sub=test", category: "spatbord", sportIds: ["gravelbiken"], explanation: "Op een natte onverharde route houdt een spatbord water tegen." },
  { externalId: "fixture-mtb-bril", name: "Testfixture bril", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/mtb", trackingUrl: "https://example.com/weersport-affiliate-test/mtb?sub=test", category: "bril", sportIds: ["mountainbiken"], explanation: "Op een natte trail beschermt een bril tegen opspattend water." },
  { externalId: "fixture-hardlopen-jack", name: "Testfixture regenjack", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/hardlopen", trackingUrl: "https://example.com/weersport-affiliate-test/hardlopen?sub=test", category: "regenjack", sportIds: ["hardlopen"], explanation: "Bij buien is een licht regenjack een passende tip." },
  { externalId: "fixture-trail-pet", name: "Testfixture trailpet", imageUrl: "/uv/sun.svg", destinationUrl: "https://example.com/weersport-affiliate-test/trail", trackingUrl: "https://example.com/weersport-affiliate-test/trail?sub=test", category: "pet", sportIds: ["trailrunning"], explanation: "Bij zon is een pet een passende tip." },
  { externalId: "fixture-wandelen-hoes", name: "Testfixture rugzakhoes", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/wandelen", trackingUrl: "https://example.com/weersport-affiliate-test/wandelen?sub=test", category: "rugzakhoes", sportIds: ["wandelen"], explanation: "Bij regen houdt een rugzakhoes je spullen droog." },
  { externalId: "fixture-hiken-zak", name: "Testfixture opbergzak", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/hiken", trackingUrl: "https://example.com/weersport-affiliate-test/hiken?sub=test", category: "opbergzak", sportIds: ["hiken"], explanation: "Bij regen is een zak voor droge kleding een passende tip." },
  { externalId: "fixture-golf-handschoen", name: "Testfixture handschoen", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/golf", trackingUrl: "https://example.com/weersport-affiliate-test/golf?sub=test", category: "handschoen", sportIds: ["golf"], explanation: "Bij nat weer is een handschoen een passende tip." },
  { externalId: "fixture-tennis-pet", name: "Testfixture sportpet", imageUrl: "/uv/sun.svg", destinationUrl: "https://example.com/weersport-affiliate-test/tennis", trackingUrl: "https://example.com/weersport-affiliate-test/tennis?sub=test", category: "pet", sportIds: ["tennis-padel"], explanation: "Bij zon is een sportpet een passende tip." },
  { externalId: "fixture-voetbal-thermo", name: "Testfixture thermolaag", imageUrl: "/weather/temperature.svg", destinationUrl: "https://example.com/weersport-affiliate-test/voetbal", trackingUrl: "https://example.com/weersport-affiliate-test/voetbal?sub=test", category: "thermolaag", sportIds: ["voetbal"], explanation: "Bij kou is een thermolaag een passende tip." },
  { externalId: "fixture-hockey-thermo", name: "Testfixture thermoshirt", imageUrl: "/weather/temperature.svg", destinationUrl: "https://example.com/weersport-affiliate-test/hockey", trackingUrl: "https://example.com/weersport-affiliate-test/hockey?sub=test", category: "thermoshirt", sportIds: ["hockey"], explanation: "Bij kou is een thermoshirt een passende tip." },
  { externalId: "fixture-zeilen-jas", name: "Testfixture zeiljas", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/zeilen", trackingUrl: "https://example.com/weersport-affiliate-test/zeilen?sub=test", category: "zeiljas", sportIds: ["zeilen"], explanation: "Bij lichte regen is een zeiljas een passende tip." },
  { externalId: "fixture-wind-tas", name: "Testfixture materiaaltas", imageUrl: "/weather/wind.svg", destinationUrl: "https://example.com/weersport-affiliate-test/windsurfen", trackingUrl: "https://example.com/weersport-affiliate-test/windsurfen?sub=test", category: "materiaaltas", sportIds: ["windsurfen"], explanation: "Een materiaaltas is een algemene sporttip." },
  { externalId: "fixture-kite-bag", name: "Testfixture boardbag", imageUrl: "/weather/wind.svg", destinationUrl: "https://example.com/weersport-affiliate-test/kitesurfen", trackingUrl: "https://example.com/weersport-affiliate-test/kitesurfen?sub=test", category: "boardbag", sportIds: ["kitesurfen"], explanation: "Een boardbag is een algemene sporttip." },
  { externalId: "fixture-surf-poncho", name: "Testfixture poncho", imageUrl: "/weather/temperature.svg", destinationUrl: "https://example.com/weersport-affiliate-test/surfen", trackingUrl: "https://example.com/weersport-affiliate-test/surfen?sub=test", category: "poncho", sportIds: ["surfen"], explanation: "Bij een frisse start is een poncho een passende tip." },
  { externalId: "fixture-sup-drybag", name: "Testfixture drybag", imageUrl: "/weather/wind.svg", destinationUrl: "https://example.com/weersport-affiliate-test/suppen", trackingUrl: "https://example.com/weersport-affiliate-test/suppen?sub=test", category: "drybag", sportIds: ["suppen"], explanation: "Een drybag is een algemene sporttip." },
  { externalId: "fixture-kajak-zak", name: "Testfixture waterdichte zak", imageUrl: "/weather/wind.svg", destinationUrl: "https://example.com/weersport-affiliate-test/kajakken", trackingUrl: "https://example.com/weersport-affiliate-test/kajakken?sub=test", category: "waterdichte-zak", sportIds: ["kajakken"], explanation: "Een waterdichte opbergzak is een algemene sporttip." },
  { externalId: "fixture-roeien-vest", name: "Testfixture windvest", imageUrl: "/weather/wind.svg", destinationUrl: "https://example.com/weersport-affiliate-test/roeien", trackingUrl: "https://example.com/weersport-affiliate-test/roeien?sub=test", category: "windvest", sportIds: ["roeien"], explanation: "Bij frisse wind is een windvest een passende tip." },
  { externalId: "fixture-zwem-tas", name: "Testfixture zwemtas", imageUrl: "/icons/pool.svg", destinationUrl: "https://example.com/weersport-affiliate-test/zwemmen", trackingUrl: "https://example.com/weersport-affiliate-test/zwemmen?sub=test", category: "zwemtas", sportIds: ["openwaterzwemmen"], explanation: "Bij een positief advies is een tas voor zwemspullen een passende tip." },
  { externalId: "fixture-skeeler-bril", name: "Testfixture sportbril", imageUrl: "/uv/sun.svg", destinationUrl: "https://example.com/weersport-affiliate-test/skeeleren", trackingUrl: "https://example.com/weersport-affiliate-test/skeeleren?sub=test", category: "sportbril", sportIds: ["skeeleren"], explanation: "Bij zon is een sportbril een passende tip." },
  { externalId: "fixture-paard-jas", name: "Testfixture regenjas", imageUrl: "/weather/rain.svg", destinationUrl: "https://example.com/weersport-affiliate-test/paardrijden", trackingUrl: "https://example.com/weersport-affiliate-test/paardrijden?sub=test", category: "regenjas", sportIds: ["paardrijden"], explanation: "Bij lichte regen is een regenjas een passende tip." },
  { externalId: "fixture-schaats-handschoen", name: "Testfixture handschoenen", imageUrl: "/icons/ice-skating.svg", destinationUrl: "https://example.com/weersport-affiliate-test/schaatsen", trackingUrl: "https://example.com/weersport-affiliate-test/schaatsen?sub=test", category: "handschoenen", sportIds: ["schaatsen"], explanation: "Bij een geschikt moment zijn handschoenen een passende tip." },
  { externalId: "fixture-fitness-doek", name: "Testfixture handdoek", imageUrl: "/uv/sun.svg", destinationUrl: "https://example.com/weersport-affiliate-test/fitness", trackingUrl: "https://example.com/weersport-affiliate-test/fitness?sub=test", category: "handdoek", sportIds: ["outdoorfitness"], explanation: "Bij warm weer is een sporthanddoek een passende tip." },
];

export function starterExplanation(category: string) {
  return STARTER.find((item) => item.category === category)?.explanation ?? "Een relevante sporttip bij dit moment.";
}

export function ensureStarterFixtures(now = new Date()) {
  if (!sponsorFlags().fixtures) return { loaded: false as const };
  ensureCommercialSchema();
  const existing = db().prepare("SELECT id FROM affiliate_offers WHERE provider = 'decathlon' AND test_data = 1 LIMIT 1").get() as
    | { id: string }
    | undefined;
  if (existing) return { loaded: true as const };
  importAffiliateFeed({
    provider: "decathlon",
    items: STARTER.map((item) => ({
      externalId: item.externalId,
      name: item.name,
      imageUrl: item.imageUrl,
      destinationUrl: item.destinationUrl,
      trackingUrl: item.trackingUrl,
      category: item.category,
      sportIds: item.sportIds,
    })),
    complete: true,
    now,
    testData: true,
  });
  seedRules();
  return { loaded: true as const };
}

export function seedRules() {
  ensureCommercialSchema();
  const count = db().prepare("SELECT COUNT(*) AS n FROM affiliate_rules").get() as { n: number };
  if (count.n > 0) return;
  const rules: Array<{ sportId: string; category: string; condition: unknown; priority: number; specific: number }> = [
    { sportId: "fietsen", category: "regenhoes", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "wielrennen", category: "armstukken", condition: { type: "temp_lte", value: 12 }, priority: 10, specific: 1 },
    { sportId: "gravelbiken", category: "spatbord", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "mountainbiken", category: "bril", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "hardlopen", category: "regenjack", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "trailrunning", category: "pet", condition: { type: "uv_gte", value: 3 }, priority: 10, specific: 1 },
    { sportId: "wandelen", category: "rugzakhoes", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "hiken", category: "opbergzak", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "golf", category: "handschoen", condition: { type: "precip_gte", value: 40 }, priority: 10, specific: 1 },
    { sportId: "tennis-padel", category: "pet", condition: { type: "uv_gte", value: 3 }, priority: 10, specific: 1 },
    { sportId: "voetbal", category: "thermolaag", condition: { type: "temp_lte", value: 8 }, priority: 10, specific: 1 },
    { sportId: "hockey", category: "thermoshirt", condition: { type: "temp_lte", value: 8 }, priority: 10, specific: 1 },
    { sportId: "zeilen", category: "zeiljas", condition: { type: "precip_gte", value: 30 }, priority: 10, specific: 1 },
    { sportId: "windsurfen", category: "materiaaltas", condition: { type: "always" }, priority: 1, specific: 0 },
    { sportId: "kitesurfen", category: "boardbag", condition: { type: "always" }, priority: 1, specific: 0 },
    { sportId: "surfen", category: "poncho", condition: { type: "temp_lte", value: 12 }, priority: 10, specific: 1 },
    { sportId: "suppen", category: "drybag", condition: { type: "always" }, priority: 1, specific: 0 },
    { sportId: "kajakken", category: "waterdichte-zak", condition: { type: "always" }, priority: 1, specific: 0 },
    { sportId: "roeien", category: "windvest", condition: { type: "wind_gte", value: 15 }, priority: 10, specific: 1 },
    { sportId: "openwaterzwemmen", category: "zwemtas", condition: { type: "advice_positive" }, priority: 5, specific: 1 },
    { sportId: "skeeleren", category: "sportbril", condition: { type: "uv_gte", value: 3 }, priority: 10, specific: 1 },
    { sportId: "paardrijden", category: "regenjas", condition: { type: "precip_gte", value: 30 }, priority: 10, specific: 1 },
    { sportId: "schaatsen", category: "handschoenen", condition: { type: "suitable" }, priority: 5, specific: 1 },
    { sportId: "outdoorfitness", category: "handdoek", condition: { type: "temp_gte", value: 22 }, priority: 10, specific: 1 },
  ];
  for (const rule of rules) {
    db()
      .prepare(
        `INSERT INTO affiliate_rules (id, sport_id, category, condition_json, priority, specific, enabled)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(randomUUID(), rule.sportId, rule.category, JSON.stringify(rule.condition), rule.priority, rule.specific);
  }
}

export function recordConversion(input: {
  provider: string;
  transactionId: string;
  offerId: string;
  status: "pending" | "approved" | "reversed";
  commissionCents: number | null;
}) {
  ensureCommercialSchema();
  const existing = db()
    .prepare("SELECT id, status FROM affiliate_conversions WHERE provider = ? AND transaction_id = ?")
    .get(input.provider, input.transactionId) as { id: string; status: string } | undefined;
  if (existing) {
    if (existing.status === input.status) return { ok: true as const, duplicate: true };
    db()
      .prepare("UPDATE affiliate_conversions SET status = ?, commission_cents = ? WHERE id = ?")
      .run(input.status, input.commissionCents, existing.id);
    return { ok: true as const, duplicate: false, updated: true };
  }
  db()
    .prepare(
      `INSERT INTO affiliate_conversions (id, provider, transaction_id, offer_id, status, commission_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), input.provider, input.transactionId, input.offerId, input.status, input.commissionCents);
  return { ok: true as const, duplicate: false, updated: false };
}
