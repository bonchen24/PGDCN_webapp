import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD document client exposes dedicated DOCX template settings and generation endpoints', () => {
  const source = read('utils/pgdApi.ts');
  assert.match(source, /\/api\/pgd\/document-templates/);
  assert.match(source, /\/api\/pgd\/documents\/generate/);
  assert.match(source, /getPgdDocumentDownloadUrl/);
  assert.match(source, /\/api\/pgd\/documents\/\$\{encodeURIComponent\(documentId\)\}\/download/);
  assert.match(source, /cellValues/);
  assert.doesNotMatch(source, /\/api\/db/);
  assert.doesNotMatch(source, /CertificationDossier|PCN_CERTIFICATION_FIELD_CODES/);
});

test('PGD UI has a dedicated DOCX settings surface and document generation module', () => {
  const documentPanel = read('components/PgdDocumentGenerationPanel.tsx');
  assert.match(documentPanel, /Cài đặt template DOCX PGD/);
  assert.match(documentPanel, /placeholder/);
  assert.match(documentPanel, /Sinh DOCX|Sinh PDF/);
  assert.match(documentPanel, /DECISION: 'Quyết định PGD'/);
  assert.match(documentPanel, /getPgdDocumentDownloadUrl/);
  assert.match(documentPanel, /PgdDocumentTemplate/);
  assert.match(documentPanel, /steelLotSize: request\.productDetails\?\.steelLotSize/);
  assert.match(documentPanel, /steelSameGradeMultiProduct: request\.productDetails\?\.steelSameGradeMultiProduct/);
  assert.match(documentPanel, /steelManualSamplingPlanNote: request\.productDetails\?\.steelManualSamplingPlanNote/);
  assert.match(documentPanel, /productForm: request\.productDetails\?\.productForm/);
  assert.match(documentPanel, /countryOfOrigin: request\.productDetails\?\.countryOfOrigin/);
  assert.match(documentPanel, /manufacturerLotCode: request\.productDetails\?\.manufacturerLotCode/);
  assert.match(documentPanel, /hsCode: request\.productDetails\?\.hsCode/);
  assert.match(documentPanel, /lotDefinition: request\.productDetails\?\.lotDefinition/);
  assert.match(documentPanel, /assessmentMethod: request\.assessmentMethod/);
  assert.doesNotMatch(documentPanel, /PgdCellManager/);
  assert.doesNotMatch(documentPanel, /\/api\/db|PCN_OPERATIONAL_TEMPLATE|QC20/i);
});

test('PGD server keeps document generation in PGD collections and private output metadata', () => {
  const source = read('server.ts');
  assert.match(source, /\/api\/pgd\/document-templates/);
  assert.match(source, /\/api\/pgd\/documents\/generate/);
  assert.match(source, /PGD_COLLECTIONS\.documents/);
  assert.match(source, /domain: 'pgd'/);
  assert.doesNotMatch(source, /PGD.*\/api\/db|\/api\/pgd\/documents\/generate[\s\S]{0,1600}certificationDossiers/i);
});

test('PGD settings expose the packaged DOCX source and its placeholder inspection', () => {
  const api = read('utils/pgdApi.ts');
  const panel = read('components/PgdDocumentGenerationPanel.tsx');
  const tableEditor = read('components/PgdTableFieldEditor.tsx');
  const server = read('server.ts');
  assert.match(api, /getPgdTemplateSourceUrl/);
  assert.match(api, /\/api\/pgd\/document-templates\/\$\{encodeURIComponent\(templateId\)\}\/source/);
  assert.match(panel, /sourceInspection/);
  assert.match(panel, /missingPlaceholderKeys/);
  assert.match(panel, /extraPlaceholderKeys/);
  assert.match(panel, /Thiếu placeholder/);
  assert.match(panel, /Thừa placeholder/);
  assert.match(panel, /Tải DOCX nguồn/);
  assert.match(panel, /PgdTableFieldEditor/);
  assert.match(tableEditor, /Thêm dòng/);
  assert.match(tableEditor, /Xóa dòng/);
  assert.doesNotMatch(panel, /JSON array hợp lệ/);
  assert.match(server, /\/api\/pgd\/document-templates\/:templateId\/source/);
  assert.match(server, /inspectPgdTemplateSource/);
});
