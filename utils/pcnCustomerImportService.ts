import { createHash } from 'node:crypto';

import type { CustomerRef, UserRole } from '../types.ts';
import { buildActivityLog } from './activityLog.ts';
import { listBackups, verifyBackupArchive } from './backupManager.ts';
import { getPcnImportBackupGateErrors, isPcnImportBackupCandidate } from './pcnImportBackupGate.ts';
import { getPcnCustomerImportAuditChanges, type PcnImportBackupCheckpoint } from './pcnCustomerImportAudit.ts';
import { mapPcnCustomerAliasCustomer, validatePcnCustomerAliasDecisions, type PcnCustomerAliasDecision } from './pcnCustomerImportAlias.ts';
import { buildPcnCustomerReconciliation, hasPcnCustomerBusinessChanges, hashPcnCustomers, mergePcnImportedCustomer, type PcnCustomerMigrationPreview } from './pcnCustomerMigration.ts';
import { getPcnDocumentId } from './pcnStorePolicy.ts';

export interface PcnCustomerImportActor {
  username?: string;
  name?: string;
  role?: UserRole;
}

export interface PcnCustomerImportDb {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<{ document_id: string; data: Record<string, any> }>; rowCount?: number }>;
}

export interface PcnCustomerImportApplyResult {
  importedCount: number;
  idempotent: boolean;
  customerIds: string[];
}

function mapCustomerRows(rows: Array<{ document_id: string; data: Record<string, any> }>): CustomerRef[] {
  return rows.map((row) => ({
    ...(row.data || {}),
    name: String(row.data?.name || ''),
    address: String(row.data?.address || ''),
    customerCode: row.data?.customerCode || (row.data?.name ? undefined : row.document_id),
  }));
}

