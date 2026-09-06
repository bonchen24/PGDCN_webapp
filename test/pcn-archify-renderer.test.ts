import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnArchifyWorkflow } from '../utils/pcnArchifyWorkflow.ts';
import { ARCHIFY_RENDERER_ENTRYPOINTS, ARCHIFY_TEMPLATE_ENTRYPOINT, renderArchifyDiagram, resetArchifyRuntimeTestHooks, setArchifyRuntimeTestHooks } from '../utils/pcnArchifyRenderer.ts';
import { renderArchifyWorkflowDocument } from '../utils/pcnArchifyRenderer.ts';
import { ARCHIFY_PINNED_VENDOR_ROOT, runArchifyRenderer } from '../utils/archifyRuntime.ts';

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

test('workflow trace animates only the route reached by the dossier and dashes future branches', async () => {
  const workflow = buildPcnArchifyWorkflow({
    dossier: {
      id: 'dossier-motion', dossierCode: 'PCN-MOTION-01', proposalId: 'proposal-motion',
      fieldCodes: ['QC4'], method: 'METHOD_1', status: 'INTAKE_REVIEW', documentWaivers: {},
      labRequestIds: [], returnedResultIds: [],
    } as any,
    workflow: {
      templateCode: 'PCN-MOTION', templateVersion: 1, capturedAt: '2026-09-06T00:00:00.000Z', capturedBy: 'admin',
      nodes: [
        { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 0 },
        { id: 'current', kind: 'DOCUMENT_TASK', label: 'Đang xử lý', requirementIds: [], active: true, sortOrder: 1 },
        { id: 'split', kind: 'PARALLEL_SPLIT', label: 'Tách nhánh', requirementIds: [], active: true, sortOrder: 2 },
        { id: 'future-a', kind: 'DOCUMENT_TASK', label: 'Nhánh A', requirementIds: [], active: true, sortOrder: 3 },
        { id: 'future-b', kind: 'DOCUMENT_TASK', label: 'Nhánh B', requirementIds: [], active: true, sortOrder: 3 },
        { id: 'join', kind: 'PARALLEL_JOIN', label: 'Gom nhánh', requirementIds: [], joinPolicy: 'ALL', active: true, sortOrder: 4 },
        { id: 'end', kind: 'END', label: 'Kết thúc', requirementIds: [], active: true, sortOrder: 5 },
      ],
      transitions: [
        { id: 'start-current', fromNodeId: 'start', toNodeId: 'current', label: 'Chuyển xử lý' },
        { id: 'current-split', fromNodeId: 'current', toNodeId: 'split', label: 'Tách song song' },
        { id: 'split-future-a', fromNodeId: 'split', toNodeId: 'future-a', label: 'Nhánh A' },
        { id: 'split-future-b', fromNodeId: 'split', toNodeId: 'future-b', label: 'Nhánh B' },
        { id: 'future-a-join', fromNodeId: 'future-a', toNodeId: 'join', label: 'A hoàn tất' },
        { id: 'future-b-join', fromNodeId: 'future-b', toNodeId: 'join', label: 'B hoàn tất' },
        { id: 'join-end', fromNodeId: 'join', toNodeId: 'end', label: 'Hoàn tất' },
      ],
    } as any,
    tasks: [
      { id: 'task-start', dossierId: 'dossier-motion', nodeId: 'start', status: 'COMPLETED', cycleNo: 1 },
      { id: 'task-current', dossierId: 'dossier-motion', nodeId: 'current', status: 'IN_PROGRESS', cycleNo: 1 },
      { id: 'task-split', dossierId: 'dossier-motion', nodeId: 'split', status: 'LOCKED', cycleNo: 1 },
      { id: 'task-future-a', dossierId: 'dossier-motion', nodeId: 'future-a', status: 'LOCKED', cycleNo: 1 },
      { id: 'task-future-b', dossierId: 'dossier-motion', nodeId: 'future-b', status: 'LOCKED', cycleNo: 1 },
      { id: 'task-join', dossierId: 'dossier-motion', nodeId: 'join', status: 'LOCKED', cycleNo: 1 },
      { id: 'task-end', dossierId: 'dossier-motion', nodeId: 'end', status: 'LOCKED', cycleNo: 1 },
    ] as any,
    documents: [], results: [], approvalSteps: [], activityLogs: [],
  });
  const result = await renderArchifyDiagram('workflow', workflow, { domain: 'pcn', recordId: 'dossier-motion' });
  assert.equal(result.available, true);
  const pathFor = (edgeId: string) => result.html.match(new RegExp(`<path\\b[^>]*data-edge-id="${edgeId}"[^>]*>`))?.[0] || '';
  const reached = pathFor('start-current');
  const futureA = pathFor('split-future-a');
  const futureB = pathFor('split-future-b');
  assert.match(reached, /data-animate="edge"/);
  assert.doesNotMatch(futureA, /data-animate="edge"/);
  assert.doesNotMatch(futureB, /data-animate="edge"/);
  assert.match(futureA, /class="a-dashed"/);
  assert.match(futureB, /class="a-dashed"/);
  assert.match(futureA, /marker-end="url\(#arrowhead-dashed\)"/);
});

