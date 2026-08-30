import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { PoolClient } from 'pg';

import { buildActivityLog } from '../utils/activityLog.ts';
import { pool } from '../utils/db.js';
import { resolveDatabaseConfig } from '../utils/pcnDatabase.ts';
import { getBackupPath, verifyBackupArchive } from '../utils/backupManager.js';
import {
  PCN_LEGACY_COLLECTION_MAPPINGS,
  planPcnLegacyCollectionReconciliation,
  type PcnLegacyCollectionDocument,
  type PcnLegacyCollectionPlan,
} from '../utils/pcnLegacyCollectionPolicy.ts';

const APPLY_CONFIRMATION = 'PCN_LEGACY_CLEANUP';

function parseArguments(argv: string[]): { apply: boolean; backupFilename: string; confirmation: string } {
  const backupArgument = argv.find((value) => value.startsWith('--backup='));
  const confirmationArgument = argv.find((value) => value.startsWith('--confirm='));
  return {
    apply: argv.includes('--apply'),
    backupFilename: backupArgument ? backupArgument.slice('--backup='.length).trim() : '',
    confirmation: confirmationArgument ? confirmationArgument.slice('--confirm='.length).trim() : '',
  };
}

async function readCollection(collectionName: string): Promise<PcnLegacyCollectionDocument[]> {
  const result = await pool.query(
    'SELECT document_id, data FROM app_documents WHERE collection_name = $1 ORDER BY document_id',
    [collectionName],
  );
  return result.rows.map((row) => ({ documentId: String(row.document_id), data: row.data || {} }));
}

async function createAuditLog(client: PoolClient, plan: PcnLegacyCollectionPlan, deletedIds: string[]) {
  const log = buildActivityLog({
    action: 'DELETED',
    entityType: 'SYSTEM',
    entityId: plan.legacyCollection,
    entityLabel: plan.legacyCollection,
    actorUsername: 'pcn-migration',
    actorName: 'PCN migration',
    actorRole: 'admin',
    summary: `Dọn collection legacy ${plan.legacyCollection} sau khi đối chiếu trùng collection chuẩn ${plan.canonicalCollection}`,
    changes: [{ field: 'documentIds', before: deletedIds, after: [] }],
    source: 'IMPORT',
  });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [log.id, JSON.stringify({ ...log, id: undefined })],
  );
}

export async function reconcilePcnLegacyCollections(argv = process.argv.slice(2)): Promise<void> {
  const config = resolveDatabaseConfig(process.env);
  if (config.profile !== 'pcn') throw new Error('Dọn collection legacy PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  const { apply, backupFilename, confirmation } = parseArguments(argv);
  const plans: PcnLegacyCollectionPlan[] = [];

  for (const mapping of PCN_LEGACY_COLLECTION_MAPPINGS) {
    const [legacyDocuments, canonicalDocuments] = await Promise.all([
      readCollection(mapping.legacyCollection),
      readCollection(mapping.canonicalCollection),
    ]);
    plans.push(planPcnLegacyCollectionReconciliation({ ...mapping, legacyDocuments, canonicalDocuments }));
  }

  if (!apply) {
    console.log(JSON.stringify({ mode: 'DRY_RUN', profile: config.profile, database: config.database, plans }, null, 2));
    return;
  }

  if (plans.some((plan) => !plan.safeToRemove)) {
    throw new Error(`Không thể --apply: collection legacy có bản ghi thiếu hoặc xung đột canonical. ${JSON.stringify(plans)}`);
  }
  if (confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Thiếu xác nhận chính xác: --confirm=${APPLY_CONFIRMATION}`);
  }
  if (!backupFilename) {
    throw new Error('Phải chỉ rõ archive backup PCN đã tồn tại bằng --backup=<filename>.');
  }
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
    for (const plan of plans) {
      if (plan.matchingIds.length === 0) continue;
      await client.query(
        'DELETE FROM app_documents WHERE collection_name = $1 AND document_id = ANY($2::text[])',
        [plan.legacyCollection, plan.matchingIds],
      );
      await createAuditLog(client, plan, plan.matchingIds);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ mode: 'APPLIED', profile: config.profile, database: config.database, plans }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  reconcilePcnLegacyCollections().catch((error) => {
    console.error('Dọn collection legacy PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of reconcilePcnLegacyCollections.ts ---
