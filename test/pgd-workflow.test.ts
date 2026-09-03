import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PGD_OPERATIONAL_STATIONS,
  buildPgdStepGate,
  getPgdOperationalStepAccess,
  getPgdOperationalStepGateDenial,
  getPgdOperationalStation,
  getPgdPostSignatureMutationDenial,
  getPgdAssignmentApprovalDenial,
  buildPgdResultValues,
  buildPgdFieldInspection,
  validatePgdResultValues,
} from '../utils/pgdWorkflow.ts';
import type { PgdResultTemplate } from '../utils/pgdDomain.ts';

test('PGD maps the detailed lifecycle to five PCN-style operational stations', () => {
  assert.equal(PGD_OPERATIONAL_STATIONS.length, 5);
  assert.equal(getPgdOperationalStation('CAPABILITY_REVIEW').key, 'INTAKE_CAPABILITY');
  assert.equal(getPgdOperationalStation('PREPARING').key, 'PREPARATION');
  assert.equal(getPgdOperationalStation('FIELD_INSPECTION').key, 'FIELD_SAMPLING');
  assert.equal(getPgdOperationalStation('RESULTS_REVIEW').key, 'LAB_RESULTS');
  assert.equal(getPgdOperationalStation('LEADERSHIP_APPROVAL').key, 'REPORT_APPROVAL_RETURN');
});

test('PGD step access keeps future stations locked and signed dossiers read-only', () => {
  assert.deepEqual(
    getPgdOperationalStepAccess({ status: 'FIELD_INSPECTION', targetStationKey: 'LAB_RESULTS' }),
    { editable: false, locked: true, requiresWithdrawal: false, reason: 'Trạm sau đang bị khóa; hãy hoàn tất trạm hiện tại trước.' },
  );
  assert.deepEqual(
    getPgdOperationalStepAccess({ status: 'FIELD_INSPECTION', targetStationKey: 'INTAKE_CAPABILITY' }),
    { editable: true, locked: false, requiresWithdrawal: false },
  );
  assert.equal(getPgdOperationalStepAccess({ status: 'SIGNED', targetStationKey: 'REPORT_APPROVAL_RETURN' }).requiresWithdrawal, true);
  assert.equal(getPgdOperationalStepAccess({ status: 'SIGNED', targetStationKey: 'REPORT_APPROVAL_RETURN' }).editable, false);
});

test('PGD step gate reports missing evidence instead of accepting a browser completion flag', () => {
  const missingAssignment = buildPgdStepGate({ stationKey: 'PREPARATION', status: 'CAPABILITY_REVIEW', evidence: {} });
  assert.equal(missingAssignment.complete, false);
  assert.deepEqual(missingAssignment.missingEvidence, ['ASSIGNMENT_APPROVED']);

  const fieldGate = buildPgdStepGate({
    stationKey: 'FIELD_SAMPLING',
    status: 'FIELD_INSPECTION',
    evidence: { hasFieldInspection: true, hasSampleHandover: false },
  });
  assert.deepEqual(fieldGate.missingEvidence, ['SAMPLE_HANDOVER']);

  const labGate = buildPgdStepGate({
    stationKey: 'LAB_RESULTS',
    status: 'WAITING_LAB_RESULTS',
    evidence: {
      hasSampleHandover: true,
      labRequests: [
        { id: 'lab-1', domain: 'pgd', requestId: 'request-1', sampleId: 'sample-1', laboratoryName: 'PTN', testItems: ['Hóa'], status: 'SENT' },
      ],
    },
  });
  assert.deepEqual(labGate.missingEvidence, ['LAB_RESULT:lab-1']);
});

test('PGD step transition gate rejects incomplete station and allows a complete station', () => {
  assert.match(
    getPgdOperationalStepGateDenial({ currentStatus: 'FIELD_INSPECTION', nextStatus: 'WAITING_LAB_RESULTS', evidence: { hasFieldInspection: true } }) || '',
    /SAMPLE_HANDOVER/,
  );
  assert.equal(
    getPgdOperationalStepGateDenial({
      currentStatus: 'FIELD_INSPECTION',
      nextStatus: 'WAITING_LAB_RESULTS',
      evidence: { hasFieldInspection: true, hasSampleHandover: true },
    }),
    null,
  );
});