export async function loadPcnCustomersForImport(db: PcnCustomerImportDb, lock = false): Promise<CustomerRef[]> {
  const lockClause = lock ? ' FOR UPDATE' : '';
  const result = await db.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'customers'
     ORDER BY document_id${lockClause}`,
  );
  return mapCustomerRows(result.rows);
}

export async function requirePcnImportBackup(checkpoint: Date | string): Promise<PcnImportBackupCheckpoint> {
  const candidate = listBackups().find((backup) => isPcnImportBackupCandidate(backup, checkpoint));
  if (!candidate) {
    throw new Error('Không thể apply import khách hàng khi chưa có archive PCN dạng ZIP được tạo trước checkpoint.');
  }
  const verification = await verifyBackupArchive(candidate.filename);
  const errors = getPcnImportBackupGateErrors(candidate, verification, checkpoint);
  if (errors.length > 0) {
    throw new Error(`Archive PCN không đạt cổng backup trước import: ${errors.join(' ')}`);
  }
  return { filename: candidate.filename, createdAt: candidate.createdAt, status: 'VALID' };
}

function stableImportActivityId(importGroupId: string, documentId: string): string {
  const fingerprint = createHash('sha256').update(`${importGroupId}:${documentId}`, 'utf8').digest('hex').slice(0, 32);
  return `${importGroupId}-${fingerprint}`;
}

export function preparePcnCustomerImportAliasDecisions(
  preview: PcnCustomerMigrationPreview,
  existing: CustomerRef[],
  decisions: unknown,
): { preview: PcnCustomerMigrationPreview; decisions: PcnCustomerAliasDecision[] } {
  const reconciliation = buildPcnCustomerReconciliation(preview.acceptedCustomers, existing);
  let normalizedDecisions: PcnCustomerAliasDecision[];
  try {
    normalizedDecisions = validatePcnCustomerAliasDecisions(reconciliation.possibleAliasMatches, decisions);
  } catch (error: any) {
    throw Object.assign(new Error(String(error?.message || error)), { statusCode: 409 });
  }
  const decisionBySource = new Map(normalizedDecisions.map((decision) => [decision.sourceKey, decision]));
  const existingByKey = new Map(existing.map((customer) => [getPcnDocumentId(customer).toLowerCase(), customer]));
  const acceptedCustomers = preview.acceptedCustomers.map((customer) => {
    const decision = decisionBySource.get(getPcnDocumentId(customer).toLowerCase());
    if (!decision || decision.mode !== 'MAP_TO_TARGET') return customer;
    const target = existingByKey.get(decision.targetKey || '');
    if (!target) throw Object.assign(new Error('Không tìm thấy khóa đích của quyết định mapping alias trong danh mục hiện tại.'), { statusCode: 409 });
    return mapPcnCustomerAliasCustomer(customer, target, decision);
  });
  const targetAfterByKey = new Map<string, CustomerRef>(
    existing.map((customer) => [getPcnDocumentId(customer).toLowerCase(), customer]),
  );
  for (const customer of acceptedCustomers) {
    const key = getPcnDocumentId(customer).toLowerCase();
    targetAfterByKey.set(key, mergePcnImportedCustomer(targetAfterByKey.get(key), customer, preview.generatedAt));
  }
  return {
    decisions: normalizedDecisions,
    preview: {
      ...preview,
      acceptedCustomers,
      targetHashAfter: hashPcnCustomers([...targetAfterByKey.values()]),
    },
  };
}

export async function applyPcnCustomerImport(
  preview: PcnCustomerMigrationPreview,
  existing: CustomerRef[],
  backupCheckpoint: PcnImportBackupCheckpoint,
  actor: PcnCustomerImportActor,
  client: PcnCustomerImportDb,
  aliasDecisions: unknown = [],
): Promise<PcnCustomerImportApplyResult> {
  const prepared = preparePcnCustomerImportAliasDecisions(preview, existing, aliasDecisions);
  const preparedPreview = prepared.preview;
  const existingByKey = new Map(existing.map((customer) => [getPcnDocumentId(customer).toLowerCase(), customer]));
  const aliasFingerprint = createHash('sha256').update(JSON.stringify(prepared.decisions), 'utf8').digest('hex').slice(0, 12);
  const importGroupId = `pcn-customer-import-${preparedPreview.sourceHash.slice(0, 16)}-${aliasFingerprint}-${createHash('sha256').update(backupCheckpoint.filename, 'utf8').digest('hex').slice(0, 12)}`;
  const now = new Date().toISOString();
  let importedCount = 0;
  const customerIds: string[] = [];

  for (const imported of preparedPreview.acceptedCustomers) {
    const key = getPcnDocumentId(imported).toLowerCase();
    const existingCustomer = existingByKey.get(key);
    const customer = mergePcnImportedCustomer(existingCustomer, imported, now);
    if (!hasPcnCustomerBusinessChanges(existingCustomer, customer)) continue;
    importedCount += 1;
    const documentId = getPcnDocumentId(customer);
    customerIds.push(documentId);
    const { id: _ignoredId, ...customerData } = customer as CustomerRef & { id?: string };
    await client.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ('customers', $1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
      [documentId, JSON.stringify(customerData)],
    );

    const log = buildActivityLog({
      id: stableImportActivityId(importGroupId, documentId),
      createdAt: now,
      actorUsername: actor.username,
      actorName: actor.name || 'PCN customer import job',
      actorRole: actor.role,
      action: 'IMPORTED',
      entityType: 'PCN_CUSTOMER',
      entityId: documentId,
      entityLabel: customer.name || documentId,
      summary: `Nhập danh mục khách hàng từ ${preparedPreview.sourceLabel}`,
      source: 'IMPORT',
      groupId: importGroupId,
      idempotencyFingerprint: preparedPreview.sourceHash,
      changes: getPcnCustomerImportAuditChanges(backupCheckpoint),
    });
    const { id: logId, ...logData } = log;
    await client.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id) DO NOTHING`,
      [logId, JSON.stringify(logData)],
    );
  }

  return { importedCount, idempotent: importedCount === 0, customerIds };
}

export function buildPcnCustomerImportPreviewData(
  preview: PcnCustomerMigrationPreview,
  existing: CustomerRef[],
) {
  return {
    sourceLabel: preview.sourceLabel,
    sourceCount: preview.sourceCount,
    validCount: preview.validCount,
    acceptedCount: preview.acceptedCount,
    rejected: preview.rejected,
    duplicateKeys: preview.duplicateKeys,
    existingConflictCount: preview.existingConflictCount,
    rows: preview.rows.map((row) => ({
      sourceIndex: row.sourceIndex,
      key: row.key,
      name: row.customer.name,
      customerCode: String(row.customer.customerCode || ''),
      isDuplicate: row.isDuplicate,
      conflictsWithExisting: row.conflictsWithExisting,
    })),
    sourceHash: preview.sourceHash,
    targetHashBefore: preview.targetHashBefore,
    targetHashAfter: preview.targetHashAfter,
    generatedAt: preview.generatedAt,
    reconciliation: buildPcnCustomerReconciliation(preview.acceptedCustomers, existing),
  };
}

export function getPcnCustomerImportTargetHash(customers: CustomerRef[]): string {
  return hashPcnCustomers(customers);
}

// --- End of pcnCustomerImportService.ts ---
