// Author: Codex
// OS support: Web/Node
// Description: Unit tests for bounded first-page model probing in combined KQTN uploads.

import assert from 'node:assert/strict';
import test from 'node:test';

import { extractKqtnModelFromProbeTexts, getKqtnModelProbePageNumbers } from '../utils/kqtnBulkModelProbe';

test('limits combined model probing to the first three pages of a group', () => {
  assert.deepEqual(getKqtnModelProbePageNumbers(21, 39), [21, 22, 23]);
});

test('does not probe pages outside a short group', () => {
  assert.deepEqual(getKqtnModelProbePageNumbers(97, 98), [97, 98]);
});

test('selects the first usable model from probe OCR text', () => {
  assert.equal(
    extractKqtnModelFromProbeTexts([
      'ITD 1132-26-M02\nTrang 1/20',
      'Tên sản phẩm: Máy lọc nước\nModel: HPN-695',
      'Model: SHOULD-NOT-REPLACE-FIRST',
    ]),
    'HPN-695',
  );
});

test('does not treat a footer report key as a model', () => {
  assert.equal(extractKqtnModelFromProbeTexts(['ITD 1132-26-M02\nTrang 1/20']), '');
});

