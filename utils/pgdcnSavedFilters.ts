export type PgdcnSavedFilterSnapshot = {
  query: string;
  values: Record<string, string>;
};

export type PgdcnSavedFilter = {
  id: string;
  name: string;
  snapshot: PgdcnSavedFilterSnapshot;
  updatedAt: string;
};

const MAX_SAVED_FILTERS = 8;

function storageKey(domain: 'PCN' | 'PGD', username: string): string {
  return `pgdcn_saved_filters_${domain}_${username}`;
}

export function readPgdcnSavedFilters(domain: 'PCN' | 'PGD', username?: string | null): PgdcnSavedFilter[] {
  if (typeof window === 'undefined' || !username) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(domain, username)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PgdcnSavedFilter => Boolean(
        item
        && typeof item === 'object'
        && typeof (item as PgdcnSavedFilter).id === 'string'
        && typeof (item as PgdcnSavedFilter).name === 'string'
        && (item as PgdcnSavedFilter).snapshot
        && typeof (item as PgdcnSavedFilter).snapshot.query === 'string'
        && typeof (item as PgdcnSavedFilter).snapshot.values === 'object',
      ))
      .slice(0, MAX_SAVED_FILTERS);
  } catch {
    return [];
  }
}

export function writePgdcnSavedFilters(
  domain: 'PCN' | 'PGD',
  username: string | null | undefined,
  filters: readonly PgdcnSavedFilter[],
): void {
  if (typeof window === 'undefined' || !username) return;
  window.localStorage.setItem(storageKey(domain, username), JSON.stringify(filters.slice(0, MAX_SAVED_FILTERS)));
}

export function upsertPgdcnSavedFilter(
  filters: readonly PgdcnSavedFilter[],
  name: string,
  snapshot: PgdcnSavedFilterSnapshot,
  now = new Date().toISOString(),
): PgdcnSavedFilter[] {
  const trimmedName = name.trim();
  if (!trimmedName) return [...filters];
  const existing = filters.find((item) => item.name.toLocaleLowerCase('vi-VN') === trimmedName.toLocaleLowerCase('vi-VN'));
  const next = {
    id: existing?.id || `saved-filter-${Date.now()}`,
    name: trimmedName,
    snapshot,
    updatedAt: now,
  };
  return [next, ...filters.filter((item) => item.id !== existing?.id)].slice(0, MAX_SAVED_FILTERS);
}

export const PGDCN_SAVED_FILTER_LIMIT = MAX_SAVED_FILTERS;
