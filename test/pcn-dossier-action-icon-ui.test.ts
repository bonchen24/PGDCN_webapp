import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const actionTable = read('components/PgdcnDossierDocumentActionTable.tsx');
const pcnDocumentPanel = read('components/PcnDossierNodeWorkPanel.tsx');
const pgdDocumentPanel = read('components/PgdDossierStepWorkPanel.tsx');

test('document action columns use compact icon controls with accessible names', () => {
  assert.match(actionTable, /className="w-40[^"]*"[^>]*>Hành động/);
  assert.match(pcnDocumentPanel, /aria-label="Xem tài liệu"/);
  assert.match(pcnDocumentPanel, /aria-label=\{item\.pendingDraftId \? "Mở lại bản nháp đang chờ xác nhận" : "Soạn thảo tài liệu"\}/);
  assert.match(pcnDocumentPanel, /aria-label="Tải tài liệu"/);
  assert.match(pcnDocumentPanel, /aria-label="Thao tác khác"/);
  assert.match(pgdDocumentPanel, /aria-label="Mở tài liệu"/);
  assert.match(pgdDocumentPanel, /aria-label="Soạn thảo tài liệu"/);
  assert.match(pgdDocumentPanel, /aria-label="Bổ sung tệp"/);
});

// --- End of pcn-dossier-action-icon-ui.test.ts ---
