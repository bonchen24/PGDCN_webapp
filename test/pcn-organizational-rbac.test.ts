import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getDepartmentScopes, toPcnUserAccount } from '../utils/pcnAuth.ts';
import { mapPcnRosterRow } from '../utils/pcnUserRoster.ts';
import { hasProfessionalRole, isOrganizationLeader } from '../utils/pcnRbac.ts';
import { getPcnApprovalDecisionDenial, buildPcnApprovalSteps } from '../utils/pcnApproval.ts';
import { getPcnSignerAuthorization, getPcnSignerActorDenial } from '../utils/pcnSignerAuthorization.ts';
import { getPgdApprovalDenial, isPgdSystemManager } from '../utils/pgdDomain.ts';
import { getPgdAssignmentApprovalDenial } from '../utils/pgdWorkflow.ts';
import { canManageSystemUsers } from '../utils/systemSettingsPolicy.ts';

const userManagementSource = fs.readFileSync(new URL('../components/PcnUserManagementView.tsx', import.meta.url), 'utf8');
const sidebarSource = fs.readFileSync(new URL('../components/PgdcnSidebar.tsx', import.meta.url), 'utf8');
const issuanceSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
const dossierDetailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const delegationSource = fs.readFileSync(new URL('../components/PcnSignerDelegationPanel.tsx', import.meta.url), 'utf8');
const rbacSource = fs.readFileSync(new URL('../utils/pcnRbac.ts', import.meta.url), 'utf8');
const systemSettingsSource = fs.readFileSync(new URL('../components/PgdcnSystemSettingsView.tsx', import.meta.url), 'utf8');

test('normalizes Center leadership and composable professional roles', () => {
  const user = toPcnUserAccount({
    documentId: 'center-director',
    data: {
      username: 'center-director',
      name: 'Giám đốc Trung tâm',
      systemRole: 'staff',
      managementRoleCode: 'CENTER_DIRECTOR',
      professionalRoleCodes: ['INSPECTION_EXPERT', 'CERTIFICATION_EXPERT'],
      departmentScopes: ['PGD', 'PCN'],
      fieldCodes: ['QC4'],
      active: true,
    },
  });

  assert.equal(user.managementRoleCode, 'CENTER_DIRECTOR');
  assert.deepEqual(user.professionalRoleCodes, ['INSPECTION_EXPERT', 'CERTIFICATION_EXPERT']);
  assert.equal(isOrganizationLeader(user), true);
  assert.equal(hasProfessionalRole(user, 'INSPECTION_EXPERT'), true);
  assert.equal(hasProfessionalRole(user, 'CERTIFICATION_EXPERT'), true);
});

test('keeps Department Deputy leadership when the same account is also an expert', () => {
  const user = toPcnUserAccount({
    documentId: 'department-deputy',
    data: {
      username: 'department-deputy',
      name: 'Phó phòng',
      systemRole: 'staff',
      managementRoleCode: 'DEPARTMENT_DEPUTY',
      professionalRoleCodes: ['INSPECTION_EXPERT'],
      departmentScopes: ['PGD', 'PCN'],
      fieldCodes: ['QC4', 'QC9'],
      active: true,
    },
  });

  assert.equal(isOrganizationLeader(user), true);
  assert.equal(hasProfessionalRole(user, 'INSPECTION_EXPERT'), true);
  assert.deepEqual(user.departmentScopes, ['PGD', 'PCN']);
});

test('does not grant leadership from a free-text position without a canonical role', () => {
  const user = {
    username: 'text-only',
    name: 'Tài khoản nhập tự do',
    role: 'staff' as const,
    systemRole: 'staff' as const,
    position: 'Trưởng phòng (ghi chú)',
    active: true,
  };

  assert.equal(isOrganizationLeader(user), false);
});

test('legacy department leadership remains scoped to both PCN and PGD', () => {
  assert.deepEqual(getDepartmentScopes({ departmentRoleCode: 'LEADERSHIP', position: 'Phó trưởng phòng' }, 'staff'), ['PCN', 'PGD']);
});

test('maps an imported Deputy position to canonical management and professional roles', () => {
  const input = mapPcnRosterRow({
    rowNumber: 2,
    name: 'Nguyễn Chuyên Gia',
    position: 'Phó trưởng phòng - Chuyên gia giám định',
    fieldAssignment: 'PGD',
  });

  assert.equal(input.managementRoleCode, 'DEPARTMENT_DEPUTY');
  assert.deepEqual(input.professionalRoleCodes, ['INSPECTION_EXPERT']);
  assert.deepEqual(input.departmentScopes, ['PCN', 'PGD']);
});

