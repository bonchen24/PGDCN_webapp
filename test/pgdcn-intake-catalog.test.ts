import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PGDCN_PRODUCT_GROUPS,
  getConfirmedStandardsForDomain,
  matchCatalogItems,
  validateIntakeClassification,
} from '../utils/pgdcnIntakeCatalog.ts';

test('PCN-confirmed standards are strictly QCVN04/QC4 and QCVN09/QC9', () => {
  const pcnConfirmed = getConfirmedStandardsForDomain('PCN');
  const codes = pcnConfirmed.map((item) => item.standardCode);
  assert.ok(codes.includes('QCVN 04:2009/BKHCN') || codes.some((c) => c.includes('QCVN 04') || c.includes('QC4')));
  assert.ok(codes.includes('QCVN 09:2012/BKHCN') || codes.some((c) => c.includes('QCVN 09') || c.includes('QC9')));
  // Must NOT include QC20 / QCVN 20
  assert.ok(!codes.some((c) => c.includes('QC20') || c.includes('QCVN 20')));
});

test('QCVN20/QC20 is strictly PGD-only and confirmed for PGD', () => {
  const pgdConfirmed = getConfirmedStandardsForDomain('PGD');
  const codes = pgdConfirmed.map((item) => item.standardCode);
  assert.ok(codes.some((c) => c.includes('QC20') || c.includes('QCVN 20')));

  const pcnMatches = matchCatalogItems({ domain: 'PCN', standard: 'QCVN 20:2019/BKHCN' });
  assert.equal(pcnMatches.length, 0);

  const pgdMatches = matchCatalogItems({ domain: 'PGD', standard: 'QCVN 20:2019/BKHCN' });
  assert.ok(pgdMatches.length > 0);
  assert.equal(pgdMatches[0].confirmationStatus, 'CONFIRMED');
});

test('unconfirmed standards QCVN07 and QCVN25 have confirmationStatus PENDING_CONFIRMATION', () => {
  const matches07 = matchCatalogItems({ standard: 'QCVN 07:2019' });
  assert.ok(matches07.length > 0);
  assert.ok(matches07.every((item) => item.confirmationStatus === 'PENDING_CONFIRMATION'));

  const matches25 = matchCatalogItems({ standard: 'QCVN 25:2025' });
  assert.ok(matches25.length > 0);
  assert.ok(matches25.every((item) => item.confirmationStatus === 'PENDING_CONFIRMATION'));
  assert.ok(matches07.every((item) => item.domain === undefined && item.defaultTemplateId === undefined));
  assert.ok(matches25.every((item) => item.domain === undefined && item.defaultTemplateId === undefined));
  assert.ok(matchCatalogItems({ domain: 'PCN', standard: 'QCVN 07:2019' }).length > 0);
  assert.ok(matchCatalogItems({ domain: 'PGD', standard: 'QCVN 07:2019' }).length > 0);
});

test('unconfirmed standard cannot silently select a wrong domain or create a valid confirmed classification', () => {
  // Attempting to validate PCN classification with QCVN 20 must fail
  const validationQc20InPcn = validateIntakeClassification({
    domain: 'PCN',
    productGroup: 'METAL_MATERIALS',
    standard: 'QCVN 20:2019/BKHCN',
  });
  assert.equal(validationQc20InPcn.valid, false);
  assert.ok(validationQc20InPcn.message.includes('PGD') || validationQc20InPcn.message.includes('không hợp lệ'));

  // Custom unmapped standard has pending confirmation
  const customStandardResult = validateIntakeClassification({
    domain: 'PCN',
    productGroup: 'OTHER',
    standard: 'TCVN 9999:2099',
  });
  assert.equal(customStandardResult.valid, true);
  assert.equal(customStandardResult.confirmationStatus, 'PENDING_CONFIRMATION');
  assert.equal(customStandardResult.matchedItem, undefined);
});

test('confirmed PCN standard with an unconfirmed group or method does not select a template scope', () => {
  const mismatch = validateIntakeClassification({
    domain: 'PCN',
    productGroup: 'OTHER',
    standard: 'QCVN 04:2009/BKHCN',
    method: 'METHOD_7',
  });
  assert.equal(mismatch.valid, true);
  assert.equal(mismatch.confirmationStatus, 'PENDING_CONFIRMATION');
});

test('productGroup is independent of PCN fieldCode', () => {
  // Product groups are domain-agnostic classification categories
  const groupCodes = PGDCN_PRODUCT_GROUPS.map((g) => g.code);
  assert.deepEqual(groupCodes, [
    'ELECTRICAL_ELECTRONIC',
    'METAL_MATERIALS',
    'CONSTRUCTION_MATERIALS',
    'MANAGEMENT_SYSTEM',
    'OTHER',
  ]);
  // They are distinct from field codes like QC4 or QC9
  assert.ok(!groupCodes.includes('QC4' as any));
  assert.ok(!groupCodes.includes('QC9' as any));
});

test('catalog matching ignores accents and letter case', () => {
  const accented = matchCatalogItems({ standard: 'TH\u00C9P KH\u00D4NG G\u1EC8' });
  const unaccented = matchCatalogItems({ standard: 'thep khong gi' });
  assert.deepEqual(unaccented.map((item) => item.id), accented.map((item) => item.id));
  assert.ok(accented.some((item) => item.id === 'PGD_QC20_QCVN20'));
});
