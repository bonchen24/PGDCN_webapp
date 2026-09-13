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

test('PGD dossier presents the current step documents as an action table', () => {
  const source = read('components/PgdDossierStepWorkPanel.tsx');
  const table = read('components/PgdcnDossierDocumentActionTable.tsx');

  assert.match(source, /testId="pgd-dossier-document-action-table"/);
  assert.match(table, /Bước/);
  assert.match(table, /Tài liệu cần có/);
  assert.match(source, /Đã có/);
  assert.match(source, /Chưa có/);
  assert.match(source, /Soạn thảo tài liệu/);
  assert.match(source, /Bổ sung tài liệu/);
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

test('PGD drafting action opens a dedicated page with dossier context', () => {
  const source = read('components/PgdWorkspace.tsx');
  const panel = read('components/PgdDossierStepWorkPanel.tsx');

  assert.match(source, /pgdcn\/pgd\/drafting/);
  assert.match(panel, /target="_blank"/);
  assert.match(source, /requestId/);
  assert.match(source, /requirementCode/);
  assert.match(source, /templateKind/);
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
