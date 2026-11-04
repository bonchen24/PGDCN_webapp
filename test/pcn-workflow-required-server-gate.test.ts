import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CertificationDossier,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  PcnUserAccount,
  PcnWorkflowSnapshot,
} from '../types.ts';
import { executePcnWorkflowTaskMutation } from '../lib/server/workflow-tasks.ts';
import { pool } from '../utils/db.ts';

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
