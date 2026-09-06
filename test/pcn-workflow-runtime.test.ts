import assert from 'node:assert/strict';
import test from 'node:test';

import type { PcnDossierWorkflowTask, PcnWorkflowSnapshot, PcnWorkflowTemplate } from '../types.ts';
import {
  applyPcnWorkflowReturn,
  buildPcnWorkflowTaskSeed,
  buildPcnWorkflowConditionContext,
  evaluatePcnWorkflowCondition,
  isPcnWorkflowTransitionAllowed,
  projectPcnWorkflowRuntime,
} from '../utils/pcnWorkflowRuntime.ts';
import { snapshotPcnWorkflowTemplate } from '../utils/pcnWorkflowTemplate.ts';

const template = (): PcnWorkflowTemplate => ({
  id: 'parallel-v1',
  code: 'PARALLEL',
  name: 'Luồng song song',
  appliesTo: { fieldCodes: ['QC4'] },
  version: 1,
  status: 'PUBLISHED',
  nodes: [
    { id: 'start', kind: 'DOCUMENT_TASK', label: 'Đầu vào', requirementIds: [], active: true, sortOrder: 1 },
    { id: 'split', kind: 'PARALLEL_SPLIT', label: 'Tách nhánh', requirementIds: [], active: true, sortOrder: 2 },
    { id: 'doc-a', kind: 'DOCUMENT_TASK', label: 'Tài liệu A', requirementIds: ['req-a'], active: true, sortOrder: 3 },
    { id: 'doc-b', kind: 'DOCUMENT_TASK', label: 'Tài liệu B', requirementIds: ['req-b'], active: true, sortOrder: 4 },
    { id: 'join', kind: 'PARALLEL_JOIN', label: 'Gom nhánh', requirementIds: [], joinPolicy: 'ALL', active: true, sortOrder: 5 },
    { id: 'decision', kind: 'DECISION', label: 'Kết luận', requirementIds: [], active: true, sortOrder: 6 },
    { id: 'end', kind: 'END', label: 'Hoàn tất', requirementIds: [], active: true, sortOrder: 7 },
  ],
  transitions: [
    { id: 's1', fromNodeId: 'start', toNodeId: 'split' },
    { id: 's2', fromNodeId: 'split', toNodeId: 'doc-a' },
    { id: 's3', fromNodeId: 'split', toNodeId: 'doc-b' },
    { id: 'j1', fromNodeId: 'doc-a', toNodeId: 'join' },
    { id: 'j2', fromNodeId: 'doc-b', toNodeId: 'join' },
    { id: 'd1', fromNodeId: 'join', toNodeId: 'decision' },
    { id: 'd2', fromNodeId: 'decision', toNodeId: 'end', condition: 'RESULT_PASSED' },
  ],
  createdAt: '2026-09-06T00:00:00.000Z',
  createdBy: 'admin',
  updatedAt: '2026-09-06T00:00:00.000Z',
  updatedBy: 'admin',
});

const snap = (): PcnWorkflowSnapshot => snapshotPcnWorkflowTemplate(template(), { capturedAt: '2026-09-06T00:00:00.000Z', capturedBy: 'admin' });

const task = (nodeId: string, status: PcnDossierWorkflowTask['status'], overrides: Partial<PcnDossierWorkflowTask> = {}): PcnDossierWorkflowTask => ({
  id: `task-${nodeId}`,
  dossierId: 'dossier-1',
  nodeId,
  status,
  cycleNo: 1,
  updatedAt: '2026-09-06T00:00:00.000Z',
  updatedBy: 'admin',
  ...overrides,
});

test('seeds only entry tasks as READY and locks the rest', () => {
  const tasks = buildPcnWorkflowTaskSeed(snap(), 'dossier-1', 'admin', '2026-09-06T00:00:00.000Z');
  assert.equal(tasks.find((item) => item.nodeId === 'start')?.status, 'READY');
  assert.equal(tasks.find((item) => item.nodeId === 'doc-a')?.status, 'LOCKED');
  assert.equal(new Set(tasks.map((item) => item.id)).size, tasks.length);
});

