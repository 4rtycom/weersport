import { readFileSync } from "node:fs";

const required = [
  "lib/scoring/profiles.ts",
  "lib/scoring/engine.ts",
  "components/score-curve.tsx",
  "components/moment-view.tsx",
  "lib/data/snapshot.ts",
  "lib/data/types.ts",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const types = readFileSync(new URL("../lib/data/types.ts", import.meta.url), "utf8");
if (!types.includes('kind: "SCORED"') || !types.includes('kind: "NO_SCORE"')) {
  throw new Error("SuitabilityOutcome must include SCORED and NO_SCORE");
}
if (types.includes("PENDING_PHASE_04")) {
  throw new Error("PENDING_PHASE_04 must be retired after phase 04 scoring");
}

const profilesSource = readFileSync(new URL("../lib/scoring/profiles.ts", import.meta.url), "utf8");
const sportsSource = readFileSync(new URL("../lib/sports.ts", import.meta.url), "utf8");
const sportBlock = sportsSource.slice(
  sportsSource.indexOf("export const sports"),
  sportsSource.indexOf("export const periods"),
);
const ids = [...sportBlock.matchAll(/{\s*id: "([^"]+)"/g)].map((match) => match[1]);
if (ids.length !== 24) throw new Error(`Expected 24 sports, found ${ids.length}`);
for (const id of ids) {
  if (!profilesSource.includes(`sportId: "${id}"`)) {
    throw new Error(`Missing score profile for ${id}`);
  }
}

const engine = readFileSync(new URL("../lib/scoring/engine.ts", import.meta.url), "utf8");
if (!engine.includes("ICE_CRITICAL_SPORTS") || !engine.includes("WATER_CRITICAL_SPORTS")) {
  throw new Error("Safety gates missing from scoring engine");
}
if (!engine.includes("Natuurijs")) {
  throw new Error("Ice safety copy missing");
}

const moment = readFileSync(new URL("../components/moment-view.tsx", import.meta.url), "utf8");
if (!moment.includes("ScoreCurve") || !moment.includes("score-badge")) {
  throw new Error("Moment view missing scored UI");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 04 static checks ok");
  process.exit(0);
}

const jar = new Map();
function store(response) {
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
  store(response);
  return response;
}
async function post(path, body) {
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((place) => place.label === "Amsterdam");
if (!city) throw new Error("Amsterdam missing");

const email = `fase04-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
await post("/api/auth/registreren", { name: "Fase Vier", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!link) throw new Error("Missing verify link");
await request(link);

// Live route checks sample land sports only; Basis quota (phase 06) is 5/month.
const landSports = ["fietsen", "wielrennen", "hardlopen", "wandelen"];
const waterSports = [
  "zeilen",
  "windsurfen",
  "kitesurfen",
  "surfen",
  "suppen",
  "kajakken",
  "roeien",
  "openwaterzwemmen",
];

const first = await post("/api/moment", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (first.status !== 200) throw new Error("Wielrennen moment failed");
if (first.data.snapshot.suitability.kind !== "SCORED") {
  throw new Error(`Wielrennen expected SCORED, got ${first.data.snapshot.suitability.kind}`);
}
const scored = first.data.snapshot.suitability;
if (!Array.isArray(scored.hourly) || scored.hourly.length < 2) {
  throw new Error("Hourly curve missing");
}
if (!scored.peakWindow?.peakTime || scored.peakWindow.peakScore == null) {
  throw new Error("Peak window missing");
}
const peakPoint = scored.hourly.find((point) => point.time === scored.peakWindow.peakTime);
if (!peakPoint || peakPoint.score !== scored.peakWindow.peakScore) {
  throw new Error("Peak score inconsistent with hourly curve");
}
if (!["GOED", "MATIG", "SLECHT"].includes(scored.badge)) {
  throw new Error("Badge missing");
}
if (!scored.tooltip || !scored.modelVersion.includes("weersport-score")) {
  throw new Error("Tooltip/model version missing");
}

for (const sportId of landSports) {
  const result = await post("/api/moment", {
    sportId,
    placeId: city.id,
    placeLabel: "Amsterdam",
    period: "Komende 48 uur",
  });
  if (result.data.snapshot.suitability.kind !== "SCORED") {
    throw new Error(`${sportId} should score`);
  }
  const hours = result.data.snapshot.suitability.hourly;
  const peak = result.data.snapshot.suitability.peakWindow;
  const match = hours.find((point) => point.time === peak.peakTime);
  if (!match || match.score !== peak.peakScore) {
    throw new Error(`${sportId} peak inconsistent with curve`);
  }
}

for (const sportId of waterSports) {
  const result = await post("/api/moment", {
    sportId,
    placeId: city.id,
    placeLabel: "Amsterdam",
    period: "Komende 48 uur",
  });
  if (result.data.snapshot.suitability.kind !== "NO_SCORE") {
    throw new Error(`${sportId} must NO_SCORE without water link`);
  }
}

const ice = await post("/api/moment", {
  sportId: "schaatsen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (ice.data.snapshot.suitability.kind !== "NO_SCORE") {
  throw new Error("Schaatsen must NO_SCORE");
}
if (!ice.data.snapshot.suitability.reason.toLowerCase().includes("natuurijs")) {
  throw new Error("Schaatsen reason must mention natuurijs");
}

const page = await request("/moment");
const html = await page.text();
if (!html.includes("/100") && !html.includes("NO_SCORE")) {
  throw new Error("Moment page missing score or NO_SCORE");
}
if (!html.includes("Beste moment") && !html.includes("NO_SCORE")) {
  throw new Error("Moment page missing peak label");
}

console.log("phase 04 route checks ok");
