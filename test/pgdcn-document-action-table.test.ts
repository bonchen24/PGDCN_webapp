import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

test('PCN dossier presents one document action table with status and actions', () => {
  const source = read('components/PcnDossierNodeWorkPanel.tsx');
  const table = read('components/PgdcnDossierDocumentActionTable.tsx');

  assert.match(source, /testId="pcn-dossier-document-action-table"/);
  assert.match(source, /PgdcnDossierDocumentActionTable/);
  assert.match(table, /Tài liệu cần có/);
  assert.match(table, /Trạng thái/);
  assert.match(table, /Hành động/);
  assert.match(source, /target="_blank"/);
});

test('document action table is readable and keyboard-scrollable without changing row rendering', () => {
  const table = read('components/PgdcnDossierDocumentActionTable.tsx');

  assert.match(table, /role=\{renderRow \? 'region' : undefined\}/);
  assert.match(table, /tabIndex=\{renderRow \? 0 : undefined\}/);
  assert.match(table, /focus-visible:ring-2/);
  assert.match(table, /Kéo ngang để xem thêm/);
  assert.match(table, /w-full min-w-0 border-collapse text-left text-xs/);
  assert.match(table, /: 'block w-full min-w-0 border-collapse text-left text-xs md:table'/);
  assert.doesNotMatch(table, /<p className="border-b border-slate-100/);
  assert.match(table, /md:py-1\.5/);
  assert.match(table, /text-xs font-black uppercase tracking-wide/);
  assert.match(table, /min-h-6 items-center rounded-full border px-2 py-0\.5 text-\[11px\] font-bold/);
  assert.match(table, /text-\[11px\] font-normal/);
  assert.match(table, /\{row\.status \?/);
  assert.match(table, /\{row\.status\}/);
  assert.match(table, /row\.required/);
  assert.match(table, /Bắt buộc/);
  assert.match(table, /Tùy chọn/);
  assert.match(table, /row\.detail/);
  assert.match(table, /row\.action !== null && row\.action !== undefined/);
  assert.doesNotMatch(table, /\btruncate\b/);
  assert.match(table, /scope="col"/);
  assert.match(table, /scope="row"/);
  assert.match(table, /renderRow \? renderRow\(row\) :/);
  assert.equal((table.match(/\{row\.action\}/g) ?? []).length, 1);
  assert.match(table, /<caption className="sr-only">/);
});

test('PGD dossier presents the current step documents as an action table', () => {
  const source = read('components/PgdDossierStepWorkPanel.tsx');
  const table = read('components/PgdcnDossierDocumentActionTable.tsx');

  assert.match(source, /testId="pgd-dossier-document-action-table"/);
  assert.equal((table.match(/<th scope="col"/g) ?? []).length, 3);
  assert.doesNotMatch(table, /\{row\.step\}/);
  assert.match(table, /Tài liệu cần có/);
  assert.match(source, /Đã có/);
  assert.match(source, /Chưa có/);
  assert.match(source, /Soạn thảo tài liệu/);
  assert.match(source, /Bổ sung tệp/);
  assert.doesNotMatch(source, /Mở checklist/);
  assert.match(source, /onOpenChecklist\?\.\(item\.code\)/);
});

test('PGD supplement action preselects the exact missing document', () => {
  const stepPanel = read('components/PgdDossierStepWorkPanel.tsx');
  const evidencePanel = read('components/PgdCaseEvidencePanel.tsx');
  const workspace = read('components/PgdWorkspace.tsx');

  assert.match(stepPanel, /initialRequirementCode/);
  assert.match(evidencePanel, /initialRequirementCode/);
  assert.match(stepPanel, /selectedSupplementRequirementCode/);
  assert.match(workspace, /onOpenChecklist=\{\(\) => setSelectedStepId\('intake'\)\}/);
});

test('PGD drafting action keeps dossier context in same-tab navigation', () => {
  const source = read('components/PgdWorkspace.tsx');
  const panel = read('components/PgdDossierStepWorkPanel.tsx');

  assert.match(source, /return buildPgdDraftingRoute\(/);
  assert.match(source, /requestId: request\.id/);
  assert.match(source, /requirementCode: input\.requirementCode/);
  assert.match(source, /templateKind: input\.templateKind/);
  assert.match(source, /returnTo: buildPgdDossierReturnRoute\(request\.id, \{ step: stepId \}\)/);
  const draftingLink = panel.match(/<a href=\{draftingHref\}([^>]*)>/);
  assert.ok(draftingLink, 'the document action opens its generated dossier drafting route');
  assert.doesNotMatch(draftingLink[1], /target=/, 'internal drafting stays in the current tab');
});

test('PGD and PCN document actions use compact desktop controls without shrinking mobile hit areas', () => {
  const css = read('index.css');
  const pcn = read('components/PcnDossierNodeWorkPanel.tsx');
  const pgd = read('components/PgdDossierStepWorkPanel.tsx');

  assert.match(css, /\.dossier-action-compact/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(pcn, /dossier-action-compact/);
  assert.match(pgd, /dossier-action-compact/);
});
