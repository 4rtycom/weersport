import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/data/adapters/open-meteo.ts",
  "lib/scoring/engine.ts",
  "lib/scoring/time.ts",
  "lib/scoring/windows.ts",
  "lib/scoring/profiles.ts",
  "docs/phase3-accurate-recommendations.md",
  "scripts/phase3-invariants.mjs",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const openMeteo = readFileSync(new URL("../lib/data/adapters/open-meteo.ts", import.meta.url), "utf8");
if (!openMeteo.includes("UTC") || !openMeteo.includes("toUtcIso") || !openMeteo.includes("forecast_days")) {
  throw new Error("Open-Meteo must request UTC, normalize instants, and fetch multi-day forecast");
}
if (!openMeteo.includes("timeline") || !openMeteo.includes("modelPublishedAt")) {
  throw new Error("Open-Meteo must expose timeline metadata");
}

const engine = readFileSync(new URL("../lib/scoring/engine.ts", import.meta.url), "utf8");
if (engine.includes("upcoming.length > 0 ? upcoming : hours")) {
  throw new Error("Expired-hour fallback must be removed");
}
if (!engine.includes("rankTwoHourWindows") || !engine.includes("selectFutureHours")) {
  throw new Error("Engine must use Phase 3 window helpers");
}
if (!engine.includes("recommendedWindow") || !engine.includes("peakHour") || !engine.includes("now:")) {
  throw new Error("Engine must distinguish nu, peak hour and recommended window");
}
if (engine.includes("uvIndex ?? 0")) {
  throw new Error("Missing UV must stay unknown (not coerced to 0)");
}

const profiles = readFileSync(new URL("../lib/scoring/profiles.ts", import.meta.url), "utf8");
if (!profiles.includes("weersport-score-v0.2-phase3")) {
  throw new Error("Score model version must be pinned for Phase 3");
}

const invariants = spawnSync(process.execPath, [new URL("./phase3-invariants.mjs", import.meta.url).pathname], {
  encoding: "utf8",
});
if (invariants.status !== 0) {
  process.stderr.write(invariants.stderr || invariants.stdout || "phase3 invariants failed\n");
  process.exit(invariants.status ?? 1);
}
process.stdout.write(invariants.stdout);

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 3 static + invariant checks ok");
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

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((p) => p.label === "Amsterdam");
if (!city) throw new Error("Amsterdam missing");

const email = `fase3-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
const registered = await post("/api/auth/registreren", { name: "Fase Drie", email, password, terms: true });
if (registered.status === 503) {
  console.log("phase 3 live skipped (auth closed) — invariants already passed");
  process.exit(0);
}
if (registered.status !== 200) throw new Error(`Register failed ${registered.status}`);

const boxed = await (await request(`/api/auth/mailbox?email=${encodeURIComponent(email)}&purpose=verify`)).json();
if (boxed.mail?.link) {
  const path = new URL(boxed.mail.link).pathname + new URL(boxed.mail.link).search;
  await request(path);
} else {
  const verifyHtml = await (await request("/auth/verifieer")).text();
  const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (link) await request(link);
  else await post("/api/auth/verifieer", { prototype: true });
}

const land = await post("/api/moment", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (land.status !== 200) throw new Error(`Moment failed ${land.status}`);
const snap = land.data.snapshot;
if (snap.suitability.kind === "SCORED") {
  if (!snap.suitability.now || !snap.suitability.peakHour || !snap.suitability.recommendedWindow) {
    throw new Error("Live scored snapshot must expose nu / piek-uur / venster");
  }
  if (!snap.weather.value?.timeline?.receivedAt || !snap.weather.value?.timeline?.forecastValidFrom) {
    throw new Error("Live weather must expose timeline");
  }
  if (!String(snap.weather.value.hours?.[0]?.time ?? "").includes("Z")) {
    throw new Error("Live hours must be UTC ISO");
  }
}

console.log("phase 3 live smoke ok");
