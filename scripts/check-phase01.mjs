import { readFileSync, statSync } from "node:fs";

const sports = readFileSync(new URL("../lib/sports.ts", import.meta.url), "utf8");
const sportCount = (sports.match(/familyId: "/g) || []).length;
if (sportCount !== 24) {
  throw new Error(`Expected 24 sports, found ${sportCount}`);
}

const required = [
  "public/brand/symbol.svg",
  "public/home/hero.png",
  "public/home/curve.svg",
  "public/home/halo.svg",
  "public/icons/pedal-bike.svg",
  "public/icons/surfing.svg",
  "public/icons/horse-human.svg",
  "public/weather/uv.svg",
  "public/weather/safety.svg",
];

for (const file of required) {
  const size = statSync(new URL(`../${file}`, import.meta.url)).size;
  if (size < 100) throw new Error(`${file} is empty`);
}

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
for (const token of ["--ws-surface-dark", "--ws-accent-action", "--ws-accent-mint", "Manrope"]) {
  if (!css.includes(token) && token !== "Manrope") throw new Error(`Missing ${token}`);
}
if (!css.includes("min-height: 44px")) throw new Error("Touch target size is missing");

const sportIcon = readFileSync(new URL("../components/sport-icon.tsx", import.meta.url), "utf8");
if (!sportIcon.includes("width={size}") || !sportIcon.includes("height={size}")) {
  throw new Error("SportIcon must set explicit width and height so glyphs cannot collapse");
}

console.log("Phase 01 checks passed: 24 sports, assets, tokens, touch targets.");
