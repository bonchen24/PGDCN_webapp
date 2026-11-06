import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  PGD_V2_WORKFLOW_STAGE_IDS,
  getPgdV2CurrentStepNumber,
  getPgdV2ReturnTarget,
} from '../utils/pgdWorkflow.ts';
import { getPgdUserCapabilities, validatePgdCapabilityAssignments } from '../utils/pgdDossierCapabilities.ts';
import { getPgdTransitionDenial, PGD_COLLECTIONS } from '../utils/pgdDomain.ts';
import { closePgdAssessmentRound, createPgdAssessmentRound } from '../utils/pgdAssessmentRounds.ts';
import { buildPgdDossierChecklist } from '../utils/pgdDossier.ts';
import { buildPgdDossierPackageManifest } from '../utils/pgdDossierPackage.ts';
import { installDocumentDatabase, routeRequest } from './helpers/document-route-database.ts';

const baseRequire = createRequire(import.meta.url);
const serverRequire = createRequire(new URL('../lib/server/pgd-operations.ts', import.meta.url));
(globalThis as any).require = Object.assign(
  (id: string) => {
    try {
      return baseRequire(id);
    } catch (err: any) {
      if (err?.code === 'MODULE_NOT_FOUND' && (id.startsWith('.') || id.startsWith('@/'))) {
        return serverRequire(id);
      }
      throw err;
    }
  },
  baseRequire,
);
const transitionRoute = await import('../app/api/pgd/requests/[requestId]/transition/route.ts');
const approvalsRoute = await import('../app/api/pgd/approvals/route.ts');
const requestsRoute = await import('../app/api/pgd/requests/route.ts');
const issuanceRoute = await import('../app/api/pgd/issuance/route.ts');
const inspectionPlansRoute = await import('../app/api/pgd/inspection-plans/route.ts');

test('new PGD workflow schema has the seven approved business stages in order', () => {
  assert.deepEqual(PGD_V2_WORKFLOW_STAGE_IDS, [
    'intake',
    'input-review',
    'assignment-plan',
    'assessment-testing',
    'technical-review',
    'leadership-approval',
    'issuance-archive',
  ]);
});

test('v2 lifecycle maps input, execution, review, approval, and issuance statuses to separate stages', () => {
  assert.equal(getPgdV2CurrentStepNumber('DRAFT'), 1);
  assert.equal(getPgdV2CurrentStepNumber('CAPABILITY_REVIEW'), 2);
  assert.equal(getPgdV2CurrentStepNumber('PREPARING'), 3);
  assert.equal(getPgdV2CurrentStepNumber('RESULTS_REVIEW'), 4);
  assert.equal(getPgdV2CurrentStepNumber('TECHNICAL_REVIEW'), 5);
  assert.equal(getPgdV2CurrentStepNumber('LEADERSHIP_APPROVAL'), 6);
  assert.equal(getPgdV2CurrentStepNumber('APPROVED_FOR_ISSUANCE'), 7);
  assert.equal(getPgdV2CurrentStepNumber('SIGNED'), 7);
});

test('v2 technical and leadership review both return to assessment/testing with a reason', () => {
  assert.deepEqual(getPgdV2ReturnTarget('TECHNICAL_REVIEW'), {
    stageId: 'assessment-testing',
    status: 'FIELD_INSPECTION',
    requiresReason: true,
  });
  assert.deepEqual(getPgdV2ReturnTarget('LEADERSHIP_APPROVAL'), {
    stageId: 'assessment-testing',
    status: 'FIELD_INSPECTION',
    requiresReason: true,
  });
  assert.equal(getPgdV2ReturnTarget('LEADERSHIP_APPROVAL').requiresReason, true);
});

