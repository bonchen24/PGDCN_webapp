// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for the canonical KQTN sample-head identity.

import assert from 'node:assert/strict';
import test from 'node:test';

import { getKqtnSampleCode, normalizeKqtnSampleKey } from '../utils/kqtnIdentity';

test('normalizes formatting and Vietnamese diacritics to one sample key', () => {
  assert.equal(normalizeKqtnSampleKey(' ATĐ-01 / 2026 '), 'ATD012026');
  assert.equal(normalizeKqtnSampleKey('ATD012026'), 'ATD012026');
});

test('returns an empty key when the sample code is blank', () => {
  assert.equal(normalizeKqtnSampleKey('   '), '');
  assert.equal(normalizeKqtnSampleKey(null), '');
});

test('chooses the canonical KQTN code before request fallbacks', () => {
  assert.equal(
    getKqtnSampleCode({
      sampleCode: 'KQTN-001',
      atdEncodeNumber: 'ATD-001',
      emcEncodeNumber: 'EMC-001',
    }),
    'KQTN-001',
  );
  assert.equal(getKqtnSampleCode({ atdEncodeNumber: 'ATD-001', emcEncodeNumber: 'EMC-001' }), 'ATD-001');
  assert.equal(getKqtnSampleCode({ codingNumber: 'KQTN-002' }), 'KQTN-002');
});

// --- End of kqtn-identity.test.ts ---
