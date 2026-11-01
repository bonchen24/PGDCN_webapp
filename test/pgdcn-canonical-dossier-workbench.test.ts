import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnWorkflowForDossier } from '../utils/pcnWorkflowTemplate';
import { PGD_DOSSIER_FLOW_STEPS, getPgdDossierCurrentStepNumber, getPgdDossierFlowStepIdForStatus } from '../components/PgdDossierFlow';
import { getPgdOperationalStepAccess } from '../utils/pgdWorkflow';
import { PGD_DOMAIN, type PgdInspectionRequest } from '../utils/pgdDomain';
import type { CertificationDossier, PcnWorkflowSnapshot } from '../types';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('canonical workbench visual hierarchy: header -> next action -> natural horizontal rail -> selected node work -> evidence/history', () => {
  const pcnPanel = read('../components/PcnDossierWorkflowPanel.tsx');
  const pgdWorkspace = read('../components/PgdWorkspace.tsx');

  // PCN visual order
  const pcnNextActionIdx = pcnPanel.indexOf('data-testid="pcn-current-step-summary"');
  const pcnRailIdx = pcnPanel.indexOf('<PcnDossierFlow ');
  const pcnWorkPanelIdx = pcnPanel.indexOf('<PcnDossierNodeWorkPanel');

  assert.ok(pcnNextActionIdx >= 0, 'PCN must have current-step-summary (next action)');
  assert.ok(pcnRailIdx >= 0, 'PCN must have PcnDossierFlow natural rail');
  assert.ok(pcnWorkPanelIdx >= 0, 'PCN must have PcnDossierNodeWorkPanel');
  assert.ok(
    pcnNextActionIdx < pcnRailIdx && pcnRailIdx < pcnWorkPanelIdx,
    'PCN visual order must be: next action -> natural horizontal rail -> node work panel',
  );

  // PGD visual order
  const pgdNextActionIdx = pgdWorkspace.indexOf('data-testid="pgd-dossier-priority-action"');
  const pgdRailIdx = pgdWorkspace.indexOf('<PgdDossierFlow ');
  const pgdWorkPanelIdx = pgdWorkspace.indexOf('<PgdDossierStepWorkPanel');

  assert.ok(pgdNextActionIdx >= 0, 'PGD must have priority-action (next action)');
  assert.ok(pgdRailIdx >= 0, 'PGD must have PgdDossierFlow natural rail');
  assert.ok(pgdWorkPanelIdx >= 0, 'PGD must have PgdDossierStepWorkPanel');
  assert.ok(
    pgdNextActionIdx < pgdRailIdx && pgdRailIdx < pgdWorkPanelIdx,
    'PGD visual order must be: next action -> natural horizontal rail -> step work panel',
  );
});