test('PGD capability snapshots require active scoped users with explicit qualifications', () => {
  const users = [
    { username: 'inspector', active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_FIELD_INSPECTOR' },
    { username: 'clerk', active: true, departmentScopes: ['PGD'], professionalRoleCodes: ['DOCUMENT_CLERK'] },
    { username: 'inactive', active: false, departmentScopes: ['PGD'], professionalRoleCodes: ['INSPECTION_EXPERT'] },
    { username: 'other-scope', active: true, departmentScopes: ['PCN'], professionalRoleCodes: ['INSPECTION_EXPERT'] },
  ] as const;
  assert.equal(getPgdUserCapabilities(users[0]).includes('ASSESSOR'), true);
  assert.equal(getPgdUserCapabilities(users[1]).includes('OFFICE_ISSUANCE'), true);
  const result = validatePgdCapabilityAssignments([
    { username: 'inspector', capability: 'ASSESSOR' },
    { username: 'clerk', capability: 'ARCHIVE' },
    { username: 'inactive', capability: 'ASSESSOR' },
    { username: 'other-scope', capability: 'ASSESSOR' },
  ], users);
  assert.deepEqual(result.map((issue) => issue.username), ['inactive', 'other-scope']);
});

test('v2 plan acceptance is a gate before opening the assessment stage', () => {
  assert.match(getPgdTransitionDenial('PREPARING', 'FIELD_INSPECTION', { requiresPlanAcceptance: true }), /trưởng đoàn|lịch/i);
  assert.equal(getPgdTransitionDenial('PREPARING', 'FIELD_INSPECTION', { requiresPlanAcceptance: true, hasAcceptedPlan: true }), null);
  assert.equal(getPgdTransitionDenial('PREPARING', 'FIELD_INSPECTION', {}), null);
});

test('v2 multi-day plan can only be accepted or returned by its assigned team lead, with a reason and audit on return', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const requestId = 'req-v2-plan-response';
  const planId = 'plan-v2-plan-response';
  db.seed(PGD_COLLECTIONS.requests, requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-261106-PLAN',
    status: 'PREPARING',
    workflowSchemaVersion: 2,
    receivedByUsername: 'requester',
  });
  db.seed(PGD_COLLECTIONS.assignments, 'assign-v2-plan-response', {
    id: 'assign-v2-plan-response',
    domain: 'pgd',
    requestId,
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead', 'assessor-one'],
  });
  db.seed(PGD_COLLECTIONS.inspectionPlans, planId, {
    id: planId,
    domain: 'pgd',
    requestId,
    status: 'DRAFT',
    team: [{ username: 'team-lead', role: 'LEAD' }, { username: 'assessor-one', role: 'MEMBER' }],
    schedule: [{ date: '2026-11-10' }, { date: '2026-11-11' }],
    createdAt: '2026-11-06T00:00:00.000Z',
    updatedAt: '2026-11-06T00:00:00.000Z',
  });
  const teamLead = {
    username: 'team-lead', name: 'Assigned team lead', role: 'staff', systemRole: 'staff',
    active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_FIELD_INSPECTOR',
  };

  const managerAttempt = await inspectionPlansRoute.POST(routeRequest('/api/pgd/inspection-plans', 'POST', {
    id: planId, requestId, action: 'ACCEPT',
  }, pgdManagerActor));
  assert.equal(managerAttempt.status, 403);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);

  const missingReason = await inspectionPlansRoute.POST(routeRequest('/api/pgd/inspection-plans', 'POST', {
    id: planId, requestId, action: 'RETURN',
  }, teamLead));
  assert.equal(missingReason.status, 400);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);

  const returnReason = 'Bổ sung lịch làm việc ngày thứ hai và thời gian lấy mẫu.';
  const returnResponse = await inspectionPlansRoute.POST(routeRequest('/api/pgd/inspection-plans', 'POST', {
    id: planId, requestId, action: 'RETURN', reason: returnReason,
  }, teamLead));
  assert.equal(returnResponse.status, 200);
  const returnedPlan = db.list(PGD_COLLECTIONS.inspectionPlans).find((item) => item.document_id === planId)?.data;
  assert.equal(returnedPlan?.acceptance?.status, 'RETURNED');
  assert.equal(returnedPlan?.acceptance?.actedByUsername, 'team-lead');
  assert.equal(returnedPlan?.acceptance?.reason, returnReason);
  assert.equal(returnedPlan?.schedule.length, 2);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
  assert.match(db.list(PGD_COLLECTIONS.activityLogs)[0]?.data.summary || '', /Trưởng đoàn trả lịch.*Bổ sung lịch làm việc/);

  const acceptResponse = await inspectionPlansRoute.POST(routeRequest('/api/pgd/inspection-plans', 'POST', {
    id: planId, requestId, action: 'ACCEPT',
  }, teamLead));
  assert.equal(acceptResponse.status, 200);
  const acceptedPlan = db.list(PGD_COLLECTIONS.inspectionPlans).find((item) => item.document_id === planId)?.data;
  assert.equal(acceptedPlan?.acceptance?.status, 'ACCEPTED');
  assert.equal(acceptedPlan?.acceptance?.actedByUsername, 'team-lead');
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 2);
});

test('separate PGD assessment rounds retain a failed first result when the retest passes', () => {
  const first = createPgdAssessmentRound({ id: 'round-1', requestId: 'request-1', openedByUsername: 'lead' }, '2026-11-06T01:00:00.000Z');
  const failed = closePgdAssessmentRound(first, { closedByUsername: 'lead', outcome: 'NON_CONFORMING' }, '2026-11-06T02:00:00.000Z');
  const second = createPgdAssessmentRound({ id: 'round-2', requestId: 'request-1', openedByUsername: 'lead', existingRounds: [failed], reason: 'Thử nghiệm lại sau khi xử lý bổ sung' }, '2026-11-07T01:00:00.000Z');
  const passed = closePgdAssessmentRound(second, { closedByUsername: 'lead', outcome: 'CONFORMING' }, '2026-11-07T02:00:00.000Z');
  assert.equal(failed.sequence, 1);
  assert.equal(failed.outcome, 'NON_CONFORMING');
  assert.equal(passed.sequence, 2);
  assert.equal(passed.outcome, 'CONFORMING');
  assert.equal(failed.status, 'CLOSED');
  assert.equal(passed.status, 'CLOSED');
});

