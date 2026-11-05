import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CertificationDossier,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  PcnUserAccount,
  PcnWorkflowSnapshot,
  DossierTemplateRequirementDefinition,
  PcnWorkflowTemplate,
  ReturnedTestResult,
} from '../types.ts';
import { executePcnWorkflowTaskMutation } from '../lib/server/workflow-tasks.ts';
import { pool } from '../utils/db.ts';
import { getPcnDossierRequirementsWithCustom } from '../utils/pcnDossierDocuments.ts';
import { snapshotPcnWorkflowTemplate } from '../utils/pcnWorkflowTemplate.ts';

const actor = { username: 'worker', role: 'staff', systemRole: 'staff' } as PcnUserAccount;

function makeWorkflow(requirementIds = ['required-a', 'optional-a']): PcnWorkflowSnapshot {
  return {
    templateCode: 'SERVER-GATE',
    templateVersion: 1,
    nodes: [
      { id: 'work', kind: 'DOCUMENT_TASK', label: 'Work', requirementIds, active: true, sortOrder: 1 },
      { id: 'next', kind: 'DOCUMENT_TASK', label: 'Next', requirementIds: [], active: true, sortOrder: 2 },
    ],
    transitions: [{ id: 'work-next', fromNodeId: 'work', toNodeId: 'next', condition: 'REQUIRED_DOCUMENTS_COMPLETE' }],
    capturedAt: '2026-10-10T00:00:00.000Z',
    capturedBy: 'admin',
  };
}

function makeTasks(workStatus: PcnDossierWorkflowTask['status'] = 'READY'): PcnDossierWorkflowTask[] {
  return [
    { id: 'task-work', dossierId: 'dossier-1', nodeId: 'work', status: workStatus, cycleNo: 1, assignedUsername: 'worker', updatedAt: '2026-10-10T00:00:00.000Z', updatedBy: 'admin' },
    { id: 'task-next', dossierId: 'dossier-1', nodeId: 'next', status: 'LOCKED', cycleNo: 1, assignedUsername: 'worker', updatedAt: '2026-10-10T00:00:00.000Z', updatedBy: 'admin' },
  ];
}

function requirement(id: string, required: boolean): PcnDocumentRequirement {
  return { id, fieldCode: 'QC4', code: id.toUpperCase(), name: id, stages: ['INTAKE'], required, active: true, sortOrder: 1 };
}

function document(requirementId: string, status: PcnDossierDocument['status']): PcnDossierDocument {
  return { id: `document-${requirementId}`, dossierId: 'dossier-1', requirementId, fieldCode: 'QC4', versions: [], status };
}

interface MutationFixture {
  workflow?: PcnWorkflowSnapshot;
  tasks?: PcnDossierWorkflowTask[];
  documents?: PcnDossierDocument[];
  requirements?: PcnDocumentRequirement[];
  results?: ReturnedTestResult[];
  documentWaivers?: CertificationDossier['documentWaivers'];
  ownerUsername?: string;
}

async function runMutation(
  fixture: MutationFixture,
  action: 'start' | 'complete',
  taskId = 'task-work',
) {
  const workflow = fixture.workflow || makeWorkflow();
  const tasks = fixture.tasks || makeTasks();
  const dossier: CertificationDossier = {
    id: 'dossier-1',
    dossierCode: 'PCN-1',
    proposalId: 'proposal-1',
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
    status: 'INTAKE_REVIEW',
    ownerUsername: fixture.ownerUsername ?? 'worker',
    workflowSnapshot: workflow,
    documentWaivers: fixture.documentWaivers,
    labRequestIds: [],
    returnedResultIds: [],
  };
  const queryLog: string[] = [];
  const rowsFor = (collection: string) => {
    if (collection === 'certificationDossiers') return [{ document_id: dossier.id, data: dossier }];
    if (collection === 'pcnDossierWorkflowTasks') return tasks.map((item) => ({ document_id: item.id, data: item }));
    if (collection === 'dossierDocuments') return (fixture.documents || []).map((item) => ({ document_id: item.id, data: item }));
    if (collection === 'pcnDocumentRequirements') return (fixture.requirements || []).map((item) => ({ document_id: item.id, data: item }));
    if (collection === 'returnedResults') return (fixture.results || []).map((item) => ({ document_id: item.id, data: item }));
    return [];
  };
  const originalDescriptor = Object.getOwnPropertyDescriptor(pool, 'connect');
  Object.defineProperty(pool, 'connect', {
    configurable: true,
    writable: true,
    value: async () => ({
      query: async (sql: string) => {
        queryLog.push(sql);
        const collection = sql.match(/collection_name = '([^']+)'/)?.[1];
        if (sql.trimStart().startsWith('SELECT') && collection) {
          const rows = rowsFor(collection);
          if (collection === 'certificationDossiers' || (collection === 'pcnDossierWorkflowTasks' && sql.includes("document_id = $1"))) {
            const id = collection === 'certificationDossiers' ? 'dossier-1' : taskId;
            return { rows: rows.filter((row) => row.document_id === id) };
          }
          return { rows };
        }
        return { rows: [], rowCount: 1 };
      },
      release() {},
    }),
  });

  try {
    const result = await executePcnWorkflowTaskMutation(actor, 'dossier-1', taskId, action, {});
    return { result, queryLog };
  } finally {
    if (originalDescriptor) Object.defineProperty(pool, 'connect', originalDescriptor);
    else delete (pool as unknown as { connect?: unknown }).connect;
  }
}

