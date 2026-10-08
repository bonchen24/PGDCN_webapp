import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';
import {
  buildPcnOfficialDocumentId,
  buildPcnOfficialFileAssetId,
  buildPcnOfficialFileName,
  getPcnOfficialSourceUpdatedAt,
  selectPcnOfficialTemplate,
} from '../utils/pcnOfficialDocumentPolicy.ts';

test('official template selection is limited to the dossier field and certification method', () => {
  const qc4Certificate = selectPcnOfficialTemplate(PCN_TEMPLATE_CATALOG, ['QC4'], 'METHOD_7', 'CERTIFICATE');
  assert.equal(qc4Certificate?.id, 'pcn-qc4-certificate-tool');
  assert.equal(selectPcnOfficialTemplate(PCN_TEMPLATE_CATALOG, ['QC9'], 'METHOD_1', 'CERTIFICATE')?.id, 'pcn-qc9-certificate-method-1');
  assert.equal(selectPcnOfficialTemplate(PCN_TEMPLATE_CATALOG, ['QC4'], 'METHOD_1', 'DECISION')?.id, 'pcn-qc4-decision-tool');
});

test('official document and asset identifiers are deterministic and format-specific', () => {
  const hash = 'a'.repeat(64);
  assert.equal(buildPcnOfficialDocumentId('issuance/1', 'template/1', 'DOCX', hash), 'pcn-official-issuance_1-template_1-docx-aaaaaaaaaaaaaaaa');
  assert.equal(buildPcnOfficialFileAssetId(hash), 'pcn-file-official-aaaaaaaaaaaaaaaa');
  assert.notEqual(buildPcnOfficialFileAssetId(hash, 'document-a'), buildPcnOfficialFileAssetId(hash, 'document-b'));
  assert.equal(buildPcnOfficialFileAssetId(hash, 'document-a'), buildPcnOfficialFileAssetId(hash, 'document-a'));
  assert.equal(buildPcnOfficialFileName('QC4-0665', 'CERTIFICATE', 'DOCX'), 'QC4-0665-gcn-chinh-thuc.docx');
  assert.equal(buildPcnOfficialFileName('QC4-0665', 'DECISION', 'PDF'), 'QC4-0665-quyet-dinh-chinh-thuc.pdf');
});

test('official source timestamp follows the newest issuance, dossier, or proposal update', () => {
  assert.equal(
    getPcnOfficialSourceUpdatedAt('2026-08-28T10:00:00.000Z', '2026-08-28T12:00:00.000Z', '2026-08-28T11:00:00.000Z'),
    '2026-08-28T12:00:00.000Z',
  );
  assert.equal(getPcnOfficialSourceUpdatedAt('2026-02-30T10:00:00.000Z', 'not-a-date'), undefined);
  assert.equal(getPcnOfficialSourceUpdatedAt(undefined, 'not-a-date'), undefined);
});

test('official generation has a session boundary, separate storage collections, and an explicit PDF capability gate', () => {
  const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
  const issuanceSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');

  assert.match(serverSource, /\/api\/pcn\/issuance\/:issuanceId\/official-documents\/generate/);
  assert.match(serverSource, /const actor = getPcnSessionUser\(req\);/);
  assert.match(serverSource, /pcnOfficialGeneratedDocuments/);
  assert.match(serverSource, /renderPcnDocxToPdf/);
  assert.match(serverSource, /source_document_id !== existing\.id/);
  assert.match(serverSource, /source_json_path !== 'fileAssetId'/);
  assert.match(serverSource, /generatedAsset\.bucket_name !== bucketName/);
  assert.match(serverSource, /generatedAsset\.object_path !== objectPath/);
  assert.match(serverSource, /generatedAsset\.mime_type !== mimeType/);
  assert.match(serverSource, /templateAsset\.source_json_path !== 'fileAssetId'/);
  assert.match(issuanceSource, /Sinh DOCX chính thức/);
  assert.match(issuanceSource, /Sinh PDF chính thức/);
  assert.match(issuanceSource, /formats/);
  assert.match(issuanceSource, /officialDocuments/);
  assert.match(issuanceSource, /Cần sinh lại/);
});

test('official generated pointers do not mutate issuance freshness metadata', () => {
  const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
  const generationRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"),
    serverSource.indexOf("app.post('/api/pcn/templates/import'"),
  );

  assert.doesNotMatch(generationRoute, /generatedFileAssetIds/);
  assert.doesNotMatch(generationRoute, /fileAssetIds:\s*\[\.\.\.new Set\(\[\.\.\.\(issuance\.fileAssetIds/);
  assert.match(generationRoute, /return \{ issuance, documents: generatedDocuments/);
});

test('official generation serializes a package and scopes assets to the generated document', () => {
  const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
  const generationRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"),
    serverSource.indexOf("app.post('/api/pcn/templates/import'"),
  );

  assert.match(generationRoute, /pg_advisory_xact_lock/);
  assert.match(generationRoute, /buildPcnOfficialFileAssetId\(sha256, documentId\)/);
  assert.match(generationRoute, /FROM file_assets WHERE id = \$1 LIMIT 1 FOR UPDATE/);
  assert.match(generationRoute, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(generationRoute, /existingAsset\.bucket_name !== bucketName/);
  assert.match(generationRoute, /existingAsset\.object_path !== objectPath/);
  assert.match(generationRoute, /templateAsset\.bucket_name !== bucketName/);
  assert.match(generationRoute, /templateAsset\.mime_type !== 'application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document'/);
  assert.match(generationRoute, /templateAsset\.byte_size/);
  assert.match(generationRoute, /templateAsset\.sha256/);
  assert.match(generationRoute, /const templateSha256 = createHash\('sha256'\)\.update\(downloadedTemplate\.body\)/);
  assert.match(generationRoute, /formats\.join\(['"]\/['"]\)/);
  assert.match(generationRoute, /const existingDownloaded = await storage\.downloadObject/);
  assert.match(generationRoute, /existingDownloaded\.body\.length !== Number\(existing\.byteSize\)/);
  assert.match(generationRoute, /createHash\('sha256'\)\.update\(existingDownloaded\.body\)/);
});

// --- End of pcn-official-document-policy.test.ts ---
