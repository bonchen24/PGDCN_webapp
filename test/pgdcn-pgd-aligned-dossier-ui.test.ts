import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PCN dossier management follows the PGD queue and toolbar anatomy', () => {
  const operations = read('../components/PcnOperationsRegisterView.tsx');
  const queue = read('../components/PcnDossierQueueView.tsx');
  const pgdQueue = read('../components/PgdDossierQueueView.tsx');

  assert.match(operations, /<PgdcnPageHeader/);
  assert.match(operations, /<PgdcnDossierSummaryGrid/);
  assert.match(queue, /data-testid="pcn-dossier-queue"/);
  assert.match(queue, /PCN · Hàng đợi công việc/);
  assert.match(queue, /data-testid="pcn-dossier-table-scroll"/);
  assert.doesNotMatch(queue, /viewMode === 'card'/);
  assert.match(queue, /mobile-scroll-x[\s\S]*overflow-x-auto/);
  assert.match(queue, /dossier-action-compact/);
  assert.match(pgdQueue, /PGD · Hàng đợi công việc/);
});

test('PCN dossier detail follows the PGD focus surface and work-panel rhythm', () => {
  const detail = read('../components/PcnDossierDetailView.tsx');
  const flow = read('../components/PcnDossierFlow.tsx');
  const workflow = read('../components/PcnDossierWorkflowPanel.tsx');

  assert.match(detail, /lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/);
  assert.match(detail, /data-testid="pcn-dossier-mobile-switcher"[\s\S]*Công việc[\s\S]*Xem tài liệu/);
  assert.match(detail, /<PcnDossierWorkflowPanel[\s\S]*onSelectFile=\{\(file\) =>/);
  assert.match(detail, /setSelectedReaderFileId\(file\.id\); setMobileWorkspaceTab\('auxiliary'\);/);
  assert.match(detail, /<PcnDossierDocumentReader[\s\S]*documents=\{dossierDocuments\}[\s\S]*attachments=\{dossierAttachments\}/);
  assert.match(detail, /<details data-testid="pcn-dossier-support"/);
  assert.match(flow, /export const PCN_DOSSIER_FLOW_STAGES/);
  assert.match(workflow, /<h2[^>]*id="pcn-workflow-step-title"[^>]*>Bước xử lý<\/h2>/);
  assert.match(workflow, /<PcnDossierFlow[\s\S]*<PcnDossierNodeWorkPanel/);
  assert.doesNotMatch(flow, /w-\[218px\]|min-h-\[106px\]/);
});

test('workflow presentation stays aligned with current work on PCN and PGD dossier surfaces', () => {
  const pcnWorkflow = read('../components/PcnDossierWorkflowPanel.tsx');
  const pcnFlow = read('../components/PcnDossierFlow.tsx');
  const pcnDetail = read('../components/PcnDossierDetailView.tsx');
  const pgdWorkspace = read('../components/PgdWorkspace.tsx');
  assert.match(pcnWorkflow, /data-testid="pcn-workflow-step-card"[\s\S]*<PcnDossierFlow[\s\S]*<PcnDossierNodeWorkPanel/);
  assert.match(pcnFlow, /aria-label="Các bước xử lý hồ sơ"/);
  assert.match(pcnDetail, /<PcnDossierDocumentReader/);
  assert.match(pgdWorkspace, /<PgdDossierFlow/);
  assert.match(pgdWorkspace, /<PgdDossierStepWorkPanel request=/);
  assert.match(pgdWorkspace, /<PgdDossierDocumentReader/);
});
test('contextual assistant opens with the current dossier in both domains', () => {
  const appShell = read('../components/PgdcnAppShell.tsx');
  const pcnWorkflow = read('../components/PcnDossierDetailView.tsx');
  const pgdWorkPanel = read('../components/PgdWorkspace.tsx');
  const assistantShell = read('../components/PgdcnAssistantView.tsx');
  const pcnAssistant = read('../components/PcnAssistantView.tsx');
  assert.match(pcnWorkflow, /Trợ lý hồ sơ/);
  assert.match(pgdWorkPanel, /Trợ lý hồ sơ/);
  assert.ok(appShell.includes('initialDomain={assistantContext?.domain}'));
  assert.match(assistantShell, /initialDossierId={props.initialPcnDossierId}/);
  assert.match(assistantShell, /props.initialPgdRequestId/);
  assert.ok(pcnAssistant.includes('initialDossierId?: string'));
});
// --- End of pgdcn-pgd-aligned-dossier-ui.test.ts ---
