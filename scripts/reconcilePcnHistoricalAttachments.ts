import dotenv from 'dotenv';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { pool } from '../utils/db.ts';
import { buildActivityLog } from '../utils/activityLog.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS } from '../utils/pcnDossierDocuments.ts';
import { reconcilePcnHistoricalAttachmentMapping } from '../utils/pcnHistoricalAttachmentMapping.ts';
import type { ActivityLog, CertificationDossier, PcnDocumentRequirement, PcnDossierAttachment, PcnDossierDocument } from '../types.ts';

dotenv.config();

const BATCH_ID = 'pcn-history-attachment-reconcile-v1';

interface ParsedArguments {
  apply: boolean;
  dryRun: boolean;
}

interface AppDocumentRow {
  document_id: string;
  data: Record<string, unknown>;
}

interface DossierPlan {
  dossier: CertificationDossier;
  nextDossier: CertificationDossier;
  dossierChanged: boolean;
  attachments: PcnDossierAttachment[];
  nextAttachments: PcnDossierAttachment[];
  documents: PcnDossierDocument[];
  nextDocuments: PcnDossierDocument[];
  changedAttachmentIds: string[];
  changedDocumentIds: string[];
  unmappedCount: number;
}

function parseArguments(argv: string[]): ParsedArguments {
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run') || !apply;
  if (apply && argv.includes('--dry-run')) throw new Error('Chỉ chọn một trong --dry-run hoặc --apply.');
  return { apply, dryRun };
}

function mapRow<T extends { id: string }>(row: AppDocumentRow): T {
  return { ...(row.data || {}), id: row.document_id } as T;
}

function stripId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const { id: _ignoredId, ...data } = record;
  return data;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => item === undefined ? 'null' : stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function changedIds<T extends { id: string }>(before: T[], after: T[]): string[] {
  const beforeById = new Map(before.map((item) => [item.id, stableJson(stripId(item))]));
  return after.filter((item) => beforeById.get(item.id) !== stableJson(stripId(item))).map((item) => item.id);
}

async function loadPlans(now: string): Promise<DossierPlan[]> {
  const [requirementsResult, dossierResult] = await Promise.all([
    pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnDocumentRequirements'
         AND COALESCE((data->>'active')::boolean, false) = true
       ORDER BY COALESCE((data->>'sortOrder')::int, 0), document_id`,
    ),
    pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'certificationDossiers'
         AND data->'historicalImport' IS NOT NULL
       ORDER BY document_id`,
    ),
  ]);
  const requirements = requirementsResult.rows.length > 0
    ? requirementsResult.rows.map((row: AppDocumentRow) => mapRow<PcnDocumentRequirement>(row))
    : DEFAULT_PCN_DOCUMENT_REQUIREMENTS;
  const plans: DossierPlan[] = [];
  for (const dossierRow of dossierResult.rows as AppDocumentRow[]) {
    const dossier = mapRow<CertificationDossier>(dossierRow);
    const [attachmentsResult, documentsResult] = await Promise.all([
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
    ]);
    const attachments = attachmentsResult.rows.map((row: AppDocumentRow) => mapRow<PcnDossierAttachment>(row));
    const documents = documentsResult.rows.map((row: AppDocumentRow) => mapRow<PcnDossierDocument>(row));
    const mapped = reconcilePcnHistoricalAttachmentMapping({
      dossierId: dossier.id,
      fieldCodes: dossier.fieldCodes || [],
      attachments,
      existingDocuments: documents,
      requirements,
      now,
    });
    const changedAttachmentIds = changedIds(attachments, mapped.attachments);
    const changedDocumentIds = changedIds(documents, mapped.documents);
    const dossierChanged = changedAttachmentIds.length > 0 || changedDocumentIds.length > 0;
    plans.push({
      dossier,
      nextDossier: dossierChanged ? { ...dossier, updatedAt: now } : dossier,
      dossierChanged,
      attachments,
      nextAttachments: mapped.attachments,
      documents,
      nextDocuments: mapped.documents,
      changedAttachmentIds,
      changedDocumentIds,
      unmappedCount: mapped.attachments.filter((item) => item.mappingStatus === 'UNMAPPED').length,
    });
  }
  return plans;
}

function summarize(plans: DossierPlan[], now: string) {
  const unmappedByKind: Record<string, number> = {};
  for (const plan of plans) {
    for (const attachment of plan.nextAttachments) {
      if (attachment.mappingStatus === 'UNMAPPED') unmappedByKind[attachment.kind] = (unmappedByKind[attachment.kind] || 0) + 1;
    }
  }
  return {
    batchId: BATCH_ID,
    checkedAt: now,
    dossierCount: plans.length,
    attachmentChanges: plans.reduce((sum, plan) => sum + plan.changedAttachmentIds.length, 0),
    documentChanges: plans.reduce((sum, plan) => sum + plan.changedDocumentIds.length, 0),
    dossierChanges: plans.filter((plan) => plan.dossierChanged).length,
    unmappedAttachments: plans.reduce((sum, plan) => sum + plan.unmappedCount, 0),
    unmappedByKind,
    dossiers: plans.map((plan) => ({
      dossierCode: plan.dossier.dossierCode,
      attachmentChanges: plan.changedAttachmentIds.length,
      documentChanges: plan.changedDocumentIds.length,
      dossierChanged: plan.dossierChanged,
      unmappedAttachments: plan.unmappedCount,
    })),
  };
}

async function applyPlans(plans: DossierPlan[], now: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const plan of plans) {
      for (const attachment of plan.nextAttachments.filter((item) => plan.changedAttachmentIds.includes(item.id))) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierAttachments', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
          [attachment.id, JSON.stringify(stripId(attachment))],
        );
      }
      for (const document of plan.nextDocuments.filter((item) => plan.changedDocumentIds.includes(item.id))) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
          [document.id, JSON.stringify(stripId(document))],
        );
      }
      if (plan.dossierChanged) {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [plan.nextDossier.id, JSON.stringify(stripId(plan.nextDossier))],
        );
      }
      if (plan.dossierChanged) {
        const log: ActivityLog = buildActivityLog({
          id: `activity-${BATCH_ID}-${plan.dossier.id}`,
          createdAt: now,
          actorName: 'Đối soát mapping hồ sơ lịch sử',
          action: 'UPDATED',
          entityType: 'PCN_DOSSIER',
          entityId: plan.dossier.id,
          entityLabel: plan.dossier.dossierCode,
          summary: `Đối soát mapping tệp lịch sử: ${plan.changedAttachmentIds.length} tệp, ${plan.changedDocumentIds.length} mục checklist`,
          source: 'IMPORT',
          groupId: BATCH_ID,
        });
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [log.id, JSON.stringify(stripId(log))],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function runPcnHistoricalAttachmentReconcile(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(argv);
  if (String(process.env.APP_PROFILE || '').trim().toLowerCase() !== 'pcn') {
    throw new Error('Đối soát mapping hồ sơ lịch sử PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  }
  const now = new Date().toISOString();
  const plans = await loadPlans(now);
  console.log(JSON.stringify(summarize(plans, now), null, 2));
  if (options.dryRun) {
    console.log('DRY-RUN: chưa ghi database; mapping chỉ cập nhật metadata pointer, không đọc hoặc sửa byte Storage.');
    return;
  }
  await applyPlans(plans, now);
  console.log(`Đã đối soát mapping ${plans.length} hồ sơ lịch sử PCN.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnHistoricalAttachmentReconcile().catch((error) => {
    console.error('Đối soát mapping hồ sơ lịch sử PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}