test('dossier package manifest keeps each assessment round visible in its archive path', () => {
  const manifest = buildPgdDossierPackageManifest({
    dossierCode: 'PGD-2026-0001',
    pointers: [{
      id: 'doc-round-2',
      domain: 'pgd',
      requestId: 'request-1',
      assessmentRoundId: 'pgd-round-2',
      fileName: 'test-result.pdf',
      sourceCollection: PGD_COLLECTIONS.dossierDocuments,
      sourceDocumentId: 'doc-round-2',
      version: 1,
      checksum: 'a'.repeat(64),
      fileAssetId: 'asset-1',
      kind: 'DOSSIER_DOCUMENT',
    }],
  });
  assert.equal(manifest.entries[0]?.assessmentRoundId, 'pgd-round-2');
  assert.match(manifest.entries[0]?.archivePath || '', /^pgd-round-2\//);
});

test('v2 cannot leave B4 for technical review while an assessment round is still open', () => {
  assert.match(getPgdTransitionDenial('RESULTS_REVIEW', 'TECHNICAL_REVIEW', { hasOpenAssessmentRounds: true }), /đợt đánh giá đang mở/i);
  assert.equal(getPgdTransitionDenial('RESULTS_REVIEW', 'TECHNICAL_REVIEW', { hasOpenAssessmentRounds: false, labResultReview: { status: 'FINAL', conformity: 'CONFORMING', retestRequired: false } }), null);
});

const regularPgdStaff = {
  username: 'regular-staff',
  name: 'Regular PGD Staff',
  systemRole: 'staff',
  role: 'staff',
  active: true,
  departmentScopes: ['PGD'],
  pgdRole: 'PGD_FIELD_INSPECTOR',
};

const pgdManagerActor = {
  username: 'pgd-head',
  name: 'PGD Department Head',
  systemRole: 'staff',
  role: 'staff',
  active: true,
  departmentScopes: ['PGD'],
  pgdRole: 'PGD_MANAGER',
  managementRoleCode: 'DEPARTMENT_HEAD',
};

const postTransition = (requestId: string, body: Record<string, unknown>, actor: Record<string, unknown> = pgdManagerActor) =>
  transitionRoute.POST(
    routeRequest(`/api/pgd/requests/${requestId}/transition`, 'POST', body, actor),
    { params: Promise.resolve({ requestId }) },
  );

test('v2 B2 capability review transition rejects regular PGD staff without mutation and allows PGD manager when assignment is approved', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'req-v2-b2', {
    id: 'req-v2-b2',
    domain: 'pgd',
    requestCode: 'PGD-261106-01',
    status: 'CAPABILITY_REVIEW',
    workflowSchemaVersion: 2,
  });
  db.seed(PGD_COLLECTIONS.assignments, 'assign-v2-b2', {
    id: 'assign-v2-b2',
    domain: 'pgd',
    requestId: 'req-v2-b2',
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
  });

  for (const payload of [
    { status: 'READY_TO_EXECUTE' },
    { status: 'REJECTED', reason: 'Chưa đủ năng lực thiết bị thử nghiệm' },
    { status: 'ON_HOLD', reason: 'Chờ bổ sung hồ sơ đầu vào' },
  ]) {
    const res = await postTransition('req-v2-b2', payload, regularPgdStaff);
    assert.equal(res.status, 403);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.status, 'CAPABILITY_REVIEW');
    assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  }

  const acceptRes = await postTransition('req-v2-b2', { status: 'READY_TO_EXECUTE' }, pgdManagerActor);
  assert.equal(acceptRes.status, 200);
  assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.status, 'READY_TO_EXECUTE');
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
});

test('v2 PREPARING -> FIELD_INSPECTION transition requires assigned TEAM_LEAD and rejects unassigned or out-of-scope staff without mutation', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'req-v2-b3', {
    id: 'req-v2-b3',
    domain: 'pgd',
    requestCode: 'PGD-261106-02',
    status: 'PREPARING',
    workflowSchemaVersion: 2,
  });
  db.seed(PGD_COLLECTIONS.assignments, 'assign-v2-b3', {
    id: 'assign-v2-b3',
    domain: 'pgd',
    requestId: 'req-v2-b3',
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead', 'assessor-only'],
    roleAssignments: [
      { username: 'team-lead', capability: 'TEAM_LEAD' },
      { username: 'assessor-only', capability: 'ASSESSOR' },
    ],
  });
  db.seed(PGD_COLLECTIONS.inspectionPlans, 'plan-v2-b3', {
    id: 'plan-v2-b3',
    domain: 'pgd',
    requestId: 'req-v2-b3',
    acceptance: { status: 'ACCEPTED', actedByUsername: 'team-lead', actedAt: '2026-11-06T01:00:00.000Z' },
  });

  const unauthorizedActors = [
    regularPgdStaff,
    { ...regularPgdStaff, username: 'assessor-only', name: 'Assessor Only' },
    { username: 'pcn-staff', name: 'Out of Scope Staff', systemRole: 'staff', role: 'staff', active: true, departmentScopes: ['PCN'] },
  ];

  for (const actor of unauthorizedActors) {
    const res = await postTransition('req-v2-b3', { status: 'FIELD_INSPECTION' }, actor);
    assert.equal(res.status, 403);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.status, 'PREPARING');
    assert.equal(db.list(PGD_COLLECTIONS.assessmentRounds).length, 0);
    assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  }

  const teamLeadActor = {
    ...regularPgdStaff,
    username: 'team-lead',
    name: 'Assigned Team Lead',
  };
  const allowedRes = await postTransition('req-v2-b3', { status: 'FIELD_INSPECTION' }, teamLeadActor);
  assert.equal(allowedRes.status, 200);
  assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.status, 'FIELD_INSPECTION');
  assert.equal(db.list(PGD_COLLECTIONS.assessmentRounds).length, 1);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
});

test('v2 generic transition endpoint rejects B7 SIGNED, RESULT_RETURNED, and ARCHIVED transitions with 409 and no mutation', async (t) => {
  t.mock.method(console, 'error', () => {});
  const cases = [
    { currentStatus: 'APPROVED_FOR_ISSUANCE', nextStatus: 'SIGNED' },
    { currentStatus: 'SIGNED', nextStatus: 'RESULT_RETURNED' },
    { currentStatus: 'RESULT_RETURNED', nextStatus: 'ARCHIVED' },
  ] as const;

  for (const { currentStatus, nextStatus } of cases) {
    const db = installDocumentDatabase(t);
    db.seed(PGD_COLLECTIONS.requests, 'req-v2-b7', {
      id: 'req-v2-b7',
      domain: 'pgd',
      requestCode: 'PGD-261106-03',
      status: currentStatus,
      workflowSchemaVersion: 2,
    });
    db.seed(PGD_COLLECTIONS.certificates, 'cert-v2-b7', {
      id: 'cert-v2-b7',
      domain: 'pgd',
      requestId: 'req-v2-b7',
      status: 'SIGNED',
      signedAt: '2026-11-06T02:00:00.000Z',
    });

    const res = await postTransition('req-v2-b7', { status: nextStatus }, pgdManagerActor);
    assert.equal(res.status, 409);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.status, currentStatus);
    assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  }
});

