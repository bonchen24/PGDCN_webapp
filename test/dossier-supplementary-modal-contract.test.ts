import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pcnPanel = read('components/PcnDossierNodeWorkPanel.tsx');
const pgdPanel = read('components/PgdDossierStepWorkPanel.tsx');
const pcnApi = read('utils/pcnDossierDocumentApi.ts');
const pcnDocuments = read('utils/pcnDossierDocuments.ts');
const pcnRoute = read('app/api/pcn/dossiers/[dossierId]/supplementary-attachments/route.ts');
const pgdRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/route.ts');

test('PCN supplementary action opens the metadata dialog and persists title, description, and optional file', () => {
  assert.match(pcnPanel, /data-testid="pcn-supplementary-trigger"[\s\S]*?onClick=\{\(\) => openSupplementaryModal\(\)\}/);
  assert.match(pcnPanel, /onUploadSupplementary\(\{[\s\S]*?title: suppTitle\.trim\(\)[\s\S]*?description: suppDescription\.trim\(\)[\s\S]*?\.{3}\(suppFile \? \{ file: suppFile \} : \{\}\)/);
  assert.match(pcnPanel, /if \(!saved\) return;[\s\S]*?setSupplementaryModalOpen\(false\)/);
  assert.match(pcnApi, /supplementaryItemId\?: string/);
  assert.match(pcnApi, /title: string/);
  assert.match(pcnApi, /description\?: string/);
  assert.match(pcnDocuments, /metadataOnly: true/);
  assert.match(pcnRoute, /buildPcnSupplementaryDossierMetadata/);
  assert.match(pcnRoute, /supplementaryItemId/);
  assert.match(pcnRoute, /document_id\s*=\s*\$3/, 'legacy uploaded supplementary attachments remain uploadable as later versions');
});

test('PGD supplementary action saves a metadata-only item and retains the modal on failure', () => {
  assert.match(pgdPanel, /data-testid="pgd-supplementary-trigger"[\s\S]*?onClick=\{\(\) => \{[\s\S]*?setSuppModalOpen\(true\)/);
  assert.match(pgdPanel, /await onUploadSupplementary\(\{[\s\S]*?stageId:[\s\S]*?title:[\s\S]*?description:[\s\S]*?file:/);
  assert.match(pgdPanel, /if \(!saved\) return;[\s\S]*?setSuppModalOpen\(false\)/);
  assert.match(pgdRoute, /isSupplementary && !file && !title/);
  assert.match(pgdRoute, /supplementaryStageId[\s\S]*?requirementCode/);
});
