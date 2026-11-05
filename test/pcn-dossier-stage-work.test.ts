import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import PcnDossierWorkflowPanel from '../components/PcnDossierWorkflowPanel.tsx';
import type {
  CertificationDossier,
  PcnDossierWorkflowTask,
  PcnDocumentRequirement,
  PcnWorkflowSnapshot,
} from '../types.ts';
import * as nodeWork from '../utils/pcnDossierNodeWork.ts';
import type { PcnDossierNodeDocumentItem, PcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork.ts';
import type { PcnWorkflowRuntimeNode } from '../utils/pcnWorkflowRuntime.ts';

const timestamp = '2026-11-05T00:00:00.000Z';

const proposalRequirement: PcnDocumentRequirement = {
  id: 'QC4-PROPOSAL',
  fieldCode: 'QC4',
  code: 'PROPOSAL',
  name: 'Đề nghị chứng nhận',
  stages: ['INTAKE'],
  required: true,
  active: true,
  sortOrder: 10,
};

const commercialRequirement: PcnDocumentRequirement = {
  id: 'QC4-COMMERCIAL',
  fieldCode: 'QC4',
  code: 'COMMERCIAL',
  name: 'Hồ sơ thương mại',
  stages: ['INTAKE'],
  required: true,
  active: true,
  sortOrder: 20,
};

const supplementaryRequirement: PcnDocumentRequirement = {
  id: 'QC4-SUPPORT',
  fieldCode: 'QC4',
  code: 'SUPPORT',
  name: 'Tài liệu hỗ trợ',
  stages: ['INTAKE'],
  required: true,
  active: true,
  sortOrder: 30,
};

const intakeWorkflow: PcnWorkflowSnapshot = {
  templateCode: 'TEST-INTAKE',
  templateVersion: 1,
  nodes: [
    { id: 'proposal', kind: 'DOCUMENT_TASK', label: 'Đề nghị', actionKey: 'INTAKE', requirementIds: [proposalRequirement.id], active: true, sortOrder: 1 },
    { id: 'commercial', kind: 'DOCUMENT_TASK', label: 'Thương mại', actionKey: 'INTAKE', requirementIds: [commercialRequirement.id, supplementaryRequirement.id], active: true, sortOrder: 2 },
  ],
  transitions: [],
  capturedAt: timestamp,
  capturedBy: 'test',
};

const dossier: CertificationDossier = {
  id: 'DOSSIER-1',
  dossierCode: 'PCN-TEST-01',
  proposalId: 'PROPOSAL-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'DRAFT',
  workflowSnapshot: intakeWorkflow,
  labRequestIds: [],
  returnedResultIds: [],
};

const workflowTasks: PcnDossierWorkflowTask[] = intakeWorkflow.nodes.map((node) => ({
  id: `task-${node.id}`,
  dossierId: dossier.id,
  nodeId: node.id,
  status: 'READY',
  cycleNo: 1,
  updatedAt: timestamp,
  updatedBy: 'test',
}));

function renderIntakeWorkflow(onOpenDrafting?: (item: PcnDossierNodeDocumentItem, nodeId: string) => string | undefined): string {
  return renderToStaticMarkup(createElement(PcnDossierWorkflowPanel, {
    dossier,
    requirements: [proposalRequirement, commercialRequirement, supplementaryRequirement],
    documents: [],
    workflowTasks,
    canEdit: true,
    initialNodeId: 'proposal',
    onStartTask: async () => undefined,
    onCompleteTask: async () => undefined,
    onUploadDocument: async () => undefined,
    onUploadSupplementary: async () => undefined,
    onCreateFromForm: () => undefined,
    onOpenDrafting: onOpenDrafting || (() => undefined),
    onGenerateAndAttach: async () => undefined,
    onConfirmDocument: async () => undefined,
    onRemoveCurrent: async () => undefined,
    onClearDocumentWaiver: async () => undefined,
    onOpenBusiness: () => undefined,
  }));
}

function docItem(input: {
  requirementId: string;
  code: string;
  label?: string;
  required?: boolean;
  status?: PcnDossierNodeDocumentItem['status'];
}): PcnDossierNodeDocumentItem {
  return {
    kind: 'DOCUMENT_REQUIREMENT',
    requirementId: input.requirementId,
    code: input.code,
    label: input.label || input.requirementId,
    required: input.required ?? true,
    status: input.status || 'MISSING',
    actions: input.status === 'PRESENT' || input.status === 'CONFIRMED'
      ? ['VIEW', 'REPLACE', 'REMOVE_CURRENT']
      : ['UPLOAD', ...(input.code === 'PROPOSAL' || input.code === 'COMMERCIAL' ? ['CREATE_FROM_FORM' as const] : []), 'WAIVE'],
  };
}

function nodeProjection(input: {
  id: string;
  label?: string;
  status: PcnWorkflowRuntimeNode['status'];
  blockedReason?: PcnWorkflowRuntimeNode['blockedReason'];
  documents: PcnDossierNodeDocumentItem[];
  canContinue?: boolean;
}): { node: PcnWorkflowRuntimeNode; projection: PcnDossierNodeWorkProjection } {
  const isActive = ['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED'].includes(input.status);
  const node: PcnWorkflowRuntimeNode = {
    id: input.id,
    kind: 'DOCUMENT_TASK',
    label: input.label || input.id,
    actionKey: 'INTAKE',
    requirementIds: input.documents.map((document) => document.requirementId),
    status: input.status,
    cycleNo: 1,
    ...(input.blockedReason ? { blockedReason: input.blockedReason } : {}),
    isActive,
  };
  const unresolvedRequiredCount = input.documents.filter((document) => document.required && !['PRESENT', 'CONFIRMED', 'WAIVED'].includes(document.status)).length;
  return {
    node,
    projection: {
      nodeId: input.id,
      nodeLabel: input.label || input.id,
      status: input.status,
      cycleNo: 1,
      ...(input.blockedReason ? { blockedReason: input.blockedReason } : {}),
      documents: input.documents,
      businessFacts: [],
      unresolvedRequiredCount,
      suggestions: [],
      canContinue: input.canContinue ?? (isActive && unresolvedRequiredCount === 0),
      isSelectable: isActive || input.status === 'COMPLETED',
      isEditable: isActive || input.status === 'COMPLETED',
      requiresReworkOnMutation: input.status === 'COMPLETED',
    },
  };
}

const stageWork = nodeWork as unknown as {
  buildPcnDossierStageWorkProjection?: (input: {
    nodes: PcnWorkflowRuntimeNode[];
    projections: Record<string, PcnDossierNodeWorkProjection | undefined>;
    preferredNodeId?: string;
  }) => {
    documents: Array<PcnDossierNodeDocumentItem & {
      sourceNodeId: string;
      sourceNodeLabel: string;
      sourceNodeEditable: boolean;
      sourceRequiresReworkOnMutation: boolean;
    }>;
    requiredMissingCount: number;
    requiredPendingConfirmationCount: number;
    blockingRequiredMissingCount: number;
    blockingRequiredPendingConfirmationCount: number;
  } | undefined;
  getPcnDossierStageAssistantMessage?: (stageLabel: string | undefined, summary: {
    blockingRequiredMissingCount: number;
    blockingRequiredPendingConfirmationCount: number;
  } | undefined) => string;
};

function buildStageWork(entries: ReturnType<typeof nodeProjection>[], preferredNodeId = 'proposal') {
  assert.equal(typeof stageWork.buildPcnDossierStageWorkProjection, 'function', 'stage-level work projection must be implemented');
  if (!stageWork.buildPcnDossierStageWorkProjection) return undefined;
  return stageWork.buildPcnDossierStageWorkProjection({
    nodes: entries.map((entry) => entry.node),
    projections: Object.fromEntries(entries.map((entry) => [entry.node.id, entry.projection])),
    preferredNodeId,
  });
}

function assistantMessage(stageLabel: string | undefined, summary: ReturnType<typeof buildStageWork>): string {
  assert.equal(typeof stageWork.getPcnDossierStageAssistantMessage, 'function', 'assistant copy must use the stage projection');
  if (!stageWork.getPcnDossierStageAssistantMessage) return '';
  return stageWork.getPcnDossierStageAssistantMessage(stageLabel, summary);
}

test('intake renders proposal and commercial requirements together without node subtab buttons', () => {
  const html = renderIntakeWorkflow((item, nodeId) => `/drafting?node=${nodeId}&requirement=${item.requirementId}`);

  assert.equal((html.match(/data-testid="pcn-dossier-document-action-table"/g) || []).length, 1);
  assert.match(html, /data-testid="pcn-node-document-QC4-PROPOSAL"/);
  assert.match(html, /data-testid="pcn-node-document-QC4-COMMERCIAL"/);
  assert.match(html, /data-testid="pcn-required-progress"[^>]*>[\s\S]*?<strong[^>]*>0\/3<\/strong>/, 'stage progress matches all required rows shown in the table');
  assert.doesNotMatch(html, /aria-pressed=/, 'intake work should not depend on proposal/commercial subtab buttons');
  assert.match(html, /href="\/drafting\?node=proposal&amp;requirement=QC4-PROPOSAL"/);
  assert.match(html, /href="\/drafting\?node=commercial&amp;requirement=QC4-COMMERCIAL"/);
  assert.doesNotMatch(html, /id="pcn-upload-(?:proposal-QC4-PROPOSAL|commercial-QC4-COMMERCIAL)"/, 'valid draft templates are the row action; upload remains the fallback');
  assert.doesNotMatch(html, /aria-label="Thao tác khác"/, 'rows without secondary actions do not show an empty overflow menu');
  assert.match(html, /id="pcn-upload-commercial-QC4-SUPPORT"/, 'upload fallback follows the owning runtime node');
});

test('stage projection deduplicates rows, keeps source-node context, and scopes blockers to the active stage gate', () => {
  const proposal = nodeProjection({
    id: 'proposal',
    label: 'Đề nghị',
    status: 'IN_PROGRESS',
    blockedReason: 'MISSING_DOCUMENT',
    documents: [
      docItem({ requirementId: 'QC4-PROPOSAL', code: 'PROPOSAL' }),
      docItem({ requirementId: 'QC4-UPLOADED', code: 'SUPPORT', status: 'UPLOADED' }),
      docItem({ requirementId: 'QC4-GENERATED', code: 'SUPPORT', status: 'GENERATED' }),
      docItem({ requirementId: 'QC4-CONFIRMED', code: 'SUPPORT', status: 'CONFIRMED' }),
      { ...docItem({ requirementId: 'QC4-WAIVED', code: 'SUPPORT', status: 'WAIVED' }), waiverReason: 'Không áp dụng' },
      docItem({ requirementId: 'QC4-OPTIONAL', code: 'SUPPORT', required: false }),
      docItem({ requirementId: 'QC4-DUPLICATE', code: 'SUPPORT' }),
    ],
  });
  const commercial = nodeProjection({
    id: 'commercial',
    label: 'Thương mại',
    status: 'LOCKED',
    blockedReason: 'PREDECESSOR',
    documents: [
      docItem({ requirementId: 'QC4-COMMERCIAL', code: 'COMMERCIAL' }),
      docItem({ requirementId: 'QC4-DUPLICATE', code: 'SUPPORT' }),
    ],
  });
  const conditional = nodeProjection({
    id: 'optional-path',
    label: 'Nhánh điều kiện không phù hợp',
    status: 'LOCKED',
    blockedReason: 'CONDITION',
    documents: [docItem({ requirementId: 'QC4-CONDITIONAL', code: 'SUPPORT' })],
  });
  const predecessorBlocked = nodeProjection({
    id: 'predecessor-blocked',
    label: 'Bước chờ tiền nhiệm',
    status: 'READY',
    blockedReason: 'PREDECESSOR',
    documents: [docItem({ requirementId: 'QC4-PREDECESSOR-BLOCKED', code: 'SUPPORT' })],
  });

  const wholeDossierMissingCount = 13;
  const stage = buildStageWork([proposal, commercial, conditional, predecessorBlocked]);

  assert.ok(stage);
  assert.equal(wholeDossierMissingCount, 13);
  assert.equal(stage.documents.filter((item) => item.requirementId === 'QC4-DUPLICATE').length, 1);
  assert.equal(stage.documents.find((item) => item.requirementId === 'QC4-DUPLICATE')?.sourceNodeId, 'proposal');
  assert.equal(stage.documents.some((item) => item.requirementId === 'QC4-CONDITIONAL'), false);
  assert.equal(stage.requiredMissingCount, 4, 'stage rows include the predecessor-blocked document without treating it as the active gate');
  assert.equal(stage.requiredPendingConfirmationCount, 2, 'uploaded and generated documents remain unresolved until confirmed');
  assert.equal(stage.blockingRequiredMissingCount, 2, 'only unresolved required docs on active nodes whose gate is not blocked by a predecessor block this step');
  assert.equal(stage.blockingRequiredPendingConfirmationCount, 2);
  assert.equal(assistantMessage('Tiếp nhận hồ sơ', stage), 'Thiếu tài liệu của bước đang chọn: 2 mục.');
});

test('assistant distinguishes pending confirmation from missing and treats confirmed, waived, and optional documents as resolved', () => {
  const pending = nodeProjection({
    id: 'proposal',
    status: 'IN_PROGRESS',
    documents: [
      docItem({ requirementId: 'UPLOADED', code: 'SUPPORT', status: 'UPLOADED' }),
      docItem({ requirementId: 'GENERATED', code: 'SUPPORT', status: 'GENERATED' }),
      docItem({ requirementId: 'CONFIRMED', code: 'SUPPORT', status: 'CONFIRMED' }),
      { ...docItem({ requirementId: 'WAIVED', code: 'SUPPORT', status: 'WAIVED' }), waiverReason: 'Miễn trừ' },
      docItem({ requirementId: 'OPTIONAL-MISSING', code: 'SUPPORT', required: false }),
    ],
  });
  const stage = buildStageWork([pending]);

  assert.ok(stage);
  assert.equal(stage.requiredMissingCount, 0);
  assert.equal(stage.requiredPendingConfirmationCount, 2);
  assert.equal(assistantMessage('Tiếp nhận hồ sơ', stage), 'Bước hiện tại có 2 tài liệu bắt buộc đang chờ xác nhận.');

  const complete = nodeProjection({
    id: 'proposal',
    status: 'READY',
    documents: [
      docItem({ requirementId: 'CONFIRMED', code: 'SUPPORT', status: 'CONFIRMED' }),
      { ...docItem({ requirementId: 'WAIVED', code: 'SUPPORT', status: 'WAIVED' }), waiverReason: 'Miễn trừ' },
      docItem({ requirementId: 'OPTIONAL-MISSING', code: 'SUPPORT', required: false }),
    ],
  });
  assert.equal(assistantMessage('Tiếp nhận hồ sơ', buildStageWork([complete])), 'Bước hiện tại chưa thiếu tài liệu bắt buộc.');
  assert.equal(assistantMessage(undefined, undefined), 'Chưa có bước hiện tại để kiểm tra tài liệu.');
});

test('document-row and task actions retain compact desktop and accessible mobile targets', () => {
  const html = renderIntakeWorkflow(() => undefined);
  const rowActions = [...html.matchAll(/<(?:a|button|label|summary)\b[^>]*class="([^"]*dossier-action-compact[^"]*)"[^>]*>/g)].map((match) => match[0]);
  const taskAction = html.match(/<button\b[^>]*aria-label="Hoàn tất bước, tiếp tục sang bước kế tiếp"[^>]*>/)?.[0];

  assert.ok(rowActions.length > 0);
  assert.ok(rowActions.every((action) => action.includes('min-h-11') && action.includes('sm:min-h-9')));
  assert.ok(rowActions.every((action) => action.includes('aria-label=') && (action.includes('focus-visible:ring') || action.includes('focus-within:ring'))));
  assert.ok(taskAction, 'the selected runtime node keeps its completion callback action');
  assert.ok(taskAction.includes('min-h-11') && taskAction.includes('sm:min-h-9'));
  assert.ok(taskAction.includes('text-xs'));
});

test('dossier assistant no longer presents a global missing count as a selected-step blocker', () => {
  const detailSource = readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(detailSource, /missingRequiredCount[^\n]*trước khi hoàn tất bước/);
  assert.match(detailSource, /currentStageAssistantMessage|onCurrentStageAssistantMessage/);
});