test('evaluates only allowlisted workflow predicates', () => {
  assert.equal(evaluatePcnWorkflowCondition('ALWAYS', {}), true);
  assert.equal(evaluatePcnWorkflowCondition('RESULT_PASSED', { resultOutcome: 'PASS' }), true);
  assert.equal(evaluatePcnWorkflowCondition('RESULT_PASSED', { resultOutcome: 'FAIL' }), false);
  assert.throws(() => evaluatePcnWorkflowCondition('process.env.SECRET', {}), /điều kiện|condition|allow/i);
  assert.equal(isPcnWorkflowTransitionAllowed({ condition: 'FIELD_MATCH', conditionConfig: { expectedFieldCodes: ['QC4'] } }, { fieldCodes: ['QC4'] }), true);
  assert.equal(isPcnWorkflowTransitionAllowed({ condition: 'METHOD_MATCH', conditionConfig: { expectedMethod: 'METHOD_5' } }, { method: 'METHOD_1' }), false);
});

test('derives branch conditions from dossier results and approval state', () => {
  const context = buildPcnWorkflowConditionContext({
    workflow: snap(),
    documents: [],
    documentWaivers: {},
    results: [{ id: 'result-1', dossierId: 'dossier-1', labRequestId: 'lab-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T02:00:00.000Z' }],
    approvalSteps: [{ id: 'approval-1', dossierId: 'dossier-1', sequence: 1, role: 'LEADERSHIP', status: 'RETURNED' }],
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
  });
  assert.equal(context.anyResultReturned, true);
  assert.equal(context.resultOutcome, 'PASS');
  assert.equal(context.approvalReturned, true);
  assert.deepEqual(context.fieldCodes, ['QC4']);

  const tasks = [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'COMPLETED'), task('doc-b', 'COMPLETED'), task('join', 'COMPLETED'), task('decision', 'COMPLETED'), task('end', 'LOCKED')];
  const passed = projectPcnWorkflowRuntime({ workflow: snap(), tasks, documents: [], documentWaivers: {}, conditionContext: context });
  assert.equal(passed.byNodeId.end.status, 'READY');

  const failedContext = buildPcnWorkflowConditionContext({
    workflow: snap(),
    documents: [],
    documentWaivers: {},
    results: [{ id: 'result-2', dossierId: 'dossier-1', labRequestId: 'lab-1', round: 1, outcome: 'FAIL', receivedAt: '2026-09-06T02:00:00.000Z' }],
  });
  const failed = projectPcnWorkflowRuntime({ workflow: snap(), tasks, documents: [], documentWaivers: {}, conditionContext: failedContext });
  assert.equal(failed.byNodeId.end.status, 'LOCKED');
  assert.equal(failed.byNodeId.end.blockedReason, 'CONDITION');
});

test('projects parallel readiness and ALL join only after both branches complete', () => {
  const before = [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'COMPLETED'), task('doc-b', 'READY'), task('join', 'LOCKED'), task('decision', 'LOCKED'), task('end', 'LOCKED')];
  const projected = projectPcnWorkflowRuntime({ workflow: snap(), tasks: before, documents: [], documentWaivers: {} });
  assert.deepEqual(projected.activeNodeIds, ['doc-b']);
  assert.equal(projected.byNodeId.join.status, 'LOCKED');

  const after = projectPcnWorkflowRuntime({ workflow: snap(), tasks: before.map((item) => item.nodeId === 'doc-b' ? { ...item, status: 'COMPLETED' as const } : item), documents: [], documentWaivers: {} });
  assert.equal(after.byNodeId.join.status, 'READY');
  assert.equal(after.byNodeId.decision.status, 'LOCKED');
});

