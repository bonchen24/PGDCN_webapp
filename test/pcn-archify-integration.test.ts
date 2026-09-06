import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildPcnArchifyWorkflow } from '../utils/pcnArchifyWorkflow.ts';
import { buildPgdArchifyWorkflow } from '../utils/pgdArchifyWorkflow.ts';
import { buildPgdArchifyDiagramSuite } from '../utils/pgdArchifyWorkflow.ts';

const pcnWorkflow = {
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
    { id: 'review', kind: 'APPROVAL_TASK', label: 'Soát xét kỹ thuật', requirementIds: [], active: true, sortOrder: 5 },
    { id: 'end', kind: 'END', label: 'Lưu hồ sơ', requirementIds: [], active: true, sortOrder: 6 },
  ],
  transitions: [
    { id: 't-intake-decision', fromNodeId: 'intake', toNodeId: 'decision', label: 'Đủ thành phần', condition: 'ALWAYS' },
    { id: 't-decision-split', fromNodeId: 'decision', toNodeId: 'split', label: 'Đạt', condition: 'REQUIRED_DOCUMENTS_COMPLETE' },
    { id: 't-split-lab', fromNodeId: 'split', toNodeId: 'lab', label: 'Nhánh PTN', condition: 'ALWAYS' },
    { id: 't-split-field', fromNodeId: 'split', toNodeId: 'field', label: 'Nhánh hiện trường', condition: 'ALWAYS' },
    { id: 't-lab-join', fromNodeId: 'lab', toNodeId: 'join', label: 'KQ PTN', condition: 'ALWAYS' },
    { id: 't-field-join', fromNodeId: 'field', toNodeId: 'join', label: 'Biên bản', condition: 'ALWAYS' },
    { id: 't-join-review', fromNodeId: 'join', toNodeId: 'review', label: 'ALL', condition: 'ALWAYS' },
    { id: 't-review-end', fromNodeId: 'review', toNodeId: 'end', label: 'Đạt', condition: 'ALWAYS' },
    { id: 't-review-decision', fromNodeId: 'review', toNodeId: 'decision', label: 'Trả bổ sung', condition: 'APPROVAL_RETURNED', returnPolicy: 'REWORK' },
  ],
} as const;

const pcnDossier = {
  id: 'dossier-1',
  dossierCode: 'PCN-260906-01',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'TECHNICAL_REVIEW',
  workflowSnapshot: pcnWorkflow,
  documentWaivers: {},
  labRequestIds: [],
  returnedResultIds: [],
} as any;

test('PCN adapter preserves authored graph, parallel branches and return route', async () => {
  const workflowDocument = buildPcnArchifyWorkflow({
    dossier: pcnDossier,
    workflow: pcnWorkflow as any,
    tasks: pcnWorkflow.nodes.map((node, index) => ({
      id: `task-${node.id}`,
      dossierId: pcnDossier.id,
      nodeId: node.id,
      status: index < 2 ? 'COMPLETED' : node.id === 'review' ? 'RETURNED' : 'READY',
      cycleNo: node.id === 'review' ? 2 : 1,
      assignedUsername: 'operator',
      updatedAt: '2026-09-06T00:00:00.000Z',
      updatedBy: 'operator',
    })),
    documents: [
      { id: 'doc-intake', dossierId: pcnDossier.id, requirementId: 'req-intake', fieldCode: 'QC4', versions: [], status: 'PRESENT' },
      { id: 'doc-lab', dossierId: pcnDossier.id, requirementId: 'req-lab', fieldCode: 'QC4', versions: [], status: 'MISSING' },
    ] as any,
    documentWaivers: {},
    results: [],
    approvalSteps: [],
    activityLogs: [],
  });

  assert.equal(workflowDocument.schema_version, 2);
  assert.equal(workflowDocument.diagram_type, 'workflow');
  assert.equal(workflowDocument.nodes.length, pcnWorkflow.nodes.length);
  assert.equal(workflowDocument.edges.length, pcnWorkflow.transitions.length);
  assert.ok(workflowDocument.edges.some((edge) => edge.role === 'return' && edge.from === 'review' && edge.to === 'decision'));
  assert.ok(workflowDocument.nodes.some((node) => node.id === 'lab' && node.lane !== workflowDocument.nodes.find((candidate) => candidate.id === 'field')?.lane));
  assert.ok(workflowDocument.meta.views.every((view) => view.focus.every((id) => workflowDocument.nodes.some((node) => node.id === id))));

  const { compileWorkflow } = await import('../vendor/archify/archify/renderers/workflow/workflow-compiler.mjs');
  const compiled = compileWorkflow({ workflow: workflowDocument, qualityProfile: workflowDocument.meta.quality_profile });
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.match(compiled.svg, /data-node-id="intake"/);
  assert.match(compiled.svg, /data-edge-id="t-review-decision"/);
});

