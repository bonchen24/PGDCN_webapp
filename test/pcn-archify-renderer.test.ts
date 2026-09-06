import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnArchifyWorkflow } from '../utils/pcnArchifyWorkflow.ts';
import { ARCHIFY_RENDERER_ENTRYPOINTS, renderArchifyDiagram, resetArchifyRuntimeTestHooks, setArchifyRuntimeTestHooks } from '../utils/pcnArchifyRenderer.ts';
import { renderArchifyWorkflowDocument } from '../utils/pcnArchifyRenderer.ts';

function workflowFixture() {
  return buildPcnArchifyWorkflow({
    dossier: {
      id: 'dossier-render', dossierCode: 'PCN-RENDER-01', proposalId: 'proposal-render',
      fieldCodes: ['QC4'], method: 'METHOD_1', status: 'INTAKE_REVIEW', documentWaivers: {},
      labRequestIds: [], returnedResultIds: [],
    } as any,
    workflow: {
      templateCode: 'PCN-RENDER', templateVersion: 1, capturedAt: '2026-09-06T00:00:00.000Z', capturedBy: 'admin',
      nodes: [
        { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 0 },
        { id: 'end', kind: 'END', label: 'Kết thúc', requirementIds: [], active: true, sortOrder: 1 },
      ],
      transitions: [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end', label: 'Hoàn tất' }],
    } as any,
    tasks: [], documents: [], results: [], approvalSteps: [], activityLogs: [],
  });
}

test.afterEach(() => resetArchifyRuntimeTestHooks());

test('renderArchifyDiagram renders every available Archify reader type', async () => {
  const cases = [
    ['workflow', { available: true, diagramType: 'workflow', document: workflowFixture() }],
    ['lifecycle', { available: true, diagramType: 'lifecycle', document: JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/agent-run.lifecycle.json', import.meta.url), 'utf8')) }],
    ['dataflow', { available: true, diagramType: 'dataflow', document: JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/product-analytics.dataflow.json', import.meta.url), 'utf8')) }],
    ['sequence', { available: true, diagramType: 'sequence', document: JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/cache-miss-request.sequence.json', import.meta.url), 'utf8')) }],
    ['architecture', { available: true, diagramType: 'architecture', document: JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8')) }],
  ] as const;

  for (const [diagramType, candidate] of cases) {
    assert.equal(candidate.available, true);
    const result = await renderArchifyDiagram(diagramType, candidate.document, { domain: 'pcn', recordId: 'dossier-render' });
    assert.equal(result.available, true);
    assert.match(result.html, /archify-guided-views-data/);
    assert.match(result.html, /data-theme="light"/);
  }
});

test('renderArchifyDiagram returns unavailable diagrams without invoking the runner', async () => {
  let spawned = false;
  setArchifyRuntimeTestHooks({ spawn: () => { spawned = true; throw new Error('must not spawn'); } });
  const result = await renderArchifyDiagram('sequence', { available: false, diagramType: 'sequence', reason: 'Không đủ sự kiện.' }, { domain: 'pgd', recordId: 'request-1' });
  assert.deepEqual(result, { available: false, diagramType: 'sequence', reason: 'Không đủ sự kiện.' });
  assert.equal(spawned, false);
});

test('renderer rejects malformed schema before spawning', async () => {
  let spawned = false;
  setArchifyRuntimeTestHooks({ spawn: () => { spawned = true; throw new Error('must not spawn'); } });
  await assert.rejects(() => renderArchifyDiagram('dataflow', { schema_version: 1, diagram_type: 'dataflow' }, { domain: 'pcn', recordId: 'r-1' }), /không hợp lệ/i);
  assert.equal(spawned, false);
});

test('renderer rejects unsupported types safely', async () => {
  await assert.rejects(() => renderArchifyDiagram('bogus' as any, {}, { domain: 'pcn', recordId: 'r-1' }), /không hỗ trợ/i);
});

test('focus bridge escapes and limits its context to the authorized record scope', async () => {
  const result = await renderArchifyDiagram('workflow', workflowFixture(), { domain: 'pgd', recordId: 'record-<unsafe>' });
  assert.equal(result.available, true);
  assert.match(result.html, /pcn-archify-focus-bridge/);
  assert.match(result.html, /pgd/);
  assert.match(result.html, /record-\\u003cunsafe\\u003e/);
  const bridge = result.html.slice(result.html.indexOf('<script id="pcn-archify-focus-bridge"'));
  assert.doesNotMatch(bridge, /password|token|secret|E:\\|C:\\Users/i);
});

test('renderer maps child failure, timeout, and oversized output to safe errors and cleans up', async () => {
  const removed: string[] = [];
  setArchifyRuntimeTestHooks({
    spawn: (_file, args) => {
      const handlers = new Map<string, (...values: any[]) => void>();
      const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {}, } as any;
      queueMicrotask(() => handlers.get('close')?.(1));
      return child;
    },
    remove: async (target) => { removed.push(target); fs.rmSync(target, { recursive: true, force: true }); },
  });
  await assert.rejects(() => renderArchifyDiagram('architecture', { schema_version: 1, diagram_type: 'architecture', meta: { title: 'A' }, components: [{ id: 'a', type: 'backend', label: 'A' }] }, { domain: 'pcn', recordId: 'r-1' }), /không thể render/i);
  assert.ok(removed.length >= 1);
  setArchifyRuntimeTestHooks({ timeoutMs: 1, spawn: () => ({ once: () => {}, kill: () => {} } as any), remove: async (target) => { removed.push(target); fs.rmSync(target, { recursive: true, force: true }); } });
  await assert.rejects(() => renderArchifyDiagram('architecture', { schema_version: 1, diagram_type: 'architecture', meta: { title: 'A' }, components: [{ id: 'a', type: 'backend', label: 'A' }] }, { domain: 'pcn', recordId: 'r-1' }), /quá thời gian/i);
  setArchifyRuntimeTestHooks({ spawn: (_file, _args) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; }, readOutput: async () => '<html>' + 'x'.repeat(12 * 1024 * 1024 + 1) + '</html>', remove: async (target) => { removed.push(target); fs.rmSync(target, { recursive: true, force: true }); } });
  await assert.rejects(() => renderArchifyDiagram('architecture', { schema_version: 1, diagram_type: 'architecture', meta: { title: 'A' }, components: [{ id: 'a', type: 'backend', label: 'A' }] }, { domain: 'pcn', recordId: 'r-1' }), /quá lớn/i);
  assert.ok(removed.length >= 3);
});

test('renderer constants pin all CLI entrypoints and the shared template', () => {
  assert.deepEqual(ARCHIFY_RENDERER_ENTRYPOINTS, {
    architecture: 'renderers/architecture/render-architecture.mjs',
    dataflow: 'renderers/dataflow/render-dataflow.mjs',
    sequence: 'renderers/sequence/render-sequence.mjs',
    lifecycle: 'renderers/lifecycle/render-lifecycle.mjs',
  });
  assert.match(fs.readFileSync(new URL('../vendor/archify/archify/assets/template.html', import.meta.url), 'utf8'), /archify-guided-views-data/);
});

test('server renderer uses the vendored Archify compiler and complete reader template', async () => {
  const workflowDocument = buildPcnArchifyWorkflow({
    dossier: {
      id: 'dossier-render',
      dossierCode: 'PCN-RENDER-01',
      proposalId: 'proposal-render',
      fieldCodes: ['QC4'],
      method: 'METHOD_1',
      status: 'INTAKE_REVIEW',
      documentWaivers: {},
      labRequestIds: [],
      returnedResultIds: [],
    } as any,
    workflow: {
      templateCode: 'PCN-RENDER',
      templateVersion: 1,
      capturedAt: '2026-09-06T00:00:00.000Z',
      capturedBy: 'admin',
      nodes: [
        { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 0 },
        { id: 'end', kind: 'END', label: 'Kết thúc', requirementIds: [], active: true, sortOrder: 1 },
      ],
      transitions: [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end', label: 'Hoàn tất' }],
    } as any,
    tasks: [],
    documents: [],
    results: [],
    approvalSteps: [],
    activityLogs: [],
  });

  const html = await renderArchifyWorkflowDocument(workflowDocument, { domain: 'pcn', recordId: 'dossier-render' });
  assert.match(html, /<html lang="en" data-theme="light" data-preset="signal-flow">/);
  assert.match(html, /ARCHIFY:SVG_SLOT|archify-guided-views-data/);
  assert.match(html, /data-node-id="start"/);
  assert.match(html, /data-edge-id="start-end"/);
  assert.match(html, /pcn-archify-focus/);
  assert.match(html, /dossier-render/);
});

test('both dossier domains serve Archify from authenticated server routes', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /app\.get\('\/api\/pcn\/dossiers\/:dossierId\/archify'/);
  assert.match(serverSource, /app\.get\('\/api\/pgd\/requests\/:requestId\/archify'/);
  assert.match(serverSource, /requirePcnSession/);
  assert.match(serverSource, /requirePgdSession/);
  assert.match(serverSource, /buildPcnArchifyWorkflow/);
  assert.match(serverSource, /buildPgdArchifyWorkflow/);
});

test('Archify routes order activity logs by the JSON activity timestamp', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(serverSource, /readRows\(PGD_COLLECTIONS\.activityLogs, "data->>'createdAt' ASC, document_id ASC"\)/);
  assert.match(serverSource, /activityLogs' AND \(data->>'entityId' = \$1 OR data->>'requestCode' = \$1\) ORDER BY data->>'createdAt', document_id/);
  assert.doesNotMatch(serverSource, /readRows\(PGD_COLLECTIONS\.activityLogs, ['"]created_at ASC/);
  assert.doesNotMatch(serverSource, /activityLogs' AND \(data->>'entityId' = \$1 OR data->>'requestCode' = \$1\) ORDER BY created_at/);
});
