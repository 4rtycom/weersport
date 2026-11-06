import { readFileSync } from "node:fs";

function read(file) {
  return readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

const home = read("components/home-page.tsx");
const page = read("app/sponsoring/page.tsx");
const form = read("components/sponsoring-form.tsx");
const store = read("lib/sponsoring/store.ts");
const route = read("app/api/sponsoring/route.ts");

if (home.includes('href="#planner">Samenwerken')) throw new Error("Samenwerken still points at the planner");
if (!home.includes('href="/sponsoring"')) throw new Error("Homepage CTA does not link to /sponsoring");
if (!home.includes('href="/sponsoring">Samenwerken')) throw new Error("Footer does not link to /sponsoring");
if (!page.includes("beïnvloedt nooit") && !page.includes("staat los van het sportadvies")) {
  throw new Error("Sponsoring page missing independence explanation");
}
for (const token of ["htmlFor", "aria-invalid", "role=\"alert\"", "role=\"status\"", "Aanvraag ontvangen"]) {
  if (!form.includes(token)) throw new Error(`Form missing ${token}`);
}
if (store.includes("nodemailer") || store.includes("resend") || route.includes("mailto:")) {
  throw new Error("Sponsoring path must not send mail");
}
if (!store.includes("mailed: false") || !store.includes("sponsorship_requests")) {
  throw new Error("Requests are not stored without mail");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("sponsoring static checks ok");
  process.exit(0);
}

const homeHtml = await (await fetch(new URL("/", base))).text();
if (!homeHtml.includes('href="/sponsoring"')) throw new Error("Live homepage missing /sponsoring");
const sponsoring = await fetch(new URL("/sponsoring", base));
if (sponsoring.status !== 200) throw new Error(`/sponsoring returned ${sponsoring.status}`);
const html = await sponsoring.text();
for (const token of ["Sponsoring", "staat los van het sportadvies", "sponsor-message", "Verstuur aanvraag"]) {
  if (!html.includes(token)) throw new Error(`Sponsoring HTML missing ${token}`);
}

const bad = await fetch(new URL("/api/sponsoring", base), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "A", organisation: "B", email: "nee", message: "kort" }),
});
const badBody = await bad.json();
if (bad.status !== 400 || !badBody.errors?.email) throw new Error("Invalid sponsoring request was accepted");

const good = await fetch(new URL("/api/sponsoring", base), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "Nora Noord",
    organisation: "Duinclub",
    email: "nora@example.nl",
    message: "We willen een herkenbare vermelding bij fietsen, zonder invloed op de score.",
  }),
});
const goodBody = await good.json();
if (good.status !== 200 || !goodBody.ok || goodBody.mailed !== false || !goodBody.id) {
  throw new Error(`Valid request was not stored: ${good.status} ${JSON.stringify(goodBody)}`);
}

const honeypot = await fetch(new URL("/api/sponsoring", base), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "Nora Noord",
    organisation: "Duinclub",
    email: "nora@example.nl",
    message: "We willen een herkenbare vermelding bij fietsen, zonder invloed op de score.",
    companyWebsite: "https://example.nl",
  }),
});
if (honeypot.status !== 400) throw new Error("Honeypot submission was stored");

console.log("sponsoring route checks ok");
