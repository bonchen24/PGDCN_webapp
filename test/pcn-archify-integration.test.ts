import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPcnArchifyWorkflow } from '../utils/pcnArchifyWorkflow.ts';
import { buildPgdArchifyWorkflow } from '../utils/pgdArchifyWorkflow.ts';

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