test('PGD adapter projects the same Archify runtime for the second domain', async () => {
  const request = {
    id: 'request-1',
    domain: 'pgd',
    requestCode: 'PGD-260906-01',
    status: 'WAITING_LAB_RESULTS',
    productGroup: 'STEEL_METAL',
    catalogItemId: 'STEEL_LOT_INSPECTION',
    productName: 'Thép cuộn',
    customerSnapshot: { name: 'Công ty mẫu', address: 'Hà Nội' },
    requester: { name: 'Người yêu cầu' },
    intakeChannel: 'DIRECT',
    quantity: 2,
    unit: 'tấn',
    inspectionScope: 'Số lượng, quy cách, phẩm chất',
    inspectionLocation: 'Kho khách hàng',
    standards: ['QCVN 20:2019/BKHCN'],
    sampleIds: ['sample-1'],
    labRequestIds: ['lab-1'],
    documentPointers: [],
    dossierChecklist: [
      { id: 'check-1', requirementCode: 'TECHNICAL_DOSSIER', title: 'Hồ sơ kỹ thuật', required: true, status: 'MISSING', updatedAt: '2026-09-06T00:00:00.000Z' },
    ],
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  } as any;

  const workflowDocument = buildPgdArchifyWorkflow({
    request,
    assignment: undefined,
    fieldInspection: undefined,
    samples: [{ id: 'sample-1', requestId: request.id, disposition: 'LAB', handedOverAt: undefined }] as any,
    labRequests: [{ id: 'lab-1', requestId: request.id, status: 'SENT', resultId: undefined }] as any,
    labResults: [],
    report: undefined,
    certificate: undefined,
    labResultReview: undefined,
    dossierDocuments: [],
    approvals: [],
    activityLogs: [],
  });

  assert.equal(workflowDocument.diagram_type, 'workflow');
  assert.ok(workflowDocument.nodes.some((node) => node.label.includes('Chờ kết quả')));
  assert.ok(workflowDocument.nodes.some((node) => node.label.includes('Hồ sơ kỹ thuật')));
  assert.ok(workflowDocument.edges.length >= 1);

  const { compileWorkflow } = await import('../vendor/archify/archify/renderers/workflow/workflow-compiler.mjs');
  const compiled = compileWorkflow({ workflow: workflowDocument, qualityProfile: workflowDocument.meta.quality_profile });
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
});

test('PGD projections stay PGD-only and add a PTN component only for linked lab facts', () => {
  const request = {
    id: 'request-projection', domain: 'pgd', requestCode: 'PGD-260906-02', status: 'WAITING_LAB_RESULTS', productGroup: 'STEEL_METAL', catalogItemId: 'STEEL_LOT_INSPECTION', productName: 'Thép cuộn', quantity: 1, unit: 'tấn', inspectionScope: 'Số lượng', inspectionLocation: 'Kho khách hàng', standards: [], sampleIds: ['sample-1'], labRequestIds: ['lab-1'], documentPointers: [], dossierChecklist: [], createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  } as any;
  const input = {
    request, samples: [{ id: 'sample-1', domain: 'pgd', requestId: request.id, sampleCode: 'M-1', description: 'Mẫu', quantity: 1, disposition: 'LAB' }],
    labRequests: [{ id: 'lab-1', domain: 'pgd', requestId: request.id, sampleId: 'sample-1', status: 'SENT', laboratoryName: 'PTN A', testItems: ['Chỉ tiêu'] }],
    labResults: [], dossierDocuments: [{ id: 'pgd-doc-1', domain: 'pgd', requestId: request.id, requirementCode: 'REQUEST_PYC', title: 'PYC', fileName: 'pyc.pdf', sourceCollection: 'pgd_dossier_documents', sourceDocumentId: 'src-1', version: 1, checksum: 'x', uploadedByUsername: 'u', uploadedAt: '2026-09-06T00:00:00.000Z' }], approvals: [], activityLogs: [],
  } as any;
  const suite = buildPgdArchifyDiagramSuite(input);
  assert.equal(suite.architecture.available, true);
  if (!suite.architecture.available) return;
  assert.ok(suite.architecture.document.components.some((component) => component.id === 'pgd'));
  assert.ok(suite.architecture.document.components.some((component) => component.label.includes('PTN')));
  assert.equal(suite.dataflow.available, true);
  if (!suite.dataflow.available) return;
  assert.equal(suite.dataflow.document.nodes.some((node) => node.label.includes('PCN')), false);
  assert.ok(suite.dataflow.document.nodes.some((node) => node.label.includes('PGD')));
});