test('legacy request without workflowSchemaVersion 2 is not newly blocked by v2 per-dossier capability guards', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'req-legacy-1', {
    id: 'req-legacy-1',
    domain: 'pgd',
    requestCode: 'PGD-261106-04',
    status: 'PREPARING',
  });
  db.seed(PGD_COLLECTIONS.assignments, 'assign-legacy-1', {
    id: 'assign-legacy-1',
    domain: 'pgd',
    requestId: 'req-legacy-1',
    status: 'APPROVED',
    inspectorUsernames: ['other-inspector'],
  });

  const res = await postTransition('req-legacy-1', { status: 'FIELD_INSPECTION' }, regularPgdStaff);
  assert.equal(res.status, 200);
  assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.status, 'FIELD_INSPECTION');
  assert.equal(db.list(PGD_COLLECTIONS.assessmentRounds).length, 0);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
});

const technicalReviewerActor = {
  username: 'tech-reviewer',
  name: 'Assigned Technical Reviewer',
  systemRole: 'staff',
  role: 'staff',
  active: true,
  departmentScopes: ['PGD'],
  pgdRole: 'PGD_TECHNICAL',
};

const postApproval = (body: Record<string, unknown>, actor: Record<string, unknown> = technicalReviewerActor) =>
  approvalsRoute.POST(
    routeRequest('/api/pgd/approvals', 'POST', body, actor),
  );

test('v2 B5 technical review approval records APPROVED snapshot and advances request to LEADERSHIP_APPROVAL', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const waivedChecklist = buildPgdDossierChecklist('OTHER').map((item) =>
    item.required
      ? { ...item, status: 'WAIVED' as const, waiverReason: 'Đã xác nhận miễn chứng từ trong đợt thẩm xét' }
      : item,
  );
  db.seed(PGD_COLLECTIONS.requests, 'req-v2-b5', {
    id: 'req-v2-b5',
    domain: 'pgd',
    requestCode: 'PGD-261106-05',
    status: 'TECHNICAL_REVIEW',
    productGroup: 'OTHER',
    workflowSchemaVersion: 2,
    dossierChecklist: waivedChecklist,
  });
  db.seed(PGD_COLLECTIONS.assignments, 'assign-v2-b5', {
    id: 'assign-v2-b5',
    domain: 'pgd',
    requestId: 'req-v2-b5',
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
    technicalReviewerUsername: 'tech-reviewer',
    roleAssignments: [
      { username: 'team-lead', capability: 'TEAM_LEAD' },
      { username: 'tech-reviewer', capability: 'TECHNICAL_REVIEW' },
    ],
  });

  const res = await postApproval(
    {
      id: 'approval-tr-v2-b5',
      domain: 'pgd',
      requestId: 'req-v2-b5',
      sequence: 1,
      role: 'TECHNICAL_REVIEW',
      status: 'APPROVED',
      comment: 'Hồ sơ kỹ thuật đầy đủ, chuyển trình lãnh đạo phê duyệt',
    },
    technicalReviewerActor,
  );

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.approval?.status, 'APPROVED');
  assert.equal(payload.approval?.actedByUsername, 'tech-reviewer');
  assert.ok(payload.approval?.packageManifestHash);
  assert.equal(db.list(PGD_COLLECTIONS.approvals)[0]?.data.status, 'APPROVED');
  assert.equal(payload.request?.status, 'LEADERSHIP_APPROVAL');
  assert.equal(db.list(PGD_COLLECTIONS.requests)[0]?.data.status, 'LEADERSHIP_APPROVAL');
});

test('v2 generic transition endpoint rejects TECHNICAL_REVIEW -> LEADERSHIP_APPROVAL without mutating request or audit', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const actor of [technicalReviewerActor, pgdManagerActor]) {
    const db = installDocumentDatabase(t);
    db.seed(PGD_COLLECTIONS.requests, 'req-v2-b5-generic', {
      id: 'req-v2-b5-generic',
      domain: 'pgd',
      requestCode: 'PGD-261106-06',
      status: 'TECHNICAL_REVIEW',
      productGroup: 'OTHER',
      workflowSchemaVersion: 2,
    });
    db.seed(PGD_COLLECTIONS.assignments, 'assign-v2-b5-generic', {
      id: 'assign-v2-b5-generic',
      domain: 'pgd',
      requestId: 'req-v2-b5-generic',
      status: 'APPROVED',
      leadInspectorUsername: 'team-lead',
      inspectorUsernames: ['team-lead'],
      technicalReviewerUsername: 'tech-reviewer',
      roleAssignments: [
        { username: 'team-lead', capability: 'TEAM_LEAD' },
        { username: 'tech-reviewer', capability: 'TECHNICAL_REVIEW' },
      ],
    });
    db.seed(PGD_COLLECTIONS.reports, 'report-v2-b5-generic', {
      id: 'report-v2-b5-generic',
      domain: 'pgd',
      requestId: 'req-v2-b5-generic',
      status: 'APPROVED',
      conclusion: 'Đạt yêu cầu kỹ thuật theo tiêu chuẩn áp dụng',
    });

    const res = await postTransition('req-v2-b5-generic', { status: 'LEADERSHIP_APPROVAL' }, actor);
    assert.equal(res.status, 409);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0]?.data.status, 'TECHNICAL_REVIEW');
    assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  }
});

