import { readFileSync, readdirSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/data/contracts.ts",
  "lib/data/sources.ts",
  "lib/data/sport-dependencies.ts",
  "lib/data/fixtures.ts",
  "lib/data/freshness.ts",
  "lib/data/adapters/knmi.ts",
  "lib/data/adapters/rws.ts",
  "lib/data/adapters/zwemwater.ts",
  "lib/data/snapshot.ts",
  "app/api/sources/status/route.ts",
  "docs/phase2-source-safety.md",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const fixtures = readdirSync(new URL("../fixtures/phase2", import.meta.url)).filter((f) => f.endsWith(".json"));
for (const name of [
  "knmi-active.json",
  "knmi-all-clear.json",
  "knmi-stale.json",
  "knmi-failed.json",
  "knmi-partial.json",
  "water-ready-town.json",
  "swim-ready.json",
  "ice-missing.json",
]) {
  if (!fixtures.includes(name)) throw new Error(`Missing fixture ${name}`);
}

const knmi = readFileSync(new URL("../lib/data/adapters/knmi.ts", import.meta.url), "utf8");
if (knmi.includes("fake warning")) throw new Error("KNMI adapter must not invent warnings");
if (!knmi.includes("NOT_LINKED") || !knmi.includes("fixturesEnabled")) {
  throw new Error("KNMI adapter must support NOT_LINKED and fixtures");
}

const deps = readFileSync(new URL("../lib/data/sport-dependencies.ts", import.meta.url), "utf8");
if (!deps.includes("SPORT_DEPENDENCY_MATRIX") || !deps.includes("24")) {
  throw new Error("Sport dependency matrix missing");
}

const engine = readFileSync(new URL("../lib/scoring/engine.ts", import.meta.url), "utf8");
if (!engine.includes("siteSpecificCoverage") || !engine.includes("woonplaatscentroïde")) {
  throw new Error("Scoring must enforce town-centroid coverage NO_SCORE");
}

const sourcesApi = readFileSync(new URL("../app/api/sources/status/route.ts", import.meta.url), "utf8");
if (!sourcesApi.includes("independentOfDatabase")) {
  throw new Error("Sources status must stay independent of database health");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 2 static checks ok");
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
async function post(path, body) {
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

const status = await (await request("/api/sources/status")).json();
if (!status.independentOfDatabase) throw new Error("sources status must declare DB independence");
if (status.sportDependencies?.rows !== 24) throw new Error("Expected 24 dependency rows");
if (!Array.isArray(status.providers) || status.providers.length < 3) {
  throw new Error("Provider freshness list missing");
}
if (!status.rights?.some((r) => r.sourceId === "knmi-warnings")) {
  throw new Error("KNMI rights register missing");
}

const health = await (await request("/api/health")).json();
if (health.checks?.sourcesStatusPath !== "/api/sources/status") {
  throw new Error("Health must point at sources status path");
}

if (process.env.WEERSPORT_SOURCE_FIXTURES !== "1") {
  console.log("phase 2 sources/status ok (set WEERSPORT_SOURCE_FIXTURES=1 on server for fixture Gate evidence)");
  process.exit(0);
}

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((p) => p.label === "Amsterdam");
if (!city) throw new Error("Amsterdam missing");

const email = `fase2-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});

// Prefer inbox/mailbox registration depending on server mode.
const registered = await post("/api/auth/registreren", {
  name: "Fase Twee",
  email,
  password,
  terms: true,
});
if (registered.status === 503) {
  console.log("phase 2: auth closed on target — sources matrix evidence only");
  process.exit(0);
}
if (registered.status !== 200) throw new Error(`Register failed ${registered.status}`);

// Verify via mailbox API (inbox log) or prototype mailbox cookie page.
const boxed = await (await request(`/api/auth/mailbox?email=${encodeURIComponent(email)}&purpose=verify`)).json();
if (boxed.mail?.link) {
  const path = new URL(boxed.mail.link).pathname + new URL(boxed.mail.link).search;
  await request(path);
} else {
  const verifyHtml = await (await request("/auth/verifieer")).text();
  const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (link) await request(link);
  else {
    // mailbox prototype button path
    await post("/api/auth/verifieer", { prototype: true });
  }
}

const land = await post("/api/moment", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (land.status !== 200) throw new Error(`Land moment failed ${land.status}`);
if (!land.data.snapshot?.warnings?.value?.lifecycle) {
  throw new Error("Warnings must expose lifecycle under fixtures");
}
if (land.data.snapshot.coverage?.kind !== "town-centroid") {
  throw new Error("Coverage must report town-centroid");
}

const water = await post("/api/moment", {
  sportId: "openwaterzwemmen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (water.data.snapshot.suitability.kind !== "NO_SCORE") {
  throw new Error("Openwater must NO_SCORE on town centroid even with water fixtures");
}
const reason = (water.data.snapshot.suitability.reason || "").toLowerCase();
if (!reason.includes("centroïde") && !reason.includes("centroid") && !reason.includes("meer")) {
  throw new Error(`Coverage NO_SCORE reason unclear: ${water.data.snapshot.suitability.reason}`);
}

const ice = await post("/api/moment", {
  sportId: "schaatsen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (ice.data.snapshot.suitability.kind !== "NO_SCORE") throw new Error("Ice must NO_SCORE");

const exhaustedSafety = water.data.snapshot.warnings && water.data.snapshot.uv;
if (!exhaustedSafety) throw new Error("Safety/UV must remain present on NO_SCORE snapshots");

console.log("phase 2 Gate source/safety fixture checks ok");
