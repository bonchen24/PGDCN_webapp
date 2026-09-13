import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PGD dossier detail uses a flat native rail with twelve numbered work tabs', () => {
  const flow = read('components/PgdDossierFlow.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  for (const marker of [
    'role="tablist"',
    'role="tab"',
    'pgd-dossier-step-tab-${step.id}',
    'mobile-scroll-x',
    'aria-selected',
    'ArrowRight',
    'Home',
    'Tiếp nhận PYC',
    'Kiểm tra phạm vi & năng lực',
    'Phân công giám định',
    'Lập kế hoạch',
    'Kiểm tra hiện trường',
    'Lấy mẫu & niêm phong',
    'Giao mẫu / lập PYC PTN',
    'Tiếp nhận KQTN',
    'Xem xét KQTN',
    'Lập báo cáo',
    'Phê duyệt & ký',
    'Trả kết quả & lưu trữ',
    'FILE',
    'ACTION',
    'APPROVAL',
    'END',
  ]) assert.match(flow, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(flow, /index \+ 1/);
  assert.match(workspace, /PgdDossierFlow/);
  assert.match(workspace, /PgdDossierStepWorkPanel/);
  assert.doesNotMatch(workspace, /PgdWorkflowMap/);
});

test('PGD native step panel keeps the existing work actions behind each tab', () => {
  const panel = read('components/PgdDossierStepWorkPanel.tsx');
  for (const marker of [
    'PgdCaseEvidencePanel',
    'PgdDossierOperationsPanel',
    'PgdAssignmentStepPanel',
    'PgdPlanStepPanel',
    'PgdFieldInspectionStepPanel',
    'PgdLabRequestStepPanel',
    'PgdResultsStepPanel',
    'Bắt đầu xử lý',
    'Hoàn tất việc',
    'Mở checklist',
    'Mở hồ sơ đầy đủ',
  ]) assert.match(panel, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(panel, /role="tabpanel"/);
});