test('renderArchifyDiagram returns unavailable diagrams without invoking the runner', async () => {
  let spawned = false;
  setArchifyRuntimeTestHooks({ spawn: () => { spawned = true; throw new Error('must not spawn'); } });
  const result = await renderArchifyDiagram('sequence', { available: false, diagramType: 'sequence', reason: 'Không đủ sự kiện.' }, { domain: 'pgd', recordId: 'request-1' });
  assert.deepEqual(result, { available: false, diagramType: 'sequence', reason: 'Biểu đồ sequence hiện chưa khả dụng.' });
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

test('unavailable reasons are bounded and compiler failures are sanitized', async () => {
  const unavailable = await renderArchifyDiagram('sequence', { available: false, diagramType: 'sequence', reason: 'C:\\secret\\token=abc PII' }, { domain: 'pcn', recordId: 'r-1' });
  assert.deepEqual(unavailable, { available: false, diagramType: 'sequence', reason: 'Biểu đồ sequence hiện chưa khả dụng.' });
  const brokenWorkflow = { ...workflowFixture(), meta: undefined };
  await assert.rejects(() => renderArchifyDiagram('workflow', brokenWorkflow as any, { domain: 'pcn', recordId: 'r-1' }), (error: any) => {
    assert.equal(error.message, 'Archify không thể biên dịch lưu trình hồ sơ.');
    assert.doesNotMatch(error.message, /vendor|secret|token|C:\\|tmp/i);
    return true;
  });
});

test('child invocation uses exact arguments and a minimal safe environment', async () => {
  let invocation: any;
  const validHtml = '<!doctype html><html><head></head><body><svg></svg><script id="archify-guided-views-data"></script></body></html>';
  setArchifyRuntimeTestHooks({
    spawn: (file, args, options) => {
      invocation = { file, args, options };
      const handlers = new Map<string, (...values: any[]) => void>();
      const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any;
      queueMicrotask(() => handlers.get('close')?.(0));
      return child;
    },
    statOutput: async () => ({ size: 0 }),
    readOutput: async () => validHtml,
  });
  const result = await renderArchifyDiagram('architecture', JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8')), { domain: 'pcn', recordId: 'r-1' });
  assert.equal(result.available, true);
  assert.equal(invocation.file, process.execPath);
  assert.equal(invocation.args.length, 3);
  assert.match(invocation.args[0], /renderers[\\/]architecture[\\/]render-architecture\.mjs$/);
  assert.match(invocation.args[1], /\.pcn-archify-/);
  assert.match(invocation.args[2], /\.pcn-archify-/);
  assert.equal(invocation.options.cwd, fs.realpathSync(new URL('../vendor/archify/archify', import.meta.url)));
  assert.deepEqual(Object.keys(invocation.options.env).filter((key) => key !== 'ARCHIFY_QUALITY_PROFILE').sort(), ['LANG', 'PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP'].filter((key) => key in invocation.options.env).sort());
  assert.equal(invocation.options.env.ARCHIFY_REPO_ROOT, undefined);
  assert.equal(invocation.options.env.SECRET_TOKEN, undefined);
});

test('runtime ignores an attempted alternate vendor root and stays pinned', async () => {
  let cwd = '';
  const validHtml = '<!doctype html><html><body><svg></svg><script id="archify-guided-views-data"></script></body></html>';
  setArchifyRuntimeTestHooks({
    spawn: (_file, _args, options) => { cwd = options.cwd; const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; },
    statOutput: async () => ({ size: 0 }),
    readOutput: async () => validHtml,
  });
  await runArchifyRenderer({ diagramType: 'architecture', document: JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8')), vendorRoot: 'C:\\attacker\\root' } as any);
  assert.equal(cwd, fs.realpathSync(ARCHIFY_PINNED_VENDOR_ROOT));
});

test('forbidden and malformed nested fields are rejected before serialization or spawn', async () => {
  const base = JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8'));
  for (const document of [
    { ...base, privateBytes: 'secret' },
    { ...base, components: [{ ...base.components[0], privateToken: 'secret' }] },
    { ...base, components: [{ ...base.components[0], pos: 'not-a-point' }] },
    { ...base, components: [{ ...base.components[0], sources: [{ path: 'C:\\private\\source.ts' }] }] },
  ]) {
    let wrote = false;
    let spawned = false;
    setArchifyRuntimeTestHooks({ writeInput: async () => { wrote = true; }, spawn: () => { spawned = true; throw new Error('must not spawn'); } });
    await assert.rejects(() => renderArchifyDiagram('architecture', document, { domain: 'pcn', recordId: 'r-1' }), /không hợp lệ/i);
    assert.equal(wrote, false);
    assert.equal(spawned, false);
  }
});

test('serialization is a sanitized projection without renderer output paths', async () => {
  let serialized = '';
  const validHtml = '<!doctype html><html><body><svg></svg><script id="archify-guided-views-data"></script></body></html>';
  setArchifyRuntimeTestHooks({
    writeInput: async (_target, data) => { serialized = data; },
    spawn: (_file, _args, _options) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; },
    statOutput: async () => ({ size: 0 }),
    readOutput: async () => validHtml,
  });
  const document = JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8'));
  await renderArchifyDiagram('architecture', document, { domain: 'pcn', recordId: 'r-1' });
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.meta.output, undefined);
  assert.equal(parsed.privateBytes, undefined);
});

test('renderer rejects partial or non-HTML output and inserts a missing light theme', async () => {
  const doc = JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8'));
  setArchifyRuntimeTestHooks({ spawn: (_file, _args, _options) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; }, statOutput: async () => ({ size: 0 }), readOutput: async () => '<html><body>archify-guided-views-data</body></html>' });
  await assert.rejects(() => renderArchifyDiagram('architecture', doc, { domain: 'pcn', recordId: 'r-1' }), /HTML không hợp lệ/i);
  setArchifyRuntimeTestHooks({ spawn: (_file, _args, _options) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; }, statOutput: async () => ({ size: 0 }), readOutput: async () => '<!doctype html><html lang="en"><body><svg></svg><script id="archify-guided-views-data"></script></body></html>' });
  const result = await renderArchifyDiagram('architecture', doc, { domain: 'pcn', recordId: 'r-1' });
  assert.equal(result.available, true);
  assert.match(result.html, /<!doctype html><html lang="en" data-theme="light">/);
});

test('filesystem failures still attempt cleanup and compatibility returns HTML', async () => {
  let removed = false;
  setArchifyRuntimeTestHooks({ writeInput: async () => { throw new Error('write failed C:\\secret'); }, remove: async (target) => { removed = true; fs.rmSync(target, { recursive: true, force: true }); } });
  await assert.rejects(() => renderArchifyDiagram('architecture', { schema_version: 1, diagram_type: 'architecture', meta: { title: 'A' }, components: [{ id: 'a', type: 'backend', label: 'A' }] }, { domain: 'pcn', recordId: 'r-1' }), /không thể render/i);
  assert.equal(removed, true);
  const html = await renderArchifyWorkflowDocument(workflowFixture(), { domain: 'pcn', recordId: 'r-1' });
  assert.match(html, /<html[^>]*data-theme="light"/);
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
  setArchifyRuntimeTestHooks({ spawn: (_file, _args) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; }, statOutput: async () => ({ size: 0 }), readOutput: async () => '<html>' + 'x'.repeat(12 * 1024 * 1024 + 1) + '</html>', remove: async (target) => { removed.push(target); fs.rmSync(target, { recursive: true, force: true }); } });
  await assert.rejects(() => renderArchifyDiagram('architecture', { schema_version: 1, diagram_type: 'architecture', meta: { title: 'A' }, components: [{ id: 'a', type: 'backend', label: 'A' }] }, { domain: 'pcn', recordId: 'r-1' }), /quá lớn/i);
  assert.ok(removed.length >= 3);
});

