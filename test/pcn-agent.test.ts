import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, PcnDocumentRequirement, PcnDossierDocument, PcnUserAccount } from '../types.ts';
import { getPcnAgentCapabilities } from '../utils/pcnAgentCapabilities.ts';
import { buildPcnAgentWorkspace } from '../utils/pcnAgentWorkspace.ts';
import { createPcnAgentToolRegistry } from '../utils/pcnAgentTools.ts';
import { confirmPcnAgentTask, getPcnAgentActionDenial, proposePcnAgentAssignment, proposePcnAgentTask } from '../utils/pcnAgentActions.ts';
import { runPcnAgentChat } from '../utils/pcnAgentOrchestrator.ts';
import type { PcnAgentTask } from '../utils/pcnAgentTypes.ts';

const specialist: PcnUserAccount = {
  username: 'specialist-a',
  name: 'Chuyên viên A',
  role: 'staff',
  systemRole: 'staff',
  departmentRoleCode: 'CERTIFICATION_EXPERT',
  fieldCodes: ['QC4'],
  active: true,
  position: 'Chuyên viên chứng nhận',
};

const otherSpecialist: PcnUserAccount = {
  ...specialist,
  username: 'specialist-b',
  name: 'Chuyên viên B',
};

const leadership: PcnUserAccount = {
  username: 'leader',
  name: 'Lãnh đạo',
  role: 'admin',
  systemRole: 'admin',
  departmentRoleCode: 'LEADERSHIP',
  fieldCodes: [],
  active: true,
  position: 'Phó trưởng phòng',
};

const viewer: PcnUserAccount = {
  ...specialist,
  username: 'viewer',
  name: 'Người xem',
  role: 'viewer',
  systemRole: 'viewer',
};

const sampleCoordinator: PcnUserAccount = {
  ...specialist,
  username: 'sample-coordinator',
  name: 'Điều phối mẫu',
  departmentRoleCode: 'SAMPLE_COORDINATOR',
  position: 'Điều phối mẫu',
};

function dossier(input: Partial<CertificationDossier> & Pick<CertificationDossier, 'id' | 'dossierCode' | 'status' | 'ownerUsername'>): CertificationDossier {
  return {
    id: input.id,
    dossierCode: input.dossierCode,
    proposalId: input.proposalId || `proposal-${input.id}`,
    fieldCodes: input.fieldCodes || ['QC4'],
    method: input.method || 'METHOD_1',
    status: input.status,
    ownerUsername: input.ownerUsername,
    labRequestIds: [],
    returnedResultIds: [],
    ...(input.evaluatorUsername ? { evaluatorUsername: input.evaluatorUsername } : {}),
    ...(input.reviewerUsername ? { reviewerUsername: input.reviewerUsername } : {}),
    ...(input.targetDate ? { targetDate: input.targetDate } : {}),
    createdAt: input.createdAt || '2026-08-01T00:00:00.000Z',
    updatedAt: input.updatedAt || '2026-08-29T00:00:00.000Z',
  };
}

