import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const pcnWorkspace = read('components/PcnWorkspace.tsx');
const pcnDossierDetail = read('components/PcnDossierDetailView.tsx');
const pcnDrafting = read('components/PcnDraftingWorkspaceView.tsx');
const pcnSampleFlow = read('components/PcnSampleFlowView.tsx');
const pgdWorkspace = read('components/PgdWorkspace.tsx');
const pgdStationForms = read('components/PgdStationFormsPanel.tsx');
const pgdSourceForms = read('components/PgdSourceFormsPanel.tsx');
const pgdResults = read('components/PgdResultsStationPanel.tsx');
const pgdProductFields = read('components/PgdProductGroupFields.tsx');
const pgdDocumentGeneration = read('components/PgdDocumentGenerationPanel.tsx');
const pgdDocxSettings = read('components/PgdDocxSettingsModal.tsx');

test('dense workspace cards use additional internal columns on wide screens', () => {
  assert.match(pcnWorkspace, /lg:grid-cols-4/);
  assert.match(pcnDossierDetail, /xl:grid-cols-5/);
  assert.match(pgdWorkspace, /lg:grid-cols-4/);
  assert.match(pgdStationForms, /lg:grid-cols-4/);
    assert.match(pgdSourceForms, /lg:grid-cols-4/);
    assert.match(pgdResults, /lg:grid-cols-4/);
    assert.match(pcnSampleFlow, /lg:grid-cols-4/);
    assert.match(pgdDocumentGeneration, /lg:grid-cols-4/);
});

test('business data-entry fields do not carry instructional placeholders', () => {
    const sources = [pcnWorkspace, pcnDossierDetail, pcnDrafting, pgdWorkspace, pgdStationForms, pgdSourceForms, pgdResults, pgdProductFields];
  const instructionalPlaceholder = /placeholder="(?:Ví dụ|Bắt buộc|Nêu|Ghi|Phân tách|Công suất|Hiện trạng|Mối liên kết|Đủ \/ thiếu|Cỡ hạt|TCVN|Kết luận|Nội dung|Nhận xét|Xe \/ container|Kho, cảng|Nơi lấy|Thông tin mẫu)/;
    sources.forEach((source) => assert.doesNotMatch(source, instructionalPlaceholder));
    assert.doesNotMatch(pcnSampleFlow, /placeholder="(?:Mã mẫu|Loại mẫu|Model \*|SL|Đơn vị)"/);
    assert.doesNotMatch(pgdDocumentGeneration, /\[\[\{cell\.key\}\]\]/);
});

test('DOCX settings keeps mapping outside the runtime editing surface', () => {
  assert.doesNotMatch(pgdDocxSettings, /PgdCellManager/);
  assert.doesNotMatch(pgdDocxSettings, /Cấu hình cell DOCX PGD/);
  assert.doesNotMatch(pgdDocxSettings, /Lưu cấu hình cell/);
});
