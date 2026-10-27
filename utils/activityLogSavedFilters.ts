import type { ActivityLogAction, ActivityLogDomain, ActivityLogEntityType } from '../types';
import type { ActivityPeriod } from './activityLogTime';

export type ActivityLogFilterSnapshot = {
  domain: ActivityLogDomain | 'ALL';
  search: string;
  action: ActivityLogAction | '';
  entityType: ActivityLogEntityType | '';
  period: ActivityPeriod;
  selectedActors: string[];
};

export type ActivityLogSavedFilter = {
  id: string;
  name: string;
  snapshot: ActivityLogFilterSnapshot;
  updatedAt: string;
};

export const ACTIVITY_LOG_SAVED_FILTER_LIMIT = 8;

const VALID_DOMAINS: ReadonlySet<string> = new Set(['ALL', 'PCN', 'PGD']);
const VALID_PERIODS: ReadonlySet<string> = new Set(['DAY', 'WEEK', 'MONTH', 'YEAR']);

function storageKey(username: string): string {
  return `pgdcn_activity_log_saved_filters_${encodeURIComponent(username.trim())}`;
}

function isValidSnapshot(value: unknown): value is ActivityLogFilterSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const domainValid = typeof candidate.domain === 'string' && VALID_DOMAINS.has(candidate.domain);
  const searchValid = typeof candidate.search === 'string';
  const actionValid = typeof candidate.action === 'string';
  const entityTypeValid = typeof candidate.entityType === 'string';
  const periodValid = typeof candidate.period === 'string' && VALID_PERIODS.has(candidate.period);
  const actorsValid = Array.isArray(candidate.selectedActors)
    && candidate.selectedActors.every((item) => typeof item === 'string');

  return domainValid && searchValid && actionValid && entityTypeValid && periodValid && actorsValid;
}

export function readActivityLogSavedFilters(username?: string | null): ActivityLogSavedFilter[] {
  if (typeof window === 'undefined' || !username || !username.trim()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is ActivityLogSavedFilter => Boolean(
        item
        && typeof item === 'object'
        && typeof (item as ActivityLogSavedFilter).id === 'string'
        && typeof (item as ActivityLogSavedFilter).name === 'string'
        && (item as ActivityLogSavedFilter).name.trim().length > 0
        && isValidSnapshot((item as ActivityLogSavedFilter).snapshot),
      ))
      .slice(0, ACTIVITY_LOG_SAVED_FILTER_LIMIT);
  } catch {
    return [];
  }
}

export function writeActivityLogSavedFilters(
  username: string | null | undefined,
  filters: readonly ActivityLogSavedFilter[],
): boolean {
  if (typeof window === 'undefined' || !username || !username.trim()) return false;
  try {
    const safePayload = filters.slice(0, ACTIVITY_LOG_SAVED_FILTER_LIMIT);
    window.localStorage.setItem(storageKey(username), JSON.stringify(safePayload));
    return true;
  } catch {
    // Storage write errors fail safely without crashing
    return false;
  }
}

export function upsertActivityLogSavedFilter(
  filters: readonly ActivityLogSavedFilter[],
  name: string,
  snapshot: ActivityLogFilterSnapshot,
  now = new Date().toISOString(),
): ActivityLogSavedFilter[] {
  const trimmedName = name.trim();
  if (!trimmedName) return [...filters];

  const existing = filters.find(
    (item) => item.name.toLocaleLowerCase('vi-VN') === trimmedName.toLocaleLowerCase('vi-VN'),
  );

  const next: ActivityLogSavedFilter = {
    id: existing?.id || `activity-saved-filter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: trimmedName,
    snapshot: {
      ...snapshot,
      selectedActors: [...snapshot.selectedActors],
    },
    updatedAt: now,
  };

  return [next, ...filters.filter((item) => item.id !== existing?.id)].slice(
    0,
    ACTIVITY_LOG_SAVED_FILTER_LIMIT,
  );
}

export function removeActivityLogSavedFilter(
  filters: readonly ActivityLogSavedFilter[],
  id: string,
): ActivityLogSavedFilter[] {
  return filters.filter((item) => item.id !== id);
}