function proposal(id: string, code: string): CertificationProposal {
  return {
    id,
    proposalCode: code,
    channel: 'DIRECT',
    status: 'RECEIVED',
    dossierId: `dossier-${id}`,
    customerId: `customer-${id}`,
    customerSnapshot: { name: `Khách hàng ${id}`, address: 'Địa chỉ' },
    warehouseAddress: 'Kho',
    productName: `Sản phẩm ${id}`,
    productType: 'Thiết bị',
    model: 'M-1',
    brand: 'IEMM',
    specifications: 'Thông số',
    manufacturer: 'Nhà sản xuất',
    quantity: 1,
    fieldCodes: ['QC4'],
    receivedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

const emptyRequirements: PcnDocumentRequirement[] = [];
const emptyDocuments: PcnDossierDocument[] = [];

test('capability separates department responsibility from system access', () => {
  const specialistCapabilities = getPcnAgentCapabilities(specialist);
  assert.ok(specialistCapabilities.includes('VIEW_MY_WORK'));
  assert.ok(specialistCapabilities.includes('ANALYZE_RECORD'));
  assert.ok(specialistCapabilities.includes('CHECK_MISSING_DOCUMENTS'));
  assert.ok(specialistCapabilities.includes('PREPARE_ASSESSMENT_DRAFT'));
  assert.ok(!specialistCapabilities.includes('VIEW_DEPARTMENT_WORK'));
  assert.ok(!(specialistCapabilities as readonly string[]).includes('APPROVE_CERTIFICATE'));

  const leaderCapabilities = getPcnAgentCapabilities(leadership);
  assert.ok(leaderCapabilities.includes('VIEW_DEPARTMENT_WORK'));
  assert.ok(leaderCapabilities.includes('VIEW_STAFF_WORKLOAD'));
  assert.ok(leaderCapabilities.includes('PROPOSE_ASSIGNMENT'));
  assert.ok(!(leaderCapabilities as readonly string[]).includes('APPROVE_CERTIFICATE'));

  const viewerCapabilities = getPcnAgentCapabilities(viewer);
  assert.ok(viewerCapabilities.includes('VIEW_MY_WORK'));
  assert.ok(!viewerCapabilities.includes('PROPOSE_TASK'));
});

test('workspace isolates specialist work while leadership receives department projection', () => {
  const dossiers = [
    dossier({ id: 'dossier-a', dossierCode: 'PCN-2026-001', status: 'FIELD_EVALUATION', ownerUsername: 'specialist-a', evaluatorUsername: 'specialist-a', targetDate: '2026-08-29' }),
    dossier({ id: 'dossier-b', dossierCode: 'PCN-2026-002', status: 'WAITING_APPROVAL', ownerUsername: 'specialist-b', targetDate: '2026-09-04' }),
  ];
  const proposals = [proposal('a', 'DN-001'), proposal('b', 'DN-002')];
  proposals[0].id = 'proposal-dossier-a';
  proposals[1].id = 'proposal-dossier-b';

  const own = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist, otherSpecialist, leadership],
    dossiers,
    proposals,
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.deepEqual(own.myWork.map((item) => item.dossierCode), ['PCN-2026-001']);
  assert.equal(own.departmentWorkload, undefined);
  assert.equal(own.metrics.overdue, 1);
  assert.ok(own.recommendations.some((item) => item.dossierCode === 'PCN-2026-001' && item.kind === 'OVERDUE'));

  const manager = buildPcnAgentWorkspace({
    user: leadership,
    users: [specialist, otherSpecialist, leadership],
    dossiers,
    proposals,
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.deepEqual(manager.myWork.map((item) => item.dossierCode), []);
  assert.equal(manager.departmentWorkload?.length, 3);
  assert.equal(manager.allWork?.length, 2);
  assert.match(manager.briefing, /toàn phòng/i);
  assert.match(manager.briefing, /PCN-2026-00[12]/);
  assert.ok(manager.quickActions.some((action) => action.id === 'assignment-proposal' && action.query === 'Hồ sơ mới nên giao cho ai?'));
});

test('manager recommendations expose high workload and unassigned dossier risks', () => {
  const dossiers = Array.from({ length: 8 }, (_, index) => dossier({
    id: `dossier-busy-${index}`,
    dossierCode: `PCN-2026-BUSY-${String(index + 1).padStart(2, '0')}`,
    status: 'FIELD_EVALUATION',
    ownerUsername: 'specialist-a',
  }));
  dossiers.push(dossier({
    id: 'dossier-unassigned-risk',
    dossierCode: 'PCN-2026-UNASSIGNED',
    status: 'ASSIGNED',
    ownerUsername: '',
  }));
  const proposals = dossiers.map((item) => ({
    ...proposal(item.id, `DN-${item.dossierCode}`),
    dossierId: item.id,
  }));
  const workspace = buildPcnAgentWorkspace({
    user: leadership,
    users: [leadership, specialist],
    dossiers,
    proposals,
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.ok(workspace.recommendations.some((item) => item.kind === 'WORKLOAD_RISK' && item.title.includes('Chuyên viên A')));
  assert.ok(workspace.recommendations.some((item) => item.kind === 'UNASSIGNED' && item.dossierCode === 'PCN-2026-UNASSIGNED'));
});

test('workspace enforces QC4/QC9 field scope before exposing assigned work', () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [
      dossier({ id: 'dossier-qc4', dossierCode: 'QC4-2026-001', status: 'FIELD_EVALUATION', ownerUsername: 'specialist-a', fieldCodes: ['QC4'] }),
      dossier({ id: 'dossier-qc9', dossierCode: 'QC9-2026-001', status: 'FIELD_EVALUATION', ownerUsername: 'specialist-a', fieldCodes: ['QC9'] }),
    ],
    proposals: [proposal('qc4', 'DN-QC4-001'), proposal('qc9', 'DN-QC9-001')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.deepEqual(workspace.myWork.map((item) => item.dossierCode), ['QC4-2026-001']);
  assert.ok(!workspace.myWork.some((item) => item.dossierCode.startsWith('QC9-')));
});

test('priority and briefing are deterministic and grounded in workflow data', () => {
  const result = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-a', dossierCode: 'PCN-2026-003', status: 'AWAITING_DOCUMENTS', ownerUsername: 'specialist-a', targetDate: '2026-08-30' })],
    proposals: [proposal('a', 'DN-003')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  const item = result.myWork[0];
  assert.equal(item.priority, 'DUE_SOON');
  assert.ok(item.priorityScore > 0);
  assert.ok(item.priorityReasons.length > 0);
  assert.match(result.briefing, /Chuyên viên A/);
  assert.match(result.briefing, /PCN-2026-003/);
});

test('workspace recommends newly returned test results within the Vietnam calendar window', () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-new-result', dossierCode: 'PCN-2026-RESULT', status: 'TECHNICAL_REVIEW', ownerUsername: 'specialist-a' })],
    proposals: [{ ...proposal('new-result', 'DN-RESULT'), dossierId: 'dossier-new-result' }],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    returnedResults: [
      { id: 'result-new', dossierId: 'dossier-new-result', labRequestId: 'lab-new', round: 2, outcome: 'PASS', receivedAt: '2026-08-29T18:00:00.000Z', reportNumber: 'KQ-002' },
      { id: 'result-old', dossierId: 'dossier-new-result', labRequestId: 'lab-old', round: 1, outcome: 'PASS', receivedAt: '2026-08-25T18:00:00.000Z', reportNumber: 'KQ-001' },
    ],
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.ok(workspace.recommendations.some((item) => item.kind === 'NEW_RESULT' && item.title.includes('PCN-2026-RESULT')));
  assert.equal(workspace.recommendations.filter((item) => item.kind === 'NEW_RESULT').length, 1);
});

test('workspace recommends newly updated checklist documents without guessing the uploader', () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-new-document', dossierCode: 'PCN-2026-DOCUMENT', status: 'AWAITING_DOCUMENTS', ownerUsername: 'specialist-a' })],
    proposals: [{ ...proposal('new-document', 'DN-DOCUMENT'), dossierId: 'dossier-new-document' }],
    documentRequirements: [{ id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị / đơn đăng ký', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 }],
    dossierDocuments: [
      { id: 'document-new', dossierId: 'dossier-new-document', requirementId: 'QC4-PROPOSAL', fieldCode: 'QC4', currentVersionId: 'asset-new', status: 'PRESENT', versions: [{ assetId: 'asset-new', fileName: 'de-nghi-moi.pdf', uploadedAt: '2026-08-29T18:00:00.000Z' }] },
      { id: 'document-old', dossierId: 'dossier-new-document', requirementId: 'QC4-PROPOSAL', fieldCode: 'QC4', currentVersionId: 'asset-old', status: 'PRESENT', versions: [{ assetId: 'asset-old', fileName: 'de-nghi-cu.pdf', uploadedAt: '2026-08-25T18:00:00.000Z' }] },
    ],
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.ok(workspace.recommendations.some((item) => item.kind === 'NEW_DOCUMENT' && item.title.includes('PCN-2026-DOCUMENT')));
  assert.equal(workspace.recommendations.filter((item) => item.kind === 'NEW_DOCUMENT').length, 1);
  assert.ok(!workspace.recommendations.some((item) => item.description.includes('khách hàng')));
});

test('agent tool registry is allowlisted and enforces capability isolation', () => {
  const registry = createPcnAgentToolRegistry();
  assert.ok(registry.list().includes('get_my_work'));
  assert.ok(registry.list().includes('search_certification_records'));
  assert.ok(!(registry.list() as readonly string[]).includes('execute_sql'));
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
  });
  assert.deepEqual(registry.execute('get_my_work', workspace, {}), []);
  assert.throws(() => registry.execute('get_department_workload', workspace, {}), /không có capability/i);
  assert.throws(() => registry.execute('execute_sql' as never, workspace, {}), /không được whitelist/i);
});

test('agent tools require the matching permission in addition to capability', () => {
  const registry = createPcnAgentToolRegistry();
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
  });
  const permissionStrippedWorkspace = {
    ...workspace,
    user: { ...workspace.user, permissions: [] },
  };
  assert.throws(
    () => registry.execute('get_my_work', permissionStrippedWorkspace, {}),
    /permission/i,
  );
});

test('workspace exposes business activity without model reasoning', () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-a', dossierCode: 'PCN-2026-005', status: 'FIELD_EVALUATION', ownerUsername: 'specialist-a' })],
    proposals: [proposal('a', 'DN-005')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
  });
  const activity = (workspace as unknown as { activity?: Array<{ label?: string; detail?: string }> }).activity;
  assert.ok(activity?.some((item) => item.label?.includes('dựng context công việc')));
  assert.ok(activity?.some((item) => item.label?.includes('deadline')));
  assert.ok(!activity?.some((item) => /reasoning|chain[- ]of[- ]thought/i.test(`${item.label} ${item.detail}`)));
});

