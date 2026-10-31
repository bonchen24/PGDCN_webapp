import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const read = (file: string) => {
  const url = new URL(`../${file}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

test('canonical PCN detail organizes information, documents, work and scoped history through shared tabs', () => {
  const source = read('components/PcnDossierDetailView.tsx');
  assert.match(source, /<PgdcnDossierWorkspace/);
  assert.match(source, /information: dossierOverviewTab/);
  assert.match(source, /documents: documentWorkspaceTab/);
  assert.match(source, /work: dossierWorkTab/);
  assert.match(source, /history:.*ActivityHistory logs=\{dossierActivityLogs\}/);
  assert.match(source, /ownerLabel=\{ownerLabel\}/);
  assert.match(source, /nextActionLabel=\{currentStation.actionLabel\}/);
  assert.match(source, /PcnDossierWorkflowPanel/);
  assert.match(source, /setWorkAreaOpen\(true\)/, 'business actions must reveal their destination');
  assert.match(source, /open=\{workAreaOpen\}/);
});

test('canonical PGD detail reuses current evidence and work actions with a separate history tab', () => {
  const source = read('components/PgdWorkspace.tsx');
  assert.match(source, /<PgdcnDossierWorkspace/);
  assert.match(source, /information:.*PgdDossierInformation/);
  assert.match(source, /documents:.*PgdCaseEvidencePanel/);
  assert.match(source, /history:.*PgdDossierHistory request=\{request\}/);
  assert.match(source, /setWorkspaceTab\('work'\)/);
  assert.match(source, /onOpenChecklist=\{\(\) => setWorkspaceTab\('documents'\)\}/);
  assert.match(source, /editable=\{getPgdPostSignatureMutationDenial\(request.status\) === null\}/);
  assert.match(source, /onCompleteCurrent=\{completeCurrentStep\}/);
});

test('workspace tab model preserves old PCN document and business deep links and keyboard wrapping', async () => {
  assert.ok(existsSync(new URL('../utils/pgdcnDossierWorkspace.ts', import.meta.url)), 'shared tab model is missing');
  const { getWorkspaceTabForPcnDetail, getWorkspaceTabForKey } = await import('../utils/pgdcnDossierWorkspace.ts');
  assert.equal(getWorkspaceTabForPcnDetail(), 'work');
  assert.equal(getWorkspaceTabForPcnDetail('overview'), 'information');
  assert.equal(getWorkspaceTabForPcnDetail('documents'), 'documents');
  for (const area of ['lab', 'results', 'issuance']) assert.equal(getWorkspaceTabForPcnDetail(area), 'work');
  assert.equal(getWorkspaceTabForKey('information', 'ArrowLeft'), 'history');
  assert.equal(getWorkspaceTabForKey('history', 'ArrowRight'), 'information');
  assert.equal(getWorkspaceTabForKey('documents', 'Home'), 'information');
  assert.equal(getWorkspaceTabForKey('documents', 'End'), 'history');
  assert.equal(getWorkspaceTabForKey('documents', 'Escape'), undefined);
});

test('shared workspace renders four labeled tabs, linked panels and preserved hidden form state', async () => {
  assert.ok(existsSync(new URL('../components/PgdcnDossierWorkspace.tsx', import.meta.url)), 'shared workspace is missing');
  const { default: Workspace } = await import('../components/PgdcnDossierWorkspace.tsx');
  const panels = { information: 'Thông tin đang giữ', documents: 'Tài liệu đang giữ', work: 'Công việc đang giữ', history: 'Lịch sử đang giữ' };
  const markup = renderToStaticMarkup(createElement(Workspace, { domain: 'PCN', dossierId: 'dossier-one', activeTab: 'documents', onTabChange() {}, ownerLabel: 'Người phụ trách có tên rất dài', nextActionLabel: 'Tiếp nhận tài liệu', panels }));
  assert.equal((markup.match(/role="tab"/g) || []).length, 4);
  assert.equal((markup.match(/role="tabpanel"/g) || []).length, 4);
  assert.equal((markup.match(/ hidden=""/g) || []).length, 3);
  assert.equal((markup.match(/aria-selected="true"/g) || []).length, 1);
  for (const label of ['Thông tin', 'Tài liệu', 'Công việc', 'Lịch sử']) assert.match(markup, new RegExp(label));
  assert.match(markup, /aria-controls=/);
  assert.match(markup, /aria-labelledby=/);
  assert.match(markup, /Người phụ trách có tên rất dài/);
  assert.match(markup, /Tiếp nhận tài liệu/);
  assert.doesNotMatch(markup, /truncate|line-clamp|whitespace-nowrap/);
  assert.match(markup, /min-h-11/);
  assert.match(markup, /grid-cols-2/);
  const source = read('components/PgdcnDossierWorkspace.tsx');
  assert.match(source, /getWorkspaceTabForKey/);
  assert.match(source, /\.focus\(/);
});

test('domain history stays scoped to canonical records and carries actor and timestamp', () => {
  const pgd = read('components/PgdDossierBusinessWorkspace.tsx');
  assert.match(pgd, /export function PgdDossierHistory/);
  assert.match(pgd, /buildPgdBusinessTimeline/);
  assert.match(pgd, /item.requestId === request.id/);
  assert.match(pgd, /dateTime=\{item.occurredAt\}/);
  assert.match(pgd, /item.actor/);
  const pcn = read('components/PcnDossierDetailView.tsx');
  assert.match(pcn, /const dossierActivityLogs = activityLogs.filter/);
  assert.match(pcn, /log.createdAt/);
  assert.match(pcn, /log.changes/);
});
