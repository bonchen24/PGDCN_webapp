import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARCHIFY_DIAGRAM_TYPES,
  archifyStableId,
} from '../utils/archifyDiagram.ts';
import {
  buildPcnArchifyDiagramSuite,
  type PcnArchifyWorkflowInput,
} from '../utils/pcnArchifyWorkflow.ts';
import { buildPgdArchifyDiagramSuite } from '../utils/pgdArchifyWorkflow.ts';

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
  assert.equal(suite.lifecycle.available, false);
  assert.equal(suite.architecture.available, false);
  assert.equal(suite.dataflow.available, false);
  assert.equal(suite.sequence.available, false);
  assert.deepEqual(
    [suite.lifecycle, suite.dataflow, suite.sequence, suite.architecture].map((view) => view.diagramType),
    ['lifecycle', 'dataflow', 'sequence', 'architecture'],
  );
  for (const view of [suite.lifecycle, suite.dataflow, suite.sequence, suite.architecture]) {
    assert.doesNotMatch(view.reason, /Task 1/);
  }
});

test('PGD diagram suite exposes the same five-view contract without mixing PCN fields', () => {
  const request = {
    id: 'request-contract',
    domain: 'pgd',
    requestCode: 'PGD-260906-CONTRACT',
    status: 'INTAKE_REVIEW',
    productGroup: 'STEEL_METAL',
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
  const suite = buildPgdArchifyDiagramSuite({
    request,
    samples: [],
    labRequests: [],
    labResults: [],
    dossierDocuments: [],
    approvals: [],
    activityLogs: [],
  } as any);

  assert.equal(suite.workflow.diagram_type, 'workflow');
  assert.deepEqual(
    [suite.lifecycle.diagramType, suite.dataflow.diagramType, suite.sequence.diagramType, suite.architecture.diagramType],
    ['lifecycle', 'dataflow', 'sequence', 'architecture'],
  );
  assert.equal(suite.sequence.available, false);
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
