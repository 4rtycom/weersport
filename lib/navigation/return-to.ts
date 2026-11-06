/** Paths a legal or support page may send someone back to. */
const RETURN_LABELS: Record<string, string> = {
  "/": "homepage",
  "/auth/inloggen": "inloggen",
  "/auth/registreren": "registreren",
  "/auth/hervat": "bewaarde zoekopdracht",
  "/account": "account",
  "/account/abonnement": "abonnement",
  "/account/facturering": "facturering",
  "/account/privacy": "privacy en data",
  "/checkout/pro": "Pro-checkout",
  "/privacy": "privacy",
  "/sporten": "sporten",
  "/support": "support",
  "/support/terugbetaling": "terugbetalingen",
  "/voorwaarden": "voorwaarden",
};

export type ReturnTarget = { href: string; label: string };

const FALLBACK: ReturnTarget = { href: "/", label: "homepage" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Accept only a plain, allowlisted path. Reject protocol, host, and encoded tricks. */
export function sanitizeReturnPath(value: string | undefined) {
  if (!value || value.length > 80) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("%") || value.includes("?")) {
    return null;
  }
  const path = value.split("#")[0];
  if (!RETURN_LABELS[path]) return null;
  return path;
}

function pathFromReferer(referer: string | null | undefined, host: string | null | undefined) {
  if (!referer || !host) return null;
  try {
    const url = new URL(referer);
    if (url.host !== host) return null;
    return sanitizeReturnPath(url.pathname);
  } catch {
    return null;
  }
}

export function resolveReturnTarget(input: {
  van?: string | string[];
  referer?: string | null;
  host?: string | null;
}): ReturnTarget {
  const fromQuery = sanitizeReturnPath(first(input.van));
  if (fromQuery) return { href: fromQuery, label: RETURN_LABELS[fromQuery] };
  const fromReferer = pathFromReferer(input.referer, input.host);
  if (fromReferer) return { href: fromReferer, label: RETURN_LABELS[fromReferer] };
  return FALLBACK;
}