test('proposed task does not bypass permission and forbidden actions stay blocked', () => {
  const proposed = proposePcnAgentTask({
    actor: specialist,
    dossierId: 'dossier-a',
    title: 'Theo dõi bổ sung hồ sơ',
    dueAt: '2026-08-31',
  });
  assert.equal(proposed.status, 'PROPOSED');
  assert.equal(proposed.actionLevel, 'EXECUTE_WITH_CONFIRMATION');
  assert.equal(getPcnAgentActionDenial('APPROVE_CERTIFICATE', specialist), 'AI không được tự phê duyệt chứng nhận.');
  assert.equal(getPcnAgentActionDenial('CREATE_TASK', viewer), 'Tài khoản viewer không được tạo task qua AI.');
});

test('manager assignment stays a non-mutating proposal and respects dossier field scope', async () => {
  const unassignedDossier = dossier({ id: 'dossier-unassigned', dossierCode: 'PCN-2026-006', status: 'ASSIGNED', ownerUsername: '', fieldCodes: ['QC4'] });
  const workspace = buildPcnAgentWorkspace({
    user: leadership,
    users: [leadership, specialist, otherSpecialist],
    dossiers: [unassignedDossier],
    proposals: [proposal('unassigned', 'DN-006')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  const registry = createPcnAgentToolRegistry();
  const candidates = registry.execute('get_assignment_candidates', workspace, { dossierId: 'dossier-unassigned' }) as Array<{ username: string; fieldCodes: string[] }>;
  assert.equal(candidates[0]?.username, specialist.username);
  assert.ok(candidates.every((candidate) => candidate.fieldCodes.length === 0 || candidate.fieldCodes.includes('QC4')));

  const chat = await runPcnAgentChat(workspace, 'Hồ sơ mới nên giao cho ai?', registry, null);
  const actionBlock = chat.blocks.find((block) => block.type === 'proposed_action');
  assert.equal(actionBlock?.type, 'proposed_action');
  if (actionBlock?.type === 'proposed_action') {
    assert.equal(actionBlock.action.actionType, 'PROPOSE_ASSIGNMENT');
      assert.equal(actionBlock.action.actionLevel, 'DRAFT');
      assert.equal(actionBlock.action.status, 'PROPOSED');
      assert.equal(actionBlock.action.payload.assigneeUsername, specialist.username);
      assert.equal((actionBlock.action.payload.assigneeWorkload as { dossierCount: number }).dossierCount, 0);
      assert.match(actionBlock.action.description, /0 hồ sơ/);
      let persisted = false;
    assert.throws(
      () => confirmPcnAgentTask(actionBlock.action, leadership, () => { persisted = true; }),
      /chưa được hỗ trợ/i,
    );
    assert.equal(persisted, false);
  }
});

test('record analysis uses the allowlisted read tools and proposed task stays non-mutating until confirm', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-a', dossierCode: 'PCN-2026-004', status: 'FIELD_EVALUATION', ownerUsername: 'specialist-a', evaluatorUsername: 'specialist-a' })],
    proposals: [proposal('a', 'DN-004')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    labRequests: [],
    returnedResults: [],
    approvalSteps: [],
  });
  const chat = await runPcnAgentChat(workspace, 'Phân tích hồ sơ PCN-2026-004', undefined, null);
  assert.ok(chat.toolsUsed.includes('get_certification_record'));
  assert.ok(chat.recordsAccessed.includes('dossier-a'));

  let persisted = 0;
  const action = proposePcnAgentTask({ actor: specialist, dossierId: 'dossier-a', dossierCode: 'PCN-2026-004', title: 'Theo dõi hồ sơ', now: '2026-08-30T00:00:00.000Z' });
  assert.equal(persisted, 0);
  const confirmed = await confirmPcnAgentTask(action, specialist, () => { persisted += 1; }, '2026-08-30T00:01:00.000Z');
  assert.equal(persisted, 1);
  assert.equal(confirmed.action.status, 'EXECUTED');
  assert.equal(confirmed.task.dossierId, 'dossier-a');
});

test('leadership approval question routes to the approval read tool', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: leadership,
    users: [leadership],
    dossiers: [dossier({ id: 'dossier-a', dossierCode: 'PCN-2026-005', status: 'WAITING_APPROVAL', ownerUsername: 'specialist-a' })],
    proposals: [proposal('a', 'DN-005')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    labRequests: [],
    returnedResults: [],
    approvalSteps: [],
  });
  assert.ok(workspace.user.capabilities.includes('VIEW_PENDING_APPROVALS'));
  const chat = await runPcnAgentChat(workspace, 'Hồ sơ nào đang chờ phê duyệt?', undefined, null);
  assert.ok(chat.toolsUsed.includes('get_pending_approvals'));
});

