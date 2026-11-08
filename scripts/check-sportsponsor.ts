import { deflateSync } from "node:zlib";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function crc32(buffer: Buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size = 64) {
  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dbFile = path.join(mkdtempSync(path.join(tmpdir(), "ws-contract-")), "contract.sqlite");
process.env.WEERSPORT_DB = dbFile;
Object.assign(process.env, { NODE_ENV: "development" });
process.env.WEERSPORT_SPONSOR_RATE_MODE = "example";
process.env.WEERSPORT_SPONSOR_RATE_CENTS = "2900";
process.env.WEERSPORT_SPONSOR_SIGNUP = "1";
process.env.WEERSPORT_SPONSOR_PUBLISH = "1";
process.env.WEERSPORT_AFFILIATE_DISPLAY = "1";
process.env.WEERSPORT_AFFILIATE_FIXTURES = "1";
process.env.WEERSPORT_SPONSOR_COLLECT = "1";
delete process.env.MOLLIE_API_KEY;

const quoteLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/quote.ts")).href);
const months = await import(pathToFileURL(path.join(root, "lib/sponsoring/months.ts")).href);
const logoLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/logo.ts")).href);
const checkoutLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/checkout.ts")).href);
const providerLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/provider.ts")).href);
const collectLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/collect.ts")).href);
const directory = await import(pathToFileURL(path.join(root, "lib/sponsoring/directory.ts")).href);
const manageLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/manage.ts")).href);
const catalog = await import(pathToFileURL(path.join(root, "lib/affiliate/catalog.ts")).href);
const selectLib = await import(pathToFileURL(path.join(root, "lib/affiliate/select.ts")).href);
const dbModule = await import(pathToFileURL(path.join(root, "lib/auth/db.ts")).href);
const admin = await import(pathToFileURL(path.join(root, "lib/sponsoring/admin.ts")).href);

assert(quoteLib.uniqueKnownSports([]).ok === false, "zero sports");
assert(quoteLib.uniqueKnownSports(["nope"]).ok === false, "unknown sport");
assert(quoteLib.uniqueKnownSports(["fietsen", "fietsen"]).ok === false, "duplicate sport");
const two = quoteLib.createQuote({ sportIds: ["hardlopen", "fietsen"], country: "NL", now: new Date("2026-03-15T12:00:00Z") });
assert(two.ok && two.quote.netCents === 5800 && two.quote.vatCents === 1218 && two.quote.grossCents === 7018, "two sport example");
const all = quoteLib.createQuote({ sportIds: (await import(pathToFileURL(path.join(root, "lib/sports.ts")).href)).sports.map((sport: { id: string }) => sport.id), country: "NL" });
assert(all.ok && all.quote.netCents === 69600 && all.quote.vatCents === 14616 && all.quote.grossCents === 84216, "24 sports");
assert(quoteLib.createQuote({ sportIds: ["fietsen"], country: "BE" }).ok === false, "unsupported country");
delete process.env.WEERSPORT_SPONSOR_RATE_MODE;
assert(quoteLib.createQuote({ sportIds: ["fietsen"], country: "NL" }).ok === false, "unconfirmed rate");
process.env.WEERSPORT_SPONSOR_RATE_MODE = "example";

const logo = logoLib.storeLogo(png());
assert(logo.ok, "png stored");
assert(!logoLib.storeLogo(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")).ok, "svg rejected");
const billing = {
  legalName: "Atelier BV",
  street: "Dorpstraat 1",
  postalCode: "6711 AA",
  city: "Ede",
  country: "NL",
  vatId: "",
  invoiceEmail: "factuur@example.nl",
};
assert(!checkoutLib.validateBilling({ ...billing, invoiceEmail: "nee" }).ok, "bad email");
const attempt = "11111111-1111-4111-8111-111111111111";
const origin = "http://127.0.0.1:3000";
async function checkout(quoteId: string, attemptId: string, gross?: number) {
  return checkoutLib.createSponsorCheckout({
    quoteId,
    attemptId,
    publicName: "Atelier Ede",
    destinationUrl: "https://example.com/atelier",
    logoId: logo.ok ? logo.id : "",
    billing,
    consent: true,
    clientGrossCents: gross,
    origin,
    now: new Date("2026-01-31T12:00:00Z"),
  });
}
if (!two.ok || !logo.ok) throw new Error("setup failed");
const mismatch = await checkout(two.quote.id, "22222222-2222-4222-8222-222222222222", 1);
assert(!mismatch.ok, "client price loses");
const [first, second] = await Promise.all([
  checkout(two.quote.id, attempt, two.quote.grossCents),
  checkout(two.quote.id, attempt, two.quote.grossCents),
]);
assert(first.ok && second.ok, "parallel checkout");
if (first.ok && second.ok) {
  assert(first.checkout.checkoutId === second.checkout.checkoutId, "one checkout");
  const other = new DatabaseSync(dbFile);
  const seen = other.prepare("SELECT COUNT(*) AS n FROM sponsor_checkouts").get() as { n: number };
  assert(seen.n === 1, "second connection sees one checkout");
  other.close();
  const pending = await checkoutLib.verifySponsorPayment({ checkoutId: first.checkout.checkoutId });
  assert(pending.ok && pending.checkout.status !== "paid", "return does not pay");
  const row = dbModule.db().prepare("SELECT mollie_payment_id FROM sponsor_checkouts WHERE id = ?").get(first.checkout.checkoutId) as {
    mollie_payment_id: string;
  };
  providerLib.markTestPayment(row.mollie_payment_id, "paid");
  await checkoutLib.verifySponsorPayment({ paymentId: row.mollie_payment_id });
  await checkoutLib.verifySponsorPayment({ paymentId: row.mollie_payment_id });
  const invoices = dbModule.db().prepare("SELECT COUNT(*) AS n FROM sponsor_invoice_periods").get() as { n: number };
  assert(invoices.n === 1, "one first invoice");
  const providerInvoices = dbModule.db().prepare("SELECT COUNT(*) AS n FROM sponsor_provider_objects WHERE kind = 'invoice'").get() as { n: number };
  assert(providerInvoices.n === 1, "one provider invoice");
  const subscription = dbModule.db().prepare("SELECT name FROM sqlite_master WHERE name = 'billing_subscriptions'").get();
  assert(!subscription, "sponsorship did not create a Pro subscription table");
  const contract = dbModule.db().prepare("SELECT id, sponsor_id, anchor_day, contract_date, paid_until FROM sponsor_contracts").get() as {
    id: string;
    sponsor_id: string;
    anchor_day: number;
    contract_date: string;
    paid_until: string;
  };
  assert(contract.anchor_day === 31 && contract.contract_date === "2026-01-31", "anchor from 31 January");
  assert(contract.paid_until === "2026-02-28", `february clamp ${contract.paid_until}`);
  const during = new Date("2026-02-01T12:00:00Z");
  assert(directory.listPublicSponsors("fietsen", during).length === 0, "unapproved stays hidden");
  assert(directory.moderateSponsor({ sponsorId: contract.sponsor_id, decision: "approved", reason: "Logo en URL gecontroleerd", actor: "test" }).ok, "approve");
  const listed = directory.listPublicSponsors("fietsen", during);
  assert(listed.length === 1 && listed[0].name === "Atelier Ede", "fietsen listing");
  assert(directory.listPublicSponsors("hardlopen", during).length === 1, "hardlopen listing");
  assert(directory.listPublicSponsors("wielrennen", during).length === 0, "other sport hidden");
  assert(!JSON.stringify(listed).includes("factuur@"), "public list has no invoice email");
  const hidden = selectLib.resolveCommercialBlocks({
    surface: "moment",
    plan: "pro",
    now: during,
    snapshot: scored("fietsen", { time: "09:00", temperatureC: 10, windKmh: 10, precipitationProbability: 80, uvIndex: 1, score: 70 }),
  });
  assert(hidden.sponsors.length === 0 && hidden.affiliate === null, "pro hides commercial blocks");
  dbModule.db().prepare("UPDATE sponsor_contracts SET pending_sport_ids = ? WHERE id = ?").run(JSON.stringify(["wandelen"]), contract.id);
  const due = new Date("2026-02-28T12:00:00Z");
  const [collectA, collectB] = await Promise.all([collectLib.collectDue(due), collectLib.collectDue(due)]);
  assert(collectA.some((item: { action: string }) => item.action === "collection_started") || collectB.some((item: { action: string }) => item.action === "collection_started"), "collection started");
  const periods = dbModule.db().prepare("SELECT period_start, status FROM sponsor_invoice_periods ORDER BY period_start").all() as Array<{
    period_start: string;
    status: string;
  }>;
  assert(periods.length === 2 && periods[1].period_start === "2026-02-28", `periods ${JSON.stringify(periods)}`);
  const marchSports = dbModule.db().prepare("SELECT sport_id FROM sponsor_contract_sports WHERE period_start = '2026-02-28'").all() as Array<{ sport_id: string }>;
  assert(marchSports.length === 1 && marchSports[0].sport_id === "wandelen", "next period uses the new sport");
  const openInvoice = dbModule.db().prepare("SELECT id FROM sponsor_invoice_periods WHERE period_start = '2026-02-28'").get() as { id: string };
  assert(collectLib.recordCollectionFailure(openInvoice.id).recoveryUsesSameInvoice, "recovery keeps the invoice");
  assert(collectLib.markInvoicePaid(openInvoice.id).ok, "same invoice can be paid");
  const covered = dbModule.db().prepare("SELECT paid_until FROM sponsor_contracts WHERE id = ?").get(contract.id) as { paid_until: string };
  assert(covered.paid_until === "2026-03-31", `coverage returns to the anchor ${covered.paid_until}`);
  assert(months.nextPeriodStart("2026-03-31", 31) === "2026-04-30", "April clamps");
  manageLib.scheduleCancellation(contract.sponsor_id, new Date("2026-03-15T12:00:00Z"));
  const before = dbModule.db().prepare("SELECT COUNT(*) AS n FROM sponsor_invoice_periods").get() as { n: number };
  await collectLib.collectDue(new Date("2026-03-31T12:00:00Z"));
  const after = dbModule.db().prepare("SELECT COUNT(*) AS n FROM sponsor_invoice_periods").get() as { n: number };
  assert(before.n === after.n, "no invoice after cancellation");
}

const noMandateQuote = quoteLib.createQuote({ sportIds: ["zeilen"], country: "NL", now: new Date("2026-04-02T10:00:00Z") });
assert(noMandateQuote.ok, "mandate quote");
if (noMandateQuote.ok && logo.ok) {
  const started = await checkoutLib.createSponsorCheckout({
    quoteId: noMandateQuote.quote.id,
    attemptId: "33333333-3333-4333-8333-333333333333",
    publicName: "Zeilclub",
    destinationUrl: "https://example.com/zeil",
    logoId: logo.id,
    billing,
    consent: true,
    origin,
    now: new Date("2026-04-02T10:00:00Z"),
  });
  assert(started.ok, "mandate checkout");
  if (started.ok) {
    const payment = dbModule.db().prepare("SELECT mollie_payment_id FROM sponsor_checkouts WHERE id = ?").get(started.checkout.checkoutId) as {
      mollie_payment_id: string;
    };
    const countBefore = dbModule.db().prepare("SELECT COUNT(*) AS n FROM sponsor_checkouts").get() as { n: number };
    providerLib.markTestPayment(payment.mollie_payment_id, "paid", { mandate: false });
    const verified = await checkoutLib.verifySponsorPayment({ checkoutId: started.checkout.checkoutId });
    assert(verified.ok && verified.mandateId === null, "paid without mandate");
    const countAfter = dbModule.db().prepare("SELECT COUNT(*) AS n FROM sponsor_checkouts").get() as { n: number };
    assert(countBefore.n === countAfter.n, "no second first payment");
  }
}

const providerSource = await import("node:fs").then((fs) => fs.readFileSync(new URL("../lib/sponsoring/provider.ts", import.meta.url), "utf8"));
assert(!providerSource.includes("/subscriptions"), "no Mollie subscription for sponsorship");

const rain = selectLib.resolveCommercialBlocks({
  surface: "moment",
  plan: "basis",
  snapshot: scored("hardlopen", { time: "09:00", temperatureC: 11, windKmh: 8, precipitationProbability: 70, uvIndex: 1, score: 72 }),
});
const sun = selectLib.resolveCommercialBlocks({
  surface: "moment",
  plan: "basis",
  hourTime: "16:00",
  snapshot: scored("trailrunning", { time: "16:00", temperatureC: 20, windKmh: 8, precipitationProbability: 5, uvIndex: 6, score: 84 }),
});
assert(rain.affiliate?.explanation.toLowerCase().includes("regen"), `rain tip ${rain.affiliate?.name}`);
assert(sun.affiliate?.explanation.toLowerCase().includes("zon"), `sun tip ${sun.affiliate?.name}`);
const blocked = selectLib.resolveCommercialBlocks({
  surface: "moment",
  plan: "basis",
  snapshot: {
    ...scored("openwaterzwemmen", { time: "09:00", temperatureC: 16, windKmh: 5, precipitationProbability: 10, uvIndex: 2, score: 0 }),
    suitability: { kind: "NO_SCORE", reason: "waterdata ontbreekt" },
  },
});
assert(blocked.affiliate === null, "missing critical data hides the affiliate");
const originalScore = 72;
const untouched = scored("hardlopen", { time: "09:00", temperatureC: 11, windKmh: 8, precipitationProbability: 70, uvIndex: 1, score: originalScore });
selectLib.resolveCommercialBlocks({ surface: "moment", plan: "basis", snapshot: untouched });
assert(untouched.suitability.kind === "SCORED" && untouched.suitability.score === originalScore, "score unchanged");

const corrupt = catalog.importAffiliateFeed({ provider: "decathlon", items: null, complete: false });
assert(corrupt.keptPrevious, "corrupt feed keeps the previous generation");
const partial = catalog.importAffiliateFeed({
  provider: "decathlon",
  complete: true,
  items: [{ externalId: "", name: "", imageUrl: "", destinationUrl: "", trackingUrl: "", category: "", sportIds: [] }],
});
assert(!partial.published && partial.keptPrevious, "partial feed rejected");
const replaced = catalog.importAffiliateFeed({
  provider: "decathlon",
  complete: true,
  testData: true,
  items: [
    {
      externalId: "fixture-only-hardlopen",
      name: "Testfixture alleen hardlopen",
      imageUrl: "/weather/rain.svg",
      destinationUrl: "https://example.com/weersport-affiliate-test/alleen",
      trackingUrl: "https://example.com/weersport-affiliate-test/alleen?sub=test",
      category: "regenjack",
      sportIds: ["hardlopen"],
    },
  ],
});
assert(replaced.published, "complete feed publishes");
const expired = dbModule.db().prepare("SELECT status FROM affiliate_offers WHERE external_id = 'fixture-fietsen-regen'").get() as { status: string };
assert(expired.status === "expired", "missing product expires after a complete feed");
const offer = dbModule.db().prepare("SELECT id FROM affiliate_offers WHERE external_id = 'fixture-only-hardlopen'").get() as { id: string };
assert(catalog.recordConversion({ provider: "decathlon", transactionId: "tx-1", offerId: offer.id, status: "approved", commissionCents: 150 }).duplicate === false, "commission");
assert(catalog.recordConversion({ provider: "decathlon", transactionId: "tx-1", offerId: offer.id, status: "reversed", commissionCents: 0 }).updated, "return once");
assert(catalog.recordConversion({ provider: "decathlon", transactionId: "tx-1", offerId: offer.id, status: "reversed", commissionCents: 0 }).duplicate, "return deduped");

const measureSource = (await import("node:fs")).readFileSync(new URL("../app/api/sponsoring/measure/route.ts", import.meta.url), "utf8");
assert(measureSource.includes("status: 403") && measureSource.includes("parseConsentCookie"), "measurement route requires consent");
const counted = selectLib.recordAffiliateMeasure({ placementId: "placement-1", kind: "impression", offerId: offer.id, sportId: "hardlopen", day: "2026-02-01" });
const countedAgain = selectLib.recordAffiliateMeasure({ placementId: "placement-1", kind: "impression", offerId: offer.id, sportId: "hardlopen", day: "2026-02-01" });
assert(counted.duplicate === false && countedAgain.duplicate === true, "impression deduped");

const legacy = admin.getRequest("missing");
assert(legacy === null || legacy === undefined, "missing historical request");
dbModule.db().prepare(
  `CREATE TABLE IF NOT EXISTS sponsorship_requests (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, organisation TEXT NOT NULL, email TEXT NOT NULL,
    message TEXT, inbox TEXT, created_at TEXT NOT NULL
  )`,
);
dbModule.db().prepare("INSERT INTO sponsorship_requests (id, name, organisation, email, message, created_at) VALUES ('old-contract', 'Oud', 'Club', 'oud@example.nl', 'Historische aanvraag blijft leesbaar in het archief.', '2026-01-01T00:00:00.000Z')").run();
assert(admin.getRequest("old-contract")?.message?.includes("Historische"), "old request stays readable");

console.log("sportsponsor checks ok");

function scored(sportId: string, hour: { time: string; temperatureC: number; windKmh: number; precipitationProbability: number; uvIndex: number; score: number }) {
  return {
    sportId,
    placeId: "wpl-ede",
    suitability: {
      kind: "SCORED" as const,
      modelVersion: "test",
      score: hour.score,
      badge: "GOED" as const,
      peakWindow: { start: hour.time, end: hour.time, peakTime: hour.time, peakScore: hour.score, label: hour.time },
      bestTimeLabel: hour.time,
      hourly: [{ ...hour }],
      factors: [],
      tooltip: "",
      caveats: "",
    },
    warnings: { status: "READY", demo: false, value: { items: [] } },
    weather: { status: "READY", demo: false, value: null },
  };
}