test('v2 generic transition endpoint rejects REJECTED and ON_HOLD from TECHNICAL_REVIEW and LEADERSHIP_APPROVAL with 409 without mutating request or audit while allowing B2 CAPABILITY_REVIEW exception decisions', async (t) => {
  t.mock.method(console, 'error', () => {});

  for (const b2Status of ['REJECTED', 'ON_HOLD'] as const) {
    const db = installDocumentDatabase(t);
    const reqId = `req-v2-b2-exception-${b2Status}`;
    db.seed(PGD_COLLECTIONS.requests, reqId, {
      id: reqId,
      domain: 'pgd',
      requestCode: 'PGD-261106-07',
      status: 'CAPABILITY_REVIEW',
      productGroup: 'OTHER',
      workflowSchemaVersion: 2,
    });
    db.seed(PGD_COLLECTIONS.assignments, `assign-${reqId}`, {
      id: `assign-${reqId}`,
      domain: 'pgd',
      requestId: reqId,
      status: 'APPROVED',
      leadInspectorUsername: 'team-lead',
      inspectorUsernames: ['team-lead'],
    });

    const b2Res = await postTransition(
      reqId,
      { status: b2Status, reason: `Quyết định ngoại lệ B2 (${b2Status})` },
      pgdManagerActor,
    );
    assert.equal(b2Res.status, 200);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0]?.data.status, b2Status);
    assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
  }

  const blockedCases = [
    { currentStatus: 'TECHNICAL_REVIEW' as const, nextStatus: 'REJECTED' as const, actor: technicalReviewerActor },
    { currentStatus: 'TECHNICAL_REVIEW' as const, nextStatus: 'ON_HOLD' as const, actor: technicalReviewerActor },
    { currentStatus: 'TECHNICAL_REVIEW' as const, nextStatus: 'REJECTED' as const, actor: pgdManagerActor },
    { currentStatus: 'TECHNICAL_REVIEW' as const, nextStatus: 'ON_HOLD' as const, actor: pgdManagerActor },
    { currentStatus: 'LEADERSHIP_APPROVAL' as const, nextStatus: 'REJECTED' as const, actor: pgdManagerActor },
    { currentStatus: 'LEADERSHIP_APPROVAL' as const, nextStatus: 'ON_HOLD' as const, actor: pgdManagerActor },
  ];

  for (const { currentStatus, nextStatus, actor } of blockedCases) {
    const db = installDocumentDatabase(t);
    const reqId = `req-v2-${currentStatus}-${nextStatus}-${actor.username}`;
    db.seed(PGD_COLLECTIONS.requests, reqId, {
      id: reqId,
      domain: 'pgd',
      requestCode: 'PGD-261106-08',
      status: currentStatus,
      productGroup: 'OTHER',
      workflowSchemaVersion: 2,
    });
    db.seed(PGD_COLLECTIONS.assignments, `assign-${reqId}`, {
      id: `assign-${reqId}`,
      domain: 'pgd',
      requestId: reqId,
      status: 'APPROVED',
      leadInspectorUsername: 'team-lead',
      inspectorUsernames: ['team-lead'],
      technicalReviewerUsername: 'tech-reviewer',
      roleAssignments: [
        { username: 'team-lead', capability: 'TEAM_LEAD' },
        { username: 'tech-reviewer', capability: 'TECHNICAL_REVIEW' },
      ],
    });
    db.seed(PGD_COLLECTIONS.reports, `report-${reqId}`, {
      id: `report-${reqId}`,
      domain: 'pgd',
      requestId: reqId,
      status: 'APPROVED',
      conclusion: 'Đạt yêu cầu kỹ thuật theo tiêu chuẩn áp dụng',
    });
    db.seed(PGD_COLLECTIONS.certificates, `cert-${reqId}`, {
      id: `cert-${reqId}`,
      domain: 'pgd',
      requestId: reqId,
      status: 'DRAFT',
    });

    const res = await postTransition(
      reqId,
      { status: nextStatus, reason: 'Không được phép đặt REJECTED/ON_HOLD ở B5/B6' },
      actor,
    );
    assert.equal(res.status, 409);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0]?.data.status, currentStatus);
    assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  }
});

test('newly created PGD PYC with zero attachments creates successfully with workflowSchemaVersion 2 without blocking create/save', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const input = {
    id: 'req-zero-attach',
    intakeChannel: 'DIRECT',
    requester: { name: 'Công ty Cổ phần Đầu tư ABC', address: 'Hà Nội', contactPerson: 'Nguyễn Văn B', phone: '0901234567' },
    customerSnapshot: { name: 'Công ty Cổ phần Đầu tư ABC', address: 'Hà Nội', contactPerson: 'Nguyễn Văn B', phone: '0901234567' },
    productGroup: 'OTHER',
    catalogItemId: 'GENERAL_GOODS_INSPECTION',
    method: 'QT-GĐ-02',
    productName: 'Hàng tiêu dùng tổng hợp',
    quantity: 100,
    unit: 'kiện',
    standards: ['TCVN ISO 9001'],
    inspectionScope: 'Giám định số lượng hàng hóa',
    inspectionLocation: 'Kho cảng Hải Phòng',
    sampleDrafts: [
      {
        sampleCode: 'M-01',
        sampleTypeLabel: 'Mẫu hàng hóa',
        quantity: 1,
        unit: 'mẫu',
        disposition: 'LAB',
        laboratoryName: 'PTN VILAS 001',
      },
    ],
  };
  const res = await requestsRoute.POST(routeRequest('/api/pgd/requests', 'POST', input, pgdManagerActor));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.request.workflowSchemaVersion, 2);
  assert.equal(body.request.status, 'DRAFT');
  assert.ok(Array.isArray(body.request.dossierChecklist));
  assert.ok(body.request.dossierChecklist.some((item) => item.required));
  for (const item of body.request.dossierChecklist) {
    assert.equal(item.status, 'MISSING');
  }
  assert.equal(body.request.documentPointers.length, 0);
  assert.equal(db.list(PGD_COLLECTIONS.dossierDocuments).length, 0);
  assert.equal(db.list(PGD_COLLECTIONS.requests).length, 1);
});

