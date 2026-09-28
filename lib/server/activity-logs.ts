import { buildActivityLog as buildActivityLogBase, isValidActivityTimestamp, ACTIVITY_LOG_ACTIONS, ACTIVITY_LOG_ENTITY_TYPES, ACTIVITY_LOG_SOURCES, validateActivityLogPayload } from '@/utils/activityLog';
export { ACTIVITY_LOG_ACTIONS, ACTIVITY_LOG_ENTITY_TYPES, ACTIVITY_LOG_SOURCES, validateActivityLogPayload };
import { canOpenPgdcnActivitySource, normalizePgdcnActivityLog, type ActivitySourceCollection, type PgdcnActivityLog } from '@/utils/pgdcnActivity';







export const buildActivityLog = (input: Parameters<typeof buildActivityLogBase>[0]): ReturnType<typeof buildActivityLogBase> => (
  buildActivityLogBase({ domain: 'PCN', ...input })
);



export function normalizeActivityDateBound(value: string, endOfDay = false): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const baseUtc = Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0), 0, 0, 0, 0);
    const utcMillis = baseUtc - (7 * 60 * 60 * 1000) - (endOfDay ? 1 : 0);
    return new Date(utcMillis).toISOString();
  }
  return value;
}

export function encodeActivityCursor(createdAt: string, domain: 'PCN' | 'PGD', id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, domain, id }), 'utf8').toString('base64url');
}

export function decodeActivityCursor(rawCursor: string): { createdAt: string; domain?: 'PCN' | 'PGD'; id: string } | null {
  if (!rawCursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string' || !parsed.createdAt || !parsed.id) {
      return null;
    }
    const domain = parsed.domain === 'PCN' || parsed.domain === 'PGD' ? parsed.domain : undefined;
    return { createdAt: parsed.createdAt, ...(domain ? { domain } : {}), id: parsed.id };
  } catch {
    return null;
  }
}

export const PGDCN_ACTIVITY_SOURCE_QUERY = `
  SELECT document_id, data, 'PCN'::text AS activity_domain, 'activityLogs'::text AS activity_source_collection
  FROM app_documents
  WHERE collection_name = 'activityLogs'
  UNION ALL
  SELECT document_id, data, 'PGD'::text AS activity_domain, 'pgdActivityLogs'::text AS activity_source_collection
  FROM app_documents
  WHERE collection_name = 'pgdActivityLogs'
`;

export function mapPgdcnActivityQueryRow(
  row: { document_id: string; data: Record<string, any>; activity_domain?: string; activity_source_collection?: string },
  departmentScopes: readonly ('PCN' | 'PGD')[],
): PgdcnActivityLog {
  const sourceCollection: ActivitySourceCollection = row.activity_source_collection === 'pgdActivityLogs'
    ? 'pgdActivityLogs'
    : 'activityLogs';
  const activity = normalizePgdcnActivityLog({
    ...(row.data || {}),
    id: row.document_id,
    ...(row.activity_domain ? { domain: row.activity_domain } : {}),
  }, sourceCollection);
  if (!canOpenPgdcnActivitySource(activity, departmentScopes)) {
    delete (activity as any).navigationTarget;
  }
  return activity;
}
