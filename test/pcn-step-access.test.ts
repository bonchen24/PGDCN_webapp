import test from 'node:test';
import assert from 'node:assert/strict';

import type { CertificationDossier } from '../types.ts';
import { getPcnDossierStepAccess, getPcnDossierReopenStatus, isPcnDossierPostApprovalLocked } from '../utils/pcnDossierStepAccess.ts';
import { getPcnRequirementReopenStatus } from '../utils/pcnDossierStageGate.ts';

const dossier = (status: CertificationDossier['status'], ownerUsername = 'owner-pcn'): CertificationDossier => ({
  id: 'dossier-step-access',
  dossierCode: 'PCN-STEP-ACCESS',
  proposalId: 'proposal-step-access',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status,
  ownerUsername,
  labRequestIds: [],
  returnedResultIds: [],
});

test('enforces owner editing, future-step lock, and post-approval withdrawal lock', () => {
  const current = getPcnDossierStepAccess({ dossier: dossier('TECHNICAL_REVIEW'), targetStageKey: 'TECHNICAL_REVIEW', actorUsername: 'owner-pcn' });
  assert.equal(current.editable, true);
  assert.equal(current.locked, false);

  const future = getPcnDossierStepAccess({ dossier: dossier('TECHNICAL_REVIEW'), targetStageKey: 'APPROVAL', actorUsername: 'owner-pcn' });
  assert.equal(future.editable, false);
  assert.equal(future.locked, true);
  assert.match(future.reason || '', /Bước sau/);

  const nonOwner = getPcnDossierStepAccess({ dossier: dossier('TECHNICAL_REVIEW'), targetStageKey: 'TECHNICAL_REVIEW', actorUsername: 'other-pcn' });
  assert.equal(nonOwner.editable, false);
  assert.match(nonOwner.reason || '', /chủ hồ sơ/i);

  assert.equal(isPcnDossierPostApprovalLocked('APPROVED'), true);
  assert.equal(isPcnDossierPostApprovalLocked('ISSUED'), true);
  assert.equal(isPcnDossierPostApprovalLocked('WAITING_APPROVAL'), false);
  const postApproval = getPcnDossierStepAccess({ dossier: dossier('APPROVED'), targetStageKey: 'TECHNICAL_REVIEW', actorUsername: 'owner-pcn' });
  assert.equal(postApproval.editable, false);
  assert.equal(postApproval.requiresWithdrawal, true);
  assert.match(postApproval.reason || '', /thu hồi/i);
  assert.equal(getPcnDossierReopenStatus('TECHNICAL_REVIEW'), 'TECHNICAL_REVIEW');
});

test('keeps exception handling available without presenting it as a sixth workflow step', () => {
  const access = getPcnDossierStepAccess({ dossier: dossier('ON_HOLD'), targetStageKey: 'EXCEPTIONS', actorUsername: 'staff-pcn' });
  assert.equal(access.editable, true);
  assert.equal(access.requiresWithdrawal, false);
});

test('reopens the compact step affected by an earlier document change', () => {
  const requirement = {
    id: 'QC4-TEST_REPORT', fieldCode: 'QC4' as const, code: 'TEST_REPORT', name: 'KQTN',
    stages: ['TECHNICAL_REVIEW' as const], stationKeys: ['RESULTS' as const], required: true, active: true, sortOrder: 1,
  };
  assert.equal(getPcnRequirementReopenStatus(requirement), 'AWAITING_RESULTS');
});