test('leadership quick-action language routes to department and unassigned tools', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: leadership,
    users: [leadership],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    labRequests: [],
    returnedResults: [],
    approvalSteps: [],
  });
  const department = await runPcnAgentChat(workspace, 'Hôm nay phòng có vấn đề gì cần xử lý?', undefined, null);
  const unassigned = await runPcnAgentChat(workspace, 'Hồ sơ nào chưa được phân công?', undefined, null);
  assert.deepEqual(department.toolsUsed, ['get_department_workload']);
  assert.equal(department.blocks[0].type, 'message');
  if (department.blocks[0].type === 'message') assert.match(department.blocks[0].text, /workload/i);
  assert.deepEqual(unassigned.toolsUsed, ['get_unassigned_records']);
});

test('workspace exposes open task counters and includes task workload in briefing', () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    tasks: [
      {
        id: 'task-overdue',
        title: 'Theo dõi tài liệu bổ sung',
        assigneeUsername: 'specialist-a',
        dueAt: '2026-08-29',
        status: 'OPEN',
        source: 'MANUAL',
        createdAt: '2026-08-28T00:00:00.000Z',
        updatedAt: '2026-08-28T00:00:00.000Z',
        createdByUsername: 'specialist-a',
      },
      {
        id: 'task-open',
        title: 'Chuẩn bị nội dung đánh giá',
        assigneeUsername: 'specialist-a',
        dueAt: '2026-09-02',
        status: 'OPEN',
        source: 'AGENT',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        createdByUsername: 'specialist-a',
      },
      {
        id: 'task-done',
        title: 'Task đã hoàn tất',
        assigneeUsername: 'specialist-a',
        dueAt: '2026-08-20',
        status: 'DONE',
        source: 'MANUAL',
        createdAt: '2026-08-19T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
        createdByUsername: 'specialist-a',
      },
    ],
    now: '2026-08-30T01:00:00.000Z',
  });
  const metrics = workspace.metrics as typeof workspace.metrics & { openTasks: number; overdueTasks: number };
  assert.equal(metrics.openTasks, 2);
  assert.equal(metrics.overdueTasks, 1);
  assert.equal(metrics.overdue, 1);
  assert.match(workspace.briefing, /2 task/i);
  assert.ok(workspace.recommendations.some((item) => item.kind === 'TASK_OVERDUE' && item.title.includes('Theo dõi tài liệu bổ sung')));
});

