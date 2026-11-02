import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PcnDossierNodeWorkPanel from '../components/PcnDossierNodeWorkPanel';
import type {
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDocumentRequirement,
  PcnWorkflowNodeDefinition,
} from '../types.ts';
import {
  buildPcnDossierNodeBusinessFacts,
  buildPcnDossierNodeWorkProjection,
  type PcnDossierNodeBusinessFact,
} from '../utils/pcnDossierNodeWork.ts';
import type { PcnWorkflowRuntimeNode } from '../utils/pcnWorkflowRuntime.ts';

function requirement(id: string, code: string, required: boolean): PcnDocumentRequirement {
  return { id, fieldCode: 'QC4', code, name: code, required, active: true, sortOrder: 1, stages: [] };
}

function node(overrides: Partial<PcnWorkflowNodeDefinition> = {}): PcnWorkflowNodeDefinition {
  return {
    id: 'sampling',
    kind: 'DOCUMENT_TASK',
    label: 'Lấy mẫu',
    actionKey: 'SAMPLING_LAB',
    requirementIds: ['req-present', 'req-missing', 'req-optional'],
    active: true,
    sortOrder: 10,
    ...overrides,
  };
}

function runtimeNode(overrides: Partial<PcnWorkflowRuntimeNode> = {}): PcnWorkflowRuntimeNode {
  return {
    id: 'sampling',
    kind: 'DOCUMENT_TASK',
    label: 'Lấy mẫu',
    actionKey: 'SAMPLING_LAB',
    requirementIds: ['req-present', 'req-missing', 'req-optional'],
    status: 'IN_PROGRESS',
    cycleNo: 1,
    isActive: true,
    ...overrides,
  };
}

function document(requirementId: string, status: PcnDossierDocument['status']): PcnDossierDocument {
  return { id: `doc-${requirementId}`, dossierId: 'dossier-1', requirementId, fieldCode: 'QC4', status, versions: [] };
}

function businessFact(overrides: Partial<PcnDossierNodeBusinessFact> = {}): PcnDossierNodeBusinessFact {
  return { id: 'sample-route', label: 'Tuyến mẫu / PYC', status: 'COMPLETED', actionLabel: 'Mở sổ mẫu', ...overrides };
}

test('node projection keeps only node requirements and exposes source-aware actions', () => {
  const projection = buildPcnDossierNodeWorkProjection({
    node: node(),
    runtimeNode: runtimeNode(),
    requirements: [
      requirement('req-present', 'SAMPLE_HANDOVER', true),
      requirement('req-missing', 'LAB_REQUEST', true),
      requirement('req-optional', 'SAMPLE_RETURN', false),
      requirement('unrelated', 'CERTIFICATE', true),
    ],
    documents: [document('req-present', 'PRESENT')],
    businessFacts: [businessFact()],
  });

  assert.deepEqual(projection.documents.map((item) => item.requirementId), ['req-present', 'req-missing', 'req-optional']);
  assert.equal(projection.documents.find((item) => item.requirementId === 'req-present')?.status, 'PRESENT');
  assert.deepEqual(projection.documents.find((item) => item.requirementId === 'req-present')?.actions, ['VIEW', 'REPLACE', 'REMOVE_CURRENT']);
  assert.deepEqual(projection.documents.find((item) => item.requirementId === 'req-missing')?.actions, ['UPLOAD', 'CREATE_FROM_FORM', 'WAIVE']);
  assert.equal(projection.documents.find((item) => item.requirementId === 'req-optional')?.required, false);
  assert.equal(projection.businessFacts[0]?.status, 'COMPLETED');
  assert.equal(projection.canContinue, false);
  assert.match(projection.suggestions.join(' '), /LAB_REQUEST/);
});

test('valid waiver resolves a required missing document while optional gaps do not block continuation', () => {
  const waivers: Record<string, PcnDossierDocumentWaiver> = {
    'req-missing': { requirementId: 'req-missing', reason: 'PTN bổ sung sau', decidedAt: '2026-09-06T00:00:00.000Z', decidedBy: 'leader' },
  };
  const projection = buildPcnDossierNodeWorkProjection({
    node: node(),
    runtimeNode: runtimeNode(),
    requirements: [requirement('req-present', 'SAMPLE_HANDOVER', true), requirement('req-missing', 'LAB_REQUEST', true), requirement('req-optional', 'SAMPLE_RETURN', false)],
    documents: [document('req-present', 'PRESENT')],
    documentWaivers: waivers,
    businessFacts: [businessFact()],
  });

  assert.equal(projection.documents.find((item) => item.requirementId === 'req-missing')?.status, 'WAIVED');
  assert.equal(projection.documents.find((item) => item.requirementId === 'req-optional')?.status, 'MISSING');
  assert.equal(projection.canContinue, true);
  assert.equal(projection.unresolvedRequiredCount, 0);
});

