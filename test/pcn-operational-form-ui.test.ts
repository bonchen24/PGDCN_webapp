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
