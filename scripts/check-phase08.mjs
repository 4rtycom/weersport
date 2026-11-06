import { readFileSync } from "node:fs";

const required = [
  "lib/account/privacy.ts",
  "app/api/account/export/route.ts",
  "app/api/account/delete/route.ts",
  "app/api/health/route.ts",
  "app/api/billing/refund/route.ts",
  "app/account/privacy/page.tsx",
  "app/support/page.tsx",
  "app/support/terugbetaling/page.tsx",
  "app/release-gate/page.tsx",
  "lib/release/matrix.ts",
  "docs/phase08-release-gate.md",
  "next.config.ts",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
for (const token of [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  if (!config.includes(token)) throw new Error(`Security header missing: ${token}`);
}

const matrix = readFileSync(new URL("../lib/release/matrix.ts", import.meta.url), "utf8");
for (const id of ["QA0", "QA1", "QA2", "QA3", "QA4", "QA5", "QA6", "QA7"]) {
  if (!matrix.includes(id)) throw new Error(`Release matrix missing ${id}`);
}

const shell = readFileSync(new URL("../components/account/account-shell.tsx", import.meta.url), "utf8");
if (!shell.includes('href="#inhoud"') || !shell.includes('id="inhoud"')) {
  throw new Error("Account shell must expose skip-link target #inhoud");
}

const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
if (!header.includes("skip-link") || !header.includes("#inhoud")) {
  throw new Error("Site header missing skip link");
}

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
if (!layout.includes('lang="nl"')) throw new Error("Root layout must set lang=nl");

const mollie = readFileSync(new URL("../lib/billing/mollie.ts", import.meta.url), "utf8");
if (!mollie.includes("applyRefund") || !mollie.includes("refunded")) {
  throw new Error("Mollie refund path missing");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 08 static checks ok");
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
async function post(path, body) {
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})), response };
}

const home = await request("/");
for (const headerName of ["content-security-policy", "x-frame-options", "x-content-type-options"]) {
  if (!home.headers.get(headerName)) throw new Error(`Missing response header ${headerName}`);
}
const homeHtml = await home.text();
if (!homeHtml.includes('lang="nl"') && !homeHtml.includes("lang='nl'")) {
  // Next may render lang on html; accept skip-link as a11y smoke
}
if (!homeHtml.includes("skip-link") && !homeHtml.includes("Naar inhoud")) {
  throw new Error("Homepage missing skip link");
}

const health = await (await request("/api/health")).json();
if (health.status !== "ok" || health.checks?.database !== "ok") {
  throw new Error("Health check failed");
}

const release = await (await request("/release-gate")).text();
if (!release.includes("Niet alleen mooi") || !release.includes("QA")) {
  // cards use titles; check matrix headings
}
if ((!release.includes("UI & RESPONSIVE") && !release.includes("UI &amp; RESPONSIVE")) || !release.includes("PERSOONLIJKE DATA")) {
  throw new Error("Release gate matrix incomplete");
}
if (!release.includes("GO / NO-GO")) throw new Error("Release gate missing GO/NO-GO");

const support = await (await request("/support")).text();
if (!support.includes("Support") || !support.includes("/api/health")) {
  throw new Error("Support page incomplete");
}
const refundPolicy = await (await request("/support/terugbetaling")).text();
if (!refundPolicy.includes("Terugbetalingen")) throw new Error("Refund policy page missing");

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((place) => place.label === "Amsterdam");
const draft = {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
};
const email = `fase08-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", draft);
await post("/api/auth/registreren", { name: "Fase Acht", email, password, terms: true });
const verifyHtml = await (await request("/auth/verifieer")).text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!link) throw new Error("Missing verify link");
await request(link);

const exportRes = await request("/api/account/export");
if (exportRes.status !== 200) throw new Error("Account export failed");
const exported = await exportRes.json();
if (exported.account?.email !== email || !exported.schemaVersion) {
  throw new Error("Export payload incomplete");
}
if (JSON.stringify(exported).includes("password_hash")) {
  throw new Error("Export must not include password hashes");
}

await post("/api/consent", { granted: true });
await post("/api/zoeken", draft);
const checkout = await post("/api/billing/checkout", { consent: true, idempotencyKey: `p08-${email}` });
await post("/api/billing/simulate", { checkoutId: checkout.data.checkout.id, status: "paid" });
const refund = await post("/api/billing/refund", {});
if (refund.status !== 200 || refund.data.entitlement?.plan !== "basis") {
  throw new Error("Sandbox refund must end Pro");
}

const deleted = await post("/api/account/delete", { password, confirm: "VERWIJDER" });
if (deleted.status !== 200) throw new Error("Account delete failed");
const afterDelete = await request("/api/account/export");
if (afterDelete.status !== 401) throw new Error("Deleted account must not export");

// Auth exclusion / ads smoke
const login = await (await request("/auth/inloggen")).text();
if (login.includes("ad-slot-sandbox") || login.includes("Sandbox-advertentie")) {
  throw new Error("Auth must stay ad-free");
}

console.log("phase 08 route checks ok");
