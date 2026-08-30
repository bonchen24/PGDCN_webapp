import { createHash } from 'node:crypto';

export interface BackupIntegrityManifestEntry {
  objectPath: string;
  byteSize: number;
  sha256?: string | null;
}

export function assertBackupObjectIntegrity(entry: BackupIntegrityManifestEntry, body: Uint8Array): void {
  const objectPath = String(entry.objectPath || '').trim() || '(không rõ object)';
  const expectedByteSize = Number(entry.byteSize);
  if (!Number.isFinite(expectedByteSize) || expectedByteSize < 0) {
    throw new Error(`Manifest có byte size không hợp lệ cho ${objectPath}.`);
  }
  if (body.byteLength !== expectedByteSize) {
    throw new Error(`Object ${objectPath} sai byte size: manifest ${expectedByteSize}, thực tế ${body.byteLength}.`);
  }

  const expectedSha256 = String(entry.sha256 || '').trim().toLowerCase();
  if (!expectedSha256) return;
  const actualSha256 = createHash('sha256').update(Buffer.from(body)).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Object ${objectPath} sai SHA-256: manifest ${expectedSha256}, thực tế ${actualSha256}.`);
  }
}

// --- End of backupIntegrity.ts ---