test('v2 B5 technical review can return to B4 FIELD_INSPECTION with reason and creates a new assessment round', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const reqId = 'req-v2-b5-return';
  db.seed(PGD_COLLECTIONS.requests, reqId, {
    id: reqId,
    domain: 'pgd',
    requestCode: 'PGD-261106-10',
    status: 'TECHNICAL_REVIEW',
    productGroup: 'OTHER',
    workflowSchemaVersion: 2,
  });
  db.seed(PGD_COLLECTIONS.assignments, `assign-${reqId}`, {
    id: `assign-${reqId}`,
    domain: 'pgd',
    requestId: reqId,
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
    technicalReviewerUsername: 'tech-reviewer',
    roleAssignments: [
      { username: 'team-lead', capability: 'TEAM_LEAD' },
      { username: 'tech-reviewer', capability: 'TECHNICAL_REVIEW' },
    ],
  });
  db.seed(PGD_COLLECTIONS.assessmentRounds, 'round-1', {
    id: 'round-1',
    domain: 'pgd',
    requestId: reqId,
    sequence: 1,
    label: 'Đợt 1',
    status: 'CLOSED',
    openedAt: '2026-11-06T00:00:00.000Z',
    openedByUsername: 'team-lead',
    closedAt: '2026-11-06T01:00:00.000Z',
    closedByUsername: 'team-lead',
    outcome: 'CONFORMING',
  });

  const res = await postApproval(
    {
      id: 'approval-return-b5',
      domain: 'pgd',
      requestId: reqId,
      sequence: 1,
      role: 'TECHNICAL_REVIEW',
      status: 'RETURNED',
      returnReason: 'Số liệu đo kiểm hiện trường cần lấy mẫu đối chứng lại',
    },
    technicalReviewerActor,
  );
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.request.status, 'FIELD_INSPECTION');
  assert.equal(payload.approval.status, 'RETURNED');
  assert.equal(payload.approval.returnReason, 'Số liệu đo kiểm hiện trường cần lấy mẫu đối chứng lại');
  assert.equal(payload.approval.returnToStageId, 'assessment-testing');

  const rounds = db.list(PGD_COLLECTIONS.assessmentRounds);
  assert.equal(rounds.length, 2);
  const round2 = rounds.find((r) => r.data.id !== 'round-1')?.data;
  assert.equal(round2.sequence, 2);
  assert.equal(round2.status, 'OPEN');
  assert.match(round2.reason, /Số liệu đo kiểm/);
});

test('v2 B6 leadership review can return to B4 FIELD_INSPECTION with reason, marks prior technical review as RETURNED, and opens a new assessment round', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const reqId = 'req-v2-b6-return';
  const leadershipActor = {
    username: 'pgd-leader',
    name: 'PGD Leader',
    systemRole: 'admin',
    role: 'admin',
    active: true,
    departmentScopes: ['PGD'],
    pgdRole: 'PGD_LEADERSHIP',
    managementRoleCode: 'VICE_HEAD',
  };
  db.seed(PGD_COLLECTIONS.requests, reqId, {
    id: reqId,
    domain: 'pgd',
    requestCode: 'PGD-261106-11',
    status: 'LEADERSHIP_APPROVAL',
    productGroup: 'OTHER',
    workflowSchemaVersion: 2,
  });
  db.seed(PGD_COLLECTIONS.assignments, `assign-${reqId}`, {
    id: `assign-${reqId}`,
    domain: 'pgd',
    requestId: reqId,
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
    technicalReviewerUsername: 'tech-reviewer',
    leadershipUsername: 'pgd-leader',
    roleAssignments: [
      { username: 'team-lead', capability: 'TEAM_LEAD' },
      { username: 'tech-reviewer', capability: 'TECHNICAL_REVIEW' },
      { username: 'pgd-leader', capability: 'LEADERSHIP_APPROVAL' },
    ],
  });
  db.seed(PGD_COLLECTIONS.approvals, 'prior-tech-approval', {
    id: 'prior-tech-approval',
    domain: 'pgd',
    requestId: reqId,
    role: 'TECHNICAL_REVIEW',
    status: 'APPROVED',
    sequence: 1,
    actedByUsername: 'tech-reviewer',
  });
  db.seed(PGD_COLLECTIONS.assessmentRounds, 'round-b6-1', {
    id: 'round-b6-1',
    domain: 'pgd',
    requestId: reqId,
    sequence: 1,
    label: 'Đợt 1',
    status: 'CLOSED',
    openedAt: '2026-11-06T00:00:00.000Z',
    openedByUsername: 'team-lead',
    closedAt: '2026-11-06T01:00:00.000Z',
    closedByUsername: 'team-lead',
    outcome: 'CONFORMING',
  });

  const res = await postApproval(
    {
      id: 'approval-return-b6',
      domain: 'pgd',
      requestId: reqId,
      sequence: 2,
      role: 'LEADERSHIP_APPROVAL',
      status: 'RETURNED',
      returnReason: 'Lãnh đạo yêu cầu bổ sung bằng chứng hiện trường',
    },
    leadershipActor,
  );
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.request.status, 'FIELD_INSPECTION');
  assert.equal(payload.approval.status, 'RETURNED');
  assert.equal(payload.approval.returnToStageId, 'assessment-testing');

  const prior = db.list(PGD_COLLECTIONS.approvals).find((a) => a.document_id === 'prior-tech-approval')?.data;
  assert.equal(prior.status, 'RETURNED');
  assert.equal(prior.returnToStageId, 'assessment-testing');

  const rounds = db.list(PGD_COLLECTIONS.assessmentRounds);
  assert.equal(rounds.length, 2);
  const round2 = rounds.find((r) => r.data.id !== 'round-b6-1')?.data;
  assert.equal(round2.sequence, 2);
  assert.equal(round2.status, 'OPEN');
});

