/**
 * Offline-first merge helpers — pure functions, no dependencies.
 * Used by the Zustand store hydrate() to merge Neon data into local state
 * while keeping localStorage as the source of truth.
 */

/** Normalize Postgres/ISO timestamps → epoch ms (0 if unparseable). */
export function parseTs(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  const s = String(ts);
  // "2026-09-03 07:00:00+00" → "2026-09-03T07:00:00+00:00"
  const norm = s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const t = Date.parse(norm);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Offline-first merge — local is source of truth:
 * - Records still in the pending queue (offline-created) are ALWAYS kept from local.
 * - Non-pending records fall back to Neon. If a version timestamp is provided,
 *   the NEWER version wins (LWW by updatedAt); otherwise Neon is authoritative.
 */
export function mergeByTs<T extends { id: string }>(
  local: T[],
  neon: T[],
  pendingIds: Set<string>,
  tsOf?: (r: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const l of local) map.set(l.id, l);
  for (const n of neon) {
    const l = map.get(n.id);
    if (!l) {
      map.set(n.id, n); // new record from another device
      continue;
    }
    if (pendingIds.has(n.id)) continue; // local pending → keep local
    if (!tsOf) {
      map.set(n.id, n); // no version field → Neon is authoritative
      continue;
    }
    const nTs = parseTs(tsOf(n));
    const lTs = parseTs(tsOf(l));
    map.set(n.id, nTs >= lTs ? n : l); // LWW by version
  }
  return Array.from(map.values());
}