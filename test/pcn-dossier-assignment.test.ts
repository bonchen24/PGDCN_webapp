import assert from 'node:assert/strict';
import test from 'node:test';

import { getPcnDossierAssignmentDenial, getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment.ts';

const users = [
  { username: 'evaluator-qc4', active: true, systemRole: 'staff', fieldCodes: ['QC4'] },
  { username: 'reviewer-qc9', active: true, systemRole: 'admin', fieldCodes: ['QC9'] },
  { username: 'inactive-qc4', active: false, systemRole: 'staff', fieldCodes: ['QC4'] },
  { username: 'viewer-qc4', active: true, systemRole: 'viewer', fieldCodes: ['QC4'] },
  { username: 'staff-qc9', active: true, systemRole: 'staff', fieldCodes: ['QC9'] },
];

test('dossier assignment accepts an active non-viewer user inside the dossier field scope', () => {
  assert.equal(getPcnDossierAssignmentDenial({
    assignmentLabel: 'Trưởng đoàn đánh giá',
    currentUsername: '',
    nextUsername: 'EVALUATOR-QC4',
    dossierFieldCodes: ['QC4'],
    users,
  }), null);
});

test('dossier assignment rejects unknown, inactive, viewer and out-of-scope users', () => {
  for (const nextUsername of ['missing-user', 'inactive-qc4', 'viewer-qc4', 'staff-qc9']) {
    assert.match(getPcnDossierAssignmentDenial({
      assignmentLabel: 'Người soát xét kỹ thuật',
      currentUsername: '',
      nextUsername,
      dossierFieldCodes: ['QC4'],
      users,
    }) || '', /tài khoản PCN|không hoạt động|viewer|phạm vi Lĩnh vực/i);
  }
});

test('assignment can be cleared and unchanged legacy assignments remain reviewable', () => {
  assert.equal(getPcnDossierAssignmentDenial({
    assignmentLabel: 'Trưởng đoàn đánh giá',
    currentUsername: 'legacy-user',
    nextUsername: '',
    dossierFieldCodes: ['QC4'],
    users,
  }), null);
  assert.equal(getPcnDossierAssignmentDenial({
    assignmentLabel: 'Trưởng đoàn đánh giá',
    currentUsername: 'Legacy-User',
    nextUsername: 'legacy-user',
    dossierFieldCodes: ['QC4'],
    users,
  }), null);
});

test('owner transfer authority belongs to Admin or Leadership while staff may self-claim an unassigned dossier', () => {
  assert.equal(getPcnOwnerAssignmentAuthorityDenial({
    currentUsername: 'owner-qc4',
    nextUsername: 'new-owner-qc4',
    actorUsername: 'leader',
    actorSystemRole: 'admin',
    actorDepartmentRoleCode: 'LEADERSHIP',
  }), null);
  assert.match(getPcnOwnerAssignmentAuthorityDenial({
    currentUsername: 'owner-qc4',
    nextUsername: 'new-owner-qc4',
    actorUsername: 'staff-qc4',
    actorSystemRole: 'staff',
    actorDepartmentRoleCode: 'CERTIFICATION_EXPERT',
  }) || '', /Admin hoặc Lãnh đạo|chủ hồ sơ/i);
  assert.equal(getPcnOwnerAssignmentAuthorityDenial({
    currentUsername: '',
    nextUsername: 'staff-qc4',
    actorUsername: 'STAFF-QC4',
    actorSystemRole: 'staff',
    actorDepartmentRoleCode: 'CERTIFICATION_EXPERT',
  }), null);
  assert.match(getPcnOwnerAssignmentAuthorityDenial({
    currentUsername: '',
    nextUsername: 'other-qc4',
    actorUsername: 'staff-qc4',
    actorSystemRole: 'staff',
    actorDepartmentRoleCode: 'CERTIFICATION_EXPERT',
  }) || '', /chính mình|chủ hồ sơ/i);
  assert.match(getPcnOwnerAssignmentAuthorityDenial({
    currentUsername: 'owner-qc4',
    nextUsername: '',
    actorUsername: 'staff-qc4',
    actorSystemRole: 'staff',
    actorDepartmentRoleCode: 'CERTIFICATION_EXPERT',
  }) || '', /Admin hoặc Lãnh đạo|chủ hồ sơ/i);
});

// --- End of pcn-dossier-assignment.test.ts ---
