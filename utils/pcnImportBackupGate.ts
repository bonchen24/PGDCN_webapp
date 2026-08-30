import type { PcnBackupVerification } from './pcnBackupVerification.ts';

export interface PcnImportBackupCandidate {
  filename: string;
  createdAt: string;
  sizeBytes?: number;
}

function timestamp(value: Date | string): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

export function isPcnImportBackupCandidate(candidate: PcnImportBackupCandidate, checkpoint: Date | string): boolean {
  const filename = String(candidate.filename || '').trim();
  const createdAt = timestamp(candidate.createdAt);
  const checkpointAt = timestamp(checkpoint);
  return filename.startsWith('pcn_certification_')
    && filename.endsWith('.zip')
    && createdAt > 0
    && checkpointAt > 0
    && createdAt <= checkpointAt;
}

export function getPcnImportBackupGateErrors(
  candidate: PcnImportBackupCandidate,
  verification: PcnBackupVerification,
  checkpoint: Date | string,
): string[] {
  const errors: string[] = [];
  if (!isPcnImportBackupCandidate(candidate, checkpoint)) {
    errors.push('Archive không phải bản sao PCN dạng ZIP đã tồn tại trước checkpoint import.');
  }
  if (String(verification.filename || '').trim() !== String(candidate.filename || '').trim()) {
    errors.push('Kết quả kiểm chứng không trỏ đúng archive đã chọn.');
  }
  if (verification.format !== 'zip') errors.push('Archive import phải có định dạng ZIP đầy đủ.');
  if (!verification.databaseDumpPresent) errors.push('Archive thiếu database.dump.');
  if (!verification.manifestPresent) errors.push('Archive thiếu storage/manifest.json.');
  if (!verification.dumpReadable) errors.push('database.dump không đọc được bằng pg_restore.');
  if (verification.missingObjectCount > 0) errors.push(`Manifest còn thiếu ${verification.missingObjectCount} object.`);
  if (verification.invalidObjectCount > 0) errors.push(`Có ${verification.invalidObjectCount} object không qua kiểm tra checksum.`);
  if (!verification.ok || verification.status !== 'VALID') {
    const verificationErrors = verification.errors.filter(Boolean).slice(0, 3);
    errors.push(...(verificationErrors.length > 0 ? verificationErrors : ['Archive chưa đạt trạng thái VALID.']));
  }
  return Array.from(new Set(errors));
}

// --- End of pcnImportBackupGate.ts ---
