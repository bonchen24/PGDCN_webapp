// Author: Codex
// Description: Regression tests for safe KQTN PDF response headers.

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKqtnPdfContentDisposition } from '../utils/kqtnPdfHeaders';

test('KQTN PDF Content-Disposition stays ASCII-safe and preserves the UTF-8 filename', () => {
  const header = buildKqtnPdfContentDisposition('Kết quả M07 \u0011 scan.pdf', 'inline');

  assert.equal([...header].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e;
  }), true);
  assert.match(header, /^inline; filename="[^"]+"; filename\*=UTF-8''/);
  assert.match(header, /filename="Ket qua M07 _ scan\.pdf"/);
  assert.match(header, /filename\*=UTF-8''K%E1%BA%BFt%20qu%E1%BA%A3%20M07%20_%20scan.pdf/);
});

test('KQTN PDF Content-Disposition supports download mode without unsafe raw controls', () => {
  const header = buildKqtnPdfContentDisposition('..\\reports\\kqtn\nresult.pdf', 'attachment');

  assert.match(header, /^attachment; filename="[^"]+"; filename\*=UTF-8''/);
  assert.doesNotMatch(header, /[\u0000-\u001f\u007f-\u009f]/);
  assert.doesNotMatch(header, /\\reports/);
});
