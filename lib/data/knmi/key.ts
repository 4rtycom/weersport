/** Presence only. The key value is never returned, logged, or stored. */

export function knmiKeyConfigured(): boolean {
  const key = process.env.KNMI_API_KEY;
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 80) return false;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.endsWith("...") || trimmed.endsWith("…")) return false;
  return true;
}

export function readKnmiKey(): string | null {
  if (!knmiKeyConfigured()) return null;
  return process.env.KNMI_API_KEY!.trim();
}
