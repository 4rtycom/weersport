import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/** Lightweight assertions against source; optional live checks via WEERSPORT_BASE_URL. */

const sportsSrc = readFileSync(new URL("../lib/sports.ts", import.meta.url), "utf8");
const sportIds = [...sportsSrc.matchAll(/\{\s*id: "([^"]+)",\s*name: "([^"]+)",\s*familyId:/g)].map(
  (match) => match[1],
);
if (sportIds.length !== 24) {
  throw new Error(`Expected 24 sports, found ${sportIds.length}`);
}

const profilesSrc = readFileSync(new URL("../lib/scoring/profiles.ts", import.meta.url), "utf8");
if (profilesSrc.includes("weights:")) throw new Error("Profiles must not keep the three-weight table");
for (const id of sportIds) {
  if (!profilesSrc.includes(`sportId: "${id}"`)) throw new Error(`Profile missing for ${id}`);
}
if (!profilesSrc.includes('personalAdvice: false')) {
  throw new Error("Profiles must record that personal advice is not released");
}
const swimProfile = readFileSync(new URL("../lib/scoring/swim.ts", import.meta.url), "utf8");
if (!swimProfile.includes("We missen een recente watertemperatuur voor deze zwemplek.")) {
  throw new Error("Swim profile must explain a missing water temperature");
}

const copy = readFileSync(new URL("../lib/sport-guide-copy.ts", import.meta.url), "utf8");
for (const id of sportIds) {
  if (!copy.includes(`${JSON.stringify(id)}:`) && !copy.includes(`${id}:`)) {
    throw new Error(`guideCopy missing ${id}`);
  }
}

const examples = readFileSync(new URL("../lib/sport-guide-examples.ts", import.meta.url), "utf8");
if (!examples.includes("describeProfileForGuide")) {
  throw new Error("Guide examples must describe the shared profile");
}
if (!profilesSrc.includes('sportId: "hardlopen"') || !profilesSrc.includes("°C")) {
  throw new Error("Hardlopen profile must name temperature in °C without scoring it");
}
if (!profilesSrc.includes('sportId: "wielrennen"') || !profilesSrc.includes("km/u")) {
  throw new Error("Wielrennen profile must name wind in km/u without scoring it");
}

const guidePage = readFileSync(new URL("../app/sporten/[sport]/page.tsx", import.meta.url), "utf8");
if (!guidePage.includes("/?sport=${sport.id}#planner")) {
  throw new Error("Guide CTA must deep-link into planner with sport id");
}
if (guidePage.includes('href="/#planner"')) {
  throw new Error("Generic /#planner CTA must be replaced");
}
if (!guidePage.includes("describeProfileForGuide")) {
  throw new Error("Guide page must render the sport profile");
}

const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
if (!home.includes("preselectedSportId") || !home.includes("params.sport")) {
  throw new Error("Homepage must honour ?sport= preselection");
}

const catalog = readFileSync(new URL("../app/sporten/page.tsx", import.meta.url), "utf8");
if (!catalog.includes("/sporten/${sport.id}") || !catalog.includes("catalog-card-link")) {
  throw new Error("Catalog tiles must link to sport guides");
}

const moment = readFileSync(new URL("../components/moment-view.tsx", import.meta.url), "utf8");
if (!moment.includes("/sporten/${sport.id}") || !moment.includes("Hoe werkt het advies")) {
  throw new Error("Result page must link back to the sport guide");
}

// Answers: at most two sentences (rough split on . ! ?).
const answerBlocks = [...copy.matchAll(/\[[\s\S]*?"([^"]+)",\s*\n?\s*"([^"]+)"\s*\]/g)];
for (const [, , answer] of answerBlocks) {
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2) {
    throw new Error(`Guide answer has ${sentences.length} sentences: ${answer.slice(0, 80)}…`);
  }
}

const waterSports = [
  "zeilen",
  "windsurfen",
  "kitesurfen",
  "surfen",
  "suppen",
  "kajakken",
  "roeien",
  "openwaterzwemmen",
];

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("sport guides static checks ok");
  process.exit(0);
}

async function check(path, expectStatus = 200) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  if (response.status !== expectStatus) {
    throw new Error(`${path} expected ${expectStatus}, got ${response.status}`);
  }
  return response;
}

for (const id of sportIds) {
  const response = await check(`/sporten/${id}`);
  const html = await response.text();
  if (!html.includes("zo werkt het weeradvies")) throw new Error(`${id} missing guide title`);
  if (!html.includes(`/?sport=${id}#planner`)) throw new Error(`${id} missing planner deep-link`);
}

await check("/sporten/niet-bestaande-sport", 404);

const hardlopen = await (await check("/sporten/hardlopen")).text();
if (!hardlopen.includes("°C")) throw new Error("Hardlopen guide should name temperature in °C");
if (hardlopen.includes("/ 100")) throw new Error("Hardlopen must not show an unreleased score");
if (!hardlopen.includes("temperatuur") && !hardlopen.includes("Temperatuur")) {
  throw new Error("Hardlopen should mention temperature");
}

const wielrennen = await (await check("/sporten/wielrennen")).text();
if (!wielrennen.includes("km/u")) throw new Error("Wielrennen guide should name wind in km/u");
if (wielrennen.includes("/ 100")) throw new Error("Wielrennen must not show an unreleased score");

for (const id of waterSports) {
  const html = await (await check(`/sporten/${id}`)).text();
  if (html.includes(" / 100") && html.includes("Rekenvoorbeeld")) {
    throw new Error(`${id} must not show a fake land score when water data is critical`);
  }
  if (!html.includes("geen score") && !html.includes("geen aanbevolen")) {
    throw new Error(`${id} should explain missing water data`);
  }
}

const openwater = await (await check("/sporten/openwaterzwemmen")).text();
if (!openwater.includes("zwemwaterkwaliteit")) {
  throw new Error("Openwater must mention zwemwaterkwaliteit");
}

const schaatsen = await (await check("/sporten/schaatsen")).text();
if (!schaatsen.includes("natuurijs")) {
  throw new Error("Schaatsen must mention natuurijs");
}
if (/veilig om te schaatsen|ijs is veilig/i.test(schaatsen)) {
  throw new Error("Schaatsen must not claim safe natural ice");
}

const homeHtml = await (await check("/?sport=hardlopen")).text();
if (!homeHtml.includes("Hardlopen") || !homeHtml.includes("voorgeselecteerd")) {
  throw new Error("Homepage ?sport=hardlopen did not preselect");
}

const catalogHtml = await (await check("/sporten")).text();
if (!catalogHtml.includes('href="/sporten/hardlopen"')) {
  throw new Error("Catalog missing hardlopen guide link");
}

console.log("sport guides Gate live checks ok");
void require;
void pathToFileURL;
