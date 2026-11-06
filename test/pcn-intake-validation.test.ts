import assert from 'node:assert/strict';
import test from 'node:test';

import { indexPcnIntakeValidationIssues, validatePcnProposalIntake } from '../utils/pcnIntakePolicy.ts';

const validProposal = {
  customerSnapshot: {
    name: 'Công ty Ánh Dương',
    address: 'Hà Nội',
    contactPerson: 'Nguyễn Văn A',
  },
  warehouseAddress: 'Kho Hà Nội',
  productGroup: 'ELECTRICAL_ELECTRONIC',
  registrationNumber: 'PCN-2026-001',
  registrationDate: '2026-11-06',
  productName: 'Nồi chiên không dầu',
  productType: 'Thiết bị gia dụng',
  model: 'AD-01',
  brand: 'Ánh Dương',
  specifications: '220 V; 1.500 W',
  manufacturer: 'Công ty Ánh Dương',
  quantity: 2,
  fieldCodes: ['QC4'],
};

test('PCN intake accepts the complete required proposal shape', () => {
  assert.deepEqual(validatePcnProposalIntake(validProposal), { valid: true, issues: [] });
});

test('new PCN proposal intake requires the standard named by the effective proposal form', () => {
  const result = validatePcnProposalIntake(validProposal, { requireStandards: true });
  assert.deepEqual(result.issues.map((issue) => issue.field), ['standards']);
  assert.equal(validatePcnProposalIntake({ ...validProposal, standards: ['QCVN 01'] }, { requireStandards: true }).valid, true);
});

test('PCN intake accepts minimal proposal omitting model, brand, manufacturer, specifications, and productType', () => {
  const minimalProposal = {
    customerSnapshot: {
      name: 'Công ty Ánh Dương',
      address: 'Hà Nội',
      contactPerson: 'Nguyễn Văn A',
    },
    warehouseAddress: 'Kho Hà Nội',
    productGroup: 'ELECTRICAL_ELECTRONIC',
    registrationNumber: 'PCN-2026-002',
    registrationDate: '2026-11-06',
    quantity: 2,
    fieldCodes: ['QC4'],
  };
  assert.deepEqual(validatePcnProposalIntake(minimalProposal, { requireWarehouseAddress: false }), { valid: true, issues: [] });
});

test('PCN intake requires product group and reports missing intake fields', () => {
  const result = validatePcnProposalIntake({ customerSnapshot: {}, fieldCodes: [] }, { requireProductGroup: true });
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.field), [
    'customerSnapshot.name',
    'customerSnapshot.address',
    'customerSnapshot.contactPerson',
    'warehouseAddress',
    'productGroup',
    'quantity',
    'fieldCodes',
  ]);
});

test('PCN B1 intake does not require warehouse or product technical details', () => {
  const minimal = {
    customerSnapshot: validProposal.customerSnapshot,
    productGroup: validProposal.productGroup,
    registrationNumber: validProposal.registrationNumber,
    registrationDate: validProposal.registrationDate,
    quantity: validProposal.quantity,
    fieldCodes: validProposal.fieldCodes,
  };
  assert.deepEqual(validatePcnProposalIntake(minimal, { requireWarehouseAddress: false }), { valid: true, issues: [] });
});

test('PCN edit validation keeps the legacy warehouse requirement by default', () => {
  const result = validatePcnProposalIntake({ ...validProposal, warehouseAddress: '' });
  assert.deepEqual(result.issues.map((issue) => issue.field), ['warehouseAddress']);
  assert.equal(validatePcnProposalIntake({ ...validProposal, warehouseAddress: '' }, { requireWarehouseAddress: false }).valid, true);
});

test('PCN intake rejects invalid product groups', () => {
  const result = validatePcnProposalIntake({ ...validProposal, productGroup: 'QC20' });
  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.field === 'productGroup'), true);
});

test('new PCN intake requires registration number and date when that gate is enabled', () => {
  const result = validatePcnProposalIntake({ ...validProposal, registrationNumber: '', registrationDate: '' }, { requireRegistration: true });
  assert.deepEqual(result.issues.map((issue) => issue.field), ['registrationNumber', 'registrationDate']);
});

test('new PCN intake rejects a malformed registration date', () => {
  const result = validatePcnProposalIntake({ ...validProposal, registrationDate: '2026-02-31' }, { requireRegistration: true });
  assert.equal(result.issues.some((issue) => issue.field === 'registrationDate'), true);
});

test('PCN edit validates a supplied registration date without requiring legacy registration fields', () => {
  const result = validatePcnProposalIntake({ ...validProposal, registrationNumber: '', registrationDate: '2026-02-31' });
  assert.deepEqual(result.issues.map((issue) => issue.field), ['registrationDate']);
});

test('tax id can satisfy the customer contact/identity requirement', () => {
  const proposal = {
    ...validProposal,
    customerSnapshot: { ...validProposal.customerSnapshot, contactPerson: '', taxId: '0101234567' },
  };
  assert.equal(validatePcnProposalIntake(proposal).valid, true);
});

test('PCN intake rejects invalid quantity and duplicate field codes', () => {
  const result = validatePcnProposalIntake({ ...validProposal, quantity: 0, fieldCodes: ['qc4', 'QC4'] });
  assert.deepEqual(result.issues.map((issue) => issue.field), ['quantity', 'fieldCodes']);
});

test('PCN intake rejects a steel/QCVN20 source even when a PCN field is selected', () => {
  const result = validatePcnProposalIntake({
    ...validProposal,
    productName: 'Sản phẩm thép không gỉ theo hồ sơ nguồn 183.10A',
    productType: 'Thép không gỉ',
    specifications: 'QCVN 20:2019/BKHCN và Sửa đổi 1:2021',
  });

  assert.equal(result.valid, false);
  assert.equal(result.issues.some((issue) => issue.field === 'productType' && issue.message.includes('PGD')), true);
});

test('PCN intake indexes validation messages by the exact form field', () => {
  const result = validatePcnProposalIntake({ customerSnapshot: {}, fieldCodes: [] });
  const messages = indexPcnIntakeValidationIssues(result.issues);

  assert.equal(messages['customerSnapshot.name'], 'Tên khách hàng là bắt buộc.');
  assert.equal(messages['customerSnapshot.contactPerson'], 'Cần người liên hệ hoặc mã số thuế để đối chiếu khách hàng.');
  assert.equal(messages.fieldCodes, 'Cần chọn ít nhất một Lĩnh vực.');
});

// --- End of pcn-intake-validation.test.ts ---
