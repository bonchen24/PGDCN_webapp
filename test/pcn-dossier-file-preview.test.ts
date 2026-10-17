import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PcnDossierFilePreview.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');

test('dossier file preview supports keyboard access and a safe unsupported-file download', () => {
  assert.match(source, /role="dialog" aria-modal="true" aria-labelledby="pcn-file-preview-title"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /focusReturnTarget\?\.focus\(\)/);
  assert.match(source, /break-words \[overflow-wrap:anywhere\]/);
  assert.match(source, /min-h-\[44px\] min-w-\[44px\]/);
  assert.match(source, /previewKind === 'UNSUPPORTED'[\s\S]*?getPcnFileUrl\(version\.assetId, \{ download: true \}\)/);
  assert.match(source, /<iframe[^>]*src=\{fileUrl\}/);
  assert.match(source, /<img[^>]*src=\{fileUrl\}/);
});
