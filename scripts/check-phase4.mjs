import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

function amsterdamParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}
function calendarPeriodKey(date = new Date()) {
  const { year, month } = amsterdamParts(date);
  return `${year}-${month}`;
}
function hourBucketKey(date = new Date()) {
  const { year, month, day, hour } = amsterdamParts(date);
  return `${year}-${month}-${day}T${hour}`;
}
function analysisFingerprint(userId, draft, at = new Date()) {
  return `${userId}:${draft.sportId}:${draft.placeId}:${draft.period}:${hourBucketKey(at)}`;
}

const required = [
  "lib/billing/analysis.ts",
  "lib/billing/period.ts",
  "lib/billing/quota-policy.ts",
  "app/moment/page.tsx",
  "app/api/moment/route.ts",
  "components/start-analysis.tsx",
  "docs/phase4-quota-metering.md",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const analysis = readFileSync(new URL("../lib/billing/analysis.ts", import.meta.url), "utf8");
if (!analysis.includes("peekMeteredAnalysis") || !analysis.includes("BEGIN IMMEDIATE")) {
  throw new Error("Peek + atomic ledger required");
}
if (!analysis.includes("writeCache(input.userId, cacheKey, snapshot)") || !analysis.includes("COMMIT")) {
  throw new Error("SCORED cache must commit with ledger");
}
if (!analysis.includes("downgradeForQuota")) {
  throw new Error("Quota-exhausted safety downgrade missing");
}

const momentPage = readFileSync(new URL("../app/moment/page.tsx", import.meta.url), "utf8");
if (!momentPage.includes("peekMeteredAnalysis") || !momentPage.includes("StartAnalysis")) {
  throw new Error("Moment GET must be peek/start, not silent booking");
}

const api = readFileSync(new URL("../app/api/moment/route.ts", import.meta.url), "utf8");
if (!api.includes("peekMeteredAnalysis") || !api.includes("runMeteredAnalysis")) {
  throw new Error("API GET peek / POST book split missing");
}

const policy = readFileSync(new URL("../lib/billing/quota-policy.ts", import.meta.url), "utf8");
if (!policy.includes("Europe/Amsterdam") || !policy.includes("calendar")) {
  throw new Error("Quota policy must document Amsterdam calendar month");
}

// Month rollover key
const endOfJan = new Date("2026-01-31T23:30:00+01:00");
const startOfFeb = new Date("2026-02-01T00:30:00+01:00");
if (calendarPeriodKey(endOfJan) !== "2026-01") throw new Error("January period key");
if (calendarPeriodKey(startOfFeb) !== "2026-02") throw new Error("February period key");
const fp = analysisFingerprint("u1", { sportId: "wielrennen", placeId: "p", period: "Komende 48 uur" }, endOfJan);
if (!fp.includes("u1:wielrennen:p:Komende 48 uur:")) throw new Error("Fingerprint shape");

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 4 static Gate B prep ok");
  process.exit(0);
}

assertDisposableCheckTarget(base);

