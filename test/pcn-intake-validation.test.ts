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

test('PCN intake reports every missing required field before writing', () => {
  const result = validatePcnProposalIntake({ customerSnapshot: {}, fieldCodes: [] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.field), [
    'customerSnapshot.name',
    'customerSnapshot.address',
    'customerSnapshot.contactPerson',
    'warehouseAddress',
    'productName',
    'productType',
    'model',
    'brand',
    'specifications',
    'manufacturer',
    'quantity',
    'fieldCodes',
  ]);
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

test('PCN intake indexes validation messages by the exact form field', () => {
  const result = validatePcnProposalIntake({ customerSnapshot: {}, fieldCodes: [] });
  const messages = indexPcnIntakeValidationIssues(result.issues);

  assert.equal(messages['customerSnapshot.name'], 'Tên khách hàng là bắt buộc.');
  assert.equal(messages['customerSnapshot.contactPerson'], 'Cần người liên hệ hoặc mã số thuế để đối chiếu khách hàng.');
  assert.equal(messages.fieldCodes, 'Cần chọn ít nhất một Lĩnh vực.');
});

// --- End of pcn-intake-validation.test.ts ---
