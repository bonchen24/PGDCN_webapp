import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { normalizePcnSettings } from '../utils/pcnSettings.ts';
import { confirmPcnQc20ScopeConfiguration, getPcnQc20Readiness, validatePcnQc20ScopeConfirmation } from '../utils/pcnQc20ScopeGovernance.ts';

test('QC20 settings start pending without inventing a legal scope catalog', () => {
  const settings = normalizePcnSettings({}) as any;

  assert.deepEqual(settings.qc20ScopeConfiguration, {
    status: 'NEEDS_PCN_CONFIRMATION',
    scopeVersion: '',
    standardRefs: [
      'QCVN 20:2019/BKHCN',
      'Sửa đổi 1:2021 QCVN 20:2019/BKHCN',
    ],
    method: 'METHOD_7',
    sourceReferences: [
      'QCVN 20:2019/BKHCN',
      'Thông tư 09/2021/TT-BKHCN',
    ],
    productForms: [],
    grades: [],
    hsCodes: [],
    appliedStandards: [],
    chemicalCompositionRequirements: [],
  });
});

test('QC20 governance exposes an admin confirmation mutation and read-only readiness projection', () => {
  const server = fs.readFileSync('server.ts', 'utf8');

  assert.match(server, /app\.post\('\/api\/pcn\/settings\/qc20-scope\/confirm'/);
  assert.match(server, /app\.get\('\/api\/pcn\/settings\/qc20-readiness'/);
  assert.match(server, /scopeVersion/);
  assert.match(server, /confirmedByUsername/);
  assert.match(server, /confirmPcnQc20ScopeConfiguration/);
});

test('QC20 readiness requires both a confirmed scope and approved private certificate/decision templates', () => {
  const server = fs.readFileSync('server.ts', 'utf8');
  const governance = fs.readFileSync('utils/pcnQc20ScopeGovernance.ts', 'utf8');

  assert.match(governance, /QC20_SCOPE_NOT_CONFIRMED/);
  assert.match(governance, /\$\{documentKind\}: TEMPLATE_NOT_READY/);
  assert.match(server, /getPcnQc20Readiness/);
});

test('QC20 confirmation rejects incomplete evidence and records the actor/time on a valid configuration', () => {
  const incomplete = validatePcnQc20ScopeConfirmation({ confirmationNote: 'x' });
  assert.equal(incomplete.valid, false);
  assert.ok(incomplete.issues.some((issue) => issue.field === 'productForms'));
  assert.ok(incomplete.issues.some((issue) => issue.field === 'chemicalCompositionRequirements'));

  const confirmed = confirmPcnQc20ScopeConfiguration({
    scopeVersion: '2026.09',
    productForms: ['Tấm/cuộn'],
    grades: ['SUS304'],
    hsCodes: ['7219'],
    appliedStandards: ['JIS G4304'],
    sourceReferences: ['QCVN 20:2019/BKHCN', 'Thông tư 09/2021/TT-BKHCN'],
    chemicalCompositionRequirements: [{ element: 'Cr', minPercent: 10.5, source: 'Sửa đổi 1:2021' }],
    confirmationNote: 'Đã đối chiếu hồ sơ pháp lý và profile thử.',
  }, 'admin', '2026-09-03T08:00:00.000Z');
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(confirmed.confirmedByUsername, 'admin');
  assert.equal(confirmed.confirmedAt, '2026-09-03T08:00:00.000Z');
});

test('QC20 readiness remains blocked when official templates are not approved/private', () => {
  const readiness = getPcnQc20Readiness({
    scopeConfiguration: {
      scopeVersion: '2026.09', status: 'CONFIRMED', productForms: ['Tấm'], grades: ['SUS304'], hsCodes: ['7219'],
      appliedStandards: ['JIS G4304'], sourceReferences: ['QCVN 20:2019/BKHCN'],
      chemicalCompositionRequirements: [{ element: 'Cr', minPercent: 10.5, source: 'Sửa đổi 1:2021' }],
      confirmationNote: 'Đối chiếu',
    },
    templates: [],
  });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.reasons, ['CERTIFICATE: TEMPLATE_NOT_READY', 'DECISION: TEMPLATE_NOT_READY']);
});

test('PCN settings exposes the QC20 confirmation form and dedicated API client', () => {
  const settingsView = fs.readFileSync('components/PcnSettingsView.tsx', 'utf8');
  const scopePanel = fs.readFileSync('components/PcnQc20ScopePanel.tsx', 'utf8');
  const api = fs.readFileSync('utils/pcnQc20ScopeApi.ts', 'utf8');

  assert.match(scopePanel, /Xác nhận phạm vi QC20/);
  assert.match(scopePanel, /sourceReferences/);
  assert.match(scopePanel, /chemicalCompositionRequirements/);
  assert.match(settingsView, /PcnQc20ScopePanel/);
  assert.match(settingsView, /onReviewTemplate/);
  assert.match(settingsView, /Yêu cầu chỉnh sửa/);
  assert.match(settingsView, /Phê duyệt/);
  assert.match(api, /\/api\/pcn\/settings\/qc20-scope\/confirm/);
});

// --- End of test/pcn-qc20-governance.test.ts ---
