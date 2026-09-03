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
  assert.match(documentPanel, /getPgdDocumentDownloadUrl/);
  assert.match(documentPanel, /PgdDocumentTemplate/);
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