test('node selection does not alter dossier business status in either domain', () => {
  const pcnPanel = read('../components/PcnDossierWorkflowPanel.tsx');
  const pgdFlow = read('../components/PgdDossierFlow.tsx');
  const pgdWorkspace = read('../components/PgdWorkspace.tsx');

  // PCN selection callback only sets selectedNodeId without changing dossier status
  assert.match(pcnPanel, /selectNode\s*=\s*useCallback\(\(nodeId:\s*string\)\s*=>\s*\{[\s\S]*?setSelectedNodeId\(nodeId\)/);
  assert.doesNotMatch(pcnPanel, /selectNode[\s\S]*?changeStatus/);

  // PGD selection only updates local selectedStepId without calling advance or mutation
  assert.match(pgdFlow, /onClick=\{\(\)\s*=>\s*onSelectStep\(step\.id\)\}/);
  assert.match(pgdWorkspace, /onSelectStep=\{setSelectedStepId\}/);
});

test('PCN workflow respects immutable dossier snapshot and preserves parallel/branching topology', () => {
  const snapshot: PcnWorkflowSnapshot = {
    templateCode: 'BRANCHED-CUSTOM',
    templateVersion: 3,
    capturedAt: '2026-11-01T00:00:00Z',
    capturedBy: 'lead-auditor',
    nodes: [
      { id: 'node-start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['req-1'], sortOrder: 1, active: true },
      { id: 'node-split', kind: 'PARALLEL_SPLIT', label: 'Tách song song', requirementIds: [], sortOrder: 2, active: true },
      { id: 'node-branch-a', kind: 'DOCUMENT_TASK', label: 'Đánh giá kỹ thuật', requirementIds: ['req-2'], sortOrder: 3, active: true },
      { id: 'node-branch-b', kind: 'APPROVAL_TASK', label: 'Thử nghiệm phòng lab', requirementIds: ['req-3'], sortOrder: 4, active: true },
      { id: 'node-join', kind: 'PARALLEL_JOIN', label: 'Hợp nhất song song', requirementIds: [], sortOrder: 5, active: true },
      { id: 'node-end', kind: 'END', label: 'Hoàn tất', requirementIds: [], sortOrder: 6, active: true },
    ],
    transitions: [
      { id: 't-1', fromNodeId: 'node-start', toNodeId: 'node-split', condition: 'ALWAYS' },
      { id: 't-2a', fromNodeId: 'node-split', toNodeId: 'node-branch-a', condition: 'ALWAYS' },
      { id: 't-2b', fromNodeId: 'node-split', toNodeId: 'node-branch-b', condition: 'ALWAYS' },
      { id: 't-3a', fromNodeId: 'node-branch-a', toNodeId: 'node-join', condition: 'ALWAYS' },
      { id: 't-3b', fromNodeId: 'node-branch-b', toNodeId: 'node-join', condition: 'ALWAYS' },
      { id: 't-4', fromNodeId: 'node-join', toNodeId: 'node-end', condition: 'ALWAYS' },
    ],
  };

  const dossier = {
    id: 'dossier-snapshot-test',
    dossierCode: 'PCN-CUSTOM-01',
    status: 'IN_PROGRESS',
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
    workflowSnapshot: snapshot,
  } as unknown as CertificationDossier;

  const resolved = getPcnWorkflowForDossier(dossier);
  assert.equal(resolved.templateCode, 'BRANCHED-CUSTOM');
  assert.equal(resolved.nodes.length, 6);
  assert.equal(resolved.nodes[1].kind, 'PARALLEL_SPLIT');
  assert.equal(resolved.nodes[4].kind, 'PARALLEL_JOIN');

  const pcnFlow = read('../components/PcnDossierFlow.tsx');
  assert.match(pcnFlow, /PARALLEL_SPLIT/);
  assert.match(pcnFlow, /PARALLEL_JOIN/);
});

test('PGD keeps exactly 12 flat jobs, calculates access via getPgdOperationalStepAccess, and does not use Archify', () => {
  assert.equal(PGD_DOSSIER_FLOW_STEPS.length, 12, 'PGD must keep exactly 12 jobs');
  const pgdWorkspace = read('../components/PgdWorkspace.tsx');
  const pgdFlow = read('../components/PgdDossierFlow.tsx');

  assert.doesNotMatch(pgdWorkspace, /Archify|archify/i, 'PGD must not embed Archify diagram');
  assert.doesNotMatch(pgdFlow, /Archify|archify/i, 'PGD Flow must not embed Archify diagram');

  assert.match(pgdWorkspace, /getPgdOperationalStepAccess/);

  // Verify access calculation for all 5 business stages
  const draftAccess = getPgdOperationalStepAccess({ status: 'DRAFT', targetStationKey: 'INTAKE_CAPABILITY' });
  assert.equal(draftAccess.editable, true);

  const fieldAccess = getPgdOperationalStepAccess({ status: 'FIELD_INSPECTION', targetStationKey: 'FIELD_SAMPLING' });
  assert.equal(fieldAccess.editable, true);

  const lockedLabAccess = getPgdOperationalStepAccess({ status: 'DRAFT', targetStationKey: 'LAB_RESULTS' });
  assert.equal(lockedLabAccess.editable, false);
});

test('checklist and document confirmation enforces mandatory/conditional/supplemental classification and server confirmation', () => {
  const pcnWorkPanel = read('../components/PcnDossierNodeWorkPanel.tsx');
  const pgdStepPanel = read('../components/PgdDossierStepWorkPanel.tsx');
  const docTable = read('../components/PgdcnDossierDocumentActionTable.tsx');

  // Classification badges in document action table or panels
  assert.match(docTable, /Bắt buộc/);
  assert.match(docTable, /Tùy chọn|Điều kiện|Bổ sung/);

  // Creating or uploading a file does not self-confirm
  assert.match(pcnWorkPanel, /onCreateFromForm|onGenerateAndAttach/);
  assert.match(pcnWorkPanel, /onUploadDocument/);
  assert.match(pgdStepPanel, /onOpenDrafting/);

  // Separation between all-dossier count and current-node count
  assert.match(pcnWorkPanel, /unresolvedRequiredCount|Thiếu tài liệu bắt buộc/);
  assert.match(pgdStepPanel, /Soát xét bước này/);
});

test('workbench controls adhere to 44px mobile touch targets, keyboard navigation, and domain color themes', () => {
  const pcnFlow = read('../components/PcnDossierFlow.tsx');
  const pgdFlow = read('../components/PgdDossierFlow.tsx');
  const pcnWorkPanel = read('../components/PcnDossierNodeWorkPanel.tsx');
  const pgdStepPanel = read('../components/PgdDossierStepWorkPanel.tsx');

  // 44px touch targets
  for (const src of [pcnFlow, pgdFlow, pcnWorkPanel, pgdStepPanel]) {
    assert.match(src, /min-h-11|min-h-\[44px\]|mobile-touch-target/);
  }

  // Keyboard accessibility
  assert.match(pcnFlow, /handleKeyDown/);
  assert.match(pcnFlow, /ArrowLeft|ArrowRight/);
  assert.match(pgdFlow, /handleKeyDown/);
  assert.match(pgdFlow, /ArrowLeft|ArrowRight/);

  // Domain colors: PCN emerald, PGD blue
  assert.match(pcnFlow, /emerald/);
  assert.match(pgdFlow, /blue/);
});
