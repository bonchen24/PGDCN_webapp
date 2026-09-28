import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { jsonError, jsonOk, jsonServerError } from '@/lib/server/response';
import {
  PGDCN_ACTIVITY_SOURCE_QUERY,
  normalizeActivityDateBound,
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
  const params: any[] = [];
  const conditions = ['TRUE'];
  const addParam = (value: any): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const actors = getActivityQueryValues(req, 'actor');
  const from = getActivityQueryText(req, 'from');
  const to = getActivityQueryText(req, 'to');
  const domain = getActivityQueryText(req, 'domain').toUpperCase();
  if (domain && domain !== 'ALL' && domain !== 'PCN' && domain !== 'PGD') {
    return jsonError('domain phải là ALL, PCN hoặc PGD', 400);
  }

  const pcnActivityKpi = true; // DATABASE_PROFILE === 'pcn'
  const proposalEntityPredicate = pcnActivityKpi
    ? "data->>'entityType' IN ('PCN_PROPOSAL', 'PCN_DOSSIER')"
    : "data->>'entityType' = 'REQUEST'";
  const proposalCreatedPredicate = pcnActivityKpi
    ? "data->>'entityType' = 'PCN_PROPOSAL'"
    : "data->>'entityType' = 'REQUEST'";
  const kqtnEntityPredicate = pcnActivityKpi
    ? "data->>'entityType' = 'PCN_RESULT'"
    : "data->>'entityType' = 'KQTN_RECORD'";
  const handoverEntityPredicate = pcnActivityKpi
    ? "data->>'entityType' IN ('PCN_LAB_REQUEST', 'PCN_SAMPLE_LOT')"
    : "data->>'entityType' = 'HANDOVER_DOC'";
  const scheduleEntityPredicate = pcnActivityKpi
    ? 'FALSE'
    : "data->>'entityType' = 'SCHEDULE'";
  const otherEntityPredicate = pcnActivityKpi
    ? "data->>'entityType' NOT IN ('PCN_PROPOSAL', 'PCN_DOSSIER', 'PCN_RESULT', 'PCN_LAB_REQUEST', 'PCN_SAMPLE_LOT')"
    : "data->>'entityType' NOT IN ('REQUEST', 'KQTN_RECORD', 'HANDOVER_DOC', 'SCHEDULE')";

  if (domain && domain !== 'ALL') conditions.push(`activity_domain = ${addParam(domain)}`);
  if (actors.length === 1) conditions.push(`data->>'actorUsername' = ${addParam(actors[0])}`);
  if (actors.length > 1) conditions.push(`data->>'actorUsername' = ANY(${addParam(actors)})`);
  if (from) conditions.push(`data->>'createdAt' >= ${addParam(normalizeActivityDateBound(from))}`);
  if (to) conditions.push(`data->>'createdAt' <= ${addParam(normalizeActivityDateBound(to, true))}`);

  try {
    const result = await pool.query(
      `
      SELECT
        COALESCE(data->>'actorUsername', '') AS "actorUsername",
        MAX(COALESCE(data->>'actorName', 'Hệ thống')) AS "actorName",
        COUNT(*)::int AS "totalActions",
        COUNT(DISTINCT CASE WHEN ${proposalCreatedPredicate} AND data->>'action' = 'CREATED' THEN NULLIF(data->>'entityId', '') END)::int AS "requestsCreated",
        COUNT(DISTINCT CASE WHEN ${pcnActivityKpi ? "data->>'entityType' = 'PCN_SAMPLE_LOT'" : "data->>'entityType' = 'KQTN_RECORD'"} AND data->>'action' IN ('CREATED', 'UPDATED') THEN NULLIF(data->>'entityId', '') END)::int AS "samplesProcessed",
        COUNT(DISTINCT CASE WHEN ${kqtnEntityPredicate} AND data->>'action' = 'UPDATED' THEN NULLIF(data->>'entityId', '') END)::int AS "kqtnUpdated",
        COUNT(DISTINCT CASE WHEN ${pcnActivityKpi ? "data->>'entityType' = 'PCN_LAB_REQUEST'" : "data->>'entityType' = 'HANDOVER_DOC'"} AND data->>'action' = 'CREATED' THEN NULLIF(data->>'entityId', '') END)::int AS "handoversCreated",
        COUNT(*) FILTER (WHERE data->>'action' IN ('ASSIGNED', 'SCHEDULED', 'UNSCHEDULED', 'STATUS_CHANGED'))::int AS "workActions",
        COUNT(*) FILTER (WHERE ${proposalEntityPredicate})::int AS "requestActions",
        COUNT(*) FILTER (WHERE ${kqtnEntityPredicate})::int AS "kqtnActions",
        COUNT(*) FILTER (WHERE ${handoverEntityPredicate})::int AS "handoverActions",
        COUNT(*) FILTER (WHERE ${scheduleEntityPredicate})::int AS "scheduleActions",
        COUNT(*) FILTER (WHERE ${otherEntityPredicate})::int AS "otherActions",
        MAX(data->>'createdAt') AS "lastActivityAt"
      FROM (${PGDCN_ACTIVITY_SOURCE_QUERY}) AS activity_source
      WHERE ${conditions.join(' AND ')}
      GROUP BY data->>'actorUsername'
      ORDER BY COUNT(*) DESC, MAX(COALESCE(data->>'actorName', 'Hệ thống')) ASC`,
      params
    );
    return jsonOk({ items: result.rows });
  } catch (error: any) {
    console.error('PostgreSQL activity KPI summary error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
