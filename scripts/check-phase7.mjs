import { readFileSync } from "node:fs";
import {
  assertDisposableCheckTarget,
  isDisposableCheckHost,
} from "../lib/auth/release-check.mjs";

const required = [
  "docs/phase7-release-evidence.md",
  "docs/phase7-evidence/_template.md",
  "docs/phase7-evidence/gate-a.md",
  "docs/phase7-evidence/gate-b.md",
  "docs/phase7-evidence/gate-c.md",
  "docs/phase7-evidence/phase-6-exit.md",
  "docs/phase7-evidence/phase-7-journeys.md",
  "lib/release/capabilities.ts",
  "lib/release/evidence.ts",
  "lib/auth/release-check.mjs",
  "scripts/check-phase7.mjs",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const caps = readFileSync(new URL("../lib/release/capabilities.ts", import.meta.url), "utf8");
for (const token of [
  "WEERSPORT_RECOMMENDATIONS_DISABLED",
  "registrationEnabled",
  "recommendationsEnabled",
  "checkoutCapabilityEnabled",
  "RECOMMENDATIONS_DISABLED_REASON",
]) {
  if (!caps.includes(token)) throw new Error(`capabilities missing ${token}`);
}

const analysis = readFileSync(new URL("../lib/billing/analysis.ts", import.meta.url), "utf8");
if (!analysis.includes("recommendationsEnabled") || !analysis.includes("recommendations_disabled")) {
  throw new Error("Analysis must honour recommendations kill switch while keeping safety path");
}

const releaseCheck = readFileSync(new URL("../lib/auth/release-check.mjs", import.meta.url), "utf8");
if (!releaseCheck.includes("WEERSPORT_CHECK_ALLOWLIST") || !releaseCheck.includes("weersport.nl")) {
  throw new Error("Allowlist + production host block required");
}

// Self-test allowlist helper (no network).
if (isDisposableCheckHost("weersport.vercel.app") || isDisposableCheckHost("weersport.nl")) {
  throw new Error("Production hosts must not be disposable");
}
if (!isDisposableCheckHost("127.0.0.1") || !isDisposableCheckHost("localhost")) {
  throw new Error("Loopback must be disposable");
}
if (!isDisposableCheckHost("some-preview.vercel.app")) {
  throw new Error("Vercel previews must be disposable");
}
try {
  assertDisposableCheckTarget("https://weersport.nl");
  throw new Error("assertDisposableCheckTarget should refuse weersport.nl");
} catch (error) {
  if (String(error.message || error).includes("should refuse")) throw error;
}

const momentsApi = readFileSync(new URL("../app/api/moments/route.ts", import.meta.url), "utf8");
if (!momentsApi.includes("export async function PATCH") || !momentsApi.includes("updatePlannedMoment")) {
  throw new Error("Moments PATCH/edit path required for Phase 7 journeys");
}

const health = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
if (!health.includes('phase: "7"') || !health.includes("capabilities")) {
  throw new Error("Health must report phase 7 + capabilities");
}

const evidence = readFileSync(new URL("../lib/release/evidence.ts", import.meta.url), "utf8");
for (const cls of ["static", "automated", "manual_uat", "untested"]) {
  if (!evidence.includes(cls)) throw new Error(`Evidence class missing ${cls}`);
}

const docs = readFileSync(new URL("../docs/phase7-release-evidence.md", import.meta.url), "utf8");
if (!docs.includes("rollback") || !docs.includes("Phase 0") || !docs.includes("idempotent")) {
  throw new Error("Rollback runbook must protect recovery containment + billing idempotency");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 7 static release-evidence checks ok");
  process.exit(0);
}

assertDisposableCheckTarget(base);

const jarA = new Map();
const jarB = new Map();

function storeCookies(jar, response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}
function cookieHeader(jar) {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}
async function request(jar, path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    headers: { cookie: cookieHeader(jar), ...(options.headers ?? {}) },
    redirect: "manual",
  });
  storeCookies(jar, response);
  return response;
}
async function post(jar, path, body) {
  const response = await request(jar, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function patch(jar, path, body) {
  const response = await request(jar, path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function del(jar, path, body) {
  const response = await request(jar, path, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

async function verifyViaMailbox(jar, email) {
  const boxed = await (await request(jar, `/api/auth/mailbox?email=${encodeURIComponent(email)}&purpose=verify`)).json();
  if (boxed.mail?.link) {
    const url = new URL(boxed.mail.link);
    await request(jar, url.pathname + url.search);
    return true;
  }
  // Fallback prototype only when mailbox empty — never scrape production HTML tokens as success criteria.
  const proto = await post(jar, "/api/auth/verifieer", { prototype: true });
  return proto.status < 400;
}

async function registerVerified(jar, name, email, password, draft) {
  await post(jar, "/api/zoeken", draft);
  const registered = await post(jar, "/api/auth/registreren", { name, email, password, terms: true });
  if (registered.status === 503) throw new Error("Auth closed — cannot run Phase 7 journeys");
  if (registered.status >= 400) throw new Error(`Register failed ${registered.status}`);
  const ok = await verifyViaMailbox(jar, email);
  if (!ok) throw new Error("Verification failed without rewarding HTML token scrape");
}

const healthJson = await (await request(jarA, "/api/health")).json();
if (String(healthJson.phase) !== "7") throw new Error(`Health phase expected 7, got ${healthJson.phase}`);
if (!healthJson.checks?.capabilities) throw new Error("Health missing capabilities");
for (const key of ["registration", "recommendations", "checkout"]) {
  if (typeof healthJson.checks.capabilities[key] !== "boolean") {
    throw new Error(`Capability ${key} missing from health`);
  }
}

const places = await (await request(jarA, "/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((p) => p.label === "Amsterdam");
if (!city) throw new Error("Amsterdam missing");
const draft = {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
};

const stamp = Date.now();
const emailA = `fase7a-${stamp}@example.nl`;
const emailB = `fase7b-${stamp}@example.nl`;
const password = "test-wachtwoord-12";

await registerVerified(jarA, "Fase Zeven A", emailA, password, draft);

// Returning user: logout + login restores session path (draft already stored).
await post(jarA, "/api/auth/uitloggen", {});
const login = await post(jarA, "/api/auth/inloggen", { email: emailA, password });
if (login.status >= 400) throw new Error("Returning login failed");

const start = new Date(Date.now() + 3600_000).toISOString();
const end = new Date(Date.now() + 7200_000).toISOString();
const created = await post(jarA, "/api/moments", {
  ...draft,
  windowLabel: "Ochtendrit",
  plannedStart: start,
  plannedEnd: end,
  note: "eerste notitie",
});
if (created.status !== 200 || !created.data.moment?.id) throw new Error("Moment save failed");
const momentId = created.data.moment.id;

const edited = await patch(jarA, "/api/moments", {
  id: momentId,
  note: "bijgewerkte notitie",
  windowLabel: "Ochtendrit bijgewerkt",
});
if (edited.status !== 200 || edited.data.moment?.note !== "bijgewerkte notitie") {
  throw new Error("Moment edit failed");
}

// Cross-account isolation: B cannot see/edit/delete A's moment.
await registerVerified(jarB, "Fase Zeven B", emailB, password, draft);
const stolenPatch = await patch(jarB, "/api/moments", { id: momentId, note: "inbraak" });
if (stolenPatch.status !== 404) throw new Error("Cross-account PATCH must 404");
const stolenDelete = await del(jarB, "/api/moments", { id: momentId });
if (stolenDelete.status !== 404) throw new Error("Cross-account DELETE must 404");
const listB = await (await request(jarB, "/api/moments")).json();
if ((listB.moments || []).some((m) => m.id === momentId)) {
  throw new Error("Cross-account list leaked moment");
}

const exportA = await request(jarA, "/api/account/export");
if (!exportA.ok) throw new Error("Account export failed");
const exportJson = await exportA.json();
if (!exportJson || typeof exportJson !== "object") throw new Error("Export payload missing");

const removed = await del(jarA, "/api/moments", { id: momentId });
if (removed.status !== 200) throw new Error("Moment delete failed");

const releaseGate = await (await request(jarA, "/release-gate")).text();
if (!releaseGate.includes("phase7") && !releaseGate.includes("Phase 7") && !releaseGate.includes("phase7-release-evidence")) {
  throw new Error("Release gate should point at Phase 7 evidence docs");
}

console.log("phase 7 Gate release-evidence / journeys ok");
