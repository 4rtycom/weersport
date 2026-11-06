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

const expectedWeights = {
  fietsen: [35, 30, 35],
  wielrennen: [30, 40, 30],
  gravelbiken: [30, 30, 40],
  mountainbiken: [28, 22, 50],
  hardlopen: [45, 25, 30],
  trailrunning: [35, 20, 45],
  wandelen: [40, 25, 35],
  hiken: [35, 25, 40],
  golf: [30, 35, 35],
  "tennis-padel": [30, 30, 40],
  voetbal: [35, 25, 40],
  hockey: [35, 25, 40],
  zeilen: [25, 55, 20],
  windsurfen: [20, 60, 20],
  kitesurfen: [20, 65, 15],
  surfen: [25, 35, 40],
  suppen: [35, 40, 25],
  kajakken: [35, 35, 30],
  roeien: [35, 40, 25],
  openwaterzwemmen: [45, 20, 35],
  skeeleren: [30, 25, 45],
  paardrijden: [35, 30, 35],
  schaatsen: [50, 25, 25],
  outdoorfitness: [40, 25, 35],
};

const profilesSrc = readFileSync(new URL("../lib/scoring/profiles.ts", import.meta.url), "utf8");
for (const [id, [temp, wind, rain]] of Object.entries(expectedWeights)) {
  const block = profilesSrc.match(
    new RegExp(`sportId: "${id}"[\\s\\S]*?weights: \\{ temperature: ([\\d.]+), wind: ([\\d.]+), rain: ([\\d.]+) \\}`),
  );
  if (!block) throw new Error(`Profile missing for ${id}`);
  const got = [Number(block[1]), Number(block[2]), Number(block[3])].map((n) => Math.round(n * 100));
  if (got[0] !== temp || got[1] !== wind || got[2] !== rain) {
    throw new Error(`${id} weights ${got.join("/")} !== ${temp}/${wind}/${rain}`);
  }
  if (temp + wind + rain !== 100) throw new Error(`${id} weights do not sum to 100`);
}

const copy = readFileSync(new URL("../lib/sport-guide-copy.ts", import.meta.url), "utf8");
for (const id of sportIds) {
  if (!copy.includes(`${JSON.stringify(id)}:`) && !copy.includes(`${id}:`)) {
    throw new Error(`guideCopy missing ${id}`);
  }
}

const examples = readFileSync(new URL("../lib/sport-guide-examples.ts", import.meta.url), "utf8");
for (const needle of ["hardlopen", "wielrennen", "scoreHour", "buildLandGuideExample"]) {
  if (!examples.includes(needle)) {
    throw new Error(`Land examples must include ${needle}`);
  }
}

const guidePage = readFileSync(new URL("../app/sporten/[sport]/page.tsx", import.meta.url), "utf8");
if (!guidePage.includes("/?sport=${sport.id}#planner")) {
  throw new Error("Guide CTA must deep-link into planner with sport id");
}
if (guidePage.includes('href="/#planner"')) {
  throw new Error("Generic /#planner CTA must be replaced");
}
if (!guidePage.includes("buildLandGuideExample")) {
  throw new Error("Guide page must use sport-specific land examples");
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
if (!hardlopen.includes("°C") || !hardlopen.includes("/ 100")) {
  throw new Error("Hardlopen land example missing temperature/score evidence");
}
if (!hardlopen.includes("lucht") && !hardlopen.includes("temperatuur")) {
  throw new Error("Hardlopen should vary temperature in its demo");
}

const wielrennen = await (await check("/sporten/wielrennen")).text();
if (!wielrennen.includes("km/u") || !wielrennen.includes("/ 100")) {
  throw new Error("Wielrennen land example missing wind/score evidence");
}

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
