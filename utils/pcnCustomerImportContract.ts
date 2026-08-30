import type { CustomerRef } from '../types.ts';
import type { PcnCustomerImportIssue, PcnCustomerReconciliationReport } from './pcnCustomerReconciliation.ts';
import type { PcnCustomerAliasDecision } from './pcnCustomerImportAlias.ts';

export interface PcnCustomerImportPreviewRow {
  sourceIndex: number;
  key: string;
  name: string;
  customerCode: string;
  isDuplicate: boolean;
  conflictsWithExisting: boolean;
}

export interface PcnCustomerImportPreviewData {
  sourceLabel: string;
  sourceCount: number;
  validCount: number;
  acceptedCount: number;
  rejected: PcnCustomerImportIssue[];
  duplicateKeys: string[];
  existingConflictCount: number;
  rows: PcnCustomerImportPreviewRow[];
  sourceHash: string;
  targetHashBefore: string;
  targetHashAfter: string;
  generatedAt: string;
  reconciliation: PcnCustomerReconciliationReport;
}

export interface PcnCustomerImportPreviewResponse {
  preview: PcnCustomerImportPreviewData;
}

export interface PcnImportBackupCheckpointContract {
  filename: string;
  createdAt: string;
  status: 'VALID';
}

export interface PcnCustomerImportApplyResponse {
  importedCount: number;
  idempotent: boolean;
  sourceHash: string;
  targetHashBefore: string;
  backupCheckpoint: PcnImportBackupCheckpointContract;
  customerIds?: string[];
}

export interface PcnCustomerImportApplyInput {
  sourceLabel: string;
  customers: unknown[];
  expectedSourceHash: string;
  expectedTargetHashBefore: string;
  confirmation: string;
  aliasDecisions?: PcnCustomerAliasDecision[];
}

export type PcnCustomerImportSourceRecord = CustomerRef;

// --- End of pcnCustomerImportContract.ts ---