test('supports ANY and QUORUM joins', () => {
  const anyWorkflow = { ...snap(), nodes: snap().nodes.map((node) => node.id === 'join' ? { ...node, joinPolicy: 'ANY' as const } : node) };
  const anyRuntime = projectPcnWorkflowRuntime({ workflow: anyWorkflow, tasks: [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'COMPLETED'), task('doc-b', 'LOCKED'), task('join', 'LOCKED'), task('decision', 'LOCKED'), task('end', 'LOCKED')], documents: [], documentWaivers: {} });
  assert.equal(anyRuntime.byNodeId.join.status, 'READY');
  const quorumWorkflow = { ...snap(), nodes: snap().nodes.map((node) => node.id === 'join' ? { ...node, joinPolicy: 'QUORUM' as const, quorum: 2 } : node) };
  const quorumRuntime = projectPcnWorkflowRuntime({ workflow: quorumWorkflow, tasks: [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'COMPLETED'), task('doc-b', 'LOCKED'), task('join', 'LOCKED'), task('decision', 'LOCKED'), task('end', 'LOCKED')], documents: [], documentWaivers: {} });
  assert.equal(quorumRuntime.byNodeId.join.status, 'LOCKED');
});

test('blocks a document task until its current document or valid waiver exists', () => {
  const tasks = [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'READY'), task('doc-b', 'LOCKED'), task('join', 'LOCKED'), task('decision', 'LOCKED'), task('end', 'LOCKED')];
  const missing = projectPcnWorkflowRuntime({ workflow: snap(), tasks, documents: [{ requirementId: 'req-a', status: 'MISSING' }], documentWaivers: {} });
  assert.equal(missing.byNodeId['doc-a'].blockedReason, 'MISSING_DOCUMENT');
  const waived = projectPcnWorkflowRuntime({ workflow: snap(), tasks, documents: [{ requirementId: 'req-a', status: 'MISSING' }], documentWaivers: { 'req-a': { requirementId: 'req-a', reason: 'Không áp dụng', decidedAt: '2026-09-06T00:00:00.000Z' } } });
  assert.equal(waived.byNodeId['doc-a'].blockedReason, undefined);
});

test('returns a node with a new cycle and marks downstream work stale', () => {
  const result = applyPcnWorkflowReturn({ workflow: snap(), tasks: [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'COMPLETED'), task('doc-b', 'COMPLETED'), task('join', 'COMPLETED'), task('decision', 'IN_PROGRESS')], sourceNodeId: 'decision', targetNodeId: 'doc-a', reason: 'Thiếu bằng chứng', actor: 'reviewer', now: '2026-09-06T03:00:00.000Z' });
  assert.equal(result.tasks.find((item) => item.nodeId === 'decision')?.status, 'RETURNED');
  assert.equal(result.tasks.find((item) => item.nodeId === 'doc-a')?.status, 'READY');
  assert.equal(result.tasks.find((item) => item.nodeId === 'join')?.status, 'STALE');
  assert.equal(result.tasks.find((item) => item.nodeId === 'doc-a')?.cycleNo, 2);
  assert.equal(result.returnedTask.returnTargetNodeId, 'doc-a');
  assert.equal(result.returnedTask.returnReason, 'Thiếu bằng chứng');
});

test('only returns an active node to an upstream node', () => {
  const tasks = [task('start', 'COMPLETED'), task('split', 'COMPLETED'), task('doc-a', 'COMPLETED'), task('doc-b', 'COMPLETED'), task('join', 'COMPLETED'), task('decision', 'IN_PROGRESS'), task('end', 'LOCKED')];
  assert.throws(() => applyPcnWorkflowReturn({ workflow: snap(), tasks, sourceNodeId: 'decision', targetNodeId: 'end', reason: 'Cần sửa', actor: 'reviewer', now: '2026-09-06T03:00:00.000Z' }), /trước|upstream|node/i);
  assert.throws(() => applyPcnWorkflowReturn({ workflow: snap(), tasks: tasks.map((item) => item.nodeId === 'decision' ? { ...item, status: 'LOCKED' as const } : item), sourceNodeId: 'decision', targetNodeId: 'join', reason: 'Cần sửa', actor: 'reviewer', now: '2026-09-06T03:00:00.000Z' }), /xử lý|trả lại|active/i);
});
