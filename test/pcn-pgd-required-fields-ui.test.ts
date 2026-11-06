import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validatePcnProposalIntake } from '../utils/pcnIntakePolicy.ts';

const pcnSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pgdSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const pcnCreateDialogSource = fs.readFileSync(new URL('../components/dashboard/create-pcn-proposal-dialog.tsx', import.meta.url), 'utf8');
const pgdCreateDialogSource = fs.readFileSync(new URL('../components/dashboard/create-pgd-request-dialog.tsx', import.meta.url), 'utf8');
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
  for (const field of [
    'customerSnapshot.name',
    'customerSnapshot.address',
    'customerSnapshot.contactPerson',
    'productGroup',
    'registrationNumber',
    'registrationDate',
    'standards',
    'quantity',
    'fieldCodes',
  ]) {
    assert.match(pcnPolicy, new RegExp(field.replace('.', '\\.'), 'i'));
  }
  const minimalResult = validatePcnProposalIntake(
    {
      customerSnapshot: { name: 'Customer', address: 'Ha Noi', contactPerson: 'Contact' },
      warehouseAddress: 'Warehouse',
      productGroup: 'ELECTRICAL_ELECTRONIC',
      registrationNumber: 'PCN-2026-001',
      registrationDate: '2026-11-06',
      standards: 'QCVN 04:2009/BKHCN',
      quantity: 1,
      fieldCodes: ['QC4'],
    },
    { requireStandards: true, requireProductGroup: true, requireRegistration: true },
  );
  assert.equal(minimalResult.valid, true);
  for (const optionalField of ['model', 'brand', 'manufacturer', 'specifications']) {
    assert.equal(minimalResult.issues.some((issue) => issue.field === optionalField), false);
  }
  assert.match(pcnSource, /Người liên hệ.*Mã số thuế/);
  assert.match(pcnSource, /Ngày tiếp nhận/);
});

test('dashboard PCN and PGD create dialogs reuse canonical domain intake forms', () => {
  assert.match(pcnCreateDialogSource, /PcnProposalView/);
  assert.match(pgdCreateDialogSource, /PgdIntakeForm/);
  assert.match(pcnSource, /registrationNumber/);
  assert.match(pcnSource, /registrationDate/);
  assert.match(pgdSource, /registrationNumber/);
  assert.match(pgdSource, /registrationDate/);
});
test('PCN and PGD B1 file controls never add a hidden required attachment gate', () => {
  for (const [domain, source] of [['PCN', pcnCreateDialogSource], ['PGD', pgdCreateDialogSource]]) {
    const requiredFileInputs = source.match(/<input\b(?=[^>]*type=["']file["'])(?=[^>]*(?:\brequired\b|aria-required=["']true))[^>]*>/gi) || [];
    assert.deepEqual(requiredFileInputs, [], `${domain} B1 must not require a file to create the dossier`);
  }
});

test('PGD intake required fields include catalog selection and conditional branches', () => {
  for (const field of ['catalogItemId', 'productName', 'inspectionLocation', 'inspectionScope', 'standards', 'assessmentMethod', 'lotCode', 'customsDocuments']) {
    assert.match(pgdPolicy, new RegExp(field));
  }
  assert.match(pgdSource, /Loại hình giám định[^\n]*\*|required[^\n]*catalogItemId/);
  assert.match(groupSource, /Tên mẫu|ProductField/);
});

test('PCN and PGD B1 forms remain mobile-first and compact', () => {
  assert.match(pcnSource, /sm:grid-cols-2/);
  assert.match(pgdSource, /sm:grid-cols-2/);
});