test('v2 B6 leadership approval transitions to APPROVED_FOR_ISSUANCE and certificate APPROVED without signing, while legacy request sets SIGNED', async (t) => {
  t.mock.method(console, 'error', () => {});
  const leadershipActor = {
    username: 'pgd-leader',
    name: 'PGD Leader',
    systemRole: 'admin',
    role: 'admin',
    active: true,
    departmentScopes: ['PGD'],
    pgdRole: 'PGD_LEADERSHIP',
    managementRoleCode: 'VICE_HEAD',
  };

  const dbV2 = installDocumentDatabase(t);
  const waivedChecklist = buildPgdDossierChecklist('OTHER').map((item) =>
    item.required
      ? { ...item, status: 'WAIVED' as const, waiverReason: 'Miễn chứng từ' }
      : item,
  );
  const reqIdV2 = 'req-v2-b6-approve';
  dbV2.seed(PGD_COLLECTIONS.requests, reqIdV2, {
    id: reqIdV2,
    domain: 'pgd',
    requestCode: 'PGD-261106-12',
    status: 'LEADERSHIP_APPROVAL',
    productGroup: 'OTHER',
    workflowSchemaVersion: 2,
    dossierChecklist: waivedChecklist,
  });
  dbV2.seed(PGD_COLLECTIONS.assignments, `assign-${reqIdV2}`, {
    id: `assign-${reqIdV2}`,
    domain: 'pgd',
    requestId: reqIdV2,
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
    technicalReviewerUsername: 'tech-reviewer',
    leadershipUsername: 'pgd-leader',
    roleAssignments: [
      { username: 'team-lead', capability: 'TEAM_LEAD' },
      { username: 'tech-reviewer', capability: 'TECHNICAL_REVIEW' },
      { username: 'pgd-leader', capability: 'LEADERSHIP_APPROVAL' },
    ],
  });
  dbV2.seed(PGD_COLLECTIONS.approvals, `tech-app-${reqIdV2}`, {
    id: `tech-app-${reqIdV2}`,
    domain: 'pgd',
    requestId: reqIdV2,
    role: 'TECHNICAL_REVIEW',
    status: 'APPROVED',
    sequence: 1,
    actedByUsername: 'tech-reviewer',
  });
  dbV2.seed(PGD_COLLECTIONS.reports, `report-${reqIdV2}`, {
    id: `report-${reqIdV2}`,
    domain: 'pgd',
    requestId: reqIdV2,
    status: 'APPROVED',
    conclusion: 'Đạt yêu cầu',
    templateSnapshot: { templateId: 'tpl-1', code: 'BM-BC-01', name: 'Báo cáo', version: 1 },
  });
  dbV2.seed(PGD_COLLECTIONS.certificates, reqIdV2, {
    id: `cert-${reqIdV2}`,
    domain: 'pgd',
    requestId: reqIdV2,
    status: 'DRAFT',
    templateSnapshot: { templateId: 'tpl-2', code: 'BM-CT-01', name: 'Chứng thư', version: 1 },
  });

  const resV2 = await postApproval(
    {
      id: 'approval-lead-v2',
      domain: 'pgd',
      requestId: reqIdV2,
      sequence: 2,
      role: 'LEADERSHIP_APPROVAL',
      status: 'APPROVED',
      comment: 'Đồng ý phê duyệt phát hành',
    },
    leadershipActor,
  );
  assert.equal(resV2.status, 200);
  const dataV2 = await resV2.json();
  assert.equal(dataV2.request.status, 'APPROVED_FOR_ISSUANCE');
  assert.equal(dataV2.certificate.status, 'APPROVED');
  assert.equal(dataV2.certificate.approvedByUsername, 'pgd-leader');
  assert.equal(dataV2.certificate.signedByUsername, undefined);

  const dbLegacy = installDocumentDatabase(t);
  const reqIdLegacy = 'req-legacy-b6-approve';
  dbLegacy.seed(PGD_COLLECTIONS.requests, reqIdLegacy, {
    id: reqIdLegacy,
    domain: 'pgd',
    requestCode: 'PGD-261106-13',
    status: 'LEADERSHIP_APPROVAL',
    productGroup: 'OTHER',
    dossierChecklist: waivedChecklist,
  });
  dbLegacy.seed(PGD_COLLECTIONS.assignments, `assign-${reqIdLegacy}`, {
    id: `assign-${reqIdLegacy}`,
    domain: 'pgd',
    requestId: reqIdLegacy,
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
    technicalReviewerUsername: 'tech-reviewer',
    leadershipUsername: 'pgd-leader',
  });
  dbLegacy.seed(PGD_COLLECTIONS.approvals, `tech-app-${reqIdLegacy}`, {
    id: `tech-app-${reqIdLegacy}`,
    domain: 'pgd',
    requestId: reqIdLegacy,
    role: 'TECHNICAL_REVIEW',
    status: 'APPROVED',
    sequence: 1,
    actedByUsername: 'tech-reviewer',
  });
  dbLegacy.seed(PGD_COLLECTIONS.reports, `report-${reqIdLegacy}`, {
    id: `report-${reqIdLegacy}`,
    domain: 'pgd',
    requestId: reqIdLegacy,
    status: 'APPROVED',
    conclusion: 'Đạt yêu cầu',
    templateSnapshot: { templateId: 'tpl-1', code: 'BM-BC-01', name: 'Báo cáo', version: 1 },
  });
  dbLegacy.seed(PGD_COLLECTIONS.certificates, reqIdLegacy, {
    id: `cert-${reqIdLegacy}`,
    domain: 'pgd',
    requestId: reqIdLegacy,
    status: 'DRAFT',
    templateSnapshot: { templateId: 'tpl-2', code: 'BM-CT-01', name: 'Chứng thư', version: 1 },
  });

  const resLegacy = await postApproval(
    {
      id: 'approval-lead-legacy',
      domain: 'pgd',
      requestId: reqIdLegacy,
      sequence: 2,
      role: 'LEADERSHIP_APPROVAL',
      status: 'APPROVED',
      comment: 'Lãnh đạo ký duyệt',
    },
    leadershipActor,
  );
  assert.equal(resLegacy.status, 200);
  const dataLegacy = await resLegacy.json();
  assert.equal(dataLegacy.request.status, 'SIGNED');
  assert.equal(dataLegacy.certificate.status, 'SIGNED');
  assert.equal(dataLegacy.certificate.signedByUsername, 'pgd-leader');
});