test('PGD projections isolate request facts, avoid catalog topology fabrication, and redact actors', () => {
  const request = { id: 'request-safe', domain: 'pgd', requestCode: 'PGD-260906-03', status: 'WAITING_LAB_RESULTS', productGroup: 'STEEL_METAL', catalogItemId: 'STEEL_LOT_INSPECTION', productName: 'Thép', quantity: 1, unit: 'tấn', inspectionScope: 'Mẫu', inspectionLocation: 'Kho', standards: [], sampleIds: ['sample-safe'], labRequestIds: ['lab-safe'], documentPointers: [], dossierChecklist: [], createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z' } as any;
  const input = {
    request,
    samples: [
      { id: 'sample-safe', domain: 'pgd', requestId: request.id, sampleCode: 'S-1', description: 'Mẫu', quantity: 1, disposition: 'LAB', sampledAt: 'bad-date', sampledByUsername: 'alice@example.com' },
      { id: 'sample-other', domain: 'pgd', requestId: 'other-request', sampleCode: 'OTHER', description: 'Không thuộc hồ sơ', quantity: 1, disposition: 'LAB', sampledAt: '2026-09-06T01:00:00.000Z', sampledByUsername: 'other@example.com' },
    ],
    labRequests: [
      { id: 'lab-safe', domain: 'pgd', requestId: request.id, sampleId: 'missing-sample', status: 'SENT', laboratoryName: 'PTN an toàn', handover: { sentAt: '2026-09-06T02:00:00.000Z', senderUsername: 'bob@example.com', quantity: 1 }, testItems: ['x'] },
      { id: 'lab-other', domain: 'pgd', requestId: 'other-request', sampleId: 'sample-other', status: 'SENT', laboratoryName: 'PTN khác', testItems: ['x'] },
    ],
    labResults: [{ id: 'result-other', domain: 'pgd', requestId: 'other-request', labRequestId: 'lab-other', receivedAt: '2026-09-06T03:00:00.000Z', values: [] }],
    dossierDocuments: [], approvals: [{ id: 'approval-other', domain: 'pgd', requestId: 'other-request', sequence: 1, role: 'TECHNICAL_REVIEW', status: 'APPROVED', actedAt: '2026-09-06T04:00:00.000Z', actedByUsername: 'other@example.com' }],
    activityLogs: [{ id: 'log-other', entityId: 'other-request', createdAt: '2026-09-06T05:00:00.000Z', actorUsername: 'other@example.com', actorName: 'Other', summary: 'secret other request' }],
  } as any;
  const suite = buildPgdArchifyDiagramSuite(input);
  assert.equal(suite.lifecycle.available, true);
  if (!suite.lifecycle.available) return;
  assert.equal(suite.lifecycle.document.transitions.length, 0);
  assert.equal(suite.sequence.available, true);
  if (!suite.sequence.available) return;
  assert.ok(suite.sequence.document.participants.every((participant) => !participant.label.includes('@')));
  assert.ok(suite.sequence.document.messages.every((message) => !message.label.includes('secret other')));
  assert.equal(suite.dataflow.available, false);
  assert.equal(suite.architecture.available, true);
  if (!suite.architecture.available) return;
  assert.equal(suite.architecture.document.components.some((component) => component.label.includes('PTN')), false);
});

test('PGD sequence remains unavailable when only invalid timestamps or missing actors exist', () => {
  const input = { request: { id: 'request-invalid', requestCode: 'PGD-260906-04', status: 'DRAFT' }, samples: [{ id: 'sample-invalid', requestId: 'request-invalid', sampleCode: 'S', disposition: 'LAB', sampledAt: 'not-a-date' }], labRequests: [], labResults: [], dossierDocuments: [], approvals: [], activityLogs: [{ id: 'log-invalid', entityId: 'request-invalid', createdAt: 'also-invalid', summary: 'x' }] } as any;
  const suite = buildPgdArchifyDiagramSuite(input);
  assert.equal(suite.sequence.available, false);
});

test('PGD available lifecycle and sequence documents match pinned schema envelopes', () => {
  const request = { id: 'request-schema-pgd', requestCode: 'PGD-260906-05', status: 'WAITING_LAB_RESULTS', productGroup: 'STEEL_METAL', catalogItemId: 'STEEL_LOT_INSPECTION', productName: 'Thép', quantity: 1, unit: 'tấn', inspectionScope: 'Mẫu', inspectionLocation: 'Kho', standards: [], sampleIds: [], labRequestIds: [], documentPointers: [], dossierChecklist: [], createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z' } as any;
  const suite = buildPgdArchifyDiagramSuite({ request, samples: [], labRequests: [], labResults: [], dossierDocuments: [], approvals: [], activityLogs: [{ id: 'pgd-schema-log', entityId: request.id, createdAt: '2026-09-06T01:00:00.000Z', actorUsername: 'safe', actorName: 'Safe', action: 'UPDATED', summary: 'private summary' }] } as any);
  for (const type of ['lifecycle', 'sequence']) {
    const schema = JSON.parse(readFileSync(resolve('vendor/archify/archify/schemas', `${type}.schema.json`), 'utf8')) as { required: string[] };
    const result = type === 'lifecycle' ? suite.lifecycle : suite.sequence;
    assert.equal(result.available, true);
    if (result.available) for (const key of schema.required) assert.ok(key in result.document, `${type} missing ${key}`);
  }
  assert.equal(suite.sequence.available, true);
  if (suite.sequence.available) assert.ok(suite.sequence.document.participants.every((participant) => !participant.label.includes('safe')));
});