test('size guard rejects before reading and read failures still clean up', async () => {
  let readCalled = false;
  let removed = false;
  const doc = JSON.parse(fs.readFileSync(new URL('../vendor/archify/archify/examples/web-app.architecture.json', import.meta.url), 'utf8'));
  setArchifyRuntimeTestHooks({
    spawn: (_file, _args, _options) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; },
    statOutput: async () => ({ size: 12 * 1024 * 1024 + 1 }),
    readOutput: async () => { readCalled = true; return ''; },
    remove: async (target) => { removed = true; fs.rmSync(target, { recursive: true, force: true }); },
  });
  await assert.rejects(() => renderArchifyDiagram('architecture', doc, { domain: 'pcn', recordId: 'r-1' }), /quá lớn/i);
  assert.equal(readCalled, false);
  assert.equal(removed, true);
  removed = false;
  setArchifyRuntimeTestHooks({
    spawn: (_file, _args, _options) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; },
    statOutput: async () => ({ size: 1 }),
    readOutput: async () => { throw new Error('read failed C:\\secret'); },
    remove: async (target) => { removed = true; fs.rmSync(target, { recursive: true, force: true }); },
  });
  await assert.rejects(() => renderArchifyDiagram('architecture', doc, { domain: 'pcn', recordId: 'r-1' }), (error: any) => { assert.equal(error.message, 'Archify không thể render biểu đồ.'); return true; });
  assert.equal(removed, true);
  removed = false;
  setArchifyRuntimeTestHooks({
    spawn: (_file, _args, _options) => { const handlers = new Map<string, (...values: any[]) => void>(); const child = { once: (event: string, handler: (...values: any[]) => void) => { handlers.set(event, handler); return child; }, kill: () => {} } as any; queueMicrotask(() => handlers.get('close')?.(0)); return child; },
    statOutput: async () => { throw new Error('stat failed C:\\secret'); },
    remove: async (target) => { removed = true; fs.rmSync(target, { recursive: true, force: true }); },
  });
  await assert.rejects(() => renderArchifyDiagram('architecture', doc, { domain: 'pcn', recordId: 'r-1' }), (error: any) => { assert.equal(error.message, 'Archify không thể render biểu đồ.'); return true; });
  assert.equal(removed, true);
});