test('overdue task tool uses the same GMT+7 calendar rule as workspace metrics', () => {
  const boundaryTask: PcnAgentTask = {
    id: 'task-boundary',
    title: 'Task sát ngày Việt Nam',
    assigneeUsername: specialist.username,
    dueAt: '2026-08-29T17:30:00.000Z',
    status: 'OPEN',
    source: 'MANUAL',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    createdByUsername: specialist.username,
  };
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    tasks: [boundaryTask],
    now: '2026-08-30T01:00:00.000Z',
  });
  const registry = createPcnAgentToolRegistry();
  assert.equal(workspace.metrics.overdueTasks, 0);
  assert.deepEqual(registry.execute('get_overdue_tasks', workspace, {}), []);
});

test('my-work chat returns personal task list and overdue-task queries use the task tool', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    tasks: [{
      id: 'task-overdue',
      title: 'Theo dõi tài liệu bổ sung',
      assigneeUsername: 'specialist-a',
      dueAt: '2026-08-29',
      status: 'OPEN',
      source: 'MANUAL',
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      createdByUsername: 'specialist-a',
    }],
    now: '2026-08-30T01:00:00.000Z',
  });
  const myWork = await runPcnAgentChat(workspace, 'Hôm nay tôi cần làm gì?', undefined, null);
  const overdue = await runPcnAgentChat(workspace, 'Việc nào của tôi đang quá hạn?', undefined, null);
  assert.ok(myWork.toolsUsed.includes('get_my_tasks' as never));
  assert.ok(myWork.blocks.some((block) => block.type === 'task_list'));
  assert.deepEqual(overdue.toolsUsed, ['get_overdue_work', 'get_overdue_tasks']);
  assert.ok(overdue.blocks.some((block) => block.type === 'task_list'));
});