async function assertStatusCode(promise: Promise<unknown>, statusCode: number): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal((error as { statusCode?: number })?.statusCode, statusCode);
    return true;
  });
}

test('server workflow gates ignore only defined optional requirements and fail closed for other blockers', async () => {
  const requirements = [requirement('required-a', true), requirement('optional-a', false), requirement('unrelated-a', true)];
  const documents = [document('required-a', 'PRESENT'), document('optional-a', 'MISSING')];

  const completed = await runMutation({ requirements, documents }, 'complete');
  assert.equal(completed.result.task.status, 'COMPLETED');
  assert.equal(completed.result.tasks.find((item) => item.nodeId === 'next')?.status, 'READY');
  assert.ok(completed.queryLog.some((sql) => sql.includes("VALUES ('activityLogs'")));
  assert.ok(completed.queryLog.some((sql) => sql === 'COMMIT'));

  const started = await runMutation({
    requirements,
    documents,
    tasks: [
      { ...makeTasks('COMPLETED')[0], status: 'COMPLETED' },
      makeTasks()[1],
    ],
  }, 'start', 'task-next');
  assert.equal(started.result.task.status, 'IN_PROGRESS');

  await assertStatusCode(runMutation({
    requirements,
    documents: [document('required-a', 'MISSING'), document('optional-a', 'MISSING')],
  }, 'complete'), 409);

  await assertStatusCode(runMutation({
    workflow: makeWorkflow(['unknown-a']),
    documents: [document('unknown-a', 'MISSING')],
    requirements: [],
  }, 'complete'), 409);

  await assertStatusCode(runMutation({
    workflow: makeWorkflow(['required-a']),
    documents: [document('required-a', 'MISSING')],
    requirements: [{ ...requirement('required-a', false), required: undefined as unknown as boolean }],
  }, 'complete'), 409);

  const waived = await runMutation({
    workflow: makeWorkflow(['required-a']),
    requirements: [requirement('required-a', true)],
    documents: [document('required-a', 'MISSING')],
    documentWaivers: { 'required-a': { requirementId: 'required-a', reason: 'Không áp dụng', decidedAt: '2026-10-10T00:00:00.000Z' } },
  }, 'complete');
  assert.equal(waived.result.task.status, 'COMPLETED');

  await assertStatusCode(runMutation({
    workflow: makeWorkflow(['required-a']),
    requirements: [requirement('required-a', true)],
    documents: [document('required-a', 'MISSING')],
    documentWaivers: { 'required-a': { requirementId: 'required-a', reason: '  ', decidedAt: '2026-10-10T00:00:00.000Z' } },
  }, 'complete'), 409);

  await assertStatusCode(runMutation({ ownerUsername: 'other-user', requirements, documents }, 'complete'), 403);
});

test('server task completion requires custom current files to be operator-confirmed', async () => {
  const requirements = [requirement('required-a', true), requirement('optional-a', false)];
  const uploaded = { ...document('required-a', 'PRESENT'), lifecycleStatus: 'UPLOADED' as const, currentVersionId: 'asset-a', versions: [{ assetId: 'asset-a', fileName: 'evidence.pdf', byteSize: 10, sha256: 'a'.repeat(64), uploadedAt: '2026-10-10T00:00:00.000Z' }] };
  const optionalMissing = document('optional-a', 'MISSING');
  await assertStatusCode(runMutation({ requirements, documents: [uploaded, optionalMissing] }, 'complete'), 409);

  const confirmed = { ...uploaded, lifecycleStatus: 'CONFIRMED' as const };
  const completed = await runMutation({ requirements, documents: [confirmed, optionalMissing] }, 'complete');
  assert.equal(completed.result.task.status, 'COMPLETED');
});

