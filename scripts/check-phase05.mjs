import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/moments/store.ts",
  "lib/moments/types.ts",
  "components/account/account-shell.tsx",
  "components/account/save-actions.tsx",
  "app/account/momenten/page.tsx",
  "app/account/zoekopdrachten/page.tsx",
  "app/account/sporten/page.tsx",
  "app/account/voorkeuren/page.tsx",
  "app/api/moments/route.ts",
  "app/api/searches/route.ts",
  "app/api/favorites/route.ts",
  "app/api/preferences/route.ts",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const types = readFileSync(new URL("../lib/moments/types.ts", import.meta.url), "utf8");
if (!types.includes("booked: false") || !types.includes("consumed: 0")) {
  throw new Error("Phase 05 must keep save operations at zero consumption");
}

const store = readFileSync(new URL("../lib/moments/store.ts", import.meta.url), "utf8");
if (!store.includes("ageLabel") || !store.includes("planned_moments") || !store.includes("saved_searches")) {
  throw new Error("Moments store incomplete");
}

const momentView = readFileSync(new URL("../components/moment-view.tsx", import.meta.url), "utf8");
if (!momentView.includes("SaveActions") || !momentView.includes("geen live veiligheidsgarantie")) {
  throw new Error("Moment view must expose zero-cost save actions and safety disclaimer");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 05 static checks ok");
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
  return { status: response.status, data: await response.json() };
}
async function del(path, body) {
  const response = await request(path, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function put(path, body) {
  const response = await request(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((place) => place.label === "Amsterdam");
if (!city) throw new Error("Amsterdam missing");

const draft = {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
};

const anonymous = await post("/api/moments", draft);
if (anonymous.status !== 401) throw new Error("Anonymous moment save allowed");

const email = `fase05-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", draft);
await post("/api/auth/registreren", { name: "Fase Vijf", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!link) throw new Error("Missing verify link");
await request(link);

const start = new Date();
start.setHours(start.getHours() + 2, 0, 0, 0);
const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
const savedMoment = await post("/api/moments", {
  ...draft,
  windowLabel: "Beste moment · test",
  plannedStart: start.toISOString(),
  plannedEnd: end.toISOString(),
  lastSnapshotAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  lastScoreLabel: "91/100 · GOED",
  note: "Opgeslagen plan, geen live veiligheidsgarantie.",
});
if (savedMoment.status !== 200 || savedMoment.data.booked !== false || savedMoment.data.consumed !== 0) {
  throw new Error("Saving moment must cost zero");
}
if (!savedMoment.data.moment?.id) throw new Error("Moment id missing");

const savedSearch = await post("/api/searches", draft);
if (savedSearch.status !== 200 || savedSearch.data.booked !== false || savedSearch.data.consumed !== 0) {
  throw new Error("Saving search must cost zero");
}

const favorites = await post("/api/favorites", { sportId: "wielrennen", favorite: true });
if (favorites.status !== 200 || favorites.data.booked !== false || favorites.data.consumed !== 0) {
  throw new Error("Favorite save must cost zero");
}

const prefs = await post("/api/preferences", { weekendFocus: true, uvReminders: false, savePlansByDefault: true });
if (prefs.status !== 200 || prefs.data.booked !== false || prefs.data.consumed !== 0) {
  throw new Error("Preferences save must cost zero");
}

const opened = await put("/api/searches", { id: savedSearch.data.search.id });
if (opened.status !== 200 || opened.data.booked !== false || opened.data.consumed !== 0) {
  throw new Error("Opening saved search must cost zero");
}
if (opened.data.next !== "/#planner") throw new Error("Opening search should restore planner, not book analysis");

const momentsPage = await request("/account/momenten");
const momentsHtml = await momentsPage.text();
if (!momentsHtml.includes("geen live") && !momentsHtml.includes("veiligheidsgarantie")) {
  throw new Error("Moments page missing safety disclaimer");
}
if (!momentsHtml.includes("uur geleden") && !momentsHtml.includes("Analyseleeftijd") && !momentsHtml.includes("geleden")) {
  throw new Error("Moments page should show analysis age");
}

const searchesPage = await (await request("/account/zoekopdrachten")).text();
if (!searchesPage.includes("Opgeslagen") || !searchesPage.includes("Wielrennen")) {
  throw new Error("Saved searches page incomplete");
}

await del("/api/moments", { id: savedMoment.data.moment.id });
await del("/api/searches", { id: savedSearch.data.search.id });

console.log("phase 05 route checks ok");
