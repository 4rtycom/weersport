import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/ads/policy.ts",
  "lib/ads/server.ts",
  "components/ads/ad-slot.tsx",
  "components/consent-banner.tsx",
  "components/ads/ads-host.tsx",
  "app/api/consent/route.ts",
  "components/consent-root.tsx",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const policy = readFileSync(new URL("../lib/ads/policy.ts", import.meta.url), "utf8");
for (const token of [
  "HOME",
  "AUTH",
  "CHECKOUT",
  "PRO",
  "NO_SCORE",
  "NO_CONSENT",
  "BASIS_MOMENT",
  "CONSENT_COOKIE",
  "ws_consent_cookies",
  "cookies-v1",
]) {
  if (!policy.includes(token)) throw new Error(`Policy missing ${token}`);
}

const banner = readFileSync(new URL("../components/consent-banner.tsx", import.meta.url), "utf8");
if (banner.includes("Accepteer advertenties") || banner.includes("Advertenties alleen met jouw toestemming")) {
  throw new Error("CMP must be cookie consent, not an ads-accept banner");
}
if (!banner.includes("Accepteer cookies") || !banner.includes("Cookies alleen met jouw toestemming")) {
  throw new Error("Cookie CMP copy missing");
}

const slot = readFileSync(new URL("../components/ads/ad-slot.tsx", import.meta.url), "utf8");
if (!slot.includes("no-fill") || !slot.includes("AD_SLOT_MIN_HEIGHT_PX") || !slot.includes("minHeight")) {
  throw new Error("Ad slot must reserve height and handle no-fill");
}

const momentView = readFileSync(new URL("../components/moment-view.tsx", import.meta.url), "utf8");
if (!momentView.includes("AdsHost")) throw new Error("Moment view missing AdsHost after content");

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
if (!layout.includes("ConsentRoot")) throw new Error("Root layout missing CMP banner");

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 07 static checks ok");
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

const home = await (await request("/")).text();
if (home.includes("ad-slot-sandbox") || home.includes("adsbygoogle")) {
  throw new Error("Homepage must not render ad inventory");
}
if (!home.includes("Cookies alleen met jouw toestemming") && !home.includes("consent-banner")) {
  // banner may be absent if prior cookie exists in other tests; fresh jar should show it
  throw new Error("Cookie CMP banner should appear for undecided visitors");
}

const login = await (await request("/auth/inloggen")).text();
if (login.includes("ad-slot-sandbox") || login.includes('data-ad-state="filled"')) {
  throw new Error("Auth pages must not show ads");
}

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((place) => place.label === "Amsterdam");
const draft = {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
};
const email = `fase07-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", draft);
await post("/api/auth/registreren", { name: "Fase Zeven", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!link) throw new Error("Missing verify link");
await request(link);

await post("/api/moment", draft, { "idempotency-key": `ads-before-${email}` });
const beforeConsent = await (await request("/moment")).text();
if (!beforeConsent.includes('data-ad-state="blocked"')) {
  throw new Error("SCORED moment without cookie consent must block ads");
}
if (beforeConsent.includes("Sandbox-advertentie")) {
  throw new Error("Ads must not fill before cookie consent");
}

await post("/api/consent", { granted: true });
const afterConsent = await (await request("/moment")).text();
if (!afterConsent.includes("ad-slot")) {
  throw new Error("Cookie-consented Basis SCORED moment must mount ad slot");
}
if (afterConsent.includes('data-ad-state="blocked"')) {
  throw new Error("Cookie-consented Basis SCORED should allow ad slot");
}

const noScoreDraft = { ...draft, sportId: "schaatsen" };
await post("/api/zoeken", noScoreDraft);
await post("/api/moment", noScoreDraft, { "idempotency-key": `ads-noscore-${email}` });
const noScorePage = await (await request("/moment")).text();
if (!noScorePage.includes("NO_SCORE")) throw new Error("Expected NO_SCORE page");
if (noScorePage.includes("Advertentie laden") || noScorePage.includes("Sandbox-advertentie")) {
  throw new Error("NO_SCORE must not request/show ads");
}
if (!noScorePage.includes('data-ad-state="blocked"')) {
  throw new Error("NO_SCORE exclusion missing");
}

const checkout = await post("/api/billing/checkout", { consent: true, idempotencyKey: `ads-${email}` });
await post("/api/billing/simulate", { checkoutId: checkout.data.checkout.id, status: "paid" });
await post("/api/zoeken", draft);
await post("/api/moment", draft, { "idempotency-key": `ads-pro-${email}` });
const proMoment = await (await request("/moment")).text();
if (proMoment.includes("Advertentie laden") || proMoment.includes("Sandbox-advertentie")) {
  throw new Error("Pro must be ad-free");
}
if (!proMoment.includes('data-ad-state="blocked"')) {
  throw new Error("Pro exclusion not visible");
}

const checkoutPage = await (await request("/checkout/pro")).text();
if (checkoutPage.includes("ad-slot-sandbox") || checkoutPage.includes("adsbygoogle")) {
  throw new Error("Checkout must not include ads");
}

console.log("phase 07 route checks ok");