test('renderer constants pin all CLI entrypoints and the shared template', () => {
  assert.deepEqual(ARCHIFY_RENDERER_ENTRYPOINTS, {
    architecture: 'renderers/architecture/render-architecture.mjs',
    dataflow: 'renderers/dataflow/render-dataflow.mjs',
    sequence: 'renderers/sequence/render-sequence.mjs',
    lifecycle: 'renderers/lifecycle/render-lifecycle.mjs',
  });
  assert.equal(ARCHIFY_TEMPLATE_ENTRYPOINT, 'assets/template.html');
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
  assert.match(html, /<html lang="en" data-preset="signal-flow" data-theme="light">/);
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

test('authenticated Archify routes select an allowlisted diagram suite member', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(serverSource, /ARCHIFY_DIAGRAM_TYPES/);
  assert.match(serverSource, /parseArchifyDiagramType/);
  assert.match(serverSource, /String\(value \?\? ''\)\.trim\(\)\.toLowerCase\(\) \|\| 'workflow'/);
  assert.match(serverSource, /buildPcnArchifyDiagramSuite/);
  assert.match(serverSource, /buildPgdArchifyDiagramSuite/);
  assert.match(serverSource, /suite\[diagramType\]/);
  assert.match(serverSource, /renderArchifyDiagram\(diagramType/);
  assert.match(serverSource, /res\.type\('html'\)\.set\('Cache-Control', 'private, no-store'\)/);
});

test('Archify diagram parsing defaults missing, empty, and whitespace-only values to workflow', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(serverSource, /const diagram = String\(value \?\? ''\)\.trim\(\)\.toLowerCase\(\) \|\| 'workflow';/);
  for (const value of [undefined, '', '   ']) {
    assert.equal(String(value ?? '').trim().toLowerCase() || 'workflow', 'workflow');
  }
});

test('Archify route errors are bounded and unavailable diagrams skip rendering', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const routeSources = [
    serverSource.slice(serverSource.indexOf("app.get('/api/pcn/dossiers/:dossierId/archify'"), serverSource.indexOf("\n  });", serverSource.indexOf("app.get('/api/pcn/dossiers/:dossierId/archify'")) + 5),
    serverSource.slice(serverSource.indexOf("app.get('/api/pgd/requests/:requestId/archify'"), serverSource.indexOf("\n  });", serverSource.indexOf("app.get('/api/pgd/requests/:requestId/archify'")) + 5),
  ];

  for (const routeSource of routeSources) {
    assert.match(routeSource, /status\(409\)\.json\(\{ error, diagram: diagramType, reason \}\)/);
    assert.match(routeSource, /const unavailable = suite\[diagramType\];/);
    assert.match(routeSource, /if \(unavailable\.available === false\)/);
    assert.doesNotMatch(routeSource, /diagnostics: error\?\.diagnostics/);
    assert.doesNotMatch(routeSource, /error: error\?\.message \|\| String\(error\)/);
  }
});

