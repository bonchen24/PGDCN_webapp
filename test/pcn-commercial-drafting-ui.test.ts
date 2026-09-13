import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PCN commercial checklist routes to the independent drafting workspace', () => {
  const nodeWork = read('utils/pcnDossierNodeWork.ts');
  const detail = read('components/PcnDossierDetailView.tsx');
  const page = read('app/pgdcn/pcn/drafting/page.tsx');
  const panel = read('components/PcnDossierNodeWorkPanel.tsx');

  assert.match(nodeWork, /getPcnNodeDraftFormKind/);
  assert.match(nodeWork, /COMMERCIAL:\s*'COMMERCIAL'/);
  assert.match(detail, /getPcnNodeDraftFormKind/);
  assert.match(page, /getPcnNodeDraftFormKind/);
  assert.match(panel, /getPcnNodeDocumentGenerationKind\(item\.code\)/);
});
