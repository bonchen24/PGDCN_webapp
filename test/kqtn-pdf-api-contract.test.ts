// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for private KQTN PDF storage routes.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('server exposes upload, inline view, download, and delete routes for KQTN PDFs', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /\/api\/kqtn\/:recordId\/pdf/);
  assert.match(source, /file_assets/);
  assert.match(source, /application\/pdf/);
  assert.match(source, /SUPABASE_STORAGE_URL/);
  assert.match(source, /KQTN_PDF_MAX_BYTES/);
  assert.match(source, /\/api\/gemini\/extract-kqtn-metadata/);
});

test('storage client supports downloading a private object', () => {
  const source = fs.readFileSync(new URL('../utils/supabaseStorage.ts', import.meta.url), 'utf8');
  assert.match(source, /downloadObject/);
  assert.match(source, /response\.arrayBuffer\(\)/);
});

// --- End of kqtn-pdf-api-contract.test.ts ---
