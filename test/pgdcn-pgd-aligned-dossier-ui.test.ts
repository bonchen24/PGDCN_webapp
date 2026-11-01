import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PCN dossier management follows the PGD queue and toolbar anatomy', () => {
  const operations = read('../components/PcnOperationsRegisterView.tsx');
  const queue = read('../components/PcnDossierQueueView.tsx');
  const pgdQueue = read('../components/PgdDossierQueueView.tsx');

  assert.match(operations, /<PgdcnPageHeader/);
  assert.match(operations, /<PcnDossierQueueView/);
  assert.match(queue, /data-testid="pcn-dossier-queue"/);
  assert.match(queue, /PCN · Hàng đợi công việc/);
  assert.match(queue, /grid grid-cols-1 md:grid-cols-2 gap-4/);
  assert.match(queue, /mobile-scroll-x[\s\S]*overflow-x-auto/);
  assert.match(queue, /dossier-action-compact/);
  assert.match(pgdQueue, /PGD · Hàng đợi công việc/);
});

test('PCN dossier detail follows the PGD focus surface and work-panel rhythm', () => {
  const detail = read('../components/PcnDossierDetailView.tsx');
  const flow = read('../components/PcnDossierFlow.tsx');
  const workPanel = read('../components/PcnDossierNodeWorkPanel.tsx');

  assert.match(detail, /data-testid="pcn-dossier-focus-shell"/);
  assert.match(detail, /data-testid="pcn-legacy-workflow-shell"/);
  assert.match(detail, /data-testid="pcn-legacy-review-summary"/);
  assert.match(detail, /Việc cần làm ngay/);
  assert.match(detail, /bg-white px-3 py-3 sm:flex-row/);
  assert.match(detail, /Xem danh sách tài liệu/);
  assert.doesNotMatch(detail, /Mở checklist/);
  assert.match(detail, /data-testid="pcn-legacy-process-map"/);
  assert.match(detail, /Các bước hồ sơ PCN/);
  assert.doesNotMatch(detail, /Mở sơ đồ quy trình/);
  assert.match(detail, /data-testid="pcn-workflow-step-checklist"[\s\S]*<summary/);
  assert.match(detail, /data-testid="pcn-operational-forms"[\s\S]*<summary/);
  assert.match(flow, /PCN · Tiến trình hồ sơ/);
  assert.match(flow, /min-h-\[106px\]\s+w-\[218px\]/);
  assert.match(workPanel, /data-testid="pcn-dossier-review-summary"/);
  assert.match(workPanel, /bg-emerald-50\/50/);
  assert.match(workPanel, /min-h-0 space-y-4 p-4/);
});

test('workflow rail is naturally positioned above node work on PCN and PGD dossier surfaces', () => {
  const pcnWorkflow = read('../components/PcnDossierWorkflowPanel.tsx');
  const pgdWorkspace = read('../components/PgdWorkspace.tsx');
  assert.match(pcnWorkflow, /Việc cần làm:/);
  assert.ok(pcnWorkflow.indexOf('<PcnDossierFlow') < pcnWorkflow.indexOf('<PcnDossierNodeWorkPanel'));
  assert.ok(pgdWorkspace.indexOf('<PgdDossierFlow') < pgdWorkspace.indexOf('<PgdDossierStepWorkPanel'));
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
