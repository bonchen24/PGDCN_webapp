import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PGD station pages expose source-derived forms and dossier operations', () => {
  const files = ['PgdPreparationStationPanel.tsx', 'PgdFieldStationPanel.tsx', 'PgdLabStationPanel.tsx', 'PgdResultsStationPanel.tsx'];
  const source = files.map((file) => read(`components/${file}`)).join('\n') + read('components/PgdStationFormsPanel.tsx');
  for (const marker of ['Phiếu phân công', 'Kế hoạch', 'Biên bản kiểm tra tại hiện trường', 'Lấy mẫu', 'Phiếu giao nhận mẫu', 'kết quả PTN', 'Báo cáo giám định', 'Chứng thư giám định', 'PgdCaseEvidencePanel', 'PgdDossierOperationsPanel']) {
    assert.match(source, new RegExp(marker, 'i'));
  }
  assert.doesNotMatch(source, /báo giá|thanh toán|tạm ứng|còn lại/i);
});

test('PGD dossier workspace wires the shared source forms to the operational branches', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  for (const marker of ['PgdSourceFormsPanel', 'PgdOperationalStationKey', 'PgdCaseEvidencePanel']) {
    assert.match(workspace, new RegExp(marker));
  }
  assert.match(workspace, /selectedRequestId/);
  assert.match(workspace, /dossierRequirements/);
});

test('PGD lab and report forms never invent positive results or conclusions', () => {
  const panel = read('components/PgdStationFormsPanel.tsx');
  for (const inventedValue of [
    "value: 'Đạt theo phạm vi kết quả được tiếp nhận'",
    "review?.conclusion || 'Kết quả thử nghiệm phù hợp với tiêu chuẩn áp dụng.'",
    "report?.conclusion || 'Kết quả giám định phù hợp với phạm vi và tiêu chuẩn đã thống nhất.'",
    "completeness: 'COMPLETE', conformity: 'CONFORMING'",
    "recommendation: reviewConformity ===",
  ]) {
    assert.equal(panel.includes(inventedValue), false, `Unexpected positive default/save value: ${inventedValue}`);
  }
  for (const requiredGuard of [
    "Cần nhập giá trị cho ít nhất một dòng kết quả PTN.",
    "Cần chọn độ đầy đủ kết quả PTN.",
    "Cần chọn đánh giá sự phù hợp kết quả PTN.",
    "Cần nhập kết luận đánh giá kết quả thử nghiệm.",
    "Cần nhập kết luận báo cáo giám định.",
  ]) {
    assert.ok(panel.includes(requiredGuard), `Missing Vietnamese validation: ${requiredGuard}`);
  }
  assert.match(panel, /setReviewConclusion\(review\?\.conclusion \|\| ''\)/);
  assert.match(panel, /setConclusion\(report\?\.conclusion \|\| certificate\?\.conclusion \|\| ''\)/);
});
