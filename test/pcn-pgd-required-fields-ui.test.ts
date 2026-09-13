import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pcnSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pgdSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const groupSource = fs.readFileSync(new URL('../components/PgdProductGroupFields.tsx', import.meta.url), 'utf8');
const pcnPolicy = fs.readFileSync(new URL('../utils/pcnIntakePolicy.ts', import.meta.url), 'utf8');
const pgdPolicy = fs.readFileSync(new URL('../utils/pgdDomain.ts', import.meta.url), 'utf8');

test('PCN and PGD required labels use a red semantic marker contract', () => {
  for (const source of [pcnSource, pgdSource, groupSource]) {
    assert.match(source, /text-rose-600/);
    assert.match(source, /aria-required|required\?/);
  }
});

test('PCN intake required fields remain aligned with policy', () => {
  for (const field of ['customerSnapshot.name', 'customerSnapshot.address', 'warehouseAddress', 'productName', 'productType', 'model', 'brand', 'specifications', 'manufacturer', 'quantity', 'fieldCodes']) {
    assert.match(pcnPolicy, new RegExp(field.replace('.', '\\.'), 'i'));
  }
  assert.match(pcnSource, /Người liên hệ.*Mã số thuế/);
  assert.match(pcnSource, /Ngày tiếp nhận/);
});

test('PGD intake required fields include catalog selection and conditional branches', () => {
  for (const field of ['catalogItemId', 'productName', 'inspectionLocation', 'inspectionScope', 'standards', 'assessmentMethod', 'lotCode', 'customsDocuments']) {
    assert.match(pgdPolicy, new RegExp(field));
  }
  assert.match(pgdSource, /Loại hình giám định[^\n]*\*|required[^\n]*catalogItemId/);
  assert.match(groupSource, /Tên mẫu|ProductField/);
});

