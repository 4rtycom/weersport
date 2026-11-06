import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/db/client.ts",
  "lib/mail/send.ts",
  "migrations/001_phase1_core.sql",
  "scripts/migrate-sqlite-to-postgres.mjs",
  "docs/phase1-durable-identity.md",
  "app/api/auth/mailbox/route.ts",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const release = readFileSync(new URL("../lib/auth/release.ts", import.meta.url), "utf8");
for (const token of ["inbox", "mailbox", "closed", "mailConfigured"]) {
  if (!release.includes(token)) throw new Error(`release.ts missing ${token}`);
}

const mail = readFileSync(new URL("../lib/mail/send.ts", import.meta.url), "utf8");
if (!mail.includes("resend") || !mail.includes("outbound_mail")) {
  throw new Error("Mail module must support Resend and log driver");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 1 static checks ok");
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
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
    setCookie: typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [],
  };
}

const health = await (await request("/api/health")).json();
if (!health.checks?.authDelivery || !health.checks?.mailDriver) {
  throw new Error("Health must report authDelivery and mailDriver");
}

if (process.env.WEERSPORT_MAIL_DRIVER !== "log") {
  console.log("phase 1 health ok (set WEERSPORT_MAIL_DRIVER=log for Gate A inbox evidence)");
  process.exit(0);
}

const places = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = places.places.find((p) => p.label === "Amsterdam");
const draft = {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
};
const email = `fase1-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
await post("/api/zoeken", draft);
const registered = await post("/api/auth/registreren", {
  name: "Fase Een",
  email,
  password,
  terms: true,
});
if (registered.status !== 200) throw new Error(`Register failed: ${registered.status}`);
if (registered.setCookie.some((c) => /ws_dev_mail=.*token/.test(c))) {
  throw new Error("Inbox mode must not set token cookie");
}

const boxed = await (await request(`/api/auth/mailbox?email=${encodeURIComponent(email)}&purpose=verify`)).json();
const link = boxed.mail?.link;
if (!link || !link.includes("token=")) throw new Error("Logged verify mail missing link");

const confirmPath = new URL(link).pathname + new URL(link).search;
const confirm = await request(confirmPath);
if (confirm.status !== 307 && confirm.status !== 302) throw new Error(`Confirm status ${confirm.status}`);
const confirmLoc = confirm.headers.get("location") ?? "";
if (!confirmLoc.includes("hervat") && !confirmLoc.includes("bevestigd")) {
  throw new Error(`Unexpected confirm redirect: ${confirmLoc}`);
}

const replay = await request(confirmPath);
const replayLoc = replay.headers.get("location") ?? "";
if (!replayLoc.includes("fout=link") && !replayLoc.includes("verifieer")) {
  throw new Error(`Replay must reject used token, got ${replayLoc}`);
}
const resume = await (await request("/auth/hervat")).text();
if (!resume.includes("Wielrennen") && !resume.includes("Amsterdam")) {
  throw new Error("Draft not restored after inbox verify");
}

const reset = await post("/api/auth/herstel", { email });
if (reset.data.next !== "/auth/herstel/verstuurd") throw new Error("Reset confirm missing");
const resetMail = await (await request(`/api/auth/mailbox?email=${encodeURIComponent(email)}&purpose=reset`)).json();
if (!resetMail.mail?.link) throw new Error("Reset mail missing");
const token = new URL(resetMail.mail.link).searchParams.get("token");
const changed = await post("/api/auth/wachtwoord", { token, password: "nieuw-wachtwoord-99" });
if (changed.data.next !== "/auth/inloggen?herstel=1") throw new Error("Password reset failed");
const oldLogin = await post("/api/auth/inloggen", { email, password });
if (oldLogin.status !== 401) throw new Error("Old password still works after reset");
const newLogin = await post("/api/auth/inloggen", { email, password: "nieuw-wachtwoord-99" });
if (newLogin.status !== 200) throw new Error("New password login failed");

console.log("phase 1 Gate A inbox-log checks ok");
