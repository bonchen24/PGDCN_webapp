import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPcnCode, getPcnCodeFamilyLabel, normalizePcnCode, reviewPcnCode, reviewPcnCodes } from '../utils/pcnCodePolicy.ts';

test('normalizes PCN code separators without dropping leading zeroes', () => {
  assert.equal(normalizePcnCode(' 0109 – 01 '), '0109-01');
  assert.equal(normalizePcnCode(' iemm   0114 - sp - 01 '), 'IEMM 0114-SP-01');
});

test('recognizes observed QC4/QC9 registration, IEMM and PYC code families', () => {
  assert.equal(classifyPcnCode('QC4', '0665').family, 'FIELD_REGISTRATION');
  assert.equal(classifyPcnCode('QC9', '0105-01').family, 'FIELD_REGISTRATION');
  assert.equal(classifyPcnCode('QC20', 'QC20.123.1').family, 'UNKNOWN');
  assert.equal(classifyPcnCode('QC20', 'QC20.123.1').recognized, false);
  assert.equal(classifyPcnCode('QC9', 'IEMM 0114-SP-01').family, 'IEMM_REFERENCE');
  assert.equal(classifyPcnCode('QC9', 'PYC 1655_R0').family, 'PYC_REFERENCE');
});

test('flags unknown or missing proposal codes for source review without blocking intake', () => {
  assert.equal(reviewPcnCode('QC4', '').needsReview, true);
  assert.match(reviewPcnCode('QC4', '').message, /chưa có mã nguồn/i);
  assert.equal(reviewPcnCode('QC4', 'DN-2026-001').needsReview, true);
  assert.match(reviewPcnCode('QC4', 'DN-2026-001').message, /đối chiếu mã nguồn/i);
  assert.equal(reviewPcnCode('QC4', '0665').needsReview, false);
});

test('uses one human-readable label for every code family in manager views', () => {
  assert.equal(getPcnCodeFamilyLabel('FIELD_REGISTRATION'), 'Mã hồ sơ / đăng ký');
  assert.equal(getPcnCodeFamilyLabel('UNKNOWN'), 'Chưa nhận diện');
  assert.equal(reviewPcnCode('QC4', ' 0109 – 01 ').source, '0109 – 01');
});

test('reviews a code against every linked PCN field instead of assuming the first field is primary', () => {
  const review = reviewPcnCodes(['QC9', 'QC4'], 'GCN QC4.19642.26');

  assert.equal(review.needsReview, false);
  assert.equal(review.family, 'CERTIFICATION_REFERENCE');
  assert.equal(review.normalized, 'GCN QC4.19642.26');
});

// --- End of pcn-code-policy.test.ts ---
