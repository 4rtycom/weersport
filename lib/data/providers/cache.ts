type Entry = { expiresAt: number; value: unknown };

const entries = new Map<string, Entry>();

export function readCache<T>(key: string): T | null {
  const row = entries.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    entries.delete(key);
    return null;
  }
  return row.value as T;
}

export function writeCache<T>(key: string, value: T, ttlMs: number) {
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearProviderCache() {
  entries.clear();
}
