import type { HomeConfig } from './types';

const DRAFT_KEY = 'choretation-home-draft';

/** JSON with object keys sorted, since the database hands fields back in a different order. */
function stableJson(v: unknown): string {
  return JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}

export const sameHome = (a: HomeConfig, b: HomeConfig) => stableJson(a) === stableJson(b);

/** Home edits not saved yet on this device, if any. */
export function loadHomeDraft(): HomeConfig | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    return Array.isArray(d?.rooms) ? d : null;
  } catch {
    return null;
  }
}

export function saveHomeDraft(home: HomeConfig | null) {
  try {
    if (home) localStorage.setItem(DRAFT_KEY, JSON.stringify(home));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* per-device safety net only */
  }
}
