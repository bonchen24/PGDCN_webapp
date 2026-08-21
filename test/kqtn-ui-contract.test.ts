// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for KQTN PDF actions and bulk-upload entry point.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('KQTN view exposes a PDF column and bulk upload control', () => {
  const source = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');
  assert.match(source, /id: 'resultPdf'/);
  assert.match(source, /Bulk Upload/);
  assert.match(source, /getKqtnPdfUrl/);
  assert.match(source, /uploadKqtnPdf/);
  assert.match(source, /window\.confirm/);
});

test('bulk modal exposes automatic matching and manual candidate selection', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /matchKqtnBulkFile/);
  assert.match(source, /Chọn đầu mẫu/);
  assert.match(source, /uploadKqtnPdf/);
  assert.match(source, /extractKqtnPdfMetadata/);
});

// --- End of kqtn-ui-contract.test.ts ---
