import { readFileSync } from "node:fs";

const required = [
  "app/api/zoeken/route.ts",
  "app/api/plaatsen/route.ts",
  "app/api/auth/registreren/route.ts",
  "app/api/auth/inloggen/route.ts",
  "app/api/auth/verifieer/route.ts",
  "app/api/auth/herstel/route.ts",
  "app/api/auth/wachtwoord/route.ts",
  "app/auth/verifieer/bevestig/route.ts",
  "app/auth/hervat/page.tsx",
  "public/auth/hourly-trend.svg",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const search = readFileSync(new URL("../app/api/zoeken/route.ts", import.meta.url), "utf8");
if (!search.includes("booked: false")) throw new Error("Search must not book an analysis");
if (search.toLowerCase().includes("mollie") || search.toLowerCase().includes("adsense")) {
  throw new Error("Phase 02 search route includes a later-phase provider");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 02 static checks ok");
  process.exit(0);
}

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
  const data = await response.json();
  return { status: response.status, data };
}

const paris = await request("/api/plaatsen?q=parijs");
const parisBody = await paris.json();
if (parisBody.places?.length) throw new Error("Parijs was accepted as a Dutch place");

const amsterdam = await (await request("/api/plaatsen?q=amsterdam")).json();
const city = amsterdam.places.find((place) => place.label === "Amsterdam");
if (!city?.id.startsWith("wpl-")) throw new Error("Amsterdam was not found");

const foreign = await post("/api/zoeken", {
  sportId: "fietsen",
  placeId: "",
  placeLabel: "Parijs",
  period: "Komende 48 uur",
});
if (foreign.status !== 400 || foreign.data.booked !== false) throw new Error("Foreign search was not refused");

const searchResult = await post("/api/zoeken", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (searchResult.status !== 200 || searchResult.data.next !== "/auth" || searchResult.data.booked !== false) {
  throw new Error(`Anonymous search did not open the gate: ${JSON.stringify(searchResult.data)}`);
}

const gate = await request("/auth");
const gateHtml = await gate.text();
if (!gateHtml.includes("Wielrennen") || !gateHtml.includes("Amsterdam")) {
  throw new Error("Auth gate dropped the draft");
}

const email = `fase02-${Date.now()}@example.nl`;
const password = "test-wachtwoord-12";
const registered = await post("/api/auth/registreren", { name: "Fase Twee", email, password, terms: true });
if (registered.data.next !== "/auth/verifieer") throw new Error("Registration did not ask for verification");

const verifyPage = await request("/auth/verifieer");
const verifyHtml = await verifyPage.text();
const link = verifyHtml.match(/href="(\/auth\/verifieer\/bevestig\?token=[^"]+)"/)?.[1];
if (!link) throw new Error("Verification link was not rendered");
const decoded = link.replaceAll("&amp;", "&");
const confirmed = await request(decoded);
if (confirmed.status !== 307 && confirmed.status !== 302) throw new Error(`Verify redirect was ${confirmed.status}`);
if (!confirmed.headers.get("location")?.endsWith("/auth/hervat")) throw new Error("Verification did not resume");

const resume = await request("/auth/hervat");
const resumeHtml = await resume.text();
if (!resumeHtml.includes("Wielrennen in Amsterdam")) throw new Error("Resume lost the draft");

const repeat = await post("/api/zoeken", {
  sportId: "wielrennen",
  placeId: city.id,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
});
if (repeat.data.booked !== false || repeat.data.next !== "/auth/hervat") {
  throw new Error("Verified search booked an analysis");
}

await post("/api/auth/uitloggen", {});
const wrong = await post("/api/auth/inloggen", { email, password: "fout-wachtwoord-12" });
if (wrong.status !== 401 || !wrong.data.error?.includes("klopt niet")) throw new Error("Bad password was accepted");

const reset = await post("/api/auth/herstel", { email });
if (reset.data.next !== "/auth/herstel/verstuurd") throw new Error("Reset did not confirm");
const sent = await request("/auth/herstel/verstuurd");
const sentHtml = await sent.text();
const resetLink = sentHtml.match(/href="(\/auth\/herstel\/nieuw\?token=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
if (!resetLink) throw new Error("Reset link was not rendered");
const token = new URL(resetLink, base).searchParams.get("token");
const changed = await post("/api/auth/wachtwoord", { token, password: "nieuw-wachtwoord-12" });
if (changed.data.next !== "/auth/inloggen?herstel=1") throw new Error("Password reset failed");
const oldLogin = await post("/api/auth/inloggen", { email, password });
if (oldLogin.status !== 401) throw new Error("Old password still works");
const newLogin = await post("/api/auth/inloggen", { email, password: "nieuw-wachtwoord-12" });
if (newLogin.data.next !== "/auth/hervat") throw new Error(`Login after reset went to ${newLogin.data.next}`);

console.log("phase 02 route checks ok");
