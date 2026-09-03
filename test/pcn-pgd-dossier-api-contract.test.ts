import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD client exposes request-scoped dossier evidence and sample lifecycle endpoints', () => {
  const api = read('utils/pgdApi.ts');
  assert.match(api, /requests\/\$\{encodeURIComponent\(requestId\)\}\/dossier-documents/);
  assert.match(api, /getPgdDossierDocuments/);
  assert.match(api, /savePgdDossierDocument/);
  assert.match(api, /dossier-documents\/\$\{encodeURIComponent\(documentId\)\}\/download/);
  assert.match(api, /destroyPgdSample/);
  assert.match(api, /samples\/\$\{encodeURIComponent\(sampleId\)\}\/destroy/);
  assert.doesNotMatch(api, /\/api\/db/);
});

test('PGD server keeps dossier evidence separate from generated documents and never hard-deletes samples', () => {
  const server = read('server.ts');
  assert.match(server, /PGD_COLLECTIONS\.dossierDocuments/);
  assert.match(server, /\/api\/pgd\/requests\/:requestId\/dossier-documents/);
  assert.match(server, /\/api\/pgd\/dossier-documents\/:documentId\/download/);
  assert.match(server, /\/api\/pgd\/samples\/:sampleId\/destroy/);
  assert.match(server, /getPgdDossierRequirements/);
  assert.match(server, /getPgdDossierRequirementStationKey/);
  assert.match(server, /getPgdOperationalStepAccess/);
  assert.ok((server.match(/assertPgdRequestStationMutationAllowed\(/g) || []).length >= 10, 'all request-scoped PGD mutation routes must enforce a station gate');
  assert.match(server, /buildPgdDossierDocument/);
  assert.match(server, /markPgdSampleDestroyed/);
  assert.match(server, /writePgdActivity/);
  assert.doesNotMatch(server, /app\.delete\('\/api\/pgd\/samples/);
  assert.doesNotMatch(server, /DELETE FROM app_documents[\s\S]{0,200}pgdSamples/);
});

test('PGD dossier upload tracks the private object for rollback after a later transaction failure', () => {
  const server = read('server.ts');
  assert.match(server, /uploadedObjectPath/);
  assert.match(server, /uploadedBucketName/);
  assert.match(server, /deleteObject\(\{[\s\S]{0,180}objectPath: uploadedObjectPath/);
});

test('PGD bootstrap and store carry dossier evidence without reusing PCN or generated-document state', () => {
  const server = read('server.ts');
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  assert.match(server, /PGD_COLLECTIONS\.dossierDocuments[\s\S]{0,900}dossierDocuments:/);
  assert.match(api, /dossierDocuments/);
  assert.match(store, /dossierDocuments/);
  assert.doesNotMatch(store, /CertificationDossier|PCN_CERTIFICATION_FIELD_CODES/);
});
