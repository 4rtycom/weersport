// Pure AdSense policy rules: where blocks and full-screen ads may appear, and ads.txt. Consent is Google's own message.
import assert from "node:assert/strict";
import { adsenseClient, adsTxtLine, decideAdPlacement, fullScreenAllowed } from "../lib/ads/policy";

const basis = { plan: "basis" as const };
assert.equal(decideAdPlacement({ ...basis, surface: "moment", suitabilityKind: "SCORED" }).allowed, true);
assert.equal(decideAdPlacement({ ...basis, surface: "moment", suitabilityKind: "NO_SCORE" }).allowed, false);
assert.equal(decideAdPlacement({ plan: "pro", surface: "moment", suitabilityKind: "SCORED" }).allowed, false, "Pro is ad-free");
for (const surface of ["home", "auth", "checkout", "billing"] as const) {
  assert.equal(decideAdPlacement({ ...basis, surface }).allowed, false, `${surface} has no ads`);
}
assert.equal(decideAdPlacement({ ...basis, surface: "account" }).allowed, true);
assert.equal(decideAdPlacement({ ...basis, surface: "guide" }).allowed, true);

for (const path of ["/", "/auth/inloggen", "/checkout/pro", "/account/abonnement", "/account/facturering", "/sponsoring", "/privacy", "/prijzen"]) {
  assert.equal(fullScreenAllowed(path), false, `no vignette around ${path}`);
}
for (const path of ["/sporten", "/sporten/hardlopen", "/sporten/hardlopen/utrecht", "/moment", "/account/momenten", "/hoe-werkt-het"]) {
  assert.equal(fullScreenAllowed(path), true, `vignette allowed on ${path}`);
}
assert.equal(fullScreenAllowed("/prijzen?x=1"), false);

assert.equal(adsenseClient("pub-1234567890123456"), "ca-pub-1234567890123456");
assert.equal(adsenseClient("ca-pub-1234567890123456"), "ca-pub-1234567890123456");
assert.equal(adsenseClient("ca-pub-12"), null);
assert.equal(adsenseClient(undefined), null);
assert.equal(adsTxtLine("ca-pub-1234567890123456"), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0");
assert.equal(adsTxtLine(null), null);

console.log("ads checks ok");
