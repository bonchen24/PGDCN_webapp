import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const issuanceSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
const composeSource = fs.readFileSync(new URL('../docker-compose.pcn.yml', import.meta.url), 'utf8');

test('PCN documents use a private Storage pointer boundary instead of JSONB bytes', () => {
  assert.match(serverSource, /app\.post\("\/api\/pcn\/files"/);
  assert.match(serverSource, /app\.get\("\/api\/pcn\/files\/:assetId"/);
  assert.match(serverSource, /PCN_STORAGE_BUCKET/);
  assert.match(serverSource, /'pcn-files'/);
  assert.match(composeSource, /PCN_STORAGE_BUCKET:\s*\$\{PCN_STORAGE_BUCKET:-pcn-files\}/);
  assert.match(serverSource, /source_collection/);
  assert.match(serverSource, /source_document_id/);
  assert.match(serverSource, /source_json_path/);
  assert.match(serverSource, /sha256/);
  assert.match(serverSource, /DATABASE_PROFILE === 'pcn'/);
});

test('PCN upload boundary allows only client-owned attachment sources', () => {
  assert.match(serverSource, /const PCN_FILE_UPLOAD_SOURCE_COLLECTIONS = new Set\(\[/);
  assert.match(serverSource, /'dossierDocuments'/);
  assert.match(serverSource, /'pcnQualityDocuments'/);
  assert.match(serverSource, /'returnedResults'/);
  assert.match(serverSource, /'issuancePackages'/);
  assert.match(serverSource, /PCN_FILE_UPLOAD_SOURCE_COLLECTIONS\.has\(sourceCollection\)/);
  assert.match(serverSource, /sourceCollection === 'pcnQualityDocuments' && !requirePcnAdmin\(req, res\)/);
  assert.match(serverSource, /sourceCollection === 'dossierDocuments'/);
  assert.match(serverSource, /sourceData\.requirementId/);
  assert.match(serverSource, /buildPcnDossierDocumentId\(String\(sourceData\.dossierId/);
  assert.match(serverSource, /sourceJsonPath !== 'fileAssetId'/);
  assert.doesNotMatch(serverSource.slice(serverSource.indexOf('const PCN_FILE_UPLOAD_SOURCE_COLLECTIONS'), serverSource.indexOf('function getDbCollection')), /pcnGeneratedDocuments|pcnOfficialGeneratedDocuments|pcnTemplateDefinitions/);
});

test('PCN issuance UI exposes the attachment boundary without embedding file bytes', () => {
  assert.match(issuanceSource, /onAttachFile/);
  assert.match(issuanceSource, /fileAssetIds/);
  assert.match(issuanceSource, /Tải tệp/);
  assert.doesNotMatch(issuanceSource, /arrayBuffer\(\)|readAsDataURL/);
});

// --- End of pcn-file-boundary.test.ts ---