test('Archify routes order activity logs by the JSON activity timestamp', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(serverSource, /readRows\(PGD_COLLECTIONS\.activityLogs, "data->>'createdAt' ASC, document_id ASC"\)/);
  assert.match(serverSource, /activityLogs' AND \(data->>'entityId' = \$1 OR data->>'requestCode' = \$1\) ORDER BY data->>'createdAt', document_id/);
  assert.doesNotMatch(serverSource, /readRows\(PGD_COLLECTIONS\.activityLogs, ['"]created_at ASC/);
  assert.doesNotMatch(serverSource, /activityLogs' AND \(data->>'entityId' = \$1 OR data->>'requestCode' = \$1\) ORDER BY created_at/);
});

test('final Archify host contract delegates reader controls to upstream HTML', () => {
  const hostSource = fs.readFileSync(new URL('../components/PcnArchifyWorkflowEmbed.tsx', import.meta.url), 'utf8');
  const runtimeSource = fs.readFileSync(new URL('../utils/archifyRuntime.ts', import.meta.url), 'utf8');

  for (const entrypoint of Object.values(ARCHIFY_RENDERER_ENTRYPOINTS)) {
    assert.equal(fs.existsSync(new URL(`../vendor/archify/archify/${entrypoint}`, import.meta.url)), true, entrypoint);
  }
  assert.equal(fs.existsSync(new URL('../vendor/archify/archify/assets/template.html', import.meta.url)), true);
  assert.match(hostSource, /<iframe/);
  assert.doesNotMatch(hostSource, /<svg|<canvas|station-arrow|archify-toolbar|toolbar|zoom-control/i);
  assert.match(runtimeSource, /ARCHIFY_TEMPLATE_ENTRYPOINT/);
  assert.doesNotMatch(runtimeSource, /ARCHIFY_REPO_ROOT|ARCHIFY_EXECUTABLE|process\.env\.(?:ARCHIFY_REPO_ROOT|ARCHIFY_EXECUTABLE)/);
});
