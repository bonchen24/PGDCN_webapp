import { createHash } from 'node:crypto';

import type { CustomerRef } from '../types.ts';
import { normalizeCustomerRecord } from './customerRecord.ts';
import { getPcnDocumentId } from './pcnStorePolicy.ts';
import {
  PCN_CUSTOMER_FIELDS,
  buildPcnCustomerReconciliation as buildCanonicalCustomerReconciliation,
  normalizePcnCustomerImport as normalizeCanonicalCustomerImport,
  parsePcnCustomerCsv as parseCanonicalCustomerCsv,
} from './pcnCustomerReconciliation.ts';
import type {
  PcnCustomerField,
  PcnCustomerImportIssue,
  PcnCustomerReconciliationReport,
} from './pcnCustomerReconciliation.ts';

export {
  buildCanonicalCustomerReconciliation as buildPcnCustomerReconciliation,
  normalizeCanonicalCustomerImport as normalizePcnCustomerImport,
  parseCanonicalCustomerCsv as parsePcnCustomerCsv,
};
export type { PcnCustomerField, PcnCustomerImportIssue, PcnCustomerReconciliationReport } from './pcnCustomerReconciliation.ts';

export interface PcnCustomerMigrationRow {
  sourceIndex: number;
  key: string;
  customer: CustomerRef;
  isDuplicate: boolean;
  conflictsWithExisting: boolean;
}

export interface PcnCustomerMigrationPreview {
  sourceLabel: string;
  sourceCount: number;
  validCount: number;
  acceptedCount: number;
  rejected: PcnCustomerImportIssue[];
  duplicateKeys: string[];
  existingConflictCount: number;
  rows: PcnCustomerMigrationRow[];
  acceptedCustomers: CustomerRef[];
  sourceHash: string;
  targetHashBefore: string;
  targetHashAfter: string;
  generatedAt: string;
}

const CUSTOMER_FIELDS = PCN_CUSTOMER_FIELDS;
type CustomerField = PcnCustomerField;

function customerHashValue(customer: CustomerRef): Record<string, string> {
  return Object.fromEntries(CUSTOMER_FIELDS.map((field) => [field, customerFieldValue(customer, field)])) as Record<string, string>;
}

function customerFieldValue(customer: CustomerRef, field: CustomerField): string {
  const value = String(customer[field] || '').trim();
  return field === 'customerCode' ? value.toLowerCase() : value;
}

export function hasPcnCustomerBusinessChanges(existing: CustomerRef | undefined, next: CustomerRef): boolean {
  if (!existing) return true;
  return CUSTOMER_FIELDS.some((field) => customerFieldValue(existing, field) !== customerFieldValue(next, field));
}

export function hashPcnCustomers(customers: CustomerRef[]): string {
  const canonical = customers
    .map(customerHashValue)
    .sort((left, right) => `${left.customerCode}\u0000${left.name}`.localeCompare(`${right.customerCode}\u0000${right.name}`));
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

export function buildPcnCustomerMigrationPreview(
  incoming: unknown[],
  existing: CustomerRef[] = [],
  options: { sourceLabel?: string; generatedAt?: string } = {},
): PcnCustomerMigrationPreview {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const rejected: PcnCustomerImportIssue[] = [];
  const candidates: PcnCustomerMigrationRow[] = [];

  for (const [offset, item] of (incoming || []).entries()) {
    const sourceIndex = offset + 1;
    const customer = normalizeCanonicalCustomerImport(item, generatedAt);
    if (!customer) {
      rejected.push({ sourceIndex, reason: 'Thiếu mã khách hàng hoặc tên khách hàng hợp lệ' });
      continue;
    }
    const key = getPcnDocumentId(customer).toLowerCase();
    candidates.push({
      sourceIndex,
      key,
      customer,
      isDuplicate: false,
      conflictsWithExisting: existing.some((item) => getPcnDocumentId(item).toLowerCase() === key),
    });
  }

  const counts = new Map<string, number>();
  for (const row of candidates) counts.set(row.key, (counts.get(row.key) || 0) + 1);
  const duplicateKeys = [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key).sort();
  for (const row of candidates) row.isDuplicate = (counts.get(row.key) || 0) > 1;

  const acceptedByKey = new Map<string, CustomerRef>();
  for (const row of candidates) {
    if (!acceptedByKey.has(row.key)) acceptedByKey.set(row.key, row.customer);
  }
  const acceptedCustomers = [...acceptedByKey.values()];
  const targetBefore = existing || [];
  const targetAfterByKey = new Map<string, CustomerRef>(
    targetBefore.map((customer) => [getPcnDocumentId(customer).toLowerCase(), customer]),
  );
  for (const customer of acceptedCustomers) {
    const key = getPcnDocumentId(customer).toLowerCase();
    targetAfterByKey.set(key, mergePcnImportedCustomer(targetAfterByKey.get(key), customer, generatedAt));
  }
  const targetAfter = [...targetAfterByKey.values()];

  return {
    sourceLabel: options.sourceLabel || 'PCN customer import',
    sourceCount: (incoming || []).length,
    validCount: candidates.length,
    acceptedCount: acceptedCustomers.length,
    rejected,
    duplicateKeys,
    existingConflictCount: candidates.filter((row) => row.conflictsWithExisting).length,
    rows: candidates,
    acceptedCustomers,
    sourceHash: hashPcnCustomers(candidates.map((row) => row.customer)),
    targetHashBefore: hashPcnCustomers(targetBefore),
    targetHashAfter: hashPcnCustomers(targetAfter),
    generatedAt,
  };
}

export function mergePcnImportedCustomer(existing: CustomerRef | undefined, incoming: CustomerRef, now: string): CustomerRef {
  const merged: Partial<CustomerRef> = { ...(existing || {}) };
  for (const field of CUSTOMER_FIELDS) {
    const incomingValue = String(incoming[field] || '').trim();
    if (incomingValue) merged[field] = incomingValue;
  }
  return normalizeCustomerRecord(merged, existing, now);
}

// --- End of pcnCustomerMigration.ts ---
