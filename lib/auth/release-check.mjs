/** Plain JS helper for Node check scripts (no TS import). */

const BLOCKED_PRODUCTION_HOSTS = new Set([
  "weersport.vercel.app",
  "weersport.nl",
  "www.weersport.nl",
]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseAllowlist() {
  return (process.env.WEERSPORT_CHECK_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isDisposableCheckHost(host) {
  const normalized = String(host || "").toLowerCase();
  if (!normalized) return false;
  if (BLOCKED_PRODUCTION_HOSTS.has(normalized)) return false;
  if (LOOPBACK_HOSTS.has(normalized)) return true;
  if (parseAllowlist().includes(normalized)) return true;
  // Vercel preview deployments are disposable; production alias is blocked above.
  if (normalized.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * Refuse destructive integration checks against production / non-allowlisted hosts.
 * Override only with explicit WEERSPORT_ALLOW_PROD_CHECK=1 (Glenn review).
 */
export function assertDisposableCheckTarget(baseUrl) {
  if (!baseUrl) return;
  if (process.env.WEERSPORT_ALLOW_PROD_CHECK === "1") return;
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`Invalid WEERSPORT_BASE_URL: ${baseUrl}`);
  }
  if (!isDisposableCheckHost(host)) {
    throw new Error(
      `Refusing destructive checks against non-allowlisted host "${host}". ` +
        "Use loopback, a Vercel preview, or set WEERSPORT_CHECK_ALLOWLIST. " +
        "Production aliases (weersport.vercel.app / weersport.nl) are blocked.",
    );
  }
}
