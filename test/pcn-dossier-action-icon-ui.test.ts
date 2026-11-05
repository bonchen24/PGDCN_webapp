import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const actionTable = read('components/PgdcnDossierDocumentActionTable.tsx');
const pcnDocumentPanel = read('components/PcnDossierNodeWorkPanel.tsx');
const pgdDocumentPanel = read('components/PgdDossierStepWorkPanel.tsx');

test('document action tables expose three compact columns and accessible controls', () => {
  assert.equal((actionTable.match(/<th scope="col"/g) ?? []).length, 3);
  assert.doesNotMatch(actionTable, /<th[^>]*>Bước<\/th>/);
  assert.match(actionTable, /className="w-40[^"]*"/);
  assert.match(pcnDocumentPanel, /aria-label=\{`Xem \$\{item\.label\}`\}/);
  assert.match(pcnDocumentPanel, /aria-label="Tải xuống"/);
  assert.match(pcnDocumentPanel, /aria-label="Thao tác khác"/);
  assert.match(pgdDocumentPanel, /aria-label=\{`Xem \$\{document\.title\}`\}/);
  assert.match(pgdDocumentPanel, /aria-label="Tải xuống"/);
  assert.match(pgdDocumentPanel, /aria-label=\{`Mở \$\{document\.title\} trong tab mới`\}/);
});

test('eye actions select the reader while external open and download remain separate', () => {
  const pcnEye = pcnDocumentPanel.match(/<button[^>]*onClick=\{\(\) => onSelectFile\?\.\(\{ id: `document:[\s\S]*?<\/button>/)?.[0] || '';
  const pgdEye = pgdDocumentPanel.match(/<button[^>]*title=\{`Xem \$\{document\.title\}`\}[\s\S]*?<\/button>/)?.[0] || '';

  assert.ok(pcnEye.includes('onSelectFile'));
  assert.doesNotMatch(pcnEye, /href=|target=|download=/);
  assert.ok(pgdEye.includes('onSelectDocument'));
  assert.doesNotMatch(pgdEye, /href=|target=|download=/);
  assert.match(pcnDocumentPanel, /getPcnFileUrl\(version\.assetId\)\} target="_blank"/);
  assert.match(pcnDocumentPanel, /download=\{version\.fileName\}/);
  assert.match(pgdDocumentPanel, /getPgdDossierDocumentDownloadUrl\(document\.id, \{ inline: true \}\)/);
  assert.match(pgdDocumentPanel, /target="_blank"/);
  assert.match(pgdDocumentPanel, /download=\{document\.fileName\}/);
  assert.match(pcnEye, /min-h-11 min-w-11[\s\S]*?sm:min-h-9 sm:min-w-9/);
  assert.match(pgdEye, /min-h-11 min-w-11[\s\S]*?sm:min-h-8 sm:min-w-8/);
});

// --- End of pcn-dossier-action-icon-ui.test.ts ---
