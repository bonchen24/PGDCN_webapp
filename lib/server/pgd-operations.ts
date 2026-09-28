import { PoolClient } from 'pg';
import {
  ActivityLog,
  ActivityLogAction,
  ActivityLogChange,
  ActivityLogEntityType,
  PcnUserAccount,
} from '@/types';
import { buildActivityLog } from '@/utils/activityLog';
import { getDocumentPayload } from './collections';
import { PGD_COLLECTIONS, PgdInspectionRequest } from '@/utils/pgdDomain';
import {
  PgdDocumentTemplate,
  PgdDocumentTemplateKind,
  getPgdDocumentTemplates,
} from '@/utils/pgdDocumentTemplates';
import { PgdOperationalStationKey, getPgdOperationalStepAccess } from '@/utils/pgdWorkflow';

export type PgdActivityInput = {
  action: ActivityLogAction;
  entityId: string;
  entityLabel?: string;
  requestCode?: string;
  summary: string;
  changes?: ActivityLogChange[];
  entityType?: ActivityLogEntityType;
  idSuffix?: string;
  notify?: any;
};

export async function writePgdActivity(
  client: PoolClient,
  actor: PcnUserAccount | null,
  input: PgdActivityInput,
): Promise<ActivityLog> {
  const activityId = `pgd-activity-${input.entityId}-${input.idSuffix || input.action}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const activity = buildActivityLog({
    domain: 'PGD',
    id: activityId,
    actorUsername: actor?.username,
    actorName: actor?.name,
    actorRole: actor?.systemRole || actor?.role,
    action: input.action,
    entityType: input.entityType || 'SYSTEM',
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    requestCode: input.requestCode,
    summary: input.summary,
    changes: input.changes,
    source: 'UI',
    createdAt,
    groupId: input.requestCode || input.entityId,
  });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [PGD_COLLECTIONS.activityLogs, activity.id, JSON.stringify({ ...getDocumentPayload(activity), domain: 'pgd' })],
  );
  if (input.notify) {
    const notification = {
      ...input.notify,
      id: `pgd-notif-${activity.id}`,
      domain: 'PGD' as const,
      createdAt: activity.createdAt,
      read: false,
    };
    await client.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id) DO NOTHING`,
      ['notifications', notification.id, JSON.stringify(notification)],
    );
  }
  return activity;
}

export function assertPgdRequestStationMutationAllowed(
  request: PgdInspectionRequest,
  targetStationKey: PgdOperationalStationKey,
): void {
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey });
  if (!access.editable) throw Object.assign(new Error(access.reason || 'Thao tác PGD đang bị khóa theo trạm hồ sơ.'), { statusCode: 409 });
}

export function getPgdGeneratedDocumentStationKey(kind: PgdDocumentTemplateKind): PgdOperationalStationKey {
  if (kind === 'INTAKE_REQUEST') return 'INTAKE_CAPABILITY';
  if (kind === 'ASSIGNMENT' || kind === 'INSPECTION_PLAN') return 'PREPARATION';
  if (
    kind === 'FIELD_INSPECTION'
    || kind === 'SAMPLE_TAKING'
    || kind === 'LAB_REQUEST'
    || kind === 'CASE_TIMELINE'
    || kind === 'FIELD_ACTIVITY_LOG'
    || kind === 'INSPECTION_MINUTES'
    || kind === 'SAMPLE_HANDOVER'
  ) return 'FIELD_SAMPLING';
  if (kind === 'LAB_RESULT_REVIEW') return 'LAB_RESULTS';
  return 'REPORT_APPROVAL_RETURN';
}

export function isPgdDocumentTemplateRecordAllowed(item: any): boolean {
  return Boolean(item && typeof item === 'object' && item.id && item.kind && item.domain === 'pgd');
}

export function normalizePgdDocumentTemplate(item: any): PgdDocumentTemplate {
  return {
    ...item,
    id: String(item.id),
    code: String(item.code || item.id),
    name: String(item.name || item.code || item.id),
    kind: item.kind,
    version: Number(item.version || 1),
    active: item.active !== false,
    status: item.status || 'ACTIVE',
  } as PgdDocumentTemplate;
}

export function getPgdDocumentTemplate(
  kind: PgdDocumentTemplateKind,
  productGroup?: string,
  method?: string,
): PgdDocumentTemplate | undefined {
  const templates = getPgdDocumentTemplates();
  return templates.find((t) => t.kind === kind);
}
