import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dropzoneSource = fs.readFileSync(new URL('../components/PgdcnIntakeDropzone.tsx', import.meta.url), 'utf8');
const pcnSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pgdSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');

test('intake dropzone supports file, image, paste, and accessible keyboard interaction', () => {
  for (const marker of ['.pdf', '.docx', '.png', '.jpg', 'onDrop', 'onPaste', 'onKeyDown', 'capture="environment"', 'aria-live', 'Bản nháp OCR', 'độ tin cậy', 'Xác nhận điền bản nháp']) {
    assert.match(dropzoneSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(dropzoneSource, /role="button"|tabIndex/);
});

test('both intake workspaces use the shared dropzone surface', () => {
  assert.match(pcnSource, /PgdcnIntakeDropzone|PcnOcrPanel/);
  assert.match(pgdSource, /PgdcnIntakeDropzone/);
});
