import type { PcnCutoverSnapshot } from './pcnCutoverVerification.ts';
import type { PcnBackupVerification } from './pcnBackupVerification.ts';

type SafeBackupVerification = Omit<PcnBackupVerification, 'sizeBytes'>;

export type SafePcnCutoverSnapshot = Omit<PcnCutoverSnapshot, 'backupVerification' | 'customerImportBackupVerification'> & {
  backupVerification?: SafeBackupVerification;
  customerImportBackupVerification?: SafeBackupVerification;
};

function withoutArchiveSize(verification: PcnBackupVerification): SafeBackupVerification {
  const { sizeBytes: _sizeBytes, ...safeVerification } = verification;
  return safeVerification;
}

/**
 * Keep cutover evidence useful without putting archive byte size in CLI exports.
 * The full verification object remains available to the server/UI boundary;
 * this projection is only for the operator-facing CLI report.
 */
export function buildSafePcnCutoverSnapshot(snapshot: PcnCutoverSnapshot): SafePcnCutoverSnapshot {
  const { backupVerification, customerImportBackupVerification, ...safeSnapshot } = snapshot;
  return {
    ...safeSnapshot,
    ...(backupVerification ? { backupVerification: withoutArchiveSize(backupVerification) } : {}),
    ...(customerImportBackupVerification
      ? { customerImportBackupVerification: withoutArchiveSize(customerImportBackupVerification) }
      : {}),
  };
}

// --- End of pcnCutoverReport.ts ---
