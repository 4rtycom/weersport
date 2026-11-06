import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/data/types.ts",
  "lib/data/snapshot.ts",
  "lib/data/adapters/open-meteo.ts",
  "lib/data/adapters/knmi.ts",
  "lib/data/adapters/rws.ts",
  "lib/data/adapters/zwemwater.ts",
  "app/moment/page.tsx",
  "app/api/moment/route.ts",
  "public/uv/sun.svg",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const knmi = readFileSync(new URL("../lib/data/adapters/knmi.ts", import.meta.url), "utf8");
if (knmi.includes("code geel") || knmi.includes("fake warning")) {
  throw new Error("KNMI adapter must not invent warnings");
}

const ice =
  readFileSync(new URL("../lib/data/snapshot.ts", import.meta.url), "utf8") +
  readFileSync(new URL("../lib/scoring/engine.ts", import.meta.url), "utf8");
if (!ice.includes("Natuurijs") || !ice.includes("NO_SCORE")) {
  throw new Error("Ice/water NO_SCORE rules missing");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 03 static checks ok");
  process.exit(0);
}

assertDisposableCheckTarget(base);

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

const anonymous = await post("/api/moment", {});
if (anonymous.status !== 401) throw new Error("Anonymous moment access was allowed");

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((place) => place.label === "Amsterdam");
if (!city) throw new Error("Amsterdam missing");

const email = `fase03-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", {
  sportId: "openwaterzwemmen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
await post("/api/auth/registreren", { name: "Fase Drie", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!link) throw new Error("Missing verify link");
await request(link);

const water = await post("/api/moment", {
  sportId: "openwaterzwemmen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (water.status !== 200 || water.data.booked !== false) throw new Error("Water moment booked an analysis");
if (water.data.snapshot.suitability.kind !== "NO_SCORE") throw new Error("Openwater should NO_SCORE without water data");
if (water.data.snapshot.warnings.status !== "NOT_LINKED") throw new Error("KNMI must stay unlinked without inventing alerts");
if (water.data.snapshot.weather.demo) throw new Error("Open-Meteo weather was marked demo while live");

const iceMoment = await post("/api/moment", {
  sportId: "schaatsen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (iceMoment.data.snapshot.suitability.kind !== "NO_SCORE") {
  throw new Error("Schaatsen must NO_SCORE without ice data");
}
if (!iceMoment.data.snapshot.suitability.reason.toLowerCase().includes("natuurijs")) {
  throw new Error("Schaatsen reason must mention natuurijs");
}

const land = await post("/api/moment", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (!["PENDING_PHASE_04", "SCORED"].includes(land.data.snapshot.suitability.kind)) {
  throw new Error("Land sport should expose PENDING_PHASE_04 or SCORED suitability");
}
if (land.data.snapshot.weather.status !== "READY" || land.data.snapshot.weather.value?.temperatureC === null) {
  throw new Error("Live weather missing for land sport");
}
if (land.data.snapshot.uv.status === "READY" && land.data.snapshot.uv.value?.index === null) {
  throw new Error("UV READY without index");
}

const page = await request("/moment");
const html = await page.text();
if (!html.includes("NO_SCORE") && !html.includes("Nog geen gevalideerde score") && !html.includes("Sportgeschiktheid")) {
  throw new Error("Moment page missing suitability status");
}
if (html.toLowerCase().includes("fictieve weerdata · niet live") && land.data.snapshot.weather.status === "READY") {
  throw new Error("Live weather page still claims fully fictional weather badge");
}

console.log("phase 03 route checks ok");