test('incomplete business evidence blocks continuation and gives the matching action suggestion', () => {
  const projection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: [] }),
    runtimeNode: runtimeNode({ requirementIds: [] }),
    requirements: [],
    businessFacts: [businessFact({ id: 'result', label: 'KQTN', status: 'ATTENTION', actionLabel: 'Tiếp nhận KQTN', reason: 'Chưa có KQTN chính thức' })],
  });

  assert.equal(projection.canContinue, false);
  assert.equal(projection.businessFacts[0]?.status, 'ATTENTION');
  assert.match(projection.suggestions.join(' '), /Tiếp nhận KQTN/);
});

test('completed node remains editable but mutations require a rework cycle', () => {
  const projection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: ['req-present'] }),
    runtimeNode: runtimeNode({ status: 'COMPLETED', isActive: false, cycleNo: 3 }),
    requirements: [requirement('req-present', 'SAMPLE_HANDOVER', true)],
    documents: [document('req-present', 'PRESENT')],
  });

  assert.equal(projection.isEditable, true);
  assert.equal(projection.requiresReworkOnMutation, true);
  assert.equal(projection.cycleNo, 3);
});

test('business work facts are derived from stored approval and result evidence', () => {
  const pendingApproval = buildPcnDossierNodeBusinessFacts({ actionKey: 'APPROVAL', dossierId: 'dossier-1', approvalSteps: [] });
  assert.equal(pendingApproval[0]?.status, 'ATTENTION');
  assert.match(pendingApproval[0]?.actionLabel || '', /phê duyệt/i);

  const completedReview = buildPcnDossierNodeBusinessFacts({
    actionKey: 'TECHNICAL_REVIEW',
    dossierId: 'dossier-1',
    results: [{ id: 'result-1', dossierId: 'dossier-1', labRequestId: 'pyc-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T00:00:00.000Z' }],
  });
  assert.equal(completedReview[0]?.status, 'COMPLETED');
  assert.equal(completedReview[0]?.actionLabel, 'Mở KQTN');
});

test('node work panel reports per-kind progress, required-first rows, and completion blockers', () => {
  const presentDocument = {
    ...document('req-present', 'PRESENT'),
    currentVersionId: 'asset-current',
    versions: [{ assetId: 'asset-current', fileName: 'current.pdf', uploadedAt: '2026-10-10T00:00:00.000Z' }],
  };
  const projection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: ['req-optional', 'req-missing', 'req-present'] }),
    runtimeNode: runtimeNode(),
    requirements: [
      requirement('req-optional', 'OPTIONAL_EVIDENCE', false),
      requirement('req-missing', 'REQUIRED_MISSING', true),
      requirement('req-present', 'REQUIRED_PRESENT', true),
    ],
    documents: [presentDocument],
    businessFacts: [businessFact({ id: 'results', label: 'KQTN', status: 'ATTENTION', reason: 'Chưa có KQTN chính thức' })],
  });
  const markup = renderToStaticMarkup(createElement(PcnDossierNodeWorkPanel, {
    projection,
    taskId: 'task-1',
    documents: [presentDocument],
    canEdit: false,
  }));
  const tableBody = markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
  const rowIds = Array.from(tableBody.matchAll(/data-testid="pcn-node-document-([^"]+)"/g), (match) => match[1]);
  const blockerSummary = markup.match(/<section[^>]*data-testid="pcn-node-completion-blockers"[\s\S]*?<\/section>/)?.[0] || '';

  assert.match(markup, /data-testid="pcn-node-documents-mobile"[^>]*class="[^"]*md:hidden/);
  assert.match(markup, /data-testid="pcn-node-documents-desktop"[^>]*class="[^"]*hidden\s+md:block/);
  assert.match(markup, /<ul[^>]*data-testid="pcn-node-documents-mobile"[\s\S]*?data-testid="pcn-node-document-card-req-missing"/);
  assert.match(markup, /<ul[^>]*data-testid="pcn-node-documents-mobile"[\s\S]*?data-testid="pcn-node-document-card-req-present"/);
  assert.match(markup, /<ul[^>]*data-testid="pcn-node-documents-mobile"[\s\S]*?data-testid="pcn-node-document-card-req-optional"/);

  assert.match(markup, /data-testid="pcn-required-progress"[^>]*>[\s\S]*?1\/2/);
  assert.match(markup, /data-testid="pcn-optional-progress"[^>]*>[\s\S]*?0\/1/);
  assert.deepEqual(rowIds, ['req-missing', 'req-present', 'req-optional']);
  assert.match(tableBody, /REQUIRED_MISSING[\s\S]*?Bắt buộc/);
  assert.match(tableBody, /OPTIONAL_EVIDENCE[\s\S]*?Tùy chọn[\s\S]*?Chưa có/);
  assert.match(blockerSummary, /Còn 1 mục bắt buộc/);
  assert.match(blockerSummary, /Thiếu tài liệu bắt buộc: REQUIRED_MISSING/);
  assert.match(blockerSummary, /Mở sổ mẫu: Chưa có KQTN chính thức/);
  assert.doesNotMatch(blockerSummary, /OPTIONAL_EVIDENCE/);
  assert.match(tableBody, /aria-label="Mở tệp"/);
  assert.doesNotMatch(tableBody, /aria-label="Tải tài liệu"/);

  const optionalOnlyProjection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: ['req-optional'] }),
    runtimeNode: runtimeNode({ requirementIds: ['req-optional'] }),
    requirements: [requirement('req-optional', 'OPTIONAL_EVIDENCE', false)],
    businessFacts: [businessFact()],
  });
  const optionalOnlyMarkup = renderToStaticMarkup(createElement(PcnDossierNodeWorkPanel, {
    projection: optionalOnlyProjection,
    taskId: 'task-optional',
    canEdit: true,
    onCompleteTask: async () => undefined,
    onWaive: async () => undefined,
  }));

  assert.equal(optionalOnlyProjection.canContinue, true);
  assert.match(optionalOnlyMarkup, /data-testid="pcn-optional-progress"[^>]*>[\s\S]*?0\/1/);
  assert.match(optionalOnlyMarkup, /Hoàn tất bước/);
  assert.match(optionalOnlyMarkup, /Lý do bỏ qua/);
  assert.match(optionalOnlyMarkup, /Bỏ qua mục này/);
  assert.doesNotMatch(optionalOnlyMarkup, /data-testid="pcn-node-completion-blockers"/);

  const renderedIds = Array.from(optionalOnlyMarkup.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  const duplicateIds = renderedIds.filter((id, index) => renderedIds.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, []);
});