test('v2 B7 issuance route handles DELIVER and ARCHIVE with RBAC checks and safe updates', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const reqId = 'req-v2-b7-flow';
  db.seed(PGD_COLLECTIONS.requests, reqId, {
    id: reqId,
    domain: 'pgd',
    requestCode: 'PGD-261106-14',
    status: 'SIGNED',
    productGroup: 'OTHER',
    workflowSchemaVersion: 2,
  });
  db.seed(PGD_COLLECTIONS.assignments, `assign-${reqId}`, {
    id: `assign-${reqId}`,
    domain: 'pgd',
    requestId: reqId,
    status: 'APPROVED',
    leadInspectorUsername: 'team-lead',
    inspectorUsernames: ['team-lead'],
    officeIssuanceUsername: 'clerk-user',
    archivistUsername: 'archivist-user',
    roleAssignments: [
      { username: 'team-lead', capability: 'TEAM_LEAD' },
      { username: 'clerk-user', capability: 'OFFICE_ISSUANCE' },
      { username: 'archivist-user', capability: 'ARCHIVE' },
    ],
  });
  db.seed(PGD_COLLECTIONS.certificates, reqId, {
    id: `cert-${reqId}`,
    domain: 'pgd',
    requestId: reqId,
    status: 'SIGNED',
    issuanceFileAssetId: 'asset-signed-pdf-1',
    issueDate: '2026-11-06',
    expiryDate: '2027-11-06',
  });

  const clerkActor = {
    username: 'clerk-user',
    name: 'Office Clerk',
    systemRole: 'staff',
    role: 'staff',
    active: true,
    departmentScopes: ['PGD'],
    professionalRoleCodes: ['DOCUMENT_CLERK'],
  };
  const archivistActor = {
    username: 'archivist-user',
    name: 'Archivist',
    systemRole: 'staff',
    role: 'staff',
    active: true,
    departmentScopes: ['PGD'],
    professionalRoleCodes: ['DOCUMENT_CLERK'],
  };
  const unassignedStaff = {
    username: 'other-staff',
    name: 'Other Staff',
    systemRole: 'staff',
    role: 'staff',
    active: true,
    departmentScopes: ['PGD'],
  };

  const unauthRes = await issuanceRoute.POST(
    routeRequest('/api/pgd/issuance', 'POST', { requestId: reqId, operationId: 'op-deliver-unauth', action: 'DELIVER', deliveredTo: 'Khách hàng A' }, unassignedStaff),
  );
  assert.equal(unauthRes.status, 403);

  const deliverRes = await issuanceRoute.POST(
    routeRequest('/api/pgd/issuance', 'POST', { requestId: reqId, operationId: 'op-deliver-1', action: 'DELIVER', deliveredTo: 'Khách hàng A' }, clerkActor),
  );
  assert.equal(deliverRes.status, 200);
  const deliverBody = await deliverRes.json();
  assert.equal(deliverBody.request.status, 'RESULT_RETURNED');
  assert.equal(deliverBody.certificate.deliveredTo, 'Khách hàng A');

  const unauthArchiveRes = await issuanceRoute.POST(
    routeRequest('/api/pgd/issuance', 'POST', { requestId: reqId, operationId: 'op-archive-unauth', action: 'ARCHIVE' }, unassignedStaff),
  );
  assert.equal(unauthArchiveRes.status, 403);

  const archiveRes = await issuanceRoute.POST(
    routeRequest('/api/pgd/issuance', 'POST', { requestId: reqId, operationId: 'op-archive-1', action: 'ARCHIVE' }, archivistActor),
  );
  assert.equal(archiveRes.status, 200);
  const archiveBody = await archiveRes.json();
  assert.equal(archiveBody.request.status, 'ARCHIVED');
  assert.equal(archiveBody.certificate.archivistUsername, 'archivist-user');
});
