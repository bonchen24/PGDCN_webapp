import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnWorkflowTemplate } from '../types.ts';
import { createPcnWorkflowRevision, publishPcnWorkflowTemplate, retirePcnWorkflowTemplate } from '../utils/pcnWorkflowTemplateApi.ts';
import { completePcnWorkflowTask, returnPcnWorkflowTask, startPcnWorkflowTask } from '../utils/pcnWorkflowTaskApi.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');
const rbacSource = fs.readFileSync(new URL('../utils/pcnRbac.ts', import.meta.url), 'utf8');

const template = { id: 'workflow-1', code: 'QC4-1', name: 'QC4', appliesTo: { fieldCodes: ['QC4'] }, version: 1, status: 'DRAFT', nodes: [], transitions: [], createdAt: '2026-09-06T00:00:00.000Z', createdBy: 'admin', updatedAt: '2026-09-06T00:00:00.000Z', updatedBy: 'admin' } as PcnWorkflowTemplate;

test('workflow collections are PCN-scoped and generic writes are blocked', () => {
  assert.match(serverSource, /"pcnWorkflowTemplates"/);
  assert.match(serverSource, /"pcnDossierWorkflowTasks"/);
  assert.match(rbacSource, /pcnWorkflowTemplates/);
  assert.match(rbacSource, /pcnDossierWorkflowTasks/);
  assert.match(schemaSource, /pcnWorkflowTemplates/);
  assert.match(schemaSource, /pcnDossierWorkflowTasks/);
});

test('server exposes manager-only template and task boundaries', () => {
  assert.match(serverSource, /requirePcnWorkflowManager/);
  assert.match(serverSource, /isPcnSystemManager/);
  assert.match(serverSource, /app\.get\('\/api\/pcn\/workflow-templates'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/workflow-templates'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/workflow-templates\/\:templateId\/revisions'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/workflow-templates\/\:templateId\/publish'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/workflow-templates\/\:templateId\/retire'/);
  assert.match(serverSource, /app\.get\('\/api\/pcn\/dossiers\/\:dossierId\/workflow-tasks'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/dossiers\/\:dossierId\/workflow-tasks\/\:taskId\/return'/);
  assert.match(serverSource, /withPgTransaction/);
  assert.match(serverSource, /FOR UPDATE/);
  assert.match(serverSource, /workflowSnapshot/);
  assert.match(serverSource, /idempotent/);
  assert.match(serverSource, /expectedCycleNo/);
  assert.match(serverSource, /buildPcnWorkflowConditionContext/);
  assert.match(serverSource, /buildPcnDossierNodeWorkProjection/);
  assert.match(serverSource, /workProjection\.canContinue/);
  assert.match(serverSource, /collection_name = 'returnedResults'/);
  assert.match(serverSource, /collection_name = 'approvalSteps'/);
});

test('workflow clients use dedicated routes and send controlled payloads', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ template, task: { id: 'task-1' }, tasks: [] });
  }) as typeof fetch;
  try {
    await createPcnWorkflowRevision('workflow-1', template);
    await publishPcnWorkflowTemplate('workflow-1');
    await retirePcnWorkflowTemplate('workflow-1', 'Không còn dùng');
    await startPcnWorkflowTask('dossier-1', 'task-1');
    await completePcnWorkflowTask('dossier-1', 'task-1', 2);
    await returnPcnWorkflowTask('dossier-1', 'task-1', { targetNodeId: 'intake', reason: 'Thiếu tài liệu' });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls.map((call) => `${call.init?.method} ${call.url}`), [
    'POST /api/pcn/workflow-templates/workflow-1/revisions',
    'POST /api/pcn/workflow-templates/workflow-1/publish',
    'POST /api/pcn/workflow-templates/workflow-1/retire',
    'POST /api/pcn/dossiers/dossier-1/workflow-tasks/task-1/start',
    'POST /api/pcn/dossiers/dossier-1/workflow-tasks/task-1/complete',
    'POST /api/pcn/dossiers/dossier-1/workflow-tasks/task-1/return',
  ]);
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { reason: 'Không còn dùng' });
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { expectedCycleNo: 2 });
  assert.deepEqual(JSON.parse(String(calls[5].init?.body)), { targetNodeId: 'intake', reason: 'Thiếu tài liệu' });
});
