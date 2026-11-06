import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function read(file) {
  return readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

const support = read("app/support/page.tsx");
const refund = read("app/support/terugbetaling/page.tsx");
const privacy = read("app/privacy/page.tsx");
const terms = read("app/voorwaarden/page.tsx");
for (const [name, source] of [
  ["support", support],
  ["refund", refund],
  ["privacy", privacy],
  ["terms", terms],
]) {
  if (!source.includes("pageReturn") || !source.includes("<ReturnLink")) {
    throw new Error(`${name} is missing an origin-aware return link`);
  }
}
if (!support.includes("/api/health") || !support.includes("Export")) {
  throw new Error("Support page dropped health or export");
}
for (const token of ["Terugbetalingen", "refunded", "geen e-mail", "bewaarplicht"]) {
  if (!refund.includes(token)) throw new Error(`Refund page missing ${token}`);
}
if (privacy.includes("Terug naar registreren") || terms.includes("Terug naar registreren")) {
  throw new Error("Privacy or terms still hard-code a registration return");
}

const policyTest = `
import { resolveReturnTarget, sanitizeReturnPath } from "./lib/navigation/return-to.ts";
const host = "preview.example";
if (sanitizeReturnPath("//evil.example") || sanitizeReturnPath("/account/../support") || sanitizeReturnPath("/%2f%2fevil.example")) {
  throw new Error("unsafe path accepted");
}
const cases = [
  [ { van: "/auth/registreren", referer: "https://evil.example/", host }, "/auth/registreren" ],
  [ { referer: "http://" + host + "/account/facturering", host }, "/account/facturering" ],
  [ { referer: "https://evil.example/account/facturering", host }, "/" ],
  [ { van: "/nope", referer: null, host }, "/" ],
  [ { van: "/support/terugbetaling?next=/", host }, "/" ],
];
for (const [input, href] of cases) {
  const actual = resolveReturnTarget(input).href;
  if (actual !== href) throw new Error(JSON.stringify(input) + " -> " + actual);
}
console.log("return targets ok");
`;

const policy = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--input-type=module", "-e", policyTest],
  { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" },
);
if (policy.status !== 0) throw new Error(policy.stderr || policy.stdout || "return-target tests failed");

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("support a11y static checks ok");
  process.exit(0);
}

const host = new URL(base).host;
async function page(path, headers = {}) {
  const response = await fetch(new URL(path, base), { headers });
  const html = (await response.text()).replaceAll("<!-- -->", "");
  return { status: response.status, html };
}

const fromRegister = await page("/privacy", { referer: `${base}/auth/registreren` });
if (fromRegister.status !== 200 || !fromRegister.html.includes("Terug naar registreren")) {
  throw new Error("Privacy did not return to registration from that referer");
}
const foreign = await page("/privacy", { referer: "https://evil.example/auth/registreren" });
if (!foreign.html.includes("Terug naar homepage") || foreign.html.includes("evil.example")) {
  throw new Error("Privacy followed a foreign referer");
}
const billing = await page("/support/terugbetaling?van=/account/facturering");
if (!billing.html.includes("Terug naar facturering")) {
  throw new Error("Refund page ignored the billing origin");
}
const injected = await page("/privacy?van=https://evil.example");
if (!injected.html.includes("Terug naar homepage")) throw new Error("Unsafe van was accepted");
const supportPage = await page("/support");
if (!supportPage.html.includes("/api/health") || !supportPage.html.includes("Terugbetalingen")) {
  throw new Error("Live support page is incomplete");
}
if (!billing.html.includes("geen e-mail") || !billing.html.includes("refunded")) {
  throw new Error("Live refund page is incomplete");
}

console.log("support return-link checks ok");
