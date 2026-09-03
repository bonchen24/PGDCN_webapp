import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORM_REQUIRED_FIELDS,
  mergePcnOperationalForm,
  validatePcnOperationalForm,
} from '../utils/pcnOperationalForms.ts';
import type { PcnOperationalFormKind, PcnOperationalForms } from '../types.ts';

test('operational form validation requires the fields needed to create a station record', () => {
  const errors = validatePcnOperationalForm('EVALUATION_PLAN', {
    plannedStartAt: '',
    plannedEndAt: '',
    location: '  ',
    teamMembers: [],
    scope: '',
    criteria: '',
    customerRepresentative: '',
    notes: '',
  });

  assert.deepEqual(errors, {
    plannedStartAt: 'Ngày bắt đầu đánh giá là bắt buộc.',
    location: 'Địa điểm đánh giá là bắt buộc.',
    scope: 'Phạm vi đánh giá là bắt buộc.',
    criteria: 'Tiêu chí đánh giá là bắt buộc.',
  });
});

test('operational form merge trims text, normalizes arrays, and preserves other station forms', () => {
  const current: PcnOperationalForms = {
    fieldInspection: {
      inspectedAt: '2026-08-30',
      location: 'Nhà máy A',
      participants: ['Trần Hoàng Phương'],
      findings: 'Đạt',
      conclusion: 'Phù hợp',
      nonconformities: [],
      notes: '',
      savedAt: '2026-08-30T02:00:00.000Z',
    },
  };
  const merged = mergePcnOperationalForm(current, 'SAMPLE_CODING', {
    codedAt: ' 2026-08-31 ',
    coder: ' Vũ Thị Thắm ',
    lotCode: ' M-QC4-01 ',
    sampleCodes: [' M-QC4-01-A ', '', 'M-QC4-01-B'],
    sealCode: ' SEAL-01 ',
    notes: '  niêm phong  ',
  });

  assert.equal(merged.fieldInspection?.location, 'Nhà máy A');
  assert.deepEqual(merged.sampleCoding, {
    codedAt: '2026-08-31',
    coder: 'Vũ Thị Thắm',
    lotCode: 'M-QC4-01',
    sampleCodes: ['M-QC4-01-A', 'M-QC4-01-B'],
    sealCode: 'SEAL-01',
    notes: 'niêm phong',
  });
});

test('sample coding keeps PCN lot code, physical sample codes, and seal stamp separate', () => {
  const form: PcnOperationalForms['sampleCoding'] = {
    codedAt: '2026-08-31',
    coder: 'Nhân viên PCN',
    lotCode: 'QC4-LOT-01',
    sampleCodes: ['QC4-LOT-01-01'],
    sealCode: 'TEM-01',
    notes: '',
  };

  assert.deepEqual(validatePcnOperationalForm('SAMPLE_CODING', form), {});
  assert.notEqual(form.lotCode, form.sampleCodes[0]);
  assert.notEqual(form.sealCode, form.lotCode);
});

test('all operational form kinds have an explicit required-field contract', () => {
  const kinds: PcnOperationalFormKind[] = ['ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'COMMERCIAL'];
  for (const kind of kinds) {
    assert.ok(Array.isArray(FORM_REQUIRED_FIELDS[kind]));
    assert.ok(FORM_REQUIRED_FIELDS[kind].length > 0);
  }
});
