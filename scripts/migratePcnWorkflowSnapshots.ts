// Author: Codex
// Description: Attach versioned workflow snapshots and task seeds to legacy PCN dossiers.

import dotenv from 'dotenv';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PoolClient } from 'pg';

import { initDbSchema, pool } from '../utils/db.ts';
import { buildPcnWorkflowBackfillPlan } from '../utils/pcnWorkflowBackfill.ts';
import type { CertificationDossier, CertificationProposal, PcnWorkflowTemplate } from '../types.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

interface StoredDocument {
  documentId: string;
  data: Record<string, any>;
}

function parseArguments(argv: string[]): { apply: boolean } {
  return { apply: argv.includes('--apply') };
}

async function readCollection(client: PoolClient, collectionName: string): Promise<StoredDocument[]> {
  const result = await client.query(
    'SELECT document_id, data FROM app_documents WHERE collection_name = $1 ORDER BY document_id',
    [collectionName],
  );
  return result.rows.map((row) => ({ documentId: String(row.document_id), data: (row.data || {}) as Record<string, any> }));
}

function toDossiers(rows: readonly StoredDocument[]): CertificationDossier[] {
  return rows.map((row) => ({ ...row.data, id: row.documentId }) as CertificationDossier);
}

function toProposals(rows: readonly StoredDocument[]): CertificationProposal[] {
  return rows.map((row) => ({ ...row.data, id: row.documentId }) as CertificationProposal);
}

function toTemplates(rows: readonly StoredDocument[]): PcnWorkflowTemplate[] {
  return rows.map((row) => ({ ...row.data, id: row.documentId }) as PcnWorkflowTemplate);
}

function summarizeSkipped(items: readonly { reason: string }[]): Record<string, number> {
  return items.reduce<Record<string, number>>((summary, item) => {
    summary[item.reason] = (summary[item.reason] || 0) + 1;
    return summary;
  }, {});
}

async function applyPlan(client: PoolClient, plan: ReturnType<typeof buildPcnWorkflowBackfillPlan>): Promise<number> {
  let applied = 0;
  for (const item of plan.plans) {
    const dossierWrite = await client.query(
      `UPDATE app_documents
          SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE collection_name = 'certificationDossiers'
          AND document_id = $1
          AND NOT (data ? 'workflowSnapshot')
        RETURNING document_id`,
      [item.dossierId, JSON.stringify(item.dossier)],
    );
    if (dossierWrite.rowCount !== 1) continue;
    for (const task of item.tasks) {
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnDossierWorkflowTasks', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [task.id, JSON.stringify(task)],
      );
    }
    applied += 1;
  }
  return applied;
}

export async function runPcnWorkflowSnapshotMigration(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(argv);
  await initDbSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pcn-workflow-snapshot-backfill'))");
    const dossierRows = await readCollection(client, 'certificationDossiers');
    const proposalRows = await readCollection(client, 'certificationProposals');
    const templateRows = await readCollection(client, 'pcnWorkflowTemplates');
    const plan = buildPcnWorkflowBackfillPlan({
      dossiers: toDossiers(dossierRows),
      proposals: toProposals(proposalRows),
      templates: toTemplates(templateRows),
      now: new Date().toISOString(),
      actor: 'pcn-workflow-migration',
    });
    console.log(JSON.stringify({
      mode: options.apply ? 'APPLY_REQUESTED' : 'DRY_RUN',
      legacyDossiers: plan.plans.length + plan.skipped.filter((item) => /đã có snapshot/i.test(item.reason)).length,
      plannedDossiers: plan.plans.length,
      plannedTasks: plan.plans.reduce((total, item) => total + item.tasks.length, 0),
      skipped: summarizeSkipped(plan.skipped),
    }, null, 2));

    if (!options.apply) {
      await client.query('ROLLBACK');
      console.log('DRY-RUN: chưa ghi dữ liệu. Dùng --apply để backfill snapshot workflow cho hồ sơ legacy.');
      return;
    }

    const applied = await applyPlan(client, plan);
    await client.query('COMMIT');
    console.log(JSON.stringify({ mode: 'APPLIED', dossiers: applied, tasks: plan.plans.filter((item) => item.dossierId).reduce((total, item) => total + item.tasks.length, 0) }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnWorkflowSnapshotMigration().catch((error) => {
    console.error('Backfill workflow snapshot PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of migratePcnWorkflowSnapshots.ts ---
