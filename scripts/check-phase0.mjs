import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/auth/release.ts",
  "lib/auth/token-migration.ts",
  "app/api/auth/registreren/route.ts",
  "app/api/auth/herstel/route.ts",
  "app/api/auth/verifieer/route.ts",
  "docs/phase0-auth-containment.md",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const release = readFileSync(new URL("../lib/auth/release.ts", import.meta.url), "utf8");
for (const token of ["authIsClosed", "VERCEL_ENV", "WEERSPORT_ALLOW_DEV_AUTH", "WEERSPORT_FORCE_AUTH_CLOSED"]) {
  if (!release.includes(token)) throw new Error(`release.ts missing ${token}`);
}

const herstel = readFileSync(new URL("../app/api/auth/herstel/route.ts", import.meta.url), "utf8");
if (!herstel.includes("authIsClosed") || !herstel.includes("clearDevMail")) {
  throw new Error("Recovery must clear mailbox cookie when closed");
}

const register = readFileSync(new URL("../app/api/auth/registreren/route.ts", import.meta.url), "utf8");
if (!register.includes("authIsClosed") || !register.includes("503")) {
  throw new Error("Registration must fail closed with 503");
}

const simulate = readFileSync(new URL("../app/api/billing/simulate/route.ts", import.meta.url), "utf8");
if (!simulate.includes("isVercelProduction")) {
  throw new Error("Payment simulate must refuse production");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 0 static checks ok");
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
  const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
    setCookie,
    text: null,
  };
}

function cookieHasToken(setCookie) {
  return setCookie.some((value) => /ws_dev_mail=/.test(value) && /token%3D|token=/.test(value));
}

const closedForced = process.env.WEERSPORT_FORCE_AUTH_CLOSED === "1" || process.env.VERCEL_ENV === "production";

if (closedForced) {
  const known = `fase0-known-${Date.now()}@example.nl`;
  const unknown = `fase0-unknown-${Date.now()}@example.nl`;

  const signup = await post("/api/auth/registreren", {
    name: "Gesloten",
    email: known,
    password: "test-wachtwoord-12",
    terms: true,
  });
  if (signup.status !== 503) throw new Error(`Closed signup expected 503, got ${signup.status}`);
  if (cookieHasToken(signup.setCookie)) throw new Error("Signup must not set token cookie when closed");
  if (JSON.stringify(signup.data).includes("token=")) throw new Error("Signup JSON must not contain token");

  const resetKnown = await post("/api/auth/herstel", { email: known });
  const resetUnknown = await post("/api/auth/herstel", { email: unknown });
  if (resetKnown.status !== 200 || resetUnknown.status !== 200) throw new Error("Recovery must respond 200");
  if (JSON.stringify(resetKnown.data) !== JSON.stringify(resetUnknown.data)) {
    throw new Error("Known/unknown recovery responses must match");
  }
  if (resetKnown.data.next !== "/auth/herstel/verstuurd") throw new Error("Recovery next path mismatch");
  if (cookieHasToken(resetKnown.setCookie) || cookieHasToken(resetUnknown.setCookie)) {
    throw new Error("Recovery must not deliver token cookie when closed");
  }

  const sent = await (await request("/auth/herstel/verstuurd")).text();
  if (sent.includes("/auth/herstel/nieuw?token=") || sent.includes("Open de herstel-link")) {
    throw new Error("Closed recovery page must not render token links");
  }

  const simulate = await post("/api/billing/simulate", { checkoutId: "x", status: "paid" });
  if (process.env.VERCEL_ENV === "production" && simulate.status !== 403) {
    throw new Error("Production must refuse payment simulation");
  }

  console.log("phase 0 closed-mode route checks ok");
} else {
  // Dev mailbox path still works for disposable local checks.
  const email = `fase0-open-${Date.now()}@example.nl`;
  const registered = await post("/api/auth/registreren", {
    name: "Open Lokaal",
    email,
    password: "test-wachtwoord-12",
    terms: true,
  });
  if (registered.status !== 200 || registered.data.next !== "/auth/verifieer") {
    throw new Error("Local mailbox mode should still allow registration");
  }
  console.log("phase 0 mailbox-mode smoke ok (set WEERSPORT_FORCE_AUTH_CLOSED=1 for closed evidence)");
}
