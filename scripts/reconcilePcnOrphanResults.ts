import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { PoolClient } from 'pg';

import { buildActivityLog } from '../utils/activityLog.js';
import { pool } from '../utils/db.js';
import { getBackupPath, verifyBackupArchive } from '../utils/backupManager.js';
import { resolveDatabaseConfig } from '../utils/pcnDatabase.ts';
import { planPcnOrphanResultCleanup, type PcnOrphanResultCleanupRecord } from '../utils/pcnOrphanResultCleanup.ts';

const APPLY_CONFIRMATION = 'PCN_ORPHAN_RESULT_CLEANUP';

type QueryExecutor = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

function parseArguments(argv: string[]): { apply: boolean; backupFilename: string; confirmation: string } {
  const backupArgument = argv.find((value) => value.startsWith('--backup='));
  const confirmationArgument = argv.find((value) => value.startsWith('--confirm='));
  return {
    apply: argv.includes('--apply'),
    backupFilename: backupArgument ? backupArgument.slice('--backup='.length).trim() : '',
    confirmation: confirmationArgument ? confirmationArgument.slice('--confirm='.length).trim() : '',
  };
}

async function readOrphanResultRecords(executor: QueryExecutor): Promise<PcnOrphanResultCleanupRecord[]> {
  const result = await executor.query(
    `SELECT r.document_id, COALESCE(r.data, '{}'::jsonb) AS data,
       (
         SELECT COUNT(*)
         FROM app_documents d
         WHERE d.collection_name = 'certificationDossiers'
           AND COALESCE(d.data -> 'returnedResultIds', '[]'::jsonb) ? r.document_id
       )::int AS dossier_reference_count,
       (
         SELECT COUNT(*)
         FROM app_documents l
         WHERE l.collection_name = 'labRequests'
           AND l.data ->> 'returnedResultId' = r.document_id
       )::int AS lab_request_reference_count,
       (
         SELECT COUNT(*)
         FROM file_assets f
         WHERE f.source_collection = 'returnedResults'
           AND f.source_document_id = r.document_id
       )::int AS file_asset_count,
       (
         SELECT COUNT(*)
         FROM app_documents a
         WHERE a.collection_name = 'activityLogs'
           AND a.data ->> 'entityId' = r.document_id
       )::int AS activity_reference_count
     FROM app_documents r
     WHERE r.collection_name = 'returnedResults'
     ORDER BY r.document_id`,
  );
  return result.rows.map((row) => ({
    documentId: String(row.document_id || ''),
    data: row.data || {},
    dossierReferenceCount: Number(row.dossier_reference_count || 0),
    labRequestReferenceCount: Number(row.lab_request_reference_count || 0),
    fileAssetCount: Number(row.file_asset_count || 0),
    activityReferenceCount: Number(row.activity_reference_count || 0),
  }));
}

function auditId(documentId: string): string {
  return `activity-pcn-orphan-result-cleanup-${createHash('sha256').update(documentId, 'utf8').digest('hex')}`;
}

async function createAuditLog(client: PoolClient, documentId: string): Promise<void> {
  const log = buildActivityLog({
    id: auditId(documentId),
    action: 'DELETED',
    entityType: 'SYSTEM',
    entityId: documentId,
    entityLabel: 'returnedResults',
    actorUsername: 'pcn-migration',
    actorName: 'PCN data repair',
    actorRole: 'admin',
    summary: 'Dọn bản ghi KQTN rỗng không liên kết',
    changes: [{ field: 'documentId', before: documentId, after: [] }],
    source: 'IMPORT',
  });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [log.id, JSON.stringify({ ...log, id: undefined })],
  );
}

export async function reconcilePcnOrphanResults(argv = process.argv.slice(2)): Promise<void> {
  const config = resolveDatabaseConfig(process.env);
  if (config.profile !== 'pcn') throw new Error('Dọn orphan KQTN PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  const { apply, backupFilename, confirmation } = parseArguments(argv);
  const plan = planPcnOrphanResultCleanup(await readOrphanResultRecords(pool));

  if (!apply) {
    console.log(JSON.stringify({ mode: 'DRY_RUN', profile: config.profile, database: config.database, plan }, null, 2));
    return;
  }

  if (!plan.safeToRemove) throw new Error(`Không thể --apply: có KQTN không đủ điều kiện dọn. ${JSON.stringify(plan)}`);
  if (confirmation !== APPLY_CONFIRMATION) throw new Error(`Thiếu xác nhận chính xác: --confirm=${APPLY_CONFIRMATION}`);
  if (!backupFilename) throw new Error('Phải chỉ rõ archive backup PCN đã tồn tại bằng --backup=<filename>.');
  if (!/^pcn_certification_[a-z0-9._-]+\.zip$/i.test(backupFilename)) {
    throw new Error('Archive cleanup phải thuộc namespace backup PCN dạng pcn_certification_*.zip.');
  }
  getBackupPath(backupFilename);
  const backupVerification = await verifyBackupArchive(backupFilename);
  if (!backupVerification.ok || backupVerification.status !== 'VALID') {
    throw new Error(`Archive backup PCN không đạt trạng thái VALID: ${backupVerification.errors.join(' ') || backupVerification.status}.`);
  }

  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const transactionPlan = planPcnOrphanResultCleanup(await readOrphanResultRecords(client));
    if (!transactionPlan.safeToRemove || JSON.stringify(transactionPlan.candidateIds) !== JSON.stringify(plan.candidateIds)) {
      throw new Error(`Snapshot KQTN thay đổi sau dry-run; không tiếp tục dọn. ${JSON.stringify(transactionPlan)}`);
    }
    for (const documentId of plan.candidateIds) {
      const deleted = await client.query(
        `DELETE FROM app_documents
         WHERE collection_name = 'returnedResults' AND document_id = $1
         RETURNING document_id`,
        [documentId],
      );
      if (deleted.rows.length > 0) await createAuditLog(client, documentId);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ mode: 'APPLIED', profile: config.profile, database: config.database, plan }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  reconcilePcnOrphanResults().catch((error) => {
    console.error('Dọn orphan KQTN PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of reconcilePcnOrphanResults.ts ---
