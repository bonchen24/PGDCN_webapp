// Author: Codex
// OS support: Web/Node
// Description: Moves legacy ITDC request codes from atdEncodeNumber to itdEncodeNumber.

import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

import { initDbSchema, pool } from '../utils/db.ts';
import {
  migrateItdcToItdRecord,
  planItdcToItdMigration,
  type ItdcToItdMigrationStatus,
} from '../utils/itdcToItdMigration.ts';

dotenv.config();

const COLLECTION_NAME = 'requests';

interface RequestDocumentRow {
  document_id: string;
  data: Record<string, unknown>;
}

export interface ItdcToItdMigrationSummary {
  mode: 'dry-run' | 'apply';
  scanned: number;
  migrated: number;
  alreadyMigrated: number;
  conflicts: number;
  unchanged: number;
  applied: number;
  conflictIds: string[];
}

export interface ItdcToItdMigrationOptions {
  apply?: boolean;
}

function countStatus(summary: ItdcToItdMigrationSummary, status: ItdcToItdMigrationStatus): void {
  if (status === 'migrate') summary.migrated += 1;
  if (status === 'already_migrated') summary.alreadyMigrated += 1;
  if (status === 'conflict') summary.conflicts += 1;
  if (status === 'unchanged') summary.unchanged += 1;
}

export function parseItdcToItdMigrationOptions(argv: string[]): ItdcToItdMigrationOptions {
  return { apply: argv.includes('--apply') };
}

export async function migrateItdcToItd(
  options: ItdcToItdMigrationOptions = {},
): Promise<ItdcToItdMigrationSummary> {
  await initDbSchema();
  const result = await pool.query<RequestDocumentRow>(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = $1
       AND COALESCE(data->>'atdEncodeNumber', '') <> ''
     ORDER BY document_id`,
    [COLLECTION_NAME],
  );

  const summary: ItdcToItdMigrationSummary = {
    mode: options.apply ? 'apply' : 'dry-run',
    scanned: result.rows.length,
    migrated: 0,
    alreadyMigrated: 0,
    conflicts: 0,
    unchanged: 0,
    applied: 0,
    conflictIds: [],
  };

  const migrations = result.rows.map((row) => {
    const plan = planItdcToItdMigration({
      id: row.document_id,
      atdEncodeNumber: row.data?.atdEncodeNumber,
      itdEncodeNumber: row.data?.itdEncodeNumber,
    });
    countStatus(summary, plan.status);
    if (plan.status === 'conflict') summary.conflictIds.push(row.document_id);
    return { row, plan, migratedRecord: migrateItdcToItdRecord(row.data) };
  });

  if (!options.apply) return summary;

  const pending = migrations.filter((migration) => migration.plan.status === 'migrate');
  if (pending.length === 0) return summary;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const migration of pending) {
      const sourceValue = String(migration.row.data.atdEncodeNumber).trim();
      const updateResult = await client.query(
        `UPDATE app_documents
         SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $2
           AND document_id = $3
           AND data->>'atdEncodeNumber' = $4`,
        [JSON.stringify(migration.migratedRecord.record), COLLECTION_NAME, migration.row.document_id, sourceValue],
      );
      if (updateResult.rowCount !== 1) {
        throw new Error(`Bản ghi ${migration.row.document_id} đã thay đổi trong lúc migration; transaction đã được rollback.`);
      }
      summary.applied += 1;
    }
    await client.query('COMMIT');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    summary.applied = 0;
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const options = parseItdcToItdMigrationOptions(process.argv.slice(2));
  const summary = await migrateItdcToItd(options);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.conflicts > 0) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main()
    .catch((error) => {
      console.error('Migration ITDC → ITD thất bại:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

// --- End of migrateItdcToItd.ts ---
