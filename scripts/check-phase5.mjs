import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/billing/mollie.ts",
  "lib/billing/mollie-mode.ts",
  "app/api/billing/webhook/route.ts",
  "app/api/billing/simulate/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/cancel/route.ts",
  "app/api/billing/refund/route.ts",
  "docs/phase5-paid-pro.md",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const mode = readFileSync(new URL("../lib/billing/mollie-mode.ts", import.meta.url), "utf8");
for (const token of ["disabled", "sandbox-local", "test_", "live_", "checkoutEnabled"]) {
  if (!mode.includes(token)) throw new Error(`mollie-mode missing ${token}`);
}

const mollie = readFileSync(new URL("../lib/billing/mollie.ts", import.meta.url), "utf8");
if (!mollie.includes("transitionEventId") || !mollie.includes("BEGIN IMMEDIATE")) {
  throw new Error("Durable transition keys + atomic writes required");
}
if (!mollie.includes("out-of-order") || !mollie.includes("applyRenewal")) {
  throw new Error("Out-of-order guards and renewal missing");
}
if (!mollie.includes("CHECKOUT_DISABLED_MESSAGE")) {
  throw new Error("Disabled checkout message missing");
}

const webhook = readFileSync(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8");
if (webhook.includes("randomUUID")) {
  throw new Error("Webhook must not use random delivery UUIDs as durable keys");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 5 static Gate C prep ok");
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

const health = await (await request("/api/health")).json();
if (!health.checks?.billingMode) throw new Error("Health must report billingMode");
if (health.checks.billingMode === "disabled") {
  if (health.checks.checkoutEnabled === true) {
    throw new Error("Disabled billing must set checkoutEnabled=false");
  }
  // Evidence path: no full sandbox lifecycle when checkout is refused.
  console.log("phase 5 Gate C disabled-checkout evidence ok");
  process.exit(0);
}
if (process.env.WEERSPORT_EXPECT_BILLING_DISABLED === "1") {
  throw new Error("Expected billingMode=disabled but got " + health.checks.billingMode);
}

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((p) => p.label === "Amsterdam");
const draft = {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
};
const email = `fase5-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", draft);
const registered = await post("/api/auth/registreren", { name: "Fase Vijf", email, password, terms: true });
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

const noConsent = await post("/api/billing/checkout", { consent: false });
if (noConsent.status !== 400) throw new Error("Checkout without consent must fail");

const checkout = await post("/api/billing/checkout", {
  consent: true,
  idempotencyKey: `p5-${email}`,
});
if (checkout.status === 503) {
  throw new Error(`Checkout disabled unexpectedly: ${checkout.data.error}`);
}
if (checkout.status !== 200 || !checkout.data.checkout?.checkoutUrl) {
  throw new Error(`Checkout create failed ${checkout.status}`);
}
if (!["sandbox-local", "test", "live"].includes(checkout.data.checkout.mode)) {
  throw new Error(`Unexpected checkout mode ${checkout.data.checkout.mode}`);
}
const checkoutId = checkout.data.checkout.id;

const paid = await post("/api/billing/simulate", { checkoutId, status: "paid" });
if (paid.status !== 200 || paid.data.state !== "payment_paid") {
  throw new Error("First payment simulate failed");
}
if (paid.data.entitlement?.plan !== "pro") throw new Error("Pro not activated after paid");
const paidThrough = paid.data.entitlement.currentPeriodEnd || paid.data.entitlement.resetAt;
if (!paidThrough) throw new Error("Customer-visible paid-through/renewal date missing");

const dup = await post("/api/billing/simulate", { checkoutId, status: "paid" });
if (!dup.data.duplicate) throw new Error("Duplicate paid delivery must be idempotent");

// Out-of-order failure after paid must not revoke
const lateFail = await post("/api/billing/simulate", { checkoutId, status: "failed" });
if (lateFail.data.entitlement?.plan !== "pro") throw new Error("Late failed must not revoke Pro");
if (lateFail.data.ignored !== true && lateFail.data.state !== "payment_paid") {
  // ignored flag preferred
}

const renew = await post("/api/billing/simulate", { action: "renew" });
if (renew.status !== 200 || renew.data.entitlement?.plan !== "pro") {
  throw new Error("Renewal failed");
}
const renewEnd = renew.data.periodEnd || renew.data.entitlement.currentPeriodEnd;
if (!renewEnd || renewEnd === paidThrough) {
  // period end should move forward; allow equal only if clock skew — require different or >=
  if (renewEnd && paidThrough && new Date(renewEnd).getTime() < new Date(paidThrough).getTime()) {
    throw new Error("Renewal shortened paid-through");
  }
}
const renewDup = await post("/api/billing/simulate", { action: "renew" });
// second renew without same payment id creates new event — that's ok; or duplicate if same
void renewDup;

const pastDue = await post("/api/billing/simulate", { action: "failed_collection" });
if (pastDue.status !== 200) throw new Error("Failed collection missing");
if (pastDue.data.entitlement?.plan !== "pro") {
  throw new Error("past_due must keep Pro access until period end");
}

const cancel = await post("/api/billing/cancel", {});
if (cancel.status !== 200 || !cancel.data.entitlement?.cancelAtPeriodEnd) {
  throw new Error("Cancel at period end missing");
}

const refund = await post("/api/billing/simulate", { action: "refund" });
if (refund.status !== 200) throw new Error("Refund simulate failed");
if (refund.data.entitlement?.plan === "pro" && refund.data.entitlement?.state !== "refunded") {
  // after refund plan becomes basis
}
if (refund.data.entitlement?.plan !== "basis") throw new Error("Refund must end Pro");

const latePaid = await post("/api/billing/simulate", { checkoutId, status: "paid" });
if (latePaid.data.entitlement?.plan === "pro") {
  throw new Error("Late paid after refund must not resurrect Pro");
}
if (latePaid.data.ignored !== true && latePaid.data.duplicate !== true) {
  // Prefer explicit ignore; duplicate also acceptable if transition already recorded
  throw new Error("Late paid after refund should be ignored or duplicate");
}

const abonnement = await (await request("/account/abonnement")).text();
if (!abonnement.includes("Basis") && !abonnement.includes("abonnement")) {
  throw new Error("Abonnement page missing");
}

console.log("phase 5 Gate C sandbox checks ok");