test('PCN node projection identifies pending confirmation outputs while keeping workflow gates closed', () => {
  const planReq = requirement('req-plan', 'EVALUATION_PLAN', true);
  const pendingDraft = {
    id: 'pcn-draft-plan-1',
    title: 'Kế hoạch đánh giá chứng nhận',
    formKind: 'EVALUATION_PLAN' as const,
    templateId: 'tpl-eval-plan',
    sourceDossierId: 'dossier-1',
    fieldCodes: [],
    values: {},
    status: 'GENERATED' as const,
    outputs: [
      {
        id: 'out-1',
        format: 'DOCX' as const,
        fileAssetId: 'asset-plan-docx',
        fileName: 'dossier-1_EVALUATION_PLAN.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        byteSize: 2048,
        sha256: 'c'.repeat(64),
        generatedAt: '2026-11-02T08:00:00.000Z',
      },
    ],
    createdByUsername: 'staff',
    updatedByUsername: 'staff',
    createdAt: '2026-11-02T08:00:00.000Z',
    updatedAt: '2026-11-02T08:05:00.000Z',
  };

  const projection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: ['req-plan'] }),
    runtimeNode: runtimeNode({ requirementIds: ['req-plan'] }),
    requirements: [planReq],
    documents: [], // Not attached to dossier yet!
    draftWorkspaces: [
      pendingDraft as any,
      {
        ...(pendingDraft as any),
        id: 'pcn-draft-plan-archived',
        status: 'ARCHIVED',
        updatedAt: '2026-11-02T08:30:00.000Z',
      },
    ],
    businessFacts: [businessFact()],
  });

  const planItem = projection.documents.find((item) => item.requirementId === 'req-plan');
  assert.ok(planItem);
  assert.equal(planItem.pendingDraftId, 'pcn-draft-plan-1');
  assert.equal(planItem.status, 'MISSING'); // Must remain MISSING
  assert.equal(projection.unresolvedRequiredCount, 1); // Gate stays closed
  assert.equal(projection.canContinue, false); // Cannot advance workflow

  // Render UI check
  let requestedDraftItem: any = null;
  const markup = renderToStaticMarkup(createElement(PcnDossierNodeWorkPanel, {
    projection,
    taskId: 'task-plan',
    canEdit: true,
    onOpenDrafting: (item) => {
      requestedDraftItem = item;
      return `/pgdcn/pcn/drafting?dossierId=dossier-1&draftId=${item.pendingDraftId}&node=sampling`;
    },
  }));

  assert.match(markup, /Chờ xác nhận/);
  assert.match(markup, /aria-label="Mở lại bản nháp đang chờ xác nhận"/);
  assert.match(markup, /href="\/pgdcn\/pcn\/drafting\?dossierId=dossier-1&amp;draftId=pcn-draft-plan-1&amp;node=sampling"/);
  assert.ok(requestedDraftItem);
  assert.equal(requestedDraftItem.pendingDraftId, 'pcn-draft-plan-1');

  // Read-only user check
  const readOnlyMarkup = renderToStaticMarkup(createElement(PcnDossierNodeWorkPanel, {
    projection,
    taskId: 'task-plan',
    canEdit: false,
    onOpenDrafting: () => '/pgdcn/pcn/drafting',
  }));

  assert.match(readOnlyMarkup, /Chờ xác nhận/);
  // Read-only user should not have editing link
  assert.doesNotMatch(readOnlyMarkup, /href="\/pgdcn\/pcn\/drafting/);
});
