// Author: Codex
// Description: Re-encode existing PCN proposal and sample-lot identifiers

import dotenv from 'dotenv';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PoolClient } from 'pg';

import { buildActivityLog } from '../utils/activityLog.ts';
import { initDbSchema, pool } from '../utils/db.js';
import {
  resequencePcnProposalCodes,
  resequencePcnSampleLotCodes,
} from '../utils/pcnIdentifier.ts';
import { resolveDatabaseConfig } from '../utils/pcnDatabase.ts';

dotenv.config();

export const PCN_IDENTIFIER_MIGRATION_CONFIRMATION = 'PCN_IDENTIFIER_REENCODE';

interface StoredDocument<T extends Record<string, unknown> = Record<string, unknown>> {
  documentId: string;
  data: T;
}

interface IdentifierMigrationPlan {
  proposals: Array<{ documentId: string; oldCode: string; newCode: string }>;
  lots: Array<{ documentId: string; oldCode: string; newCode: string }>;
}

function parseArguments(argv: string[]): { apply: boolean; confirmation: string } {
  const confirmationArgument = argv.find((value) => value.startsWith('--confirm='));
  return {
    apply: argv.includes('--apply'),
    confirmation: confirmationArgument ? confirmationArgument.slice('--confirm='.length).trim() : '',
  };
}

async function readCollection<T extends Record<string, unknown>>(collectionName: string): Promise<StoredDocument<T>[]> {
  const result = await pool.query(
    'SELECT document_id, data FROM app_documents WHERE collection_name = $1 ORDER BY document_id',
    [collectionName],
  );
  return result.rows.map((row) => ({ documentId: String(row.document_id), data: (row.data || {}) as T }));
}

export function buildPcnIdentifierMigrationPlan(
  proposals: StoredDocument[],
  lots: StoredDocument[],
): IdentifierMigrationPlan {
  const proposalRecords = proposals.map((document) => ({ ...document.data, id: document.documentId, proposalCode: String(document.data.proposalCode || '') }));
  const lotRecords = lots.map((document) => ({ ...document.data, id: document.documentId, lotCode: String(document.data.lotCode || '') }));
  const nextProposals = resequencePcnProposalCodes(proposalRecords);
  const nextLots = resequencePcnSampleLotCodes(lotRecords);
  const proposalById = new Map(nextProposals.map((record) => [record.id, record.proposalCode]));
  const lotById = new Map(nextLots.map((record) => [record.id, record.lotCode]));

  return {
    proposals: proposals.map((document) => ({
      documentId: document.documentId,
      oldCode: String(document.data.proposalCode || ''),
      newCode: proposalById.get(document.documentId) || '',
    })),
    lots: lots.map((document) => ({
      documentId: document.documentId,
      oldCode: String(document.data.lotCode || ''),
      newCode: lotById.get(document.documentId) || '',
    })),
  };
}

async function updateIdentifier(
  client: PoolClient,
  collectionName: string,
  documentId: string,
  fieldName: 'proposalCode' | 'lotCode',
  value: string,
): Promise<void> {
  await client.query(
    `UPDATE app_documents
        SET data = jsonb_set(data, ARRAY[$2::text], to_jsonb($3::text), true),
            updated_at = CURRENT_TIMESTAMP
      WHERE collection_name = $1 AND document_id = $4`,
    [collectionName, fieldName, value, documentId],
  );
}

async function writePlan(client: PoolClient, plan: IdentifierMigrationPlan): Promise<void> {
  for (const item of plan.proposals) {
    await updateIdentifier(client, 'certificationProposals', item.documentId, 'proposalCode', `__pcn_migration_proposal__${item.documentId}`);
  }
  for (const item of plan.lots) {
    await updateIdentifier(client, 'pcnSampleLots', item.documentId, 'lotCode', `__pcn_migration_lot__${item.documentId}`);
  }
  for (const item of plan.proposals) {
    await updateIdentifier(client, 'certificationProposals', item.documentId, 'proposalCode', item.newCode);
  }
  for (const item of plan.lots) {
    await updateIdentifier(client, 'pcnSampleLots', item.documentId, 'lotCode', item.newCode);
  }
}

async function writeMigrationAudit(client: PoolClient, plan: IdentifierMigrationPlan): Promise<void> {
  const log = buildActivityLog({
    action: 'IMPORTED',
    entityType: 'SYSTEM',
    entityId: 'PCN_IDENTIFIER_MIGRATION',
    entityLabel: 'PCN_IDENTIFIER_MIGRATION',
    actorUsername: 'pcn-migration',
    actorName: 'PCN migration',
    actorRole: 'admin',
    summary: 'Mã hóa lại mã Đề nghị và mã lô PCN theo quy tắc hiện hành',
    changes: [
      { field: 'proposalCount', before: plan.proposals.length, after: plan.proposals.length },
      { field: 'sampleLotCount', before: plan.lots.length, after: plan.lots.length },
    ],
    source: 'IMPORT',
  });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [log.id, JSON.stringify({ ...log, id: undefined })],
  );
}

export async function runPcnIdentifierMigration(argv = process.argv.slice(2)): Promise<void> {
  const config = resolveDatabaseConfig(process.env);
  const options = parseArguments(argv);
  if (config.profile !== 'pcn') throw new Error('Migration mã PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');

  await initDbSchema();
  const [proposals, lots] = await Promise.all([
    readCollection('certificationProposals'),
    readCollection('pcnSampleLots'),
  ]);
  const plan = buildPcnIdentifierMigrationPlan(proposals, lots);
  console.log(JSON.stringify({
    mode: options.apply ? 'APPLY_REQUESTED' : 'DRY_RUN',
    profile: config.profile,
    database: config.database,
    proposalCount: plan.proposals.length,
    sampleLotCount: plan.lots.length,
    proposals: plan.proposals,
    lots: plan.lots,
  }, null, 2));

  if (!options.apply) {
    console.log(`DRY-RUN: chưa ghi dữ liệu. Dùng --apply --confirm=${PCN_IDENTIFIER_MIGRATION_CONFIRMATION} sau khi đối soát.`);
    return;
  }
  if (options.confirmation !== PCN_IDENTIFIER_MIGRATION_CONFIRMATION) {
    throw new Error(`Thiếu xác nhận chính xác: --confirm=${PCN_IDENTIFIER_MIGRATION_CONFIRMATION}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await writePlan(client, plan);
    await writeMigrationAudit(client, plan);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ mode: 'APPLIED', proposalCount: plan.proposals.length, sampleLotCount: plan.lots.length }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnIdentifierMigration().catch((error) => {
    console.error('Migration mã PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of migratePcnIdentifiers.ts ---
