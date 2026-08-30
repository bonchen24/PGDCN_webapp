import type { ActivityLog, ActivityLogChange } from '../types.ts';

export interface PcnImportBackupCheckpoint {
  filename: string;
  createdAt: string;
  status: 'VALID';
}

export interface PcnCustomerImportAuditCheckpoint extends PcnImportBackupCheckpoint {
  sourceFingerprint: string;
  auditCreatedAt: string;
}

/**
 * Keep the import audit proof small and operational: identify the exact
 * verified archive, but never copy its size, bytes, or customer payload into
 * the activity log.
 */
export function getPcnCustomerImportAuditChanges(checkpoint: PcnImportBackupCheckpoint): ActivityLogChange[] {
  return [
    { field: 'backupCheckpoint.filename', before: null, after: checkpoint.filename },
    { field: 'backupCheckpoint.createdAt', before: null, after: checkpoint.createdAt },
    { field: 'backupCheckpoint.status', before: null, after: checkpoint.status },
  ];
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function changeValue(log: ActivityLog, field: string): string {
  const change = (log.changes || []).find((item) => item.field === field);
  return cleanText(change?.after);
}

/**
 * Extract only a complete, safe checkpoint from append-only import audits.
 * Legacy imports without the complete tuple deliberately return undefined.
 */
export function getLatestPcnCustomerImportCheckpoint(
  logs: ActivityLog[],
): PcnCustomerImportAuditCheckpoint | undefined {
  const candidates = (logs || [])
    .filter((log) => log.source === 'IMPORT' && log.entityType === 'PCN_CUSTOMER')
    .slice()
    .sort((left, right) => {
      const rightTime = Date.parse(right.createdAt);
      const leftTime = Date.parse(left.createdAt);
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
        || right.id.localeCompare(left.id);
    });

  for (const log of candidates) {
    const filename = changeValue(log, 'backupCheckpoint.filename');
    const createdAt = changeValue(log, 'backupCheckpoint.createdAt');
    const status = changeValue(log, 'backupCheckpoint.status');
    const sourceFingerprint = cleanText(log.idempotencyFingerprint);
    if (!/^pcn_certification_[a-z0-9._-]+\.zip$/i.test(filename)) continue;
    const backupCreatedAt = Date.parse(createdAt);
    const auditCreatedAt = Date.parse(log.createdAt);
    if (!createdAt || Number.isNaN(backupCreatedAt)) continue;
    if (status !== 'VALID') continue;
    if (!/^[a-f0-9]{64}$/i.test(sourceFingerprint)) continue;
    if (!log.createdAt || Number.isNaN(auditCreatedAt)) continue;
    if (backupCreatedAt > auditCreatedAt) continue;
    return { filename, createdAt, status: 'VALID', sourceFingerprint, auditCreatedAt: log.createdAt };
  }

  return undefined;
}

// --- End of pcnCustomerImportAudit.ts ---
