import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const page = readFileSync(new URL("../app/sponsoring/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/sponsoring-form.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../components/sponsoring-running-preview.tsx", import.meta.url), "utf8");
const momentPage = readFileSync(new URL("../app/moment/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/home-page.tsx", import.meta.url), "utf8");
const screen = `${page}\n${form}\n${preview}`;
for (const token of [
  "Stel je campagne samen",
  "Verder naar contactgegevens",
  "Controleer je aanvraag",
  "Keuzes wijzigen",
  "Sponsoraanvraag versturen",
  "Aanvraag ontvangen",
  "Aanvraagnummer",
  "Voorbeeld met demogegevens",
  "Je ochtendrun",
  "hardlopen-heide.webp",
  "trailschoen.webp",
  "Loopatelier Ede",
  "Fictieve partner",
  "role=\"alert\"",
  "role=\"status\"",
]) {
  if (!screen.includes(token)) throw new Error(`Sponsoring screen missing ${token}`);
}
const campaignSource = readFileSync(new URL("../lib/sponsoring/campaign.ts", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../lib/sponsoring/store.ts", import.meta.url), "utf8");
if (!campaignSource.includes("campaign_v1") || !storeSource.includes("idempotency_key") || !storeSource.includes("message: null")) {
  throw new Error("Campaign storage lost its type, idempotency key or empty message");
}
for (const banned of ["€99", "Vraag een pilot aan", "Vraag informatie over de pilot", "Bespreek maatwerk", "gratis"]) {
  if (page.includes(banned) || form.includes(banned) || preview.includes(banned)) {
    throw new Error(`Public sponsoring still shows ${banned}`);
  }
}
if (preview.includes("https://") || preview.includes("meet") || preview.includes("forecast") || preview.includes("scoreSportHours")) {
  throw new Error("Running preview must stay a fixed fixture without a forecast or shop link");
}
if (!momentPage.includes("try {") || !momentPage.includes("resolveSponsorSlot")) {
  throw new Error("Moment page must isolate sponsor selection");
}
if (home.includes("resolveSponsorSlot") || home.includes("SponsorMeasure")) {
  throw new Error("Homepage must not place a sponsor");
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dbFile = path.join(mkdtempSync(path.join(tmpdir(), "ws-sponsor-")), "pilot.sqlite");
process.env.WEERSPORT_DB = dbFile;
Object.assign(process.env, { NODE_ENV: "development" });
delete process.env.WEERSPORT_SPONSOR_PILOT_BOOKABLE;
delete process.env.WEERSPORT_SPONSOR_EVENT_SECRET;

const period = await import(pathToFileURL(path.join(root, "lib/sponsoring/period.ts")).href);
const validate = await import(pathToFileURL(path.join(root, "lib/sponsoring/validate.ts")).href);
const store = await import(pathToFileURL(path.join(root, "lib/sponsoring/store.ts")).href);
const admin = await import(pathToFileURL(path.join(root, "lib/sponsoring/admin.ts")).href);
const placement = await import(pathToFileURL(path.join(root, "lib/sponsoring/placement.ts")).href);
const dbModule = await import(pathToFileURL(path.join(root, "lib/auth/db.ts")).href);

const spring = period.pilotWindow("2026-03-29");
assert(spring.endDate === "2026-04-26", `spring end ${spring.endDate}`);
assert(spring.startsAt === "2026-03-28T23:00:00.000Z", `spring start ${spring.startsAt}`);
assert(spring.endsAt === "2026-04-25T22:00:00.000Z", `spring exclusive end ${spring.endsAt}`);
assert(Date.parse(spring.endsAt) - Date.parse(spring.startsAt) === 28 * 24 * 3600 * 1000 - 3600 * 1000, "spring DST short");

const autumn = period.pilotWindow("2026-10-25");
assert(autumn.endDate === "2026-11-22", `autumn end ${autumn.endDate}`);
assert(autumn.startsAt === "2026-10-24T22:00:00.000Z", `autumn start ${autumn.startsAt}`);
assert(autumn.endsAt === "2026-11-21T23:00:00.000Z", `autumn exclusive end ${autumn.endsAt}`);
assert(Date.parse(autumn.endsAt) - Date.parse(autumn.startsAt) === 28 * 24 * 3600 * 1000 + 3600 * 1000, "autumn DST long");
assert(period.windowContains(spring.startsAt, spring.endsAt, new Date(spring.startsAt)), "start is inclusive");
assert(!period.windowContains(spring.startsAt, spring.endsAt, new Date(spring.endsAt)), "end is exclusive");
assert(period.effectiveCpmCents(9900, 2500) === 3960, "€99 and 2500 impressions must be €39,60");
assert(period.effectiveCpmCents(9900, 0) === null, "zero impressions have no CPM");
assert(period.formatEuroCents(3960) === "€39,60", period.formatEuroCents(3960));
assert(period.formatEuroCents(9900) === "€99,00", "price format");
assert(period.formatEuroDot(3960) === "39.60", "csv cpm");
const campaignLib = await import(pathToFileURL(path.join(root, "lib/sponsoring/campaign.ts")).href);
assert(campaignLib.inclusiveCampaignEnd("2027-03-01", 6) === "2027-04-11", "six weeks from 1 March");
assert(campaignLib.inclusiveCampaignEnd("2026-03-28", 1) === "2026-04-03", "one week across spring DST");
assert(campaignLib.inclusiveCampaignEnd("2026-10-24", 2) === "2026-11-06", "two weeks across autumn DST");
assert(campaignLib.formatPeriod("2027-03-01", "2027-04-11") === "1 maart t/m 11 april 2027", campaignLib.formatPeriod("2027-03-01", "2027-04-11"));
assert(
  campaignLib.formatPeriod("2027-12-20", "2028-01-09") === "20 december 2027 t/m 9 januari 2028",
  campaignLib.formatPeriod("2027-12-20", "2028-01-09"),
);

assert(validate.validateDestination("https://example.com/schoenen") === "https://example.com/schoenen", "https allowed");
for (const bad of ["http://example.com", "javascript:alert(1)", "//example.com", "https://user:pass@example.com/x", "/api/sponsoring/events?url=https://evil.test"]) {
  let rejected = false;
  try {
    validate.validateDestination(bad);
  } catch {
    rejected = true;
  }
  assert(rejected, `destination should fail: ${bad}`);
}
assert(validate.validateDestination("") === null, "empty destination");
assert(validate.validateDestination(null) === null, "missing destination");

const places = new Map([
  ["wpl-ede", "Ede"],
  ["wpl-ams", "Amsterdam"],
  ["wpl-ben", "Bennekom"],
]);
async function resolvePlace(id: string) {
  const label = places.get(id);
  return label ? { id, label, detail: `${label}, Gelderland` } : null;
}

const raw = new DatabaseSync(dbFile);
raw.exec(`
  CREATE TABLE sponsorship_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organisation TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    inbox TEXT,
    created_at TEXT NOT NULL
  );
`);
raw
  .prepare(
    "INSERT INTO sponsorship_requests (id, name, organisation, email, message, inbox, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
  .run("old-1", "Oud", "Oude club", "oud@example.nl", "Dit is een oude aanvraag zonder de nieuwe pilotvelden.", null, "2026-01-01T00:00:00.000Z");
raw.close();

const legacy = await store.saveSponsorship({
  name: "Nora Noord",
  organisation: "Duinclub",
  email: "nora@example.nl",
  message: "We willen een herkenbare vermelding bij fietsen, zonder invloed op de score.",
  status: "agreed",
  priceCents: 0,
  startsAt: "2026-06-01",
});
assert(legacy.ok && legacy.mailed === false && legacy.request.intent === null, "legacy request");
assert(legacy.request.quotedPriceCents === null && legacy.request.status === "received", "legacy has no quote");
const old = admin.getRequest("old-1");
assert(old?.intent == null && old?.message.includes("oude aanvraag"), "old row stays readable");
assert(admin.campaignForRequest(legacy.request.id) === null, "public request created no campaign");

const pilot = await store.saveSponsorship(
  {
    name: "Glenn Tester",
    organisation: "Loopatelier Ede",
    email: "glenn-pilot@example.nl",
    message: "We willen vier weken zichtbaar zijn bij hardlopen in Ede.",
    intent: "pilot",
    sportId: "hardlopen",
    placeId: "wpl-ede",
    placeLabel: "Ede",
    desiredStart: "2026-06-01",
    status: "agreed",
    priceCents: 0,
    agreedPriceCents: 0,
    startsAt: "2026-06-01",
    endsAt: "2026-06-29",
  },
  { resolvePlace },
);
assert(pilot.ok, "pilot request");
if (pilot.ok) {
  assert(pilot.request.quotedPriceCents === 9900, "quote is 9900 cents");
  assert(pilot.request.inquiry === "interest", "unbookable pilot is interest");
  assert(pilot.request.status === "received", "public request stays received");
  assert(pilot.request.sportId === "hardlopen" && pilot.request.placeLabel === "Ede", "sport and region stored");
  const row = admin.getRequest(pilot.request.id);
  assert(row?.agreed_price_cents == null && row?.agreed_at == null, "public request cannot authorise a price");
}

const booked = await store.saveSponsorship(
  {
    name: "Boekbaar",
    organisation: "Atelier",
    email: "boekbaar@example.nl",
    message: "We willen de pilot boeken voor hardlopen in Ede.",
    intent: "pilot",
    sportId: "hardlopen",
    placeId: "wpl-ede",
    placeLabel: "Ede",
  },
  { resolvePlace, bookable: true },
);
assert(booked.ok && booked.request.inquiry === "request" && booked.request.quotedPriceCents === 9900, "bookable still does not go live");
assert(admin.campaignForRequest(booked.ok ? booked.request.id : "") === null, "bookable request has no campaign");

const custom = await store.saveSponsorship({
  name: "Maat Mens",
  organisation: "Seizoenclub",
  email: "maat@example.nl",
  message: "We willen wielrennen én hardlopen, in Ede en Arnhem, voor een heel voorjaar.",
  intent: "custom",
  sportId: "hardlopen",
  placeId: "wpl-ede",
  placeLabel: "Ede",
});
assert(custom.ok && custom.request.intent === "custom" && custom.request.sportId === null, "custom keeps wishes in the message");
assert(custom.ok && custom.request.quotedPriceCents === null, "custom has no pilot price");

const badSport = await store.saveSponsorship(
  {
    name: "Fout",
    organisation: "Club",
    email: "fout-sport@example.nl",
    message: "Deze sport bestaat niet in de catalogus van WeerSport.",
    intent: "pilot",
    sportId: "schaken",
    placeId: "wpl-ede",
    placeLabel: "Ede",
  },
  { resolvePlace },
);
assert(!badSport.ok && badSport.errors.sport, "unknown sport rejected");
const badStart = await store.saveSponsorship(
  {
    name: "Fout",
    organisation: "Club",
    email: "fout-datum@example.nl",
    message: "De gewenste startdatum is geen kalenderdatum.",
    intent: "pilot",
    sportId: "hardlopen",
    placeId: "wpl-ede",
    placeLabel: "Ede",
    desiredStart: "2026-02-31",
  },
  { resolvePlace },
);
assert(!badStart.ok && badStart.errors.start, "invalid start rejected");
const honeypot = await store.saveSponsorship({
  name: "Nora Noord",
  organisation: "Duinclub",
  email: "nora-hp@example.nl",
  message: "We willen een herkenbare vermelding bij fietsen, zonder invloed op de score.",
  wsHp: "https://example.nl",
});
assert(!honeypot.ok, "honeypot rejected");

const campaignKey = "11111111-1111-4111-8111-111111111111";
const campaignBody = {
  requestType: "campaign_v1",
  name: "Sam Jansen",
  organisation: "Noordkade Wielers",
  email: "Sam@Wieler.test",
  sportId: "wielrennen",
  placeId: "wpl-ben",
  placeLabel: "Bennekom",
  areaKind: "radius",
  radiusKm: 10,
  desiredStart: "2027-03-01",
  durationWeeks: 8,
  idempotencyKey: campaignKey,
  message: "Dit vrije bericht hoort niet bij een campagneaanvraag.",
  status: "agreed",
  priceCents: 0,
  quotedPriceCents: 0,
};
const campaignSaved = await store.saveSponsorship(campaignBody, { resolvePlace });
assert(campaignSaved.ok, "campaign request stored");
if (!campaignSaved.ok) throw new Error("campaign");
assert(campaignSaved.request.status === "ontvangen", "campaign stays ontvangen");
assert(campaignSaved.request.quotedPriceCents === null, "client price is ignored");
assert(campaignSaved.request.message === null, "campaign does not invent a message");
assert(campaignSaved.request.email === "sam@wieler.test", "email normalised");
const campaignRow = admin.getRequest(campaignSaved.request.id);
assert(campaignRow?.request_type === "campaign_v1", "request type stored");
assert(campaignRow?.sport_id === "wielrennen" && campaignRow.place_id === "wpl-ben", "sport and place stored");
assert(campaignRow?.place_label === "Bennekom" && campaignRow.province === "Gelderland", "place and province stored");
assert(campaignRow?.area_kind === "radius" && campaignRow.radius_km === 10, "radius stored");
assert(campaignRow?.desired_start === "2027-03-01" && campaignRow.end_date === "2027-04-25", `end ${campaignRow?.end_date}`);
assert(campaignRow?.duration_weeks === 8, "weeks stored");
assert(campaignRow?.name === "Sam Jansen" && campaignRow.organisation === "Noordkade Wielers", "contact stored");
assert(campaignRow?.message == null, "message column stays empty");
const campaignAgain = await store.saveSponsorship(campaignBody, { resolvePlace });
assert(campaignAgain.ok && campaignAgain.request.id === campaignSaved.request.id, "retry reuses the request");
const campaignCount = dbModule.db().prepare("SELECT COUNT(*) AS count FROM sponsorship_requests WHERE idempotency_key = ?").get(campaignKey) as { count: number };
assert(campaignCount.count === 1, "retry does not insert a second row");
const [raceOne, raceTwo] = await Promise.all([
  store.saveSponsorship({ ...campaignBody, idempotencyKey: "22222222-2222-4222-8222-222222222222", email: "race@wieler.test" }, { resolvePlace }),
  store.saveSponsorship({ ...campaignBody, idempotencyKey: "22222222-2222-4222-8222-222222222222", email: "race@wieler.test" }, { resolvePlace }),
]);
assert(raceOne.ok && raceTwo.ok && raceOne.request.id === raceTwo.request.id, "parallel retry is one request");
const changed = await store.saveSponsorship({ ...campaignBody, durationWeeks: 9 }, { resolvePlace });
assert(!changed.ok && changed.status === 409, "same key with other content conflicts");
const afterConflict = dbModule.db().prepare("SELECT duration_weeks AS weeks FROM sponsorship_requests WHERE idempotency_key = ?").get(campaignKey) as { weeks: number };
assert(afterConflict.weeks === 8, "conflict keeps the original row");
const unknownType = await store.saveSponsorship({ requestType: "banner_v9", name: "A", organisation: "B", email: "a@b.nl" });
assert(!unknownType.ok && unknownType.status === 400, "unknown request type rejected");
const pastCampaign = await store.saveSponsorship(
  { ...campaignBody, idempotencyKey: "33333333-3333-4333-8333-333333333333", email: "verleden@wieler.test", desiredStart: "2026-01-02" },
  { resolvePlace },
);
assert(!pastCampaign.ok && pastCampaign.errors.start, "past start rejected");
for (const weeks of [0, 1.5, 53, "6.0"]) {
  const badWeeks = await store.saveSponsorship(
    { ...campaignBody, idempotencyKey: "44444444-4444-4444-8444-444444444444", email: "weken@wieler.test", durationWeeks: weeks },
    { resolvePlace },
  );
  assert(!badWeeks.ok && badWeeks.errors.weeks, `weeks rejected: ${weeks}`);
}
const badMail = await store.saveSponsorship(
  { ...campaignBody, idempotencyKey: "55555555-5555-4555-8555-555555555555", email: "geen-adres" },
  { resolvePlace },
);
assert(!badMail.ok && badMail.errors.email, "campaign email rejected");
const typedOnly = await store.saveSponsorship(
  { ...campaignBody, idempotencyKey: "66666666-6666-4666-8666-666666666666", email: "typed@wieler.test", placeId: "", placeLabel: "Bennekom" },
  { resolvePlace },
);
assert(!typedOnly.ok && typedOnly.errors.region, "unselected place rejected");
const campaignHoney = await store.saveSponsorship({ ...campaignBody, idempotencyKey: "77777777-7777-4777-8777-777777777777", email: "honey@wieler.test", wsHp: "https://example.nl" }, { resolvePlace });
assert(!campaignHoney.ok, "campaign honeypot rejected");
const honeyRows = dbModule.db().prepare("SELECT COUNT(*) AS count FROM sponsorship_requests WHERE email = ?").get("honey@wieler.test") as { count: number };
assert(honeyRows.count === 0, "honeypot stored nothing");
const placeOnly = await store.saveSponsorship(
  {
    ...campaignBody,
    idempotencyKey: "88888888-8888-4888-8888-888888888888",
    email: "plaats@wieler.test",
    areaKind: "place",
    radiusKm: null,
    durationWeeks: 1,
  },
  { resolvePlace },
);
assert(placeOnly.ok && placeOnly.request.areaKind === "place" && placeOnly.request.endDate === "2027-03-07", "place-only week");
let limited = false;
for (let index = 0; index < 6; index += 1) {
  const result = await store.saveSponsorship(
    {
      ...campaignBody,
      idempotencyKey: `99999999-9999-4999-8999-99999999999${index}`,
      email: "limiet@wieler.test",
      durationWeeks: index + 1,
    },
    { resolvePlace },
  );
  if (!result.ok && result.status === 429) limited = true;
}
assert(limited, "campaign rate limit");
const limitedRetry = await store.saveSponsorship(
  { ...campaignBody, idempotencyKey: "99999999-9999-4999-8999-999999999990", email: "limiet@wieler.test", durationWeeks: 1 },
  { resolvePlace },
);
assert(limitedRetry.ok, "stored retry still succeeds when the hour is full");
const listedCampaign = admin.formatRequestList(admin.listRequests());
assert(listedCampaign.includes("Wielrennen") && listedCampaign.includes("Bennekom, Gelderland"), "list shows campaign place");
assert(listedCampaign.includes("straal 10 km") && listedCampaign.includes("2027-03-01") && listedCampaign.includes("2027-04-25"), "list shows radius and period");
assert(listedCampaign.includes("sam@wieler.test") && listedCampaign.includes("Noordkade Wielers"), "list shows contact");

if (!pilot.ok) throw new Error("pilot missing");
const early = await admin.scheduleCampaign(
  {
    requestId: pilot.request.id,
    sportId: "hardlopen",
    placeId: "wpl-ede",
    startDate: "2026-06-01",
    headline: "Te vroeg",
    body: "Nog geen akkoord vastgelegd.",
  },
  { resolvePlace },
);
assert(!early.ok, "schedule before agreement fails");

const agreed = admin.agreeRequest(pilot.request.id, "standard");
assert(agreed.ok && agreed.request.agreed_price_cents === 9900, "agreement stores 9900");
const agreedAgain = admin.agreeRequest(pilot.request.id, "standard");
assert(agreedAgain.ok && agreedAgain.reused, "agreement is repeatable");
const flip = admin.agreeRequest(pilot.request.id, "complimentary");
assert(!flip.ok, "agreement price cannot be replaced");

const scheduled = await admin.scheduleCampaign(
  {
    requestId: pilot.request.id,
    sportId: "hardlopen",
    placeId: "wpl-ede",
    startDate: "2026-06-01",
    headline: "Welke schoen past bij jouw rondje?",
    body: "Van asfalt tot heidepad. In onze winkel in Ede kun je verschillende hardloopschoenen passen en vergelijken.",
    destinationUrl: "https://example.com/loopatelier-ede",
    partnerName: "Loopatelier Ede",
    audience: "test",
  },
  { resolvePlace },
);
assert(scheduled.ok, "scheduled");
if (!scheduled.ok) throw new Error("schedule");
const scheduledAgain = await admin.scheduleCampaign(
  {
    requestId: pilot.request.id,
    sportId: "fietsen",
    placeId: "wpl-ams",
    startDate: "2026-07-01",
    headline: "Andere kop",
    body: "Dit mag geen tweede campagne worden.",
    audience: "test",
  },
  { resolvePlace },
);
assert(scheduledAgain.ok && scheduledAgain.reused && scheduledAgain.campaign.id === scheduled.campaign.id, "one campaign per request");

const atStart = placement.resolveSponsorSlot({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  now: new Date(scheduled.campaign.starts_at),
  allowTest: true,
  snapshot: snapshot({}),
});
assert(atStart.mode === "show" && atStart.creative.destinationUrl === "https://example.com/loopatelier-ede", "exact start shows the sponsor");
const before = placement.resolveSponsorSlot({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  now: new Date(Date.parse(scheduled.campaign.starts_at) - 1),
  allowTest: true,
  snapshot: snapshot({}),
});
assert(before.mode === "none", "future campaign stays hidden");
const atEnd = placement.resolveSponsorSlot({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  now: new Date(scheduled.campaign.ends_at),
  allowTest: true,
  snapshot: snapshot({}),
});
assert(atEnd.mode === "none", "exclusive end stays hidden");

const rivalRequest = await store.saveSponsorship(
  {
    name: "Rivaal",
    organisation: "Andere winkel",
    email: "rivaal@example.nl",
    message: "Wij willen dezelfde hardloopplek in Ede in dezelfde weken.",
    intent: "pilot",
    sportId: "hardlopen",
    placeId: "wpl-ede",
    placeLabel: "Ede",
  },
  { resolvePlace },
);
assert(rivalRequest.ok, "rival request");
if (!rivalRequest.ok) throw new Error("rival");
admin.agreeRequest(rivalRequest.request.id, "standard");
const overlap = await admin.scheduleCampaign(
  {
    requestId: rivalRequest.request.id,
    sportId: "hardlopen",
    placeId: "wpl-ede",
    startDate: "2026-06-10",
    headline: "Zelfde plek",
    body: "Deze boeking overlapt de bestaande pilot.",
    audience: "test",
  },
  { resolvePlace },
);
assert(!overlap.ok && overlap.error.includes("Overlappende"), overlap.ok ? "" : overlap.error);

const adjacentRequest = await store.saveSponsorship({
  name: "Naast",
  organisation: "Naastclub",
  email: "naast@example.nl",
  message: "Wij starten op de dag dat de vorige pilot exclusief eindigt.",
  intent: "custom",
});
assert(adjacentRequest.ok, "adjacent request");
if (!adjacentRequest.ok) throw new Error("adjacent");
admin.agreeRequest(adjacentRequest.request.id, "complimentary");
const adjacent = await admin.scheduleCampaign(
  {
    requestId: adjacentRequest.request.id,
    sportId: "hardlopen",
    placeId: "wpl-ede",
    startDate: "2026-06-29",
    headline: "Direct erna",
    body: "Deze periode raakt de vorige niet.",
    audience: "test",
    destinationUrl: "http://example.com/nope",
  },
  { resolvePlace },
);
assert(!adjacent.ok, "http destination rejected");
const adjacentOk = await admin.scheduleCampaign(
  {
    requestId: adjacentRequest.request.id,
    sportId: "hardlopen",
    placeId: "wpl-ede",
    startDate: "2026-06-29",
    headline: "Direct erna",
    body: "Deze periode raakt de vorige niet.",
    audience: "test",
  },
  { resolvePlace },
);
assert(adjacentOk.ok && adjacentOk.campaign.price_cents === 0 && adjacentOk.campaign.price_kind === "complimentary", "free pilot is a separate price");

const otherSport = await store.saveSponsorship({
  name: "Fiets",
  organisation: "Fietsclub",
  email: "fiets@example.nl",
  message: "Een andere sport op dezelfde plaats mag naast hardlopen staan.",
  intent: "custom",
});
assert(otherSport.ok, "other sport request");
if (!otherSport.ok) throw new Error("other");
admin.agreeRequest(otherSport.request.id, "standard");
const other = await admin.scheduleCampaign(
  {
    requestId: otherSport.request.id,
    sportId: "fietsen",
    placeId: "wpl-ede",
    startDate: "2026-06-01",
    headline: "Andere sport",
    body: "Fietsen in Ede is een andere plek in het aanbod.",
    audience: "production",
  },
  { resolvePlace },
);
assert(other.ok, "different sport can share a place");

function snapshot(partial: {
  sportId?: string;
  placeId?: string;
  kind?: "SCORED" | "NO_SCORE";
  warningStatus?: string;
  warningCount?: number;
  weatherDemo?: boolean;
}) {
  const kind = partial.kind ?? "SCORED";
  return {
    sportId: partial.sportId ?? "hardlopen",
    placeId: partial.placeId ?? "wpl-ede",
    suitability: kind === "SCORED" ? { kind, score: 72 } : { kind, reason: "geen score" },
    warnings: {
      status: partial.warningStatus ?? "NOT_LINKED",
      value: { items: Array.from({ length: partial.warningCount ?? 0 }, () => ({ title: "waarschuwing", detail: "x" })) },
    },
    weather: { demo: partial.weatherDemo ?? false },
  };
}

for (const blocked of [
  { plan: "pro", consentGranted: true, snapshot: snapshot({}), label: "pro" },
  { plan: "basis", consentGranted: false, snapshot: snapshot({}), label: "consent" },
  { plan: "basis", consentGranted: true, snapshot: snapshot({ kind: "NO_SCORE" }), label: "score" },
  { plan: "basis", consentGranted: true, snapshot: snapshot({ warningStatus: "OFFICIAL_WARNING" }), label: "safety" },
  { plan: "basis", consentGranted: true, snapshot: snapshot({ warningCount: 1 }), label: "warning item" },
  { plan: "basis", consentGranted: true, snapshot: snapshot({ weatherDemo: true }), label: "demo weather" },
  { plan: "basis", consentGranted: true, snapshot: snapshot({ sportId: "wielrennen" }), label: "sport" },
  { plan: "basis", consentGranted: true, snapshot: snapshot({ placeId: "wpl-ams" }), label: "place" },
]) {
  const slot = placement.resolveSponsorSlot({
    surface: blocked.plan === "basis" && blocked.label === "consent" ? "moment" : "moment",
    plan: blocked.plan,
    consentGranted: blocked.consentGranted,
    now: new Date(scheduled.campaign.starts_at),
    allowTest: true,
    snapshot: blocked.snapshot,
  });
  assert(slot.mode === "none", `${blocked.label} must not place a sponsor`);
}
const homeSlot = placement.resolveSponsorSlot({
  surface: "home",
  plan: "basis",
  consentGranted: true,
  now: new Date(scheduled.campaign.starts_at),
  allowTest: true,
  snapshot: snapshot({}),
});
assert(homeSlot.mode === "none", "no sponsor on the homepage surface");
const hiddenTest = placement.resolveSponsorSlot({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  now: new Date(scheduled.campaign.starts_at),
  allowTest: false,
  snapshot: snapshot({}),
});
assert(hiddenTest.mode === "none", "test campaigns stay out of production rendering");

admin.pauseCampaign(scheduled.campaign.id);
const paused = placement.resolveSponsorSlot({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  now: new Date(scheduled.campaign.starts_at),
  allowTest: true,
  snapshot: snapshot({}),
});
assert(paused.mode === "eligible", "paused campaign is not shown");
if (paused.mode !== "eligible") throw new Error("pause");
const pausedImpression = placement.recordSponsorEvent({ ...paused.creative, kind: "impression", now: new Date(scheduled.campaign.starts_at) });
assert(!pausedImpression.ok, "paused campaign records no impression");
const pausedEligible = placement.recordSponsorEvent({ ...paused.creative, kind: "eligible", now: new Date(scheduled.campaign.starts_at) });
assert(pausedEligible.ok && pausedEligible.duplicate === false, "eligible view can be counted while paused");
const resumed = admin.resumeCampaign(scheduled.campaign.id, new Date("2026-06-15T12:00:00.000Z"));
assert(resumed.ok, "resume inside the window");

const shown = placement.resolveSponsorSlot({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  now: new Date("2026-06-15T12:00:00.000Z"),
  allowTest: true,
  snapshot: snapshot({}),
});
assert(shown.mode === "show", "active window shows");
if (shown.mode !== "show") throw new Error("show");
const impression = placement.recordSponsorEvent({ ...shown.creative, kind: "impression", now: new Date("2026-06-15T12:00:00.000Z") });
assert(impression.ok && !impression.duplicate, "impression stored");
const impressionAgain = placement.recordSponsorEvent({ ...shown.creative, kind: "impression", now: new Date("2026-06-15T12:00:00.000Z") });
assert(impressionAgain.ok && impressionAgain.duplicate, "duplicate impression does not count twice");
const click = placement.recordSponsorEvent({ ...shown.creative, kind: "click", now: new Date("2026-06-15T12:00:00.000Z") });
assert(click.ok, "click stored");
const forged = placement.recordSponsorEvent({
  ...shown.creative,
  signature: "not-the-signature",
  kind: "click",
  now: new Date("2026-06-15T12:00:00.000Z"),
});
assert(!forged.ok, "forged event rejected");

const report = admin.campaignReport(scheduled.campaign.id);
assert(report?.impressions === 1 && report.clicks === 1 && report.eligible === 1, "report uses the event table");
assert(report?.countsInProduction === false, "test campaign excluded from production");
assert(admin.productionTotals().impression === 0 && admin.productionTotals().click === 0, "production totals ignore the test campaign");

if (other.ok) {
  const insert = dbModule.db().prepare(
    "INSERT INTO sponsor_events (id, campaign_id, placement_id, kind, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  for (let index = 0; index < 2500; index += 1) {
    insert.run(`prod-${index}`, other.campaign.id, `prod-placement-${index}`, "impression", "2026-06-02T12:00:00.000Z");
  }
  const priced = admin.campaignReport(other.campaign.id);
  assert(priced?.cpmCents === 3960, `expected 3960 got ${priced?.cpmCents}`);
  const text = admin.formatReport(priced!);
  assert(text.includes("€39,60"), text);
  assert(text.includes("€99,00"), "report price");
  assert(!text.includes("unieke sporters zijn"), "no unique-athlete claim");
  assert(text.includes("Klikken:"), "clicks stay clicks");
  const csv = admin.formatReportCsv(priced!);
  assert(csv.includes("39.60") && csv.includes("99.00") && csv.includes("Loopatelier") === false, "production csv");
  assert(csv.startsWith("partner,sport,regio,start,einde,prijs_excl_btw,zichtbare_vertoningen,klikken"), "csv header");
  assert(admin.productionTotals().impression === 2500, "production total counts only production events");
}

const zeroRequest = await store.saveSponsorship({
  name: "Leeg",
  organisation: "Lege club",
  email: "leeg@example.nl",
  message: "Een campagne zonder vertoningen moet een lege CPM houden.",
  intent: "custom",
});
assert(zeroRequest.ok, "zero request");
if (zeroRequest.ok) {
  admin.agreeRequest(zeroRequest.request.id, "standard");
  const zero = await admin.scheduleCampaign(
    {
      requestId: zeroRequest.request.id,
      sportId: "wandelen",
      placeId: "wpl-ben",
      startDate: "2026-08-01",
      headline: "Geen vertoningen",
      body: "Nog niemand heeft deze vermelding gezien.",
      audience: "production",
    },
    { resolvePlace },
  );
  assert(zero.ok, "zero campaign");
  if (zero.ok) {
    const empty = admin.campaignReport(zero.campaign.id);
    assert(empty?.cpmCents === null && empty.impressions === 0, "empty cpm");
    assert(admin.formatReport(empty!).includes("Geen effectieve CPM"), "empty cpm explanation");
    assert(admin.formatReportCsv(empty!).includes("0,0,0,"), "csv leaves cpm empty");
  }
}

const demoRequest = await store.saveSponsorship({
  name: "Demo",
  organisation: "Democlub",
  email: "demo@example.nl",
  message: "Een democampagne mag niet op het sportmoment of in het productierapport.",
  intent: "custom",
});
assert(demoRequest.ok, "demo request");
if (demoRequest.ok) {
  admin.agreeRequest(demoRequest.request.id, "standard");
  const demo = await admin.scheduleCampaign(
    {
      requestId: demoRequest.request.id,
      sportId: "wandelen",
      placeId: "wpl-ede",
      startDate: "2026-06-01",
      headline: "Alleen demo",
      body: "Dit is een adminvoorbeeld en telt niet.",
      audience: "demo",
    },
    { resolvePlace },
  );
  assert(demo.ok, "demo scheduled");
  const demoSlot = placement.resolveSponsorSlot({
    surface: "moment",
    plan: "basis",
    consentGranted: true,
    now: new Date("2026-06-15T12:00:00.000Z"),
    allowTest: true,
    snapshot: snapshot({ sportId: "wandelen" }),
  });
  assert(demoSlot.mode === "none", "demo audience is not placed");
}

let busy = 0;
for (let index = 0; index < 61; index += 1) {
  const slot = placement.resolveSponsorSlot({
    surface: "moment",
    plan: "basis",
    consentGranted: true,
    now: new Date("2026-06-15T12:00:00.000Z"),
    allowTest: true,
    snapshot: snapshot({}),
  });
  if (slot.mode !== "show") throw new Error("expected show while flooding events");
  const result = placement.recordSponsorEvent({ ...slot.creative, kind: "eligible", now: new Date("2026-06-15T12:00:00.000Z") });
  if (!result.ok && result.status === 429) busy += 1;
}
assert(busy >= 1, "event flood is limited");

const raceA = await store.saveSponsorship({
  name: "Race A",
  organisation: "Raceclub A",
  email: "race-a@example.nl",
  message: "Eerste gelijktijdige boeking voor wielrennen in Amsterdam.",
  intent: "custom",
});
const raceB = await store.saveSponsorship({
  name: "Race B",
  organisation: "Raceclub B",
  email: "race-b@example.nl",
  message: "Tweede gelijktijdige boeking voor wielrennen in Amsterdam.",
  intent: "custom",
});
assert(raceA.ok && raceB.ok, "race requests");
if (raceA.ok && raceB.ok) {
  admin.agreeRequest(raceA.request.id, "standard");
  admin.agreeRequest(raceB.request.id, "standard");
  const argsFor = (requestId: string) => [
    "--experimental-strip-types",
    "--import",
    "./scripts/register-ts.mjs",
    "./scripts/sponsor-race.ts",
    requestId,
  ];
  const run = (requestId: string) =>
    new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(process.execPath, argsFor(requestId), {
        cwd: root,
        env: { ...process.env, WEERSPORT_DB: dbFile, NODE_ENV: "development" },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
  const [first, second] = await Promise.all([run(raceA.request.id), run(raceB.request.id)]);
  const codes = [first.code, second.code].sort();
  assert(codes[0] === 0 && codes[1] === 1, `race expected one winner, got ${first.code}/${second.code}\n${first.stderr}\n${second.stderr}\n${first.stdout}\n${second.stdout}`);
  assert(`${first.stderr}${second.stderr}`.includes("Overlappende"), "race loser mentions overlap");
}

const listed = admin.formatRequestList(admin.listRequests());
assert(listed.includes("old-1") && listed.includes("Loopatelier Ede"), "list shows old and new requests");

console.log("sponsor pilot checks ok");

const base = process.env.WEERSPORT_BASE_URL;
const serverDb = process.env.WEERSPORT_SERVER_DB;
if (!base) process.exit(0);
if (!serverDb) throw new Error("Live checks need WEERSPORT_SERVER_DB");

function amsterdamToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function runAdmin(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "--import", "./scripts/register-ts.mjs", "./scripts/sponsor-admin.ts", ...args],
      { cwd: root, env: { ...process.env, WEERSPORT_DB: serverDb, NODE_ENV: "development" } },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

const jar = new Map<string, string>();
function storeCookies(response: Response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}
async function request(pathname: string, options: RequestInit = {}) {
  const response = await fetch(new URL(pathname, base), {
    ...options,
    headers: { cookie: cookieHeader(), ...(options.headers ?? {}) },
    redirect: "manual",
  });
  storeCookies(response);
  return response;
}
async function post(pathname: string, body: unknown) {
  const response = await request(pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

const html = await (await request("/sponsoring")).text();
for (const token of [
  "Stel je campagne samen",
  "Verder naar contactgegevens",
  "Sponsoraanvraag versturen",
  "Bekijk volledige momentpagina",
  "Jouw WeerSport-moment",
  "10:00 – 12:00",
  "Fietswerk Amsterdam",
  "Fictieve partner",
  "Kies een sport",
]) {
  if (!html.includes(token)) throw new Error(`Live sponsoring HTML missing ${token}`);
}
for (const removed of ["Zo ziet een sporter je merk", "Je ochtendrun", "Loopatelier Ede"]) {
  if (html.includes(removed)) throw new Error(`Live sponsoring HTML still shows ${removed}`);
}
for (const banned of ["€99", "Vraag een pilot aan", "Bespreek maatwerk", "adsbygoogle"]) {
  if (html.includes(banned)) throw new Error(`Live sponsoring HTML still shows ${banned}`);
}
const reportRoute = await request("/api/sponsoring/report");
if (reportRoute.status !== 404) throw new Error("Public report route must stay closed");
const eventsGet = await request("/api/sponsoring/events");
if (eventsGet.status !== 404) throw new Error("Public event export must stay closed");

const legacyLive = await post("/api/sponsoring", {
  name: "Nora Noord",
  organisation: "Duinclub",
  email: `nora-live-${Date.now()}@example.nl`,
  message: "We willen een herkenbare vermelding bij fietsen, zonder invloed op de score.",
});
assert(legacyLive.status === 200 && legacyLive.data.ok && legacyLive.data.mailed === false, "live legacy request");
const badLive = await post("/api/sponsoring", {
  name: "A",
  organisation: "B",
  email: "nee",
  message: "kort",
  intent: "pilot",
  sportId: "hardlopen",
  placeId: "wpl-ede",
  placeLabel: "Ede",
});
assert(badLive.status === 400 && badLive.data.errors?.email, "live invalid request");

const placesLive = await (await request("/api/plaatsen?q=Ede")).json();
const ede = placesLive.places?.find((place: { label: string }) => place.label === "Ede");
assert(ede?.id, "PDOK Ede missing");
const pilotLive = await post("/api/sponsoring", {
  name: "Live Pilot",
  organisation: "Loopatelier Ede",
  email: `pilot-live-${Date.now()}@example.nl`,
  message: "We willen de hardlooppilot in Ede vier weken proberen.",
  intent: "pilot",
  sportId: "hardlopen",
  placeId: ede.id,
  placeLabel: "Ede",
  desiredStart: amsterdamToday(),
  status: "agreed",
  priceCents: 0,
});
assert(pilotLive.status === 200 && pilotLive.data.id, `live pilot failed ${pilotLive.status}`);
const customLive = await post("/api/sponsoring", {
  name: "Live Maat",
  organisation: "Seizoenclub",
  email: `maat-live-${Date.now()}@example.nl`,
  message: "Meerdere sporten en regio's voor een heel seizoen, graag een voorstel.",
  intent: "custom",
});
assert(customLive.status === 200 && customLive.data.id, "live custom request");

const show = await runAdmin(["show", pilotLive.data.id]);
assert(show.code === 0 && show.stdout.includes('"status": "received"'), show.stderr);
assert(!show.stdout.includes('"agreed_price_cents": 0'), "malicious price was stored");
const agree = await runAdmin(["agree", pilotLive.data.id, "--price", "9900"]);
assert(agree.code === 0, agree.stderr);
const schedule = await runAdmin([
  "schedule",
  pilotLive.data.id,
  "--start",
  amsterdamToday(),
  "--sport",
  "hardlopen",
  "--place",
  ede.id,
  "--partner",
  "Loopatelier Ede",
  "--headline",
  "Welke schoen past bij jouw rondje?",
  "--body",
  "Van asfalt tot heidepad. In onze winkel in Ede kun je verschillende hardloopschoenen passen en vergelijken.",
  "--url",
  "https://example.com/loopatelier-ede",
]);
assert(schedule.code === 0, `${schedule.stderr}\n${schedule.stdout}`);
const campaignId = schedule.stdout.match(/Campagne gepland: ([0-9a-f-]+)/)?.[1];
assert(campaignId, schedule.stdout);

const homeHtml = await (await request("/")).text();
assert(!homeHtml.includes("sponsor-placement"), "homepage has no sponsor");
const checkoutHtml = await (await request("/checkout/pro")).text();
assert(!checkoutHtml.includes("sponsor-placement"), "checkout has no sponsor");

const email = `sponsor-live-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", { sportId: "hardlopen", placeId: ede.id, placeLabel: "Ede", period: "Komende 48 uur" });
await post("/api/auth/registreren", { name: "Pilot Loper", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
assert(link, "verify link missing");
await request(link!);
const denied = await (await request("/moment")).text();
assert(!denied.includes("Loopatelier Ede"), "no sponsor without consent");
assert(!denied.includes("data-sponsor-state=\"show\""), "no shown sponsor without consent");
await post("/api/consent", { granted: true });
const moment = await (await request("/moment")).text();
assert(moment.includes("Welke schoen past bij jouw rondje?"), "sponsor under the advice");
assert(moment.includes("https://example.com/loopatelier-ede"), "destination is a direct link");
assert(!moment.includes("adsbygoogle"), "direct sponsor must not load AdSense");
assert(!moment.includes('href="/api/sponsoring/events'), "measurement is not a redirect");
const placementId = moment.match(/data-sponsor-placement="([^"]+)"/)?.[1];
const signature = moment.match(/data-sponsor-signature="([^"]+)"/)?.[1];
const sportId = moment.match(/data-sponsor-sport="([^"]+)"/)?.[1];
const placeId = moment.match(/data-sponsor-place="([^"]+)"/)?.[1];
assert(placementId && signature && sportId === "hardlopen" && placeId === ede.id, "placement token missing");
const eventBody = {
  placementId,
  signature,
  campaignId,
  sportId,
  placeId,
};
const seen = await post("/api/sponsoring/events", { ...eventBody, kind: "impression" });
assert(seen.status === 200 && seen.data.duplicate === false, "impression accepted");
const seenAgain = await post("/api/sponsoring/events", { ...eventBody, kind: "impression" });
assert(seenAgain.status === 200 && seenAgain.data.duplicate === true, "impression deduped");
const clicked = await post("/api/sponsoring/events", { ...eventBody, kind: "click" });
assert(clicked.status === 200 && clicked.data.ok, "click accepted");
const reportLive = await runAdmin(["report", campaignId!]);
assert(reportLive.stdout.includes("Zichtbare vertoningen: 1"), reportLive.stdout);
assert(reportLive.stdout.includes("Klikken: 1"), reportLive.stdout);
assert(reportLive.stdout.includes("niet mee in productierapporten"), "test report is marked");

await post("/api/zoeken", { sportId: "wielrennen", placeId: ede.id, placeLabel: "Ede", period: "Komende 48 uur" });
const otherMoment = await (await request("/moment")).text();
assert(!otherMoment.includes("Welke schoen past bij jouw rondje?"), "wrong sport hides the sponsor");
await post("/api/zoeken", { sportId: "schaatsen", placeId: ede.id, placeLabel: "Ede", period: "Komende 48 uur" });
const noScore = await (await request("/moment")).text();
assert(noScore.includes("NO_SCORE") && !noScore.includes("Welke schoen past bij jouw rondje?"), "missing score hides the sponsor");

const pause = await runAdmin(["pause", campaignId!]);
assert(pause.code === 0, pause.stderr);
await post("/api/zoeken", { sportId: "hardlopen", placeId: ede.id, placeLabel: "Ede", period: "Komende 48 uur" });
const pausedHtml = await (await request("/moment")).text();
assert(!pausedHtml.includes("Welke schoen past bij jouw rondje?"), "paused campaign is hidden");
assert(pausedHtml.includes('data-sponsor-state="eligible"'), "paused result can still count an eligible view");

await post("/api/consent", { granted: false });
const noConsentEvent = await post("/api/sponsoring/events", { ...eventBody, kind: "click" });
assert(noConsentEvent.status === 403, "events need consent");

console.log("sponsor pilot live checks ok");
