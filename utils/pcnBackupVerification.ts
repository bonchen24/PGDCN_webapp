export type PcnBackupArchiveFormat = 'zip' | 'dump';
export type PcnBackupVerificationStatus = 'VALID' | 'INVALID';

export interface PcnBackupVerificationInput {
  filename: string;
  format: PcnBackupArchiveFormat;
  sizeBytes: number;
  databaseDumpPresent: boolean;
  manifestPresent: boolean;
  manifestReadable: boolean;
  manifestObjectCount: number;
  objectEntryCount: number;
  verifiedObjectCount: number;
  missingObjectCount: number;
  invalidObjectCount: number;
  pgToolAvailable: boolean;
  dumpReadable: boolean;
}
export interface PcnBackupVerification {
  filename: string;
  format: PcnBackupArchiveFormat;
  sizeBytes: number;
  databaseDumpPresent: boolean;
  manifestPresent: boolean;
  manifestObjectCount: number;
  objectEntryCount: number;
  verifiedObjectCount: number;
  missingObjectCount: number;
  invalidObjectCount: number;
  pgToolAvailable: boolean;
  dumpReadable: boolean;
  status: PcnBackupVerificationStatus;
  ok: boolean;
  errors: string[];
}

function positiveCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function buildPcnBackupVerification(
  input: PcnBackupVerificationInput,
  additionalErrors: string[] = [],
): PcnBackupVerification {
  const errors = [...additionalErrors];
  const manifestObjectCount = positiveCount(input.manifestObjectCount);
  const objectEntryCount = positiveCount(input.objectEntryCount);
  const verifiedObjectCount = positiveCount(input.verifiedObjectCount);
  const missingObjectCount = positiveCount(input.missingObjectCount);
  const invalidObjectCount = positiveCount(input.invalidObjectCount);

  if (!String(input.filename || '').trim()) errors.push('Thiếu tên archive.');
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) errors.push('Archive có dung lượng không hợp lệ.');
  if (!input.databaseDumpPresent) errors.push('Archive thiếu database.dump.');
  if (input.format === 'zip' && !input.manifestPresent) errors.push('Archive thiếu storage/manifest.json.');
  if (input.format === 'zip' && !input.manifestReadable) errors.push('Manifest Storage không đọc được.');
  if (objectEntryCount !== manifestObjectCount) {
    errors.push(`Số object trong archive (${objectEntryCount}) không khớp manifest (${manifestObjectCount}).`);
  }
  if (missingObjectCount > 0) errors.push(`Manifest còn thiếu ${missingObjectCount} object.`);
  if (invalidObjectCount > 0) errors.push(`Có ${invalidObjectCount} object không qua kiểm tra byte size/SHA-256.`);
  if (verifiedObjectCount !== manifestObjectCount) {
    errors.push(`Mới kiểm chứng ${verifiedObjectCount}/${manifestObjectCount} object theo manifest.`);
  }
  if (!input.pgToolAvailable) errors.push('Không có pg_restore để kiểm chứng database.dump.');
  else if (!input.dumpReadable) errors.push('pg_restore không đọc được database.dump.');

  const ok = errors.length === 0;
  return {
    filename: String(input.filename || '').trim(),
    format: input.format,
    sizeBytes: input.sizeBytes,
    databaseDumpPresent: input.databaseDumpPresent,
    manifestPresent: input.manifestPresent,
    manifestObjectCount,
    objectEntryCount,
    verifiedObjectCount,
    missingObjectCount,
    invalidObjectCount,
    pgToolAvailable: input.pgToolAvailable,
    dumpReadable: input.dumpReadable,
    status: ok ? 'VALID' : 'INVALID',
    ok,
    errors,
  };
}
