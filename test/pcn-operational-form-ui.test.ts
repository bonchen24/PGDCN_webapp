import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modalSource = fs.readFileSync(new URL('../components/PcnOperationalFormModal.tsx', import.meta.url), 'utf8');
const detailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const generationSource = fs.readFileSync(new URL('../components/PcnDocumentGenerationPanel.tsx', import.meta.url), 'utf8');

test('operational form modal covers every PCN station form and uses structured controls', () => {
  for (const label of [
    'Phiếu phân công chứng nhận',
    'Kế hoạch đánh giá CNSP',
    'Biên bản kiểm tra tại hiện trường',
    'Biên bản lấy mẫu',
    'Biên bản mã hóa mẫu',
    'Báo cáo đánh giá hồ sơ',
    'Hợp đồng dịch vụ',
  ]) assert.match(modalSource, new RegExp(label));
  for (const field of ['assignmentNumber', 'plannedStartAt', 'inspectedAt', 'sampledAt', 'lotCode', 'reportNumber', 'contractNumber']) {
    assert.match(modalSource, new RegExp(field));
  }
  assert.match(modalSource, /validatePcnOperationalForm/);
  assert.match(modalSource, /aria-label="Đóng form nghiệp vụ"/);
  assert.match(modalSource, /type="submit"/);
});

test('operational form exposes an authoritative error summary and linked field errors', () => {
  assert.match(modalSource, /useRef/);
  assert.match(modalSource, /pcn-operational-form-error-summary/);
  assert.match(modalSource, /role="alert"/);
  assert.match(modalSource, /tabIndex=\{-1\}/);
  assert.match(modalSource, /C\u1ea7n ki\u1ec3m tra l\u1ea1i th\u00f4ng tin/);
  assert.match(modalSource, /ref=\{errorSummaryRef\}/);
  assert.match(modalSource, /Object\.entries\(errors\)[\s\S]*FIELD_LABELS\[field\]/);
  assert.match(modalSource, /setErrors\(nextErrors\);[\s\S]*requestAnimationFrame/);
  assert.match(modalSource, /<form[\s\S]*noValidate/);
  assert.match(modalSource, /const getFieldControlId = \(field: string\) => \x60pcn-operational-\$\{kind\.toLowerCase\(\)\}-\$\{field\}\x60/);
  assert.match(modalSource, /id=\{getFieldControlId\(field\)\}/);
  assert.match(modalSource, /errorId=\{getFieldErrorId\(field\)\}/);
  assert.match(modalSource, /<span id=\{errorId\}/);
  assert.match(modalSource, /aria-invalid=\{Boolean\(errors\[field\]\)\}/);
  assert.match(modalSource, /aria-describedby=\{errors\[field\] \? getFieldErrorId\(field\) : undefined\}/);
  assert.ok((modalSource.match(/mobile-touch-target min-h-11/g) || []).length >= 3);
});
test('dossier card opens station forms in-place and persists operationalForms', () => {
  assert.match(detailSource, /PcnOperationalFormModal/);
  assert.match(detailSource, /operationalForms/);
  assert.match(detailSource, /mergePcnOperationalForm/);
  assert.match(detailSource, /onUpdateDossier/);
  assert.match(detailSource, /Biểu mẫu theo bước/);
  assert.match(detailSource, /canProcessPcnOperationalForm/);
  assert.match(detailSource, /Chưa đến bước hiện tại/);
  assert.match(generationSource, /canProcessPcnGeneratedDocument/);
  assert.match(generationSource, /Biểu mẫu này thuộc bước sau/);
  assert.doesNotMatch(detailSource, /href="\/pcn\/(assignment|evaluation-plan|field-inspection|sample-taking|sample-coding|evaluation-report)"/);
  assert.doesNotMatch(detailSource, /documentKind\s*:\s*['"]KQTN/);
});
