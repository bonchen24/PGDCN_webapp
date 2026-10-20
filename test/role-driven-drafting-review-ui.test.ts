import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('design documents source-first drafting and multi-role review', () => {
  const design = read('design.md');
  assert.match(design, /Phiếu yêu cầu giám định/);
  assert.match(design, /CertificationProposal.*Đề nghị/);
  assert.match(design, /Xác nhận/);
assert.match(design, /Xác nhận/);
  assert.match(design, /Người yêu cầu.*Tiếp nhận.*Quản lý.*Chuyên gia/);
  assert.match(design, /Soát xét hồ sơ/);
  assert.match(design, /upload.*ngoại sinh/i);
});

test('active dossier panels expose role-aware review copy', () => {
  const pgd = read('components/PgdDossierStepWorkPanel.tsx');
  const pcn = read('components/PcnDossierNodeWorkPanel.tsx');
  const pgdReviewSection = pgd.match(/<section\b(?=[^>]*aria-label="Soát xét tài liệu bắt buộc ở bước PGD hiện tại")[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(pgdReviewSection, /Soát xét bước này/);
  assert.match(pgdReviewSection, /Vai trò hiện tại/);
  assert.match(pgdReviewSection, /\{currentRole\}/);
  assert.match(pcn, /Soát xét hồ sơ/);
  assert.match(pcn, /Vai trò hiện tại/);
});
