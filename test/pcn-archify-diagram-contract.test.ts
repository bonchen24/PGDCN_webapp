import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ARCHIFY_DIAGRAM_TYPES,
  archifyStableId,
} from '../utils/archifyDiagram.ts';
import {
  buildPcnArchifyDiagramSuite,
  type PcnArchifyWorkflowInput,
} from '../utils/pcnArchifyWorkflow.ts';
import {
  buildPgdArchifyDiagramSuite,
  type PgdArchifyWorkflowInput,
} from '../utils/pgdArchifyWorkflow.ts';

function assertSemanticReferences(document: any, nodeKey: 'nodes' | 'states' | 'participants' | 'components') {
  const ids = new Set((document[nodeKey] || []).map((node: any) => node.id));
  for (const relation of [...(document.edges || []), ...(document.flows || []), ...(document.connections || []), ...(document.transitions || []), ...(document.messages || [])]) {
    if (relation.from) assert.ok(ids.has(relation.from), `missing source ${relation.from}`);
    if (relation.to) assert.ok(ids.has(relation.to), `missing target ${relation.to}`);
  }
  for (const view of document.meta.views || []) for (const id of view.focus) assert.ok(ids.has(id), `missing focus ${id}`);
}

type JsonSchema = Record<string, any>;
function assertStrictSchema(type: string, document: unknown): void {
  const schemaRoot = resolve('vendor/archify/archify/schemas');
  const schema = JSON.parse(readFileSync(resolve(schemaRoot, `${type}.schema.json`), 'utf8')) as JsonSchema;
  const common = JSON.parse(readFileSync(resolve(schemaRoot, 'common.schema.json'), 'utf8')) as JsonSchema;
  const errors: string[] = [];
  const check = (value: any, rawSchema: JsonSchema | false, path: string) => {
    if (rawSchema === false) { errors.push(`${path}: value is not allowed`); return; }
    if (rawSchema.$ref) {
      const ref = String(rawSchema.$ref);
      check(value, ref.includes('common.schema.json') || ref.startsWith('#/$defs/') ? common.$defs[ref.split('/').pop()!] : schema, path);
      return;
    }
    if (rawSchema.const !== undefined && value !== rawSchema.const) errors.push(`${path}: expected constant ${String(rawSchema.const)}`);
    if (rawSchema.enum && !rawSchema.enum.includes(value)) errors.push(`${path}: unexpected enum value`);
    if (rawSchema.oneOf || rawSchema.anyOf) {
      const choices = rawSchema.oneOf || rawSchema.anyOf;
      const matches = choices.filter((choice: JsonSchema) => { const before = errors.length; check(value, choice, path); const matched = errors.length === before; errors.splice(before); return matched; });
      if (matches.length !== 1 && rawSchema.oneOf || matches.length === 0 && rawSchema.anyOf) errors.push(`${path}: schema union did not match`);
      return;
    }
    if (rawSchema.type === 'object') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${path}: expected object`); return; }
      for (const required of rawSchema.required || []) if (!(required in value)) errors.push(`${path}.${required}: required`);
      if (rawSchema.additionalProperties === false) for (const key of Object.keys(value)) if (!rawSchema.properties?.[key]) errors.push(`${path}.${key}: additional property`);
      for (const [key, child] of Object.entries(rawSchema.properties || {})) if (key in value) check(value[key], child as JsonSchema, `${path}.${key}`);
      if (rawSchema.minProperties !== undefined && Object.keys(value).length < rawSchema.minProperties) errors.push(`${path}: too few properties`);
      return;
    }
    if (rawSchema.type === 'array') {
      if (!Array.isArray(value)) { errors.push(`${path}: expected array`); return; }
      if (rawSchema.minItems !== undefined && value.length < rawSchema.minItems) errors.push(`${path}: too few items`);
      if (rawSchema.maxItems !== undefined && value.length > rawSchema.maxItems) errors.push(`${path}: too many items`);
      for (const [index, child] of (rawSchema.prefixItems || []).entries()) if (index < value.length) check(value[index], child, `${path}[${index}]`);
      if (rawSchema.items && rawSchema.items !== false) for (let index = rawSchema.prefixItems?.length || 0; index < value.length; index += 1) check(value[index], rawSchema.items, `${path}[${index}]`);
      return;
    }
    if (rawSchema.type === 'string') {
      if (typeof value !== 'string') { errors.push(`${path}: expected string`); return; }
      if (rawSchema.minLength !== undefined && value.length < rawSchema.minLength) errors.push(`${path}: too short`);
      if (rawSchema.maxLength !== undefined && value.length > rawSchema.maxLength) errors.push(`${path}: too long`);
      if (rawSchema.pattern && !(new RegExp(rawSchema.pattern).test(value))) errors.push(`${path}: pattern mismatch`);
      return;
    }
    if (rawSchema.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${path}: expected finite number`);
    if (rawSchema.type === 'integer' && !Number.isInteger(value)) errors.push(`${path}: expected integer`);
    if (rawSchema.minimum !== undefined && value < rawSchema.minimum) errors.push(`${path}: below minimum`);
    if (rawSchema.exclusiveMinimum !== undefined && value <= rawSchema.exclusiveMinimum) errors.push(`${path}: below exclusive minimum`);
  };
  check(document, schema, '$');
  assert.deepEqual(errors, [], `${type} strict schema errors: ${errors.join('; ')}`);
}