test('server task gates honor custom snapshot levels for required and optional documents', async () => {
  const definition = {
    domain: 'PCN' as const,
    id: 'pcn-custom-proof',
    code: 'CUSTOM_PROOF',
    name: 'Bằng chứng bổ sung',
    level: 'REQUIRED' as const,
    source: 'UPLOAD_EXTERNAL' as const,
    ownerRole: 'CUSTOMER' as const,
    multiplicity: 'SINGLE' as const,
  };
  const workflow: PcnWorkflowSnapshot = {
    ...makeWorkflow([definition.id]),
    requirementDefinitions: [definition],
  };
  const uploaded = {
    ...document(definition.id, 'PRESENT'),
    lifecycleStatus: 'UPLOADED' as const,
    currentVersionId: 'custom-asset',
    versions: [{ assetId: 'custom-asset', fileName: 'proof.pdf', byteSize: 10, sha256: 'b'.repeat(64), uploadedAt: '2026-10-10T00:00:00.000Z' }],
  };
  await assertStatusCode(runMutation({ workflow, documents: [uploaded] }, 'complete'), 409);

  const confirmed = { ...uploaded, lifecycleStatus: 'CONFIRMED' as const };
  const requiredCompleted = await runMutation({ workflow, documents: [confirmed] }, 'complete');
  assert.equal(requiredCompleted.result.task.status, 'COMPLETED');

  const optionalWorkflow: PcnWorkflowSnapshot = {
    ...makeWorkflow(['pcn-custom-optional']),
    requirementDefinitions: [{ ...definition, id: 'pcn-custom-optional', level: 'OPTIONAL' }],
  };
  const optionalCompleted = await runMutation({ workflow: optionalWorkflow }, 'complete');
  assert.equal(optionalCompleted.result.task.status, 'COMPLETED');

  const conditionalWorkflow: PcnWorkflowSnapshot = {
    ...makeWorkflow(['pcn-custom-conditional']),
    requirementDefinitions: [{ ...definition, id: 'pcn-custom-conditional', level: 'CONDITIONAL', condition: 'RESULT_FAILED' }],
  };
  const inapplicableConditionalCompleted = await runMutation({ workflow: conditionalWorkflow }, 'complete');
  assert.equal(inapplicableConditionalCompleted.result.task.status, 'COMPLETED');

  const failedResult: ReturnedTestResult = {
    id: 'result-failed', dossierId: 'dossier-1', labRequestId: 'pyc-1', round: 1, outcome: 'FAIL',
    receivedAt: '2026-10-10T00:00:00.000Z',
  };
  await assertStatusCode(runMutation({ workflow: conditionalWorkflow, results: [failedResult] }, 'complete'), 409);
});

test('stage-only PCN requirement reaches the server gate through the immutable dossier snapshot', async () => {
  const definition: DossierTemplateRequirementDefinition = {
    domain: 'PCN',
    id: 'pcn-custom-stage-gate',
    code: 'STAGE_GATE_PROOF',
    name: 'Bằng chứng theo giai đoạn',
    level: 'REQUIRED',
    source: 'UPLOAD_EXTERNAL',
    ownerRole: 'CERTIFICATION_EXPERT',
    multiplicity: 'SINGLE',
  };
  const template: PcnWorkflowTemplate = {
    id: 'pcn-stage-gate-v1',
    code: 'PCN-STAGE-GATE',
    name: 'Kiểm tra stage-only gate',
    appliesTo: { fieldCodes: ['QC4'], methods: ['METHOD_1'] },
    version: 1,
    status: 'PUBLISHED',
    stages: [{ id: 'intake-documents', label: 'Tiếp nhận hồ sơ', sortOrder: 10, requirementIds: [definition.id] }],
    requirementDefinitions: [definition],
    nodes: [
      { id: 'work', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 1, stageId: 'intake-documents' },
      { id: 'next', kind: 'END', label: 'Kết thúc', requirementIds: [], active: true, sortOrder: 2, stageId: 'issuance-archive' },
    ],
    transitions: [{ id: 'work-next', fromNodeId: 'work', toNodeId: 'next', condition: 'ALWAYS' }],
    createdAt: '2026-10-10T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-10-10T00:00:00.000Z',
    updatedBy: 'admin',
  };
  const snapshot = snapshotPcnWorkflowTemplate(template, { capturedAt: '2026-10-10T01:00:00.000Z', capturedBy: 'admin' });
  assert.deepEqual(snapshot.nodes[0].requirementIds, [definition.id]);
  const dossierSnapshot = { fieldCodes: ['QC4'], workflowSnapshot: snapshot };
  const runtimeRequirement = getPcnDossierRequirementsWithCustom(dossierSnapshot).find((item) => item.id === definition.id)!;
  await assertStatusCode(runMutation({ workflow: snapshot, requirements: [runtimeRequirement] }, 'complete'), 409);

  const confirmed = {
    ...document(definition.id, 'PRESENT'),
    currentVersionId: 'stage-gate-asset',
    lifecycleStatus: 'CONFIRMED' as const,
    versions: [{ assetId: 'stage-gate-asset', fileName: 'proof.pdf', byteSize: 10, sha256: 'c'.repeat(64), uploadedAt: '2026-10-10T00:00:00.000Z' }],
  };
  const completed = await runMutation({ workflow: snapshot, requirements: [runtimeRequirement], documents: [confirmed] }, 'complete');
  assert.equal(completed.result.task.status, 'COMPLETED');
});
