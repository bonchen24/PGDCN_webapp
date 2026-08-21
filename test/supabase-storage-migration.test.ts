// Author: Gemini
// OS support: Web/Node
// Description: Tests for extracting and naming persisted KQTN image assets

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStorageObjectPath,
  decodeBase64DataUri,
  extractBase64DataUris,
} from '../utils/supabaseStorageMigration.js';

test('extractBase64DataUris finds nested image data URIs with JSON paths', () => {
  const source = {
    productPhoto1: 'data:image/jpeg;base64,SGVsbG8=',
    nested: {
      nameplatePhotos: [
        'data:image/png;base64,UE5H',
        'https://example.test/not-a-persisted-file',
      ],
    },
  };

  assert.deepEqual(extractBase64DataUris(source), [
    { jsonPath: '$.productPhoto1', dataUri: 'data:image/jpeg;base64,SGVsbG8=' },
    { jsonPath: '$.nested.nameplatePhotos[0]', dataUri: 'data:image/png;base64,UE5H' },
  ]);
});

test('decodeBase64DataUri returns MIME type and bytes and rejects malformed input', () => {
  assert.deepEqual(decodeBase64DataUri('data:image/png;base64,UE5H'), {
    mimeType: 'image/png',
    buffer: Buffer.from('PNG'),
  });
  assert.throws(() => decodeBase64DataUri('not-a-data-uri'), /data URI/i);
  assert.throws(() => decodeBase64DataUri('data:image/png;base64,'), /empty/i);
});

test('buildStorageObjectPath is stable and safe for the same asset identity', () => {
  const first = buildStorageObjectPath({
    collectionName: 'kqtnRecords',
    documentId: 'record/01 with spaces',
    jsonPath: '$.nested[0].productPhoto1',
    sha256: 'a'.repeat(64),
    mimeType: 'image/jpeg',
  });
  const second = buildStorageObjectPath({
    collectionName: 'kqtnRecords',
    documentId: 'record/01 with spaces',
    jsonPath: '$.nested[0].productPhoto1',
    sha256: 'a'.repeat(64),
    mimeType: 'image/jpeg',
  });

  assert.equal(first, second);
  assert.equal(first, 'kqtnRecords/record_01_with_spaces/nested_0_productPhoto1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg');
  assert.doesNotMatch(first, /\s/);
});

// --- End of supabase-storage-migration.test.ts ---
