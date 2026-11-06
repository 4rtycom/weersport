import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function read(file) {
  return readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

const layout = read("app/layout.tsx");
const sw = read("public/sw.js");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const offline = read("app/offline/page.tsx");
const banner = read("components/pwa-install.tsx");

if (!layout.includes('manifest: "/manifest.webmanifest"')) throw new Error("Layout missing manifest link");
if (!layout.includes("appleWebApp")) throw new Error("Layout missing standalone Apple web app metadata");
if (!layout.includes("<PwaInstall")) throw new Error("Install banner is not mounted");
if (manifest.display !== "standalone" || manifest.start_url !== "/") {
  throw new Error("Manifest is not a standalone start on /");
}
for (const icon of ["/icons/pwa-192.png", "/icons/pwa-512.png", "/icons/apple-touch-icon.png"]) {
  if (statSync(new URL(`../public${icon}`, import.meta.url)).size < 200) throw new Error(`${icon} is missing`);
}
if (!sw.includes("weersport-offline-v1")) throw new Error("Service worker cache name missing");
for (const blocked of ["/account", "/moment", "/checkout", "/api", "/auth"]) {
  if (!sw.includes(blocked.slice(1))) throw new Error(`Service worker does not exclude ${blocked}`);
}
if (sw.includes('"/moment"') || sw.includes('"/account"') || sw.includes('"/checkout"')) {
  throw new Error("Service worker lists a private route in the shell cache");
}
const shell = sw.slice(sw.indexOf("const SHELL"), sw.indexOf("const PRIVATE_PATH"));
for (const forbidden of ["/moment", "/account", "/checkout", "/api/", "warning"]) {
  if (shell.includes(forbidden)) throw new Error(`Offline shell includes ${forbidden}`);
}
if (!offline.includes("geen persoonlijk sportmoment") || !offline.includes("geen actuele waarschuwing")) {
  throw new Error("Offline page is not explicit about what it withholds");
}
if (!banner.includes("beforeinstallprompt") || !banner.includes("INSTALL_DISMISS_MS") || !banner.includes("ios-manual")) {
  throw new Error("Install banner does not follow prompt, dismiss, or iOS rules");
}
if (!banner.includes('data-dismiss-days="30"')) throw new Error("Dismiss period is not 30 days");

const policyTest = `
import { INSTALL_DISMISS_MS, installMode } from "./lib/pwa/policy.ts";
const day = 24 * 60 * 60 * 1000;
if (INSTALL_DISMISS_MS !== 30 * day) throw new Error("dismiss window");
const base = {
  standalone: false,
  installed: false,
  dismissedUntil: 0,
  now: 1000,
  promptAvailable: false,
  ios: false,
  blockedByPriority: false,
};
const cases = [
  [{ ...base, promptAvailable: true }, "prompt"],
  [{ ...base, promptAvailable: true, standalone: true }, "hidden"],
  [{ ...base, promptAvailable: true, installed: true }, "hidden"],
  [{ ...base, promptAvailable: true, dismissedUntil: base.now + day }, "hidden"],
  [{ ...base, promptAvailable: true, dismissedUntil: base.now - day }, "prompt"],
  [{ ...base, promptAvailable: true, blockedByPriority: true }, "hidden"],
  [{ ...base, ios: true }, "ios-manual"],
  [{ ...base, ios: true, standalone: true }, "hidden"],
  [{ ...base, ios: true, blockedByPriority: true }, "hidden"],
  [base, "hidden"],
];
for (const [surface, expected] of cases) {
  const actual = installMode(surface);
  if (actual !== expected) throw new Error(JSON.stringify(surface) + " -> " + actual);
}
console.log("pwa policy ok");
`;

const policy = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", policyTest], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  encoding: "utf8",
});
if (policy.status !== 0) {
  throw new Error(policy.stderr || policy.stdout || "PWA policy tests failed");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("pwa static checks ok");
  process.exit(0);
}

const home = await fetch(new URL("/", base));
const homeHtml = await home.text();
if (!homeHtml.includes('rel="manifest"') || !homeHtml.includes("/manifest.webmanifest")) {
  throw new Error("Homepage HTML has no manifest link");
}
const manifestRes = await fetch(new URL("/manifest.webmanifest", base));
if (manifestRes.status !== 200) throw new Error(`Manifest status ${manifestRes.status}`);
if (!manifestRes.headers.get("content-type")?.includes("application/manifest+json")) {
  throw new Error(`Manifest content type ${manifestRes.headers.get("content-type")}`);
}
const liveManifest = await manifestRes.json();
if (liveManifest.display !== "standalone") throw new Error("Live manifest is not standalone");
const offlineRes = await fetch(new URL("/offline", base));
if (offlineRes.status !== 200) throw new Error(`/offline status ${offlineRes.status}`);
const offlineHtml = await offlineRes.text();
if (!offlineHtml.includes("Je bent offline") || offlineHtml.includes("Sportscore")) {
  throw new Error("Offline page is missing or looks like a result");
}
const swRes = await fetch(new URL("/sw.js", base));
if (swRes.status !== 200 || !(await swRes.text()).includes("PRIVATE_PATH")) {
  throw new Error("Service worker is not served");
}

console.log("pwa route checks ok");