test('task proposal normalizes relative deadlines using the Vietnam calendar', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-task-deadline', dossierCode: 'PCN-2026-TASK', status: 'FIELD_EVALUATION', ownerUsername: 'specialist-a' })],
    proposals: [{ ...proposal('task-deadline', 'DN-TASK'), dossierId: 'dossier-task-deadline' }],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  const chat = await runPcnAgentChat(workspace, 'Tạo task theo dõi hồ sơ PCN-2026-TASK vào ngày mai', undefined, null);
  const actionBlock = chat.blocks.find((block) => block.type === 'proposed_action');
  assert.equal(actionBlock?.type, 'proposed_action');
  if (actionBlock?.type === 'proposed_action') {
    assert.equal(actionBlock.action.actionLevel, 'EXECUTE_WITH_CONFIRMATION');
    assert.equal(actionBlock.action.payload.dueAt, '2026-08-31');
  }
});

test('record analysis exposes the actual missing document labels and next station', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-analysis', dossierCode: 'PCN-2026-006', status: 'AWAITING_DOCUMENTS', ownerUsername: 'specialist-a' })],
    proposals: [proposal('analysis', 'DN-006')],
    documentRequirements: [{ id: 'QC4-COMMERCIAL', fieldCode: 'QC4', code: 'COMMERCIAL', name: 'Báo giá / hợp đồng', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 }],
    dossierDocuments: [],
    now: '2026-08-30T01:00:00.000Z',
  });
  const chat = await runPcnAgentChat(workspace, 'Hồ sơ PCN-2026-006 còn thiếu gì và bước tiếp theo là gì?', undefined, null);
  const warning = chat.blocks.find((block) => block.type === 'warning');
  assert.ok(warning);
  if (warning?.type === 'warning') assert.match(warning.text, /Báo giá/);
  assert.ok(chat.blocks.some((block) => block.type === 'recommendation'));
});

