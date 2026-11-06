import { readFileSync } from "node:fs";
import { assertDisposableCheckTarget } from "../lib/auth/release-check.mjs";

const required = [
  "lib/site.ts",
  "app/robots.ts",
  "app/sitemap.ts",
  "app/samenwerken/page.tsx",
  "app/ux-states/page.tsx",
  "docs/phase6-public-ux.md",
  "docs/phase6-lab-metrics.md",
  "components/home-page.tsx",
  "app/sporten/page.tsx",
  "app/support/page.tsx",
  "components/consent-banner.tsx",
  "components/account/privacy-actions.tsx",
  "components/start-analysis.tsx",
];

for (const file of required) {
  const body = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (body.length < 40) throw new Error(`${file} is empty`);
}

const site = readFileSync(new URL("../lib/site.ts", import.meta.url), "utf8");
for (const token of ["allowPublicIndexing", "INDEXABLE_PUBLIC_PATHS", "partnershipMailto", "weersport.nl"]) {
  if (!site.includes(token)) throw new Error(`lib/site.ts missing ${token}`);
}

const home = readFileSync(new URL("../components/home-page.tsx", import.meta.url), "utf8");
if (!home.includes("Plan mijn sportmoment") || !home.includes("Zoek mijn sportmoment")) {
  throw new Error("Homepage CTAs must match approved planner wording");
}
if (!home.includes('href="/samenwerken"') && !home.includes('href={"/samenwerken"}')) {
  if (!home.includes("/samenwerken")) throw new Error("Partnership CTA must leave the planner");
}
if (!home.includes("sizes=") || !home.includes("fetchPriority")) {
  throw new Error("Hero must expose responsive sizes + fetchPriority");
}

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
if (!page.includes("sport") || !page.includes("preselectedSportId")) {
  throw new Error("Homepage must honour ?sport= preselection");
}

const sporten = readFileSync(new URL("../app/sporten/page.tsx", import.meta.url), "utf8");
if (!sporten.includes("/?sport=") || !sporten.includes("catalog-card-link")) {
  throw new Error("Catalogue tiles must link into the planner");
}
if (sporten.includes("latere fase")) throw new Error("Catalogue still has build-note copy");

const support = readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
if (support.includes("release-gate") || support.includes("/api/health")) {
  throw new Error("Support must not expose staging diagnostics");
}

const privacy = readFileSync(new URL("../components/account/privacy-actions.tsx", import.meta.url), "utf8");
if (!privacy.includes("reset: true")) throw new Error("Consent withdrawal missing");

const consentApi = readFileSync(new URL("../app/api/consent/route.ts", import.meta.url), "utf8");
if (!consentApi.includes("reset")) throw new Error("Consent API must support reset");

const start = readFileSync(new URL("../components/start-analysis.tsx", import.meta.url), "utf8");
if (!start.includes("/checkout/pro") || !start.includes("quotaExhausted")) {
  throw new Error("Exhausted start-gate needs Pro path");
}

const ads = readFileSync(new URL("../lib/ads/policy.ts", import.meta.url), "utf8");
for (const code of ["HOME", "CHECKOUT", "PRO", "NO_SCORE", "NO_CONSENT", "BASIS_MOMENT"]) {
  if (!ads.includes(code)) throw new Error(`Ads policy missing ${code}`);
}

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
if (!layout.includes("robotsDirective") || !layout.includes("preload")) {
  throw new Error("Root layout needs robots + SVG preload");
}
if (layout.includes("nog zonder live weerdata")) {
  throw new Error("Root metadata still has unfinished-product copy");
}

const auth = readFileSync(new URL("../components/auth-forms.tsx", import.meta.url), "utf8");
if (auth.includes("Doorgaan met Google")) {
  throw new Error("Remove unfinished Google auth stub from customer UI");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("phase 6 static UX/SEO checks ok");
  process.exit(0);
}

assertDisposableCheckTarget(base);

const health = await (await fetch(new URL("/api/health", base))).json();
if (health.phase !== "6" && health.phase !== 6) {
  throw new Error(`Health phase expected 6, got ${health.phase}`);
}

const robots = await (await fetch(new URL("/robots.txt", base))).text();
if (!/disallow:\s*\//i.test(robots) && process.env.WEERSPORT_ALLOW_INDEXING !== "1") {
  throw new Error("Default robots should disallow indexing without allow flag");
}

const sportenHtml = await (await fetch(new URL("/sporten", base))).text();
if (!sportenHtml.includes("/?sport=hardlopen#planner")) {
  throw new Error("Live catalogue missing Hardlopen planner link");
}

const homeHtml = await (await fetch(new URL("/?sport=hardlopen", base))).text();
if (!homeHtml.includes("Hardlopen") || !homeHtml.includes("Plan mijn sportmoment")) {
  throw new Error("Live homepage missing preselect/CTA evidence");
}

const supportHtml = await (await fetch(new URL("/support", base))).text();
if (supportHtml.includes("release-gate") || supportHtml.includes("/api/health")) {
  throw new Error("Live support still exposes staging diagnostics");
}

const partners = await (await fetch(new URL("/samenwerken", base))).text();
if (!partners.includes("mailto:")) throw new Error("Partnership page missing mailto");

const ux = await fetch(new URL("/ux-states", base));
if (!ux.ok) throw new Error("UX states fixture index missing on non-production");

console.log("phase 6 Gate UX live checks ok");