test('Center and Department leaders can manage both PCN and PGD surfaces', () => {
  const centerDeputy = toPcnUserAccount({
    documentId: 'center-deputy',
    data: {
      username: 'center-deputy',
      name: 'Phó giám đốc Trung tâm',
      systemRole: 'staff',
      managementRoleCode: 'CENTER_DEPUTY_DIRECTOR',
      departmentScopes: ['PGD', 'PCN'],
      fieldCodes: ['QC4'],
      active: true,
    },
  });
  const departmentHead = toPcnUserAccount({
    documentId: 'department-head',
    data: {
      username: 'department-head',
      name: 'Trưởng phòng',
      systemRole: 'staff',
      managementRoleCode: 'DEPARTMENT_HEAD',
      departmentScopes: ['PGD', 'PCN'],
      fieldCodes: ['QC4'],
      active: true,
    },
  });
  const approvalStep = buildPcnApprovalSteps('dossier-org')[0];

  for (const leader of [centerDeputy, departmentHead]) {
    assert.equal(canManageSystemUsers(leader), true);
    assert.equal(isPgdSystemManager(leader), true);
    assert.equal(getPgdApprovalDenial('LEADERSHIP_APPROVAL', 'LEADERSHIP_APPROVAL', leader), null);
    assert.equal(getPgdAssignmentApprovalDenial('APPROVED', leader), null);
    assert.equal(getPcnApprovalDecisionDenial(approvalStep, leader, ['QC4']), null);
    assert.equal(getPcnSignerAuthorization({
      signerUsername: leader.username,
      fieldCodes: ['QC4'],
      issuedAt: '2026-09-12T08:00:00.000Z',
      users: [leader],
      delegations: [],
    }).authorized, true);
  }
});

test('PGD operational manager does not become an organization manager', () => {
  const pgdManager = { role: 'staff' as const, systemRole: 'staff' as const, pgdRole: 'PGD_MANAGER' as const };
  assert.equal(isOrganizationLeader(pgdManager), false);
  assert.equal(canManageSystemUsers(pgdManager), false);
});

test('issuance signer selection cannot impersonate an authorized leader', () => {
  const leader = toPcnUserAccount({
    documentId: 'leader',
    data: {
      username: 'leader',
      name: 'Trưởng phòng',
      systemRole: 'staff',
      managementRoleCode: 'DEPARTMENT_HEAD',
      departmentScopes: ['PGD', 'PCN'],
      fieldCodes: ['QC4'],
      active: true,
    },
  });
  const authorization = getPcnSignerAuthorization({
    signerUsername: leader.username,
    fieldCodes: ['QC4'],
    issuedAt: '2026-09-12T08:00:00.000Z',
    users: [leader],
    delegations: [],
  });

  assert.equal(getPcnSignerActorDenial({ actorUsername: 'leader', signerUsername: 'leader', authorization }), null);
  assert.match(getPcnSignerActorDenial({ actorUsername: 'staff', signerUsername: 'leader', authorization }) || '', /người ký|ủy quyền|giả danh/i);
});

test('personnel management exposes canonical organization and professional role controls', () => {
  assert.match(userManagementSource, /ORGANIZATION_MANAGEMENT_ROLE_OPTIONS/);
  assert.match(userManagementSource, /PROFESSIONAL_ROLE_OPTIONS/);
  assert.match(userManagementSource, /professionalRoleCodes/);
  assert.match(userManagementSource, /Chức danh quản lý/);
  assert.match(userManagementSource, /PROFESSIONAL_ROLE_OPTIONS/);
  assert.match(userManagementSource, /ORGANIZATION_MANAGEMENT_ROLE_OPTIONS/);
  assert.match(sidebarSource, /PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG/);
  assert.match(issuanceSource, /isOrganizationLeader/);
  assert.match(dossierDetailSource, /isOrganizationLeader/);
  assert.match(delegationSource, /isOrganizationLeader/);
});

test('system settings remains a shared administration surface, not a PCN configuration page', () => {
  assert.match(systemSettingsSource, /Cài đặt hệ thống/);
  assert.match(systemSettingsSource, /PcnUserManagementView/);
  assert.doesNotMatch(systemSettingsSource, /PcnSettingsView/);
  assert.doesNotMatch(systemSettingsSource, /Cấu hình PCN/);
  assert.doesNotMatch(systemSettingsSource, /pcnTemplates|onUploadPcnTemplate|onReviewPcnTemplate/);
});

test('browser RBAC policy does not pull server-only authentication into the client bundle', () => {
  assert.doesNotMatch(rbacSource, /from ['"]\.\/pcnAuth\.ts['"]/);
});