test('PGD result template validates required fields and field types before report creation', () => {
  const template: PgdResultTemplate = {
    id: 'template-1',
    code: 'PGD-1',
    name: 'Template PGD',
    version: '1',
    productGroup: 'STEEL_METAL',
    active: true,
    fields: [
      { key: 'quantityVerified', label: 'Khối lượng xác nhận', type: 'NUMBER', required: true },
      { key: 'conclusion', label: 'Kết luận', type: 'TEXT', required: true },
    ],
  };
  assert.deepEqual(validatePgdResultValues(template, [{ key: 'quantityVerified', label: 'Khối lượng xác nhận', value: 'not-a-number' }]), [
    { key: 'quantityVerified', message: 'Trường “Khối lượng xác nhận” phải là số.' },
    { key: 'conclusion', message: 'Thiếu trường bắt buộc “Kết luận”.' },
  ]);
  assert.deepEqual(validatePgdResultValues(template, [
    { key: 'quantityVerified', label: 'Khối lượng xác nhận', value: 10 },
    { key: 'conclusion', label: 'Kết luận', value: 'Phù hợp' },
  ]), []);
});

test('PGD result form converts template inputs to typed report values', () => {
  const template: PgdResultTemplate = {
    id: 'template-2',
    code: 'PGD-2',
    name: 'Template định lượng',
    version: '1',
    productGroup: 'STEEL_METAL',
    active: true,
    fields: [
      { key: 'quantityVerified', label: 'Khối lượng', type: 'NUMBER', required: true, unit: 'tấn' },
      { key: 'conformity', label: 'Phù hợp', type: 'BOOLEAN', required: true },
      { key: 'note', label: 'Ghi chú', type: 'TEXT', required: false },
    ],
  };
  assert.deepEqual(buildPgdResultValues(template, { quantityVerified: '12.5', conformity: 'true', note: 'Đã đối chiếu' }), [
    { key: 'quantityVerified', label: 'Khối lượng', value: 12.5, unit: 'tấn' },
    { key: 'conformity', label: 'Phù hợp', value: true, unit: undefined },
    { key: 'note', label: 'Ghi chú', value: 'Đã đối chiếu', unit: undefined },
  ]);
});

test('PGD field record preserves inspection evidence and normalizes findings', () => {
  const record = buildPgdFieldInspection({
    id: 'field-1',
    requestId: 'request-1',
    performedAt: '2026-09-02T04:00:00.000Z',
    location: 'Kho A',
    inspectorUsernames: ['inspector'],
    lotObservation: 'Bao gói nguyên vẹn',
    packaging: 'Đai kiện còn nguyên',
    labeling: 'Có số lô',
    measurements: { 'Chiều dài': '6 m' },
    nonconformities: [' ', 'Không có'],
    sampleIds: ['sample-1'],
    note: 'Đã chụp ảnh hiện trường',
  });
  assert.equal(record.domain, 'pgd');
  assert.equal(record.completed, true);
  assert.deepEqual(record.measurements, { 'Chiều dài': '6 m' });
  assert.deepEqual(record.nonconformities, ['Không có']);
  assert.deepEqual(record.sampleIds, ['sample-1']);
});

test('PGD locks direct evidence mutations after signing, return or archive', () => {
  assert.equal(getPgdPostSignatureMutationDenial('FIELD_INSPECTION'), null);
  assert.match(getPgdPostSignatureMutationDenial('SIGNED') || '', /đã ký/);
  assert.match(getPgdPostSignatureMutationDenial('RESULT_RETURNED') || '', /đã ký/);
  assert.match(getPgdPostSignatureMutationDenial('ARCHIVED') || '', /đã ký/);
});

test('PGD assignment approval is reserved for management roles', () => {
  assert.equal(getPgdAssignmentApprovalDenial('PENDING_APPROVAL', { role: 'staff', pgdRole: 'PGD_FIELD_INSPECTOR' }), null);
  assert.equal(getPgdAssignmentApprovalDenial('APPROVED', { role: 'staff', pgdRole: 'PGD_MANAGER' }), null);
  assert.equal(getPgdAssignmentApprovalDenial('APPROVED', { role: 'admin', pgdRole: 'PGD_FIELD_INSPECTOR' }), null);
  assert.match(getPgdAssignmentApprovalDenial('APPROVED', { role: 'staff', pgdRole: 'PGD_TECHNICAL' }) || '', /quản lý|phê duyệt/i);
});
