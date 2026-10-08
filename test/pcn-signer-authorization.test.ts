import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnSignerDelegation, PcnUserAccount } from '../types.ts';
import {
  getPcnSignerAuthorization,
  getPcnAuthorizedSignerOptions,
} from '../utils/pcnSignerAuthorization.ts';
import { getPcnIssuanceGenericMutationDenial } from '../utils/pcnIssuance.ts';

const users: PcnUserAccount[] = [
  { username: 'leader', name: 'Lãnh đạo', role: 'admin', systemRole: 'admin', departmentRoleCode: 'LEADERSHIP', fieldCodes: ['QC4', 'QC9'], active: true },
  { username: 'expert', name: 'Chuyên gia', role: 'staff', systemRole: 'staff', departmentRoleCode: 'CERTIFICATION_EXPERT', fieldCodes: ['QC4'], active: true },
  { username: 'viewer', name: 'Chỉ xem', role: 'viewer', systemRole: 'viewer', departmentRoleCode: 'LEADERSHIP', fieldCodes: ['QC4'], active: true },
  { username: 'inactive', name: 'Đã khóa', role: 'staff', systemRole: 'staff', departmentRoleCode: 'LEADERSHIP', fieldCodes: ['QC4'], active: false },
  { username: 'approver', name: 'Admin duyệt ủy quyền', role: 'admin', systemRole: 'admin', departmentRoleCode: 'DOCUMENT_CLERK', fieldCodes: ['QC4'], active: true },
];

const delegation: PcnSignerDelegation = {
  id: 'delegation-1',
  grantorUsername: 'leader',
  delegateUsername: 'expert',
  fieldCodes: ['QC4'],
  effectiveFrom: '2026-08-01T00:00:00.000Z',
  effectiveUntil: '2026-08-31T23:59:59.999Z',
  reason: 'Người ký đi công tác',
  approvedByUsername: 'approver',
  status: 'ACTIVE',
};

test('authorizes only an active leadership account as a direct signer', () => {
  const direct = getPcnSignerAuthorization({ signerUsername: 'leader', fieldCodes: ['QC4'], issuedAt: '2026-08-15T10:00:00.000Z', users, delegations: [] });
  assert.equal(direct.authorized, true);
  assert.equal(direct.mode, 'DIRECT');

  const viewer = getPcnSignerAuthorization({ signerUsername: 'viewer', fieldCodes: ['QC4'], issuedAt: '2026-08-15T10:00:00.000Z', users, delegations: [] });
  assert.equal(viewer.authorized, false);
  assert.match(viewer.reason, /viewer|chức vụ|người ký/i);

  const invalidIssueDate = getPcnSignerAuthorization({ signerUsername: 'leader', fieldCodes: ['QC4'], issuedAt: 'not-a-date', users, delegations: [] });
  assert.equal(invalidIssueDate.authorized, false);
  assert.match(invalidIssueDate.reason, /ngày cấp/i);
});

test('authorizes an explicit delegation only inside its active date and field scope', () => {
  const delegated = getPcnSignerAuthorization({ signerUsername: 'expert', fieldCodes: ['QC4'], issuedAt: '2026-08-15T10:00:00.000Z', users, delegations: [delegation] });
  assert.equal(delegated.authorized, true);
  assert.equal(delegated.mode, 'DELEGATED');
  assert.equal(delegated.delegation?.id, delegation.id);

  const expired = getPcnSignerAuthorization({ signerUsername: 'expert', fieldCodes: ['QC4'], issuedAt: '2026-09-01T00:00:00.000Z', users, delegations: [delegation] });
  assert.equal(expired.authorized, false);
  assert.match(expired.reason, /hạn|ủy quyền/i);

  const wrongField = getPcnSignerAuthorization({ signerUsername: 'expert', fieldCodes: ['QC9'], issuedAt: '2026-08-15T10:00:00.000Z', users, delegations: [delegation] });
  assert.equal(wrongField.authorized, false);
});

test('rejects unsafe delegation records and never offers arbitrary usernames', () => {
  const unsafe = getPcnSignerAuthorization({
    signerUsername: 'expert',
    fieldCodes: ['QC4'],
    issuedAt: '2026-08-15T10:00:00.000Z',
    users,
    delegations: [{ ...delegation, grantorUsername: 'inactive' }],
  });
  assert.equal(unsafe.authorized, false);

  const options = getPcnAuthorizedSignerOptions({ fieldCodes: ['QC4'], issuedAt: '2026-08-15T10:00:00.000Z', users, delegations: [delegation] });
  assert.deepEqual(options.map((option) => option.username), ['leader', 'expert']);
  assert.deepEqual(options.map((option) => option.mode), ['DIRECT', 'DELEGATED']);
});

test('issuance and delegation boundaries are server-side and dedicated', () => {
  const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
  const issuanceViewSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
  assert.match(serverSource, /\/api\/pcn\/issuance\/:issuanceId\/issue/);
  assert.match(serverSource, /pcnSignerDelegations/);
  assert.match(serverSource, /getPcnSignerAuthorization/);
  assert.match(serverSource, /getPcnIssuanceGenericMutationDenial/);
  assert.match(serverSource, /issuancePackages.*ISSUED/s);
  assert.match(issuanceViewSource, /getPcnAuthorizedSignerOptions/);
  assert.doesNotMatch(issuanceViewSource, /<input[^>]+signerUsername/);
});

test('signer delegation form requires an explicit field scope', () => {
  const panelSource = fs.readFileSync(new URL('../components/PcnSignerDelegationPanel.tsx', import.meta.url), 'utf8');

  assert.match(panelSource, /const reset = \(\) => setForm\([\s\S]*?fieldCodes: \[\],/);
  assert.doesNotMatch(panelSource, /fieldCodes: fields\.filter\(.*?slice\(0, 1\)/s);
});

test('generic issuance writes cannot bypass the dedicated issue route', () => {
  assert.match(
    getPcnIssuanceGenericMutationDenial({ status: 'ISSUED' }) || '',
    /chỉ được cấp số qua endpoint chuyên biệt/i,
  );
  assert.equal(getPcnIssuanceGenericMutationDenial({ status: 'APPROVED' }), null);
  assert.equal(getPcnIssuanceGenericMutationDenial({ status: 'DELIVERED' }), null);
});

// --- End of pcn-signer-authorization.test.ts ---
