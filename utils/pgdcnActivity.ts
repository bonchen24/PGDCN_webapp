import type { ActivityLogDomain, ActivityLogChange, DepartmentScope } from '../types.ts';

export type ActivitySourceCollection = 'activityLogs' | 'pgdActivityLogs';

export interface PgdcnActivitySourceRow {
  sourceCollection: ActivitySourceCollection;
  row: unknown;
}

export interface PgdcnActivityNavigationTarget {
  domain: ActivityLogDomain;
  entityId: string;
  entityType: string;
}

export interface PgdcnActivityLog {
  id: string;
  createdAt: string;
  domain: ActivityLogDomain;
  sourceCollection: ActivitySourceCollection;
  actorUsername?: string;
  actorName: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  summary: string;
  changes?: ActivityLogChange[];
  source?: string;
  groupId?: string;
  navigationTarget?: PgdcnActivityNavigationTarget;
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const asText = (value: unknown): string | undefined => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

const inferDomain = (row: Record<string, unknown>, sourceCollection: ActivitySourceCollection): ActivityLogDomain => {
  const explicit = String(row.domain || '').trim().toUpperCase();
  if (explicit === 'PCN' || explicit === 'PGD') return explicit;
  return sourceCollection === 'pgdActivityLogs' ? 'PGD' : 'PCN';
};

const safeChanges = (value: unknown): ActivityLogChange[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const change = asRecord(item);
      return {
        field: String(change.field || ''),
        before: change.before ?? null,
        after: change.after ?? null,
      };
    })
    .filter((item) => item.field);
};

export function normalizePgdcnActivityLog(
  value: unknown,
  sourceCollection: ActivitySourceCollection,
): PgdcnActivityLog {
  const row = asRecord(value);
  const domain = inferDomain(row, sourceCollection);
  const id = asText(row.id) || `${sourceCollection}-${String(row.createdAt || 'unknown')}`;
  const entityId = asText(row.entityId);
  const entityType = asText(row.entityType) || 'SYSTEM';
  const normalized: PgdcnActivityLog = {
    id,
    createdAt: asText(row.createdAt) || '',
    domain,
    sourceCollection,
    actorUsername: asText(row.actorUsername),
    actorName: asText(row.actorName) || 'Hệ thống',
    actorRole: asText(row.actorRole),
    action: asText(row.action) || 'UPDATED',
    entityType,
    entityId,
    entityLabel: asText(row.entityLabel),
    requestCode: asText(row.requestCode),
    docNumber: asText(row.docNumber),
    reportNo: asText(row.reportNo),
    summary: asText(row.summary) || 'Thao tác hệ thống',
    changes: safeChanges(row.changes),
    source: asText(row.source),
    groupId: asText(row.groupId),
  };
  if (entityId) {
    normalized.navigationTarget = { domain, entityId, entityType };
  }
  return normalized;
}

const domainRank: Record<ActivityLogDomain, number> = { PGD: 1, PCN: 2 };

export function comparePgdcnActivityLogs(a: PgdcnActivityLog, b: PgdcnActivityLog): number {
  const byCreatedAt = b.createdAt.localeCompare(a.createdAt);
  if (byCreatedAt !== 0) return byCreatedAt;
  const byDomain = domainRank[b.domain] - domainRank[a.domain];
  if (byDomain !== 0) return byDomain;
  return b.id.localeCompare(a.id);
}

export function encodePgdcnActivityCursor(log: PgdcnActivityLog): string {
  return encodeURIComponent(`${log.createdAt}|${log.domain}|${log.id}`);
}

const decodeCursor = (value: string | null | undefined): { createdAt: string; domain: ActivityLogDomain; id: string } | null => {
  if (!value) return null;
  const [createdAt, domain, ...idParts] = decodeURIComponent(value).split('|');
  if ((domain !== 'PCN' && domain !== 'PGD') || !createdAt || !idParts.length) return null;
  return { createdAt, domain, id: idParts.join('|') };
};

export function mergePgdcnActivityLogs(
  rows: PgdcnActivitySourceRow[],
  options: { limit?: number; cursor?: string | null; domain?: ActivityLogDomain | 'ALL' } = {},
): { items: PgdcnActivityLog[]; nextCursor: string | null; hasMore: boolean } {
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit || 50)));
  const cursor = decodeCursor(options.cursor);
  const cursorLog = cursor
    ? normalizePgdcnActivityLog({ id: cursor.id, createdAt: cursor.createdAt, domain: cursor.domain }, cursor.domain === 'PGD' ? 'pgdActivityLogs' : 'activityLogs')
    : null;
  const items = rows
    .map(({ row, sourceCollection }) => normalizePgdcnActivityLog(row, sourceCollection))
    .filter((item) => !options.domain || options.domain === 'ALL' || item.domain === options.domain)
    .sort(comparePgdcnActivityLogs)
    .filter((item) => !cursorLog || comparePgdcnActivityLogs(item, cursorLog) > 0);
  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: items.length > limit && page.length ? encodePgdcnActivityCursor(page[page.length - 1]) : null,
    hasMore: items.length > limit,
  };
}

export function canOpenPgdcnActivitySource(
  activity: PgdcnActivityLog,
  departmentScopes: readonly DepartmentScope[],
): boolean {
  return Boolean(activity.navigationTarget?.entityId && departmentScopes.includes(activity.domain));
}
