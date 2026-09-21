export type PgdcnRecentDomain = 'PCN' | 'PGD';

export type PgdcnRecentRecord = {
  domain: PgdcnRecentDomain;
  recordId: string;
  openedAt: string;
};

const MAX_RECENT_RECORDS = 6;

function storageKey(username: string): string {
  return `pgdcn_recent_records_${username}`;
}

export function readPgdcnRecentRecords(username?: string | null): PgdcnRecentRecord[] {
  if (typeof window === 'undefined' || !username) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(username)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PgdcnRecentRecord => Boolean(
        item
        && typeof item === 'object'
        && (item as PgdcnRecentRecord).domain
        && ((item as PgdcnRecentRecord).domain === 'PCN' || (item as PgdcnRecentRecord).domain === 'PGD')
        && typeof (item as PgdcnRecentRecord).recordId === 'string'
        && typeof (item as PgdcnRecentRecord).openedAt === 'string',
      ))
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
      .slice(0, MAX_RECENT_RECORDS);
  } catch {
    return [];
  }
}

export function writePgdcnRecentRecords(username: string | null | undefined, records: readonly PgdcnRecentRecord[]): void {
  if (typeof window === 'undefined' || !username) return;
  window.localStorage.setItem(storageKey(username), JSON.stringify(records.slice(0, MAX_RECENT_RECORDS)));
}

export function rememberPgdcnRecentRecord(
  records: readonly PgdcnRecentRecord[],
  domain: PgdcnRecentDomain,
  recordId: string,
  now = new Date().toISOString(),
): PgdcnRecentRecord[] {
  if (!recordId) return [...records].slice(0, MAX_RECENT_RECORDS);
  return [
    { domain, recordId, openedAt: now },
    ...records.filter((item) => !(item.domain === domain && item.recordId === recordId)),
  ].slice(0, MAX_RECENT_RECORDS);
}

export const PGDCN_RECENT_RECORD_LIMIT = MAX_RECENT_RECORDS;
