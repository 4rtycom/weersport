import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const home = read("components/home-page.tsx");
const css = read("app/globals.css");
const place = read("components/place-field.tsx");
const sport = read("components/sport-select.tsx");
const auth = read("app/auth/page.tsx");
const resume = read("app/auth/hervat/page.tsx");

const shared =
  "Gratis en zonder account: de homepage, de sportgidsen en het fictieve voorbeeld. Een gratis account is nodig om een zoekopdracht te bewaren en een analyse te starten. Alleen locaties in Nederland.";

if (!home.includes(shared)) throw new Error("Planner access copy is missing");
if (home.includes("planner-note-short") || home.includes("planner-note-long")) {
  throw new Error("Planner copy still splits by breakpoint");
}
if (home.includes("Gratis, zonder account") || home.includes("Gratis account nodig bij zoeken")) {
  throw new Error("Contradictory planner lines are still present");
}
if (css.includes("planner-note-short") || css.includes("planner-note-long")) {
  throw new Error("Breakpoint CSS still hides part of the planner note");
}
if (home.includes("weather-temp") || home.includes(">16°<")) {
  throw new Error("Hero still shows a fictional temperature");
}
if (!home.includes("fictief fietsvoorbeeld")) {
  throw new Error("Fictional bike example is not kept separate from the planner");
}
if (!home.includes("Voorbeeld · fictief")) throw new Error("Example badge missing");
if (home.includes("<select") || home.includes("setPeriod")) {
  throw new Error("Period must be a fixed value, not a select");
}
if (!home.includes("readOnly") || !home.includes("periods[0]")) {
  throw new Error("Period is not rendered as the single fixed value");
}
if (!place.includes("setPlaces([])")) throw new Error("Place field does not clear stale options");
if (!place.includes("AbortController")) throw new Error("Place lookup can still apply a stale response");
if (!auth.includes("Je zoekopdracht is bewaard") || !auth.includes("Wijzig zoekopdracht")) {
  throw new Error("Auth account step is missing the saved-search name or edit action");
}
if (!resume.includes("Je zoekopdracht is bewaard") || !resume.includes("Wijzig zoekopdracht")) {
  throw new Error("Resume account step is missing the saved-search name or edit action");
}
if (!home.includes('htmlFor="sport"') || !sport.includes("aria-activedescendant")) {
  throw new Error("Sport control label or keyboard active descendant is missing");
}
if (!css.includes(".text-field:focus-within")) throw new Error("Planner fields still have no visible focus");

console.log("planner copy checks passed");
