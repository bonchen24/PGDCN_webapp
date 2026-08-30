import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnUserAccount } from '../types.ts';
import {
  PCN_NEUTRAL_USER_LABEL,
  getPcnActorDisplayName,
  getPcnUserDisplayName,
} from '../utils/pcnUserIdentity.ts';

const users: PcnUserAccount[] = [
  { username: 'nguyenvana', name: 'Nguyễn Văn A', role: 'staff', systemRole: 'staff', departmentRoleCode: 'CERTIFICATION_EXPERT', fieldCodes: ['QC4'], active: true },
  { username: 'lethib', name: 'Lê Thị B', role: 'staff', systemRole: 'staff', departmentRoleCode: 'DOCUMENT_CLERK', fieldCodes: ['QC9'], active: true },
];

test('PCN business identity resolves names without leaking technical usernames', () => {
  assert.equal(getPcnUserDisplayName('nguyenvana', users), 'Nguyễn Văn A');
  assert.equal(getPcnUserDisplayName('Nguyễn Văn A', users), 'Nguyễn Văn A');
  assert.equal(getPcnUserDisplayName('unknown-user', users), PCN_NEUTRAL_USER_LABEL);
  assert.equal(getPcnUserDisplayName(undefined, users), PCN_NEUTRAL_USER_LABEL);
  assert.equal(getPcnActorDisplayName('Nguyễn Văn A', 'nguyenvana', users), 'Nguyễn Văn A');
  assert.equal(getPcnActorDisplayName('unknown-user', 'unknown-user', users), PCN_NEUTRAL_USER_LABEL);
});

test('PCN business screens use human-readable identity labels while retaining technical values only internally', () => {
  const detail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
  const operations = fs.readFileSync(new URL('../components/PcnOperationsRegisterView.tsx', import.meta.url), 'utf8');
  const quality = fs.readFileSync(new URL('../components/PcnQualityDocumentsView.tsx', import.meta.url), 'utf8');
  const issuance = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
  const approval = fs.readFileSync(new URL('../components/PcnApprovalModal.tsx', import.meta.url), 'utf8');
  const delegation = fs.readFileSync(new URL('../components/PcnSignerDelegationPanel.tsx', import.meta.url), 'utf8');

  assert.match(detail, /getPcnActorDisplayName/);
  assert.match(detail, /getPcnUserDisplayName/);
  assert.doesNotMatch(detail, /\$\{log\.actorUsername\}/);
  assert.doesNotMatch(detail, /\{user\.name\} · \{user\.username\}/);
  assert.match(operations, /getPcnUserDisplayName/);
  assert.match(quality, /getPcnUserDisplayName/);
  assert.doesNotMatch(quality, /Phụ trách: \$\{document\.ownerUsername\}/);
  assert.match(issuance, /getPcnUserDisplayName/);
  assert.doesNotMatch(issuance, /\{option\.name\} \(/);
  assert.match(approval, /getPcnUserDisplayName/);
  assert.doesNotMatch(approval, /Tài khoản: \{step\.assigneeUsername\}/);
  assert.match(delegation, /getPcnUserDisplayName/);
  assert.doesNotMatch(delegation, /\?\.name \|\| delegation\.(grantor|delegate)Username/);
});
