import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isIemmSealStamp,
  applySealStampPolicy,
  normalizeSealStampBase,
} from '../utils/sealStampPolicy.ts';

test('recognizes IEMM seal stamps regardless of case and leading whitespace', () => {
  assert.equal(isIemmSealStamp('IEMM.26/HQA/0000.0A-SP'), true);
  assert.equal(isIemmSealStamp('  iemm-8891'), true);
  assert.equal(isIemmSealStamp('TĐC-0000-00'), false);
  assert.equal(isIemmSealStamp(''), false);
});

test('adds M suffixes only to IEMM seals', () => {
  assert.deepEqual(
    applySealStampPolicy(['IEMM-BASE', 'IEMM-BASE'], 'IEMM-BASE'),
    ['IEMM-BASE-M01', 'IEMM-BASE-M02'],
  );
  assert.deepEqual(
    applySealStampPolicy(['TĐC-0000-01', 'TTP/ABC/02'], 'TĐC-0000-01'),
    ['TĐC-0000-01', 'TTP/ABC/02'],
  );
});

test('removes a generated IEMM suffix for edit-mode base input but preserves other formats', () => {
  assert.equal(normalizeSealStampBase('IEMM-BASE-M02'), 'IEMM-BASE');
  assert.equal(normalizeSealStampBase('TĐC-0000-01-M02'), 'TĐC-0000-01-M02');
});