test('record chat can draft a customer supplementation request without writing business data', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [dossier({ id: 'dossier-draft', dossierCode: 'PCN-2026-007', status: 'AWAITING_DOCUMENTS', ownerUsername: 'specialist-a' })],
    proposals: [proposal('draft', 'DN-007')],
    documentRequirements: [{ id: 'QC4-COMMERCIAL', fieldCode: 'QC4', code: 'COMMERCIAL', name: 'Báo giá / hợp đồng', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 }],
    dossierDocuments: [],
    now: '2026-08-30T01:00:00.000Z',
  });
  const chat = await runPcnAgentChat(workspace, 'Soạn nội dung yêu cầu khách hàng bổ sung tài liệu cho hồ sơ PCN-2026-007', undefined, null);
  const draft = chat.blocks.find((block) => block.type === 'draft');
  assert.ok(draft);
  if (draft?.type === 'draft') {
    assert.match(draft.text, /Báo giá/);
    assert.match(draft.text, /Khách hàng draft/);
  }
  assert.ok(!chat.blocks.some((block) => block.type === 'proposed_action'));
});

test('sample coordinator receives a KQTN shortcut and pending-result tool', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: sampleCoordinator,
    users: [sampleCoordinator],
    dossiers: [dossier({ id: 'dossier-results', dossierCode: 'PCN-2026-008', status: 'AWAITING_RESULTS', ownerUsername: 'sample-coordinator' })],
    proposals: [proposal('results', 'DN-008')],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  assert.ok(workspace.quickActions.some((action) => action.id === 'pending-results'));
  const chat = await runPcnAgentChat(workspace, 'Hồ sơ nào đang chờ kết quả thử nghiệm?', undefined, null);
  assert.deepEqual(chat.toolsUsed, ['get_pending_test_results']);
  assert.ok(chat.blocks.some((block) => block.type === 'record_list'));
});

test('new KQTN chat intent uses the recent-result tool instead of pending-result state', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: sampleCoordinator,
    users: [sampleCoordinator],
    dossiers: [dossier({ id: 'dossier-recent-chat', dossierCode: 'PCN-2026-RECENT', status: 'TECHNICAL_REVIEW', ownerUsername: 'sample-coordinator' })],
    proposals: [{ ...proposal('recent-chat', 'DN-RECENT'), dossierId: 'dossier-recent-chat' }],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    returnedResults: [{ id: 'result-recent-chat', dossierId: 'dossier-recent-chat', labRequestId: 'lab-recent-chat', round: 1, outcome: 'PASS', receivedAt: '2026-08-29T18:00:00.000Z' }],
    now: '2026-08-30T01:00:00.000Z',
  });
  const chat = await runPcnAgentChat(workspace, 'KQTN mới có gì cần kiểm tra?', undefined, null);
  assert.deepEqual(chat.toolsUsed, ['get_recent_test_results']);
  assert.ok(!chat.toolsUsed.includes('get_pending_test_results' as never));
  assert.ok(chat.blocks.some((block) => block.type === 'recommendation' && block.title.includes('KQTN mới')));
});

test('provider receives bounded identity, permission and current-work context', async () => {
  const workspace = buildPcnAgentWorkspace({
    user: specialist,
    users: [specialist],
    dossiers: [],
    proposals: [],
    documentRequirements: emptyRequirements,
    dossierDocuments: emptyDocuments,
    now: '2026-08-30T01:00:00.000Z',
  });
  let providerContext: Record<string, unknown> | undefined;
  const provider = {
    name: 'test-provider',
    async explain(input: { userContext: Record<string, unknown> }) {
      providerContext = input.userContext;
      return null;
    },
  };
  await runPcnAgentChat(workspace, 'Hôm nay tôi cần làm gì?', undefined, provider);
  assert.equal(providerContext?.username, 'specialist-a');
  assert.deepEqual(providerContext?.permissions, workspace.user.permissions);
  assert.equal(providerContext?.current_date, workspace.asOf);
  assert.ok(providerContext?.assigned_work);
  assert.equal('all_database' in (providerContext || {}), false);
});
