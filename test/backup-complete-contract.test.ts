// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for complete Admin backup coverage

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildStorageBackupManifest } from '../utils/backupManager';

const panel = fs.readFileSync(new URL('../components/BackupRestoreAdminPanel.tsx', import.meta.url), 'utf8');
const manager = fs.readFileSync(new URL('../utils/backupManager.ts', import.meta.url), 'utf8');

test('maps every file asset to a stable archive entry', () => {
  assert.deepEqual(
    buildStorageBackupManifest([{
      id: 'asset-1',
      bucket_name: 'ddt-files',
      object_path: 'kqtnRecords/sample-1/result.pdf',
      mime_type: 'application/pdf',
      byte_size: 42,
      sha256: 'abc123',
    }]),
    [{
      assetId: 'asset-1',
      bucketName: 'ddt-files',
      objectPath: 'kqtnRecords/sample-1/result.pdf',
      mimeType: 'application/pdf',
      byteSize: 42,
      sha256: 'abc123',
      entryName: 'storage/objects/asset-1.bin',
    }],
  );
});

test('Admin backup panel uses the complete server backup action', () => {
  assert.match(panel, /triggerServerBackup/);
  assert.match(panel, /Tạo bản sao lưu ngay/);
});

test('server backup archives file metadata and objects', () => {
  assert.match(manager, /file_assets/);
  assert.match(manager, /downloadObject/);
  assert.match(manager, /AdmZip/);
  assert.match(manager, /storage\/manifest\.json/);
});

// --- End of backup-complete-contract.test.ts ---
