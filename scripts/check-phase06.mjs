import { readFileSync } from "node:fs";

const required = [
  "lib/billing/analysis.ts",
  "lib/billing/mollie.ts",
  "lib/billing/entitlement.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/webhook/route.ts",
  "app/api/billing/simulate/route.ts",
  "app/api/billing/cancel/route.ts",
  "app/account/abonnement/page.tsx",
  "app/checkout/pro/page.tsx",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const analysis = readFileSync(new URL("../lib/billing/analysis.ts", import.meta.url), "utf8");
if (!analysis.includes("BEGIN IMMEDIATE") || !analysis.includes("idempotency")) {
  throw new Error("Quota ledger must be atomic and idempotent");
}
const buildAt = analysis.indexOf("await buildForecastSnapshot");
const freeAt = analysis.indexOf("if (!snapshotConsumesQuota(snapshot))");
const blockAt = analysis.indexOf("quotaBlocksSnapshot(entitlement.remaining, true)");
if (buildAt < 0 || freeAt < buildAt || blockAt < freeAt) {
  throw new Error("A free NO_SCORE must be built and returned before a used quota can block the request");
}

const mollie = readFileSync(new URL("../lib/billing/mollie.ts", import.meta.url), "utf8");
const constants = readFileSync(new URL("../lib/billing/constants.ts", import.meta.url), "utf8");
if (!mollie.includes("verifyAndApplyPayment") || !constants.includes("Browserredirect is geen betaalbewijs")) {
  throw new Error("Mollie verification contract missing");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 06 static checks ok");
  process.exit(0);
}

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

const email = `fase06-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", draft);
await post("/api/auth/registreren", { name: "Fase Zes", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!link) throw new Error("Missing verify link");
await request(link);

const first = await post("/api/moment", draft, { "idempotency-key": "phase06-first" });
if (first.status !== 200) throw new Error(`First moment failed: ${first.status}`);
if (first.data.snapshot.suitability.kind !== "NO_SCORE") throw new Error("Unreleased sport must NO_SCORE");
if (first.data.booked !== false || first.data.consumed !== 0) {
  throw new Error("NO_SCORE must not book an analysis");
}

const repeat = await post("/api/moment", draft, { "idempotency-key": "phase06-first" });
if (repeat.data.booked !== false || repeat.data.consumed !== 0 || repeat.data.cacheHit !== true) {
  throw new Error("Idempotent/cached repeat must not double-charge");
}

const water = await post("/api/moment", { ...draft, sportId: "openwaterzwemmen" });
if (water.data.snapshot.suitability.kind !== "NO_SCORE") throw new Error("Water should NO_SCORE");
if (water.data.booked !== false || water.data.consumed !== 0) {
  throw new Error("NO_SCORE must not consume quota");
}

const save = await post("/api/searches", draft);
if (save.data.booked !== false || save.data.consumed !== 0) {
  throw new Error("Saving search must remain zero-cost");
}

const sports = ["fietsen", "hardlopen", "wandelen", "golf", "tennis-padel"];
for (const sportId of sports) {
  const result = await post("/api/moment", { ...draft, sportId });
  if (result.status !== 200) throw new Error(`${sportId} moment failed`);
  if (result.data.snapshot.suitability.kind !== "NO_SCORE" || result.data.booked !== false || result.data.consumed !== 0) {
    throw new Error(`${sportId} must stay unbilled while its rule is withheld`);
  }
}
if (first.data.entitlement?.used !== 0) {
  throw new Error("Withheld analyses changed the Basis quota");
}

const earlyPro = await post("/api/billing/checkout", { consent: false });
if (earlyPro.status !== 400) throw new Error("Checkout without consent must fail");

const checkout = await post("/api/billing/checkout", {
  consent: true,
  idempotencyKey: `p06-${email}`,
});
if (checkout.status !== 200 || !checkout.data.checkout?.checkoutUrl) {
  throw new Error("Checkout create failed");
}
const checkoutId = checkout.data.checkout.id;

const pendingRedirect = await request(`/checkout/pending?checkout=${checkoutId}`);
if (pendingRedirect.status !== 200) throw new Error("Pending page failed");
const pendingHtml = await pendingRedirect.text();
if (pendingHtml.toLowerCase().includes("pro is geactiveerd")) {
  throw new Error("Redirect must not activate Pro");
}

const simulateFail = await post("/api/billing/simulate", { checkoutId, status: "failed" });
if (!simulateFail.data.ok || simulateFail.data.state !== "payment_failed") {
  throw new Error("Failed simulation broken");
}

const checkout2 = await post("/api/billing/checkout", {
  consent: true,
  idempotencyKey: `p06-paid-${email}`,
});
const paid = await post("/api/billing/simulate", {
  checkoutId: checkout2.data.checkout.id,
  status: "paid",
});
if (!paid.data.ok || paid.data.state !== "payment_paid" || paid.data.entitlement.plan !== "pro") {
  throw new Error("Paid simulation must activate Pro after verification");
}

const duplicateWebhook = await post("/api/billing/simulate", {
  checkoutId: checkout2.data.checkout.id,
  status: "paid",
});
if (!duplicateWebhook.data.duplicate) {
  throw new Error("Webhook/simulate must be idempotent");
}

const cancel = await post("/api/billing/cancel", {});
if (cancel.status !== 200 || cancel.data.entitlement.state !== "cancel_requested") {
  throw new Error("Cancel path failed");
}
if (cancel.data.entitlement.plan !== "pro") {
  throw new Error("Pro must remain until period end after cancel request");
}

const plans = await (await request("/account/abonnement")).text();
if (!plans.includes("Pro") || !plans.includes("analyses")) {
  throw new Error("Abonnement page incomplete");
}

console.log("phase 06 route checks ok");