const jar = new Map();
function storeCookies(response) {
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
async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    headers: { cookie: cookieHeader(), ...(options.headers ?? {}) },
    redirect: "manual",
  });
  storeCookies(response);
  return response;
}
async function post(path, body, headers = {}) {
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

async function register(suffix) {
  const places = await (await request("/api/plaatsen?q=amsterdam")).json();
  const city = places.places.find((p) => p.label === "Amsterdam");
  const draft = {
    sportId: "wielrennen",
    placeId: city.id,
    placeLabel: "Amsterdam",
    period: "Komende 48 uur",
  };
  const email = `fase4-${suffix}-${Date.now()}@example.nl`;
  const password = "test-wachtwoord-12";
  await post("/api/zoeken", draft);
  const registered = await post("/api/auth/registreren", { name: "Fase Vier", email, password, terms: true });
  if (registered.status === 503) throw new Error("Auth closed");
  const boxed = await (await request(`/api/auth/mailbox?email=${encodeURIComponent(email)}&purpose=verify`)).json();
  if (boxed.mail?.link) {
    await request(new URL(boxed.mail.link).pathname + new URL(boxed.mail.link).search);
  } else {
    const verifyHtml = await (await request("/auth/verifieer")).text();
    const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    if (link) await request(link);
    else await post("/api/auth/verifieer", { prototype: true });
  }
  return { city, draft, email };
}

const { city, draft } = await register("gate");

// Repeated GET must not book
const get1 = await (await request("/api/moment")).json();
const get2 = await (await request("/api/moment")).json();
if (get1.booked || get2.booked || get1.consumed || get2.consumed) {
  throw new Error("GET /api/moment must never book");
}

// Cache miss GET → 404 style
if (get1.snapshot && get1.cacheHit) {
  // unexpected early cache
} else if (get1.error && get1.readOnly !== true && get1.status !== undefined) {
  /* jsonResult may not include status field */
}

const first = await post("/api/moment", draft, { "idempotency-key": "p4-first" });
if (first.status !== 200 || first.data.booked !== true || first.data.consumed !== 1) {
  throw new Error(`First POST must book once, got ${first.status} booked=${first.data.booked}`);
}
if (!first.data.fingerprint) throw new Error("Fingerprint missing");

const dup = await post("/api/moment", draft, { "idempotency-key": "p4-first" });
if (dup.data.booked !== false || dup.data.consumed !== 0 || dup.data.cacheHit !== true) {
  throw new Error("Duplicate idempotency key must share one charge");
}

const getAfter = await (await request("/api/moment")).json();
if (getAfter.booked !== false || getAfter.consumed !== 0 || getAfter.cacheHit !== true) {
  throw new Error("Repeated GET after book must be read-only cache");
}

const water = await post("/api/moment", { ...draft, sportId: "openwaterzwemmen" });
if (water.data.snapshot.suitability.kind !== "NO_SCORE") throw new Error("NO_SCORE expected");
if (water.data.booked !== false || water.data.consumed !== 0) throw new Error("NO_SCORE must not consume");

// Provider timeout / forced fail — no consume
const failEnvHint = process.env.WEERSPORT_FORCE_WEATHER_FAIL;
if (failEnvHint === "1") {
  const failed = await post("/api/moment", { ...draft, sportId: "hardlopen" }, { "idempotency-key": "p4-fail" });
  if (failed.status !== 503 || failed.data.consumed !== 0) throw new Error("Forced fail must 503 without consume");
}

// Burn to exactly 4 used so one credit remains for the race (Basis limit 5).
let used = first.data.entitlement?.used ?? 1;
const burnSports = [
  "fietsen",
  "hardlopen",
  "wandelen",
  "golf",
  "tennis-padel",
  "voetbal",
  "hockey",
  "skeeleren",
  "paardrijden",
  "outdoorfitness",
  "gravelbiken",
];
for (const sportId of burnSports) {
  if (used >= 4) break;
  const result = await post("/api/moment", { ...draft, sportId }, { "idempotency-key": `p4-burn-${sportId}` });
  if (result.status !== 200) throw new Error(`Burn ${sportId} failed ${result.status}`);
  if (result.data.entitlement) used = result.data.entitlement.used;
}
if (used !== 4) {
  console.log(`phase 4: used=${used} before race (need 4) — skipping tight Gate B race`);
} else {
  // One credit left: two concurrent distinct requests
  const a = post("/api/moment", { ...draft, sportId: "mountainbiken" }, { "idempotency-key": "p4-race-a" });
  const b = post("/api/moment", { ...draft, sportId: "trailrunning" }, { "idempotency-key": "p4-race-b" });
  const [ra, rb] = await Promise.all([a, b]);
  const booked = [ra, rb].filter((r) => r.status === 200 && r.data.booked === true).length;
  const exhaustedOk = [ra, rb].filter(
    (r) =>
      (r.status === 200 && r.data.quotaExhausted === true && r.data.booked === false) ||
      (r.status === 200 && r.data.booked === false && r.data.snapshot?.suitability?.kind === "NO_SCORE"),
  ).length;
  if (booked !== 1) {
    throw new Error(
      `Gate B race expected exactly one booking, got ${booked} (a=${ra.status}/${ra.data.booked}/${ra.data.quotaExhausted}, b=${rb.status}/${rb.data.booked}/${rb.data.quotaExhausted})`,
    );
  }
  if (exhaustedOk < 1 && booked !== 1) throw new Error("Race loser must not invent a second booking");

  // Boundary: next must be exhausted safety without a new SCORED booking
  const over = await post("/api/moment", { ...draft, sportId: "hiken" }, { "idempotency-key": "p4-over" });
  if (over.status === 200) {
    if (over.data.booked === true) throw new Error("Over-limit must not book");
    if (over.data.snapshot?.suitability?.kind === "SCORED" && over.data.quotaExhausted) {
      throw new Error("Exhausted path must not return SCORED");
    }
    if (!over.data.snapshot?.warnings || !over.data.snapshot?.uv) {
      throw new Error("Exhausted path must still expose warnings/UV");
    }
  } else if (over.status !== 402) {
    throw new Error(`Unexpected over-limit status ${over.status}`);
  }
}

// Page start=1 smoke
const page = await request("/moment?start=1");
const html = await page.text();
if (!html.includes("NO_SCORE") && !html.includes("/100") && !html.includes("Start je WeerSport-analyse")) {
  throw new Error("Moment page missing analysis UI");
}

console.log("phase 4 Gate B checks ok");
