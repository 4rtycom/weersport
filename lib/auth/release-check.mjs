/** Plain JS helper for Node check scripts (no TS import). */
export function assertDisposableCheckTarget(baseUrl) {
  if (!baseUrl) return;
  if (process.env.WEERSPORT_ALLOW_PROD_CHECK === "1") return;
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`Invalid WEERSPORT_BASE_URL: ${baseUrl}`);
  }
  if (host === "weersport.vercel.app") {
    throw new Error(
      "Refusing destructive checks against production (weersport.vercel.app). Use a disposable staging URL.",
    );
  }
}
