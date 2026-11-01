import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PGD operations defaults to a work queue and keeps the data register as a secondary view', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  const queue = read('components/PgdDossierQueueView.tsx');
  for (const marker of ['PgdDossierQueueView', 'Hàng đợi hồ sơ', 'Sổ dữ liệu']) assert.match(workspace, new RegExp(marker));
  for (const marker of ['Mã PYC', 'Khách hàng', 'Bước hiện tại / tiếp theo', 'Đầu mục hồ sơ còn thiếu', 'Chủ hồ sơ', 'Mở hồ sơ', 'mobile-scroll-x', 'aria-label="Hàng đợi hồ sơ PGD"']) {
    assert.match(queue, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workspace, /viewMode.*QUEUE.*DATA/);
  assert.match(workspace, /PgdSummaryRegisterView/);
});

test('PGD dossier card summary renders all canonical operational fields and meets official UI contract', () => {
  const queue = read('components/PgdDossierQueueView.tsx');
  const workspace = read('components/PgdWorkspace.tsx');

  // PGD card summary requires: mã PYC, khách hàng, đối tượng, việc hiện tại/tiếp theo, mức hoàn thiện, tài liệu thiếu, chủ hồ sơ, CTA mở
  assert.match(queue, /PgdDossierSummaryCard/);
  assert.match(queue, /item\.nextAction/);
  assert.match(queue, /item\.completeness/);
  assert.match(queue, /item\.missingRequiredCount/);
  assert.match(queue, /item\.ownerName/);

  // Canonical full-screen PGD detail exposes header context summary with current step, missing required docs, and owner
  assert.match(workspace, /data-testid="pgd-dossier-context-summary"/);
  assert.match(workspace, /Chủ hồ sơ:/);
});

test('PGD dossier header only summarizes checklist readiness from a loaded current-document projection', () => {
  const workspace = read('components/PgdWorkspace.tsx');

  assert.match(workspace, /getCurrentPgdDossierDocuments\(dossierDocuments\)/);
  assert.match(workspace, /dossierRequirements\.length > 0/);
  assert.match(workspace, /!dossierLoading && !dossierError/);
});