const workflow = {
  templateCode: 'PCN-CUSTOM',
  templateVersion: 4,
  capturedAt: '2026-09-06T00:00:00.000Z',
  capturedBy: 'admin',
  nodes: [
    { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận hồ sơ', requirementIds: ['req-intake'], active: true, sortOrder: 0 },
    { id: 'decision', kind: 'DECISION', label: 'Kiểm tra điều kiện', requirementIds: [], active: true, sortOrder: 1 },
    { id: 'split', kind: 'PARALLEL_SPLIT', label: 'Tách xử lý', requirementIds: [], active: true, sortOrder: 2 },
    { id: 'lab', kind: 'DOCUMENT_TASK', label: 'Xử lý phòng thử', requirementIds: ['req-lab'], active: true, sortOrder: 3 },
    { id: 'field', kind: 'DOCUMENT_TASK', label: 'Đánh giá hiện trường', requirementIds: ['req-field'], active: true, sortOrder: 3 },
    { id: 'join', kind: 'PARALLEL_JOIN', label: 'Gom kết quả', requirementIds: [], joinPolicy: 'ALL', active: true, sortOrder: 4 },
    { id: 'return', kind: 'DOCUMENT_TASK', label: 'Xử lý trả lại', requirementIds: [], active: true, sortOrder: 5 },
    { id: 'end', kind: 'END', label: 'Lưu hồ sơ', requirementIds: [], active: true, sortOrder: 6 },
  ],
  transitions: [
    { id: 't-intake-decision', fromNodeId: 'intake', toNodeId: 'decision', label: 'Đủ thành phần', condition: 'ALWAYS' },
    { id: 't-decision-split', fromNodeId: 'decision', toNodeId: 'split', label: 'Đạt', condition: 'REQUIRED_DOCUMENTS_COMPLETE' },
    { id: 't-split-lab', fromNodeId: 'split', toNodeId: 'lab', label: 'Nhánh PTN', condition: 'ALWAYS' },
    { id: 't-split-field', fromNodeId: 'split', toNodeId: 'field', label: 'Nhánh hiện trường', condition: 'ALWAYS' },
    { id: 't-lab-join', fromNodeId: 'lab', toNodeId: 'join', label: 'KQ PTN', condition: 'ALWAYS' },
    { id: 't-field-join', fromNodeId: 'field', toNodeId: 'join', label: 'Biên bản', condition: 'ALWAYS' },
    { id: 't-join-return', fromNodeId: 'join', toNodeId: 'return', label: 'Cần xử lý', condition: 'ALWAYS' },
    { id: 't-return-end', fromNodeId: 'return', toNodeId: 'end', label: 'Hoàn tất', condition: 'ALWAYS' },
  ],
} as const;

const fixture = {
  dossier: {
    id: 'dossier-contract',
    dossierCode: 'PCN-260906-CONTRACT',
    proposalId: 'proposal-contract',
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
    status: 'TECHNICAL_REVIEW',
    workflowSnapshot: workflow,
    documentWaivers: {},
    labRequestIds: [],
    returnedResultIds: [],
  },
  workflow,
  tasks: workflow.nodes.map((node, index) => ({
    id: `task-${node.id}`,
    dossierId: 'dossier-contract',
    nodeId: node.id,
    status: index < 2 ? 'COMPLETED' : 'READY',
    cycleNo: 1,
    updatedAt: '2026-09-06T00:00:00.000Z',
    updatedBy: 'operator',
  })),
  documents: [
    { id: 'doc-intake', dossierId: 'dossier-contract', requirementId: 'req-intake', fieldCode: 'QC4', versions: [], status: 'PRESENT' },
    { id: 'doc-lab', dossierId: 'dossier-contract', requirementId: 'req-lab', fieldCode: 'QC4', versions: [], status: 'MISSING' },
  ],
  documentWaivers: {},
  results: [],
  approvalSteps: [],
  activityLogs: [],
} as unknown as PcnArchifyWorkflowInput;

test('PCN diagram suite exposes the workflow and explicit unavailable five-view contracts', () => {
  const suite = buildPcnArchifyDiagramSuite(fixture);

  assert.deepEqual(ARCHIFY_DIAGRAM_TYPES, ['workflow', 'lifecycle', 'dataflow', 'sequence', 'architecture']);
  assert.equal(suite.workflow.diagram_type, 'workflow');
  assert.equal(suite.lifecycle.available, true);
  assert.equal(suite.architecture.available, true);
  assert.equal(suite.dataflow.available, true);
  assert.equal(suite.sequence.available, false);
  assert.deepEqual(
    [suite.lifecycle, suite.dataflow, suite.sequence, suite.architecture].map((view) => view.diagramType),
    ['lifecycle', 'dataflow', 'sequence', 'architecture'],
  );
  for (const view of [suite.lifecycle, suite.dataflow, suite.sequence, suite.architecture]) {
    if (!view.available) assert.doesNotMatch((view as { reason: string }).reason, /Task 1/);
  }
});

test('final Archify capability contract keeps all five views explicit for both domains', () => {
  assert.deepEqual(Object.keys(buildPcnArchifyDiagramSuite(fixture)), [...ARCHIFY_DIAGRAM_TYPES]);

  const request = {
    id: 'request-final-contract', domain: 'pgd', requestCode: 'PGD-260906-FINAL', status: 'DRAFT',
    productGroup: 'STEEL_METAL', catalogItemId: 'STEEL_LOT_INSPECTION', productName: 'Thép', quantity: 1,
    unit: 'tấn', inspectionScope: 'Mẫu', inspectionLocation: 'Kho', standards: [], sampleIds: [],
    labRequestIds: [], documentPointers: [], dossierChecklist: [], createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  } as any;
  const pgdSuite = buildPgdArchifyDiagramSuite({ request, samples: [], labRequests: [], labResults: [], dossierDocuments: [], approvals: [], activityLogs: [] } as any);
  assert.deepEqual(Object.keys(pgdSuite), [...ARCHIFY_DIAGRAM_TYPES]);
  for (const type of ARCHIFY_DIAGRAM_TYPES) assert.equal(type === 'workflow' ? pgdSuite[type].diagram_type : pgdSuite[type].diagramType, type);
});

test('PGD diagram suite exposes the same five-view contract without mixing PCN fields', () => {
  const request = {
    id: 'request-contract',
    domain: 'pgd',
    requestCode: 'PGD-260906-CONTRACT',
    status: 'CAPABILITY_REVIEW' as const,
    productGroup: 'STEEL_METAL' as const,
    catalogItemId: 'STEEL_LOT_INSPECTION',
    productName: 'Thép cuộn',
    quantity: 1,
    unit: 'tấn',
    inspectionScope: 'Số lượng',
    inspectionLocation: 'Kho khách hàng',
    standards: [],
    sampleIds: [],
    labRequestIds: [],
    documentPointers: [],
    dossierChecklist: [],
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  };
  const pgdInput: PgdArchifyWorkflowInput = {
    request: {
      ...request,
      intakeChannel: 'DIRECT',
      requester: { name: 'Người yêu cầu' },
      customerSnapshot: { name: 'Công ty mẫu', address: 'Hà Nội' },
      domain: 'pgd',
      documentPointers: [],
    },
    samples: [],
    labRequests: [],
    labResults: [],
    dossierDocuments: [],
    approvals: [],
    activityLogs: [],
  };
  const suite = buildPgdArchifyDiagramSuite(pgdInput);

  assert.equal(suite.workflow.diagram_type, 'workflow');
  assert.deepEqual(
    [suite.lifecycle.diagramType, suite.dataflow.diagramType, suite.sequence.diagramType, suite.architecture.diagramType],
    ['lifecycle', 'dataflow', 'sequence', 'architecture'],
  );
  assert.equal(suite.lifecycle.available, true);
  assert.equal(suite.dataflow.available, false);
  assert.equal(suite.sequence.available, false);
  assert.equal(suite.architecture.available, true);
});

test('sequence stays unavailable without activity events and does not fabricate a message', () => {
  const suite = buildPcnArchifyDiagramSuite(fixture);

  assert.equal(suite.sequence.available, false);
  assert.match(suite.sequence.reason, /Không có|chưa có/i);
  assert.doesNotMatch(suite.sequence.reason, /đã ghi nhận|đã phát sinh|thành công/i);
  assert.equal('document' in suite.sequence, false);
});

test('stable IDs normalize conservatively and remain deterministic', () => {
  assert.equal(archifyStableId('edge', ' return / review '), 'edge-return-review');
  assert.equal(archifyStableId('node', '123'), 'node-123');
  assert.equal(archifyStableId('node', 'A/B'), 'node-a-b');
  assert.equal(archifyStableId('node', 'A/B'), archifyStableId('node', 'A/B'));
});

test('stable IDs disambiguate distinct Unicode source IDs', () => {
  const first = archifyStableId('node', '申請');
  const second = archifyStableId('node', '審査');

  assert.notEqual(first, second);
  assert.equal(first, archifyStableId('node', '申請'));
  assert.equal(second, archifyStableId('node', '審査'));
});

test('stable IDs disambiguate Unicode IDs from crafted ASCII encodings', () => {
  const unicode = archifyStableId('node', '申請');
  const craftedAscii = archifyStableId('node', 'unknown-u7533x8acb');

  assert.notEqual(unicode, craftedAscii);
});

test('PCN fact-backed projections expose current lifecycle, linked dataflow, ordered sequence, and architecture', () => {
  const rich = {
    ...fixture,
    dossier: { ...fixture.dossier, status: 'TECHNICAL_REVIEW', returnedResultIds: ['result-1'] },
    workflow: {
      ...workflow,
      nodes: [...workflow.nodes, { id: 'technical-review', kind: 'APPROVAL_TASK', label: 'Soát xét kỹ thuật', requirementIds: ['req-intake'], active: true, sortOrder: 5 }],
    },
    tasks: [
      ...fixture.tasks,
      { id: 'task-technical-review', dossierId: 'dossier-contract', nodeId: 'technical-review', status: 'IN_PROGRESS', cycleNo: 1, updatedAt: '2026-09-06T01:00:00.000Z', updatedBy: 'reviewer' },
    ],
    documents: [{ ...fixture.documents[0], status: 'PRESENT' }, { ...fixture.documents[1], status: 'PRESENT', updatedAt: '2026-09-06T02:00:00.000Z' }],
    results: [{ id: 'result-1', dossierId: 'dossier-contract', labRequestId: 'lab-request-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T03:00:00.000Z' }],
    approvalSteps: [{ id: 'approval-1', dossierId: 'dossier-contract', sequence: 1, role: 'TECHNICAL_REVIEW', status: 'APPROVED', actedAt: '2026-09-06T04:00:00.000Z' }],
    activityLogs: [
      { id: 'activity-z', createdAt: '2026-09-06T00:30:00.000Z', actorName: 'Operator', actorUsername: 'operator', action: 'UPDATED', entityType: 'PCN_DOSSIER', entityId: 'dossier-contract', summary: 'Cập nhật hồ sơ', source: 'UI' },
      { id: 'activity-a', createdAt: '2026-09-06T00:30:00.000Z', actorName: 'Reviewer', actorUsername: 'reviewer', action: 'UPDATED', entityType: 'PCN_DOSSIER', entityId: 'dossier-contract', summary: 'Soát xét hồ sơ', source: 'UI' },
    ],
  } as unknown as PcnArchifyWorkflowInput;
  const suite = buildPcnArchifyDiagramSuite(rich);
  assert.equal(suite.lifecycle.available, true);
  if (!suite.lifecycle.available) return;
  assert.equal(suite.lifecycle.document.states.find((state) => state.tag === 'Hiện tại')?.id, 'pcn-technical-review');
  assert.equal(suite.dataflow.available, true);
  if (!suite.dataflow.available) return;
  assert.ok(suite.dataflow.document.flows.some((flow) => flow.label.includes('tài liệu')));
  assertSemanticReferences(suite.dataflow.document, 'nodes');
  assert.equal(suite.sequence.available, true);
  if (!suite.sequence.available) return;
  assert.ok(suite.sequence.document.messages.every((message) => message.id));
  assert.ok(suite.sequence.document.participants.every((participant) => !participant.label.includes('@')));
  assert.ok(suite.sequence.document.messages.every((message) => !message.label.includes('Cập nhật hồ sơ')));
  assert.deepEqual(suite.sequence.document.messages.slice(0, 2).map((message) => message.id), ['message-activity-a', 'message-activity-z']);
  assertSemanticReferences(suite.sequence.document, 'participants');
  assert.equal(suite.architecture.available, true);
  if (!suite.architecture.available) return;
  assert.ok(suite.architecture.document.components.some((component) => component.id === 'pcn'));
  assert.equal(suite.architecture.document.components.some((component) => component.label.includes('PTN')), false);
  assertSemanticReferences(suite.architecture.document, 'components');
});

test('available projections retain the pinned Archify v1 schema envelope and required collections', () => {
  const schemaRoot = resolve('vendor/archify/archify/schemas');
  const requiredByType: Record<string, string[]> = {};
  for (const type of ['lifecycle', 'dataflow', 'sequence', 'architecture']) {
    const schema = JSON.parse(readFileSync(resolve(schemaRoot, `${type}.schema.json`), 'utf8')) as { required: string[]; properties: Record<string, { const?: unknown }> };
    requiredByType[type] = schema.required;
    assert.equal(schema.properties.schema_version.const, 1);
    assert.equal(schema.properties.diagram_type.const, type);
  }
  const rich = { ...fixture, dossier: { ...fixture.dossier, returnedResultIds: ['result-schema'] }, results: [{ id: 'result-schema', dossierId: 'dossier-contract', labRequestId: 'lab-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T03:00:00.000Z' }], activityLogs: [{ id: 'schema-activity', createdAt: '2026-09-06T04:00:00.000Z', actorName: 'Actor', actorUsername: 'actor', action: 'UPDATED', entityType: 'PCN_DOSSIER', entityId: 'dossier-contract', summary: 'private', source: 'UI' }] } as unknown as PcnArchifyWorkflowInput;
  const suite = buildPcnArchifyDiagramSuite(rich);
  for (const [type, result] of Object.entries({ lifecycle: suite.lifecycle, dataflow: suite.dataflow, sequence: suite.sequence, architecture: suite.architecture })) {
    assert.equal(result.available, true);
    if (result.available) for (const key of requiredByType[type]) assert.ok(key in result.document, `${type} missing ${key}`);
    if (result.available) assertStrictSchema(type, result.document);
  }
});

test('PGD lifecycle, dataflow, sequence, and architecture pass strict pinned-schema validation', () => {
  const request = { id: 'request-strict-pgd', domain: 'pgd', requestCode: 'PGD-260906-07', status: 'WAITING_LAB_RESULTS', productGroup: 'STEEL_METAL', catalogItemId: 'STEEL_LOT_INSPECTION', productName: 'Thép', quantity: 1, unit: 'tấn', inspectionScope: 'Mẫu', inspectionLocation: 'Kho', standards: [], sampleIds: ['sample-strict'], labRequestIds: ['lab-strict'], documentPointers: [], dossierChecklist: [], createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z' } as any;
  const suite = buildPgdArchifyDiagramSuite({ request, samples: [{ id: 'sample-strict', domain: 'pgd', requestId: request.id, sampleCode: 'S', description: 'Mẫu', quantity: 1, disposition: 'LAB' }], labRequests: [{ id: 'lab-strict', domain: 'pgd', requestId: request.id, sampleId: 'sample-strict', status: 'SENT', laboratoryName: 'PTN', testItems: ['x'] }], labResults: [{ id: 'result-strict', domain: 'pgd', requestId: request.id, labRequestId: 'lab-strict', receivedAt: '2026-09-06T02:00:00.000Z', values: [] }], dossierDocuments: [{ id: 'doc-strict', domain: 'pgd', requestId: request.id, requirementCode: 'REQUEST_PYC', title: 'PYC', fileName: 'pyc.pdf', sourceCollection: 'pgd_dossier_documents', sourceDocumentId: 'src', version: 1, checksum: 'x', uploadedByUsername: 'u', uploadedAt: '2026-09-06T00:00:00.000Z' }], approvals: [], activityLogs: [{ id: 'log-strict', entityId: request.id, createdAt: '2026-09-06T03:00:00.000Z', actorUsername: 'actor', actorName: 'Actor', action: 'UPDATED', summary: 'private' }] } as any);
  for (const [type, result] of Object.entries({ lifecycle: suite.lifecycle, dataflow: suite.dataflow, sequence: suite.sequence, architecture: suite.architecture })) {
    assert.equal(result.available, true);
    if (result.available) assertStrictSchema(type, result.document);
  }
});

test('PCN projections do not infer current state or result-to-approval edges', () => {
  const rich = {
    ...fixture,
    dossier: { ...fixture.dossier, labRequestIds: ['lab-dangling'] },
    tasks: fixture.tasks.map((task) => ({ ...task, status: 'READY' })),
    results: [
      { id: 'result-a', dossierId: 'dossier-contract', labRequestId: 'lab-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T03:00:00.000Z' },
      { id: 'result-b', dossierId: 'dossier-contract', labRequestId: 'lab-1', round: 2, outcome: 'PASS', receivedAt: '2026-09-06T03:01:00.000Z' },
    ],
    approvalSteps: [
      { id: 'approval-a', dossierId: 'dossier-contract', sequence: 1, role: 'TECHNICAL_REVIEW', status: 'APPROVED', actedAt: '2026-09-06T04:00:00.000Z' },
      { id: 'approval-b', dossierId: 'dossier-contract', sequence: 2, role: 'LEADERSHIP_APPROVAL', status: 'PENDING' },
    ],
  } as unknown as PcnArchifyWorkflowInput;
  const suite = buildPcnArchifyDiagramSuite(rich);
  assert.equal(suite.lifecycle.available, true);
  if (!suite.lifecycle.available) return;
  assert.equal(suite.lifecycle.document.states.some((state) => state.tag === 'Hiện tại'), false);
  assert.equal(suite.architecture.available, true);
  if (!suite.architecture.available) return;
  assert.equal(suite.architecture.document.components.some((component) => component.id === 'ptn'), false);
  assert.equal(suite.dataflow.available, true);
  if (!suite.dataflow.available) return;
  assert.equal(suite.dataflow.document.flows.some((flow) => flow.from.startsWith('result-') && flow.to.startsWith('approval-')), false);
});

test('PCN dataflow excludes results absent from persisted returnedResultIds', () => {
  const input = {
    ...fixture,
    dossier: { ...fixture.dossier, returnedResultIds: [] },
    results: [{ id: 'result-unpointed', dossierId: 'dossier-contract', labRequestId: 'lab-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T03:00:00.000Z' }],
    approvalSteps: [],
  } as unknown as PcnArchifyWorkflowInput;
  const suite = buildPcnArchifyDiagramSuite(input);
  assert.equal(suite.dataflow.available, true);
  if (!suite.dataflow.available) return;
  assert.equal(suite.dataflow.document.nodes.some((node) => node.id === 'result-result-unpointed'), false);
});

test('PCN approval-only dataflow is unavailable instead of exposing disconnected approvals', () => {
  const input = {
    ...fixture,
    documents: [],
    results: [],
    approvalSteps: [{ id: 'approval-only', dossierId: 'dossier-contract', sequence: 1, role: 'TECHNICAL_REVIEW', status: 'APPROVED', actedAt: '2026-09-06T04:00:00.000Z' }],
  } as unknown as PcnArchifyWorkflowInput;
  const suite = buildPcnArchifyDiagramSuite(input);
  assert.equal(suite.dataflow.available, false);
});

test('PCN sequence pseudonyms are non-PII and deterministically tied to actor evidence', () => {
  const input = {
    ...fixture,
    tasks: [{ id: 'task-actor', dossierId: 'dossier-contract', nodeId: 'intake', status: 'COMPLETED', cycleNo: 1, startedAt: '2026-09-06T01:00:00.000Z', updatedAt: '2026-09-06T01:00:00.000Z', updatedBy: 'alice@example.com' }],
    activityLogs: [],
  } as unknown as PcnArchifyWorkflowInput;
  const first = buildPcnArchifyDiagramSuite(input).sequence;
  const second = buildPcnArchifyDiagramSuite(input).sequence;
  assert.equal(first.available, true);
  assert.equal(second.available, true);
  if (!first.available || !second.available) return;
  assert.deepEqual(first.document.participants, second.document.participants);
  assert.ok(first.document.participants.every((participant) => !participant.label.includes('alice@example.com')));
  assert.ok(first.document.participants.some((participant) => participant.label.startsWith('pcn-actor-')));
});
