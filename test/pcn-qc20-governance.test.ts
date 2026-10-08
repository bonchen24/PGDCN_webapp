import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PCN_CERTIFICATION_FIELD_CODES } from '../types.ts';
import { DEFAULT_PCN_SETTINGS, normalizePcnSettings } from '../utils/pcnSettings.ts';
import { DEFAULT_PGD_CATALOG } from '../utils/pgdDomain.ts';

test('PCN excludes stainless steel and keeps only the active certification fields', () => {
  assert.deepEqual(PCN_CERTIFICATION_FIELD_CODES, ['QC4', 'QC9']);
  assert.deepEqual(DEFAULT_PCN_SETTINGS.fieldCodes, ['QC4', 'QC9']);
  assert.deepEqual(normalizePcnSettings({ fieldCodes: ['QC20', 'QC4'] }).fieldCodes, ['QC4']);
});
test('stainless steel is owned by the PGD catalog with the legal standard snapshot', () => {
  const steel = DEFAULT_PGD_CATALOG.find((item) => item.productGroup === 'STEEL_METAL');
  assert.ok(steel);
  assert.equal(steel?.code, 'GĐ-THEP-KG');
  assert.ok(steel?.defaultStandards.includes('QCVN 20:2019/BKHCN'));
  assert.ok(steel?.defaultStandards.includes('Sửa đổi 1:2021 QCVN 20:2019/BKHCN'));
  assert.ok(steel?.methodOptions.some((method) => method.code === 'TT58'));
  assert.ok(steel?.methodOptions.some((method) => method.code === 'QT-GĐ-14'));
});

test('PCN no longer exposes QC20 confirmation endpoints or UI', () => {
  const server = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
  const settings = fs.readFileSync(new URL('../components/PcnSettingsView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(server, /qc20-readiness|qc20-scope\/confirm|PcnQc20Scope/);
  assert.doesNotMatch(settings, /PcnQc20ScopePanel|Xác nhận phạm vi QC20/);
});
