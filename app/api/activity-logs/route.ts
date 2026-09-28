import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonOk, jsonServerError } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  PGDCN_ACTIVITY_SOURCE_QUERY,
  buildActivityLog,
  decodeActivityCursor,
  encodeActivityCursor,
  mapPgdcnActivityQueryRow,
  normalizeActivityDateBound,
  validateActivityLogPayload,
} from '@/lib/server/activity-logs';

export const dynamic = 'force-dynamic';

function getActivityQueryValues(req: NextRequest, paramName: string): string[] {
  const url = new URL(req.url);
  const values = url.searchParams.getAll(paramName);
  return values.map((v) => v.trim()).filter(Boolean);
}

function getActivityQueryText(req: NextRequest, paramName: string): string {
  const url = new URL(req.url);
  return (url.searchParams.get(paramName) || '').trim();
}

export async function GET(req: NextRequest) {
  const rawLimit = getActivityQueryText(req, 'limit');
  const parsedLimit = rawLimit ? Number(rawLimit) : 50;
  if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return jsonError('limit phải nằm trong khoảng 1 đến 100', 400);
  }

  const limit = Math.trunc(parsedLimit);
  const cursorValue = getActivityQueryText(req, 'cursor');
  const cursor = cursorValue ? decodeActivityCursor(cursorValue) : null;
  if (cursorValue && !cursor) {
    return jsonError('cursor không hợp lệ', 400);
  }

  const params: any[] = [];
  const conditions = ['TRUE'];
  const addParam = (value: any): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const actors = getActivityQueryValues(req, 'actor');
  const action = getActivityQueryText(req, 'action');
  const entityType = getActivityQueryText(req, 'entityType');
  const from = getActivityQueryText(req, 'from');
  const to = getActivityQueryText(req, 'to');
  const search = getActivityQueryText(req, 'search');
  const domain = getActivityQueryText(req, 'domain').toUpperCase();
  if (domain && domain !== 'ALL' && domain !== 'PCN' && domain !== 'PGD') {
    return jsonError('domain phải là ALL, PCN hoặc PGD', 400);
  }

  if (domain && domain !== 'ALL') conditions.push(`activity_domain = ${addParam(domain)}`);
  if (actors.length === 1) conditions.push(`data->>'actorUsername' = ${addParam(actors[0])}`);
  if (actors.length > 1) conditions.push(`data->>'actorUsername' = ANY(${addParam(actors)})`);
  if (action) conditions.push(`data->>'action' = ${addParam(action)}`);
  if (entityType) conditions.push(`data->>'entityType' = ${addParam(entityType)}`);
  if (from) conditions.push(`data->>'createdAt' >= ${addParam(normalizeActivityDateBound(from))}`);
  if (to) conditions.push(`data->>'createdAt' <= ${addParam(normalizeActivityDateBound(to, true))}`);
  if (search) {
    const searchParam = addParam(`%${search}%`);
    conditions.push(`(
      COALESCE(data->>'summary', '') ILIKE ${searchParam}
      OR COALESCE(data->>'entityLabel', '') ILIKE ${searchParam}
      OR COALESCE(data->>'requestCode', '') ILIKE ${searchParam}
      OR COALESCE(data->>'docNumber', '') ILIKE ${searchParam}
      OR COALESCE(data->>'reportNo', '') ILIKE ${searchParam}
    )`);
  }
  if (cursor) {
    const createdAtParam = addParam(cursor.createdAt);
    if (cursor.domain) {
      const rankParam = addParam(cursor.domain === 'PCN' ? 2 : 1);
      const idParam = addParam(cursor.id);
      conditions.push(`(
        (data->>'createdAt') < ${createdAtParam}
        OR ((data->>'createdAt') = ${createdAtParam} AND (
          CASE activity_domain WHEN 'PCN' THEN 2 WHEN 'PGD' THEN 1 ELSE 0 END < ${rankParam}
          OR (CASE activity_domain WHEN 'PCN' THEN 2 WHEN 'PGD' THEN 1 ELSE 0 END = ${rankParam} AND document_id < ${idParam})
        ))
      )`);
    } else {
      const idParam = addParam(cursor.id);
      conditions.push(`((data->>'createdAt') < ${createdAtParam} OR ((data->>'createdAt') = ${createdAtParam} AND document_id < ${idParam}))`);
    }
  }

  const limitParam = addParam(limit + 1);
  const query = `
    SELECT document_id, data, activity_domain, activity_source_collection
    FROM (${PGDCN_ACTIVITY_SOURCE_QUERY}) AS activity_source
    WHERE ${conditions.join(' AND ')}
    ORDER BY data->>'createdAt' DESC,
      CASE activity_domain WHEN 'PCN' THEN 2 WHEN 'PGD' THEN 1 ELSE 0 END DESC,
      document_id DESC
    LIMIT ${limitParam}`;

  try {
    const result = await pool.query(query, params);
    const hasMore = result.rows.length > limit;
    const visibleRows = result.rows.slice(0, limit);
    const actor = getPcnSessionUser(req);
    const departmentScopes = (actor?.departmentScopes || []).filter((scope): scope is 'PCN' | 'PGD' => scope === 'PCN' || scope === 'PGD');
    const items = visibleRows.map((row: any) => mapPgdcnActivityQueryRow(row, departmentScopes));
    const lastItem = items[items.length - 1];
    return jsonOk({
      items,
      nextCursor: hasMore && lastItem ? encodeActivityCursor(lastItem.createdAt, lastItem.domain, lastItem.id) : null,
      hasMore,
    });
  } catch (error: any) {
    console.error('PostgreSQL activity log read error:', error);
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    // In server.ts: if (DATABASE_PROFILE === 'pcn' && !requirePcnMutation(req, res)) return;
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const validationError = validateActivityLogPayload(body);
  if (validationError) {
    return jsonError(validationError, 400);
  }

  const documentId = String(body.id).trim();
  const normalizedLog = buildActivityLog(body);
  try {
    const result = await pool.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id) DO NOTHING
       RETURNING document_id, data`,
      [documentId, JSON.stringify(getDocumentPayload(normalizedLog))]
    );
    if (result.rows.length === 0) {
      return jsonOk({ id: documentId, duplicate: true });
    }
    return jsonCreated(mapDocumentRow(result.rows[0]));
  } catch (error: any) {
    console.error('PostgreSQL activity log write error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
