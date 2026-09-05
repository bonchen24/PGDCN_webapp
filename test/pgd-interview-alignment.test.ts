import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_PGD_CATALOG,
  getPgdApprovalDenial,
  getPgdApprovalRoleForStatus,
  getPgdTransitionDenial,
  splitPgdSample,
  validatePgdIntake,
} from '../utils/pgdDomain.ts';
import { getPgdDocumentTemplates } from '../utils/pgdDocumentTemplates.ts';
import { createPgdLabResultReview } from '../utils/pgdArtifacts.ts';
import * as pgdDomain from '../utils/pgdDomain.ts';

const basicOutsideRequest = {
  id: 'pgd-interview-request',
  requestCode: 'PGD-260905-01',
  intakeChannel: 'EMAIL',
  requester: {
    name: 'Công ty yêu cầu',
    address: 'Hà Nội',
    contactPerson: 'Nguyễn Văn A',
    phone: '0900000000',
  },
  customerSnapshot: { name: 'Công ty yêu cầu', address: 'Hà Nội' },
  productGroup: 'OTHER',
  catalogItemId: 'OUTSIDE_INSPECTION',
  productName: 'Cột chống ngoài hiện trường',
  quantity: 10,
  unit: 'cái',
  inspectionScope: 'Kiểm tra tình trạng và số lượng',
  inspectionLocation: 'Công trường A',
  standards: ['Tiêu chuẩn hợp đồng'],
  method: 'QT-GĐ-05',
};

test('PGD catalog exposes every interview product and inspection profile', () => {
  const catalogText = DEFAULT_PGD_CATALOG.map((item) => `${item.name} ${item.code}`).join(' | ').toLocaleLowerCase('vi-VN');
  for (const phrase of ['số lượng', 'tình trạng', 'cao bằng', 'thái nguyên', 'cột chống']) {
    assert.match(catalogText, new RegExp(phrase), `Thiếu profile phỏng vấn: ${phrase}`);
  }
  assert.ok(DEFAULT_PGD_CATALOG.every((item) => item.slaLabel.trim() && item.defaultStandards.length > 0));
});

test('PGD intake requires the requester snapshot instead of silently using the receiver', () => {
  assert.deepEqual(validatePgdIntake(basicOutsideRequest as any), []);
  const missingRequesterContact = validatePgdIntake({
    ...basicOutsideRequest,
    requester: { name: 'Công ty yêu cầu', address: 'Hà Nội' },
  } as any);
  assert.deepEqual(
    missingRequesterContact.map((issue) => issue.field),
    ['requester.contactPerson', 'requester.phone'],
  );
});

test('PGD approval chain has technical and leadership steps in order', () => {
  assert.equal(getPgdApprovalRoleForStatus('TECHNICAL_REVIEW'), 'TECHNICAL_REVIEW');
  assert.equal(getPgdApprovalRoleForStatus('LEADERSHIP_APPROVAL'), 'LEADERSHIP_APPROVAL');
  assert.equal(getPgdApprovalDenial('TECHNICAL_REVIEW', 'TECHNICAL_REVIEW', { pgdRole: 'PGD_TECHNICAL' }), null);
});

test('PGD approval API enforces the technical step before leadership signing', () => {
  const serverSource = readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8');
  assert.doesNotMatch(serverSource, /PGD v1 chỉ có một cấp phê duyệt/);
  assert.match(serverSource, /TECHNICAL_REVIEW.*LEADERSHIP_APPROVAL/s);
  assert.match(serverSource, /approvedTechnical|technicalApproval|TECHNICAL_REVIEW.*APPROVED/s);
});

test('PGD retained samples receive the interview retention deadline', () => {
  const split = splitPgdSample({
    requestId: 'pgd-interview-request',
    sampleCodePrefix: 'GD-0001',
    description: 'Thép/kim loại',
    quantity: 2,
    unit: 'mẫu',
  }, '2026-09-05T08:00:00.000Z');
  assert.equal(split.retained.retentionStatus, 'ACTIVE');
  assert.equal(split.retained.retainedUntil, '2026-12-05T08:00:00.000Z');
});

test('PGD result output includes the interview certificate form code', () => {
  assert.ok(getPgdDocumentTemplates().some((template) => template.code === 'BM-GĐ-07.19'));
});

test('PGD non-conforming lab results require an explicit recheck reason', () => {
  assert.throws(() => createPgdLabResultReview({
    id: 'review-1',
    requestId: 'pgd-interview-request',
    labResultIds: ['lab-result-1'],
    completeness: 'COMPLETE',
    conformity: 'NON_CONFORMING',
    conclusion: 'Kết quả không phù hợp.',
  }), /thử lại|kiểm tra lại/i);
  const review = createPgdLabResultReview({
    id: 'review-2',
    requestId: 'pgd-interview-request',
    labResultIds: ['lab-result-1'],
    completeness: 'COMPLETE',
    conformity: 'NON_CONFORMING',
    conclusion: 'Kết quả không phù hợp, cần kiểm tra lại mẫu.',
    retestRequired: true,
    retestReason: 'Đối chiếu lại mẫu và phép thử theo yêu cầu PGD.',
  });
  assert.equal(review.retestRequired, true);
  assert.equal(review.retestReason, 'Đối chiếu lại mẫu và phép thử theo yêu cầu PGD.');
});

test('PGD cannot move to technical review while a lab recheck is outstanding', () => {
  assert.match(getPgdTransitionDenial('RESULTS_REVIEW', 'TECHNICAL_REVIEW', {
    labResultReview: { status: 'FINAL', conformity: 'NON_CONFORMING', retestRequired: true },
  }) || '', /thử lại|kiểm tra lại/i);
  assert.equal(getPgdTransitionDenial('RESULTS_REVIEW', 'TECHNICAL_REVIEW', {
    labResultReview: { status: 'FINAL', conformity: 'CONFORMING', retestRequired: false },
  }), null);
});

test('PGD calibration tracking marks an instrument expired from its due date', () => {
  assert.equal(typeof pgdDomain.getPgdCalibrationStatus, 'function');
  assert.equal(pgdDomain.getPgdCalibrationStatus({
    expiresAt: '2026-09-04T23:59:59.000Z',
  } as any, '2026-09-05T08:00:00.000Z'), 'EXPIRED');
});
