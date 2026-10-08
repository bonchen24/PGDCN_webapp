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
  const server = read('server.legacy.ts');
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

test('PGD dossier delete is a confirmed hard-delete boundary with minimal audit traceability', () => {
  const server = read('server.legacy.ts');
  const domain = read('utils/pgdDomain.ts');
  const api = read('utils/pgdApi.ts');
  assert.match(server, /app\.delete\('\/api\/pgd\/requests\/:requestId'/);
  assert.match(server, /getPgdDossierDeletionDenial/);
  assert.match(server, /confirmationCode/);
  assert.match(server, /DELETE FROM app_documents/);
  assert.match(server, /file_assets/);
  assert.match(server, /writePgdActivity/);
  assert.match(domain, /getPgdDossierDeletionDenial/);
  assert.match(api, /deletePgdInspection/);
  assert.match(api, /confirmationCode/);
});

test('PCN dossier delete has a specialized confirmed hard-delete boundary', () => {
  const server = read('server.legacy.ts');
  const rbac = read('utils/pcnRbac.ts');
  const api = read('utils/pcnDossierApi.ts');
  const store = read('store-pcn.ts');
  const detail = read('components/PcnDossierDetailView.tsx');
  assert.match(server, /app\.delete\('\/api\/pcn\/dossiers\/:dossierId'/);
  assert.match(server, /confirmationCode/);
  assert.match(server, /getPcnDossierDeletionDenial/);
  assert.match(server, /DELETE FROM app_documents/);
  assert.match(server, /file_assets/);
  assert.match(rbac, /getPcnDossierDeletionDenial/);
  assert.match(api, /deletePcnDossier/);
  assert.match(api, /confirmationCode/);
  assert.match(store, /deleteDossier/);
  assert.match(detail, /Xóa vĩnh viễn hồ sơ/);
});

test('PGD dossier edit is a scoped allowlist mutation with audit traceability', () => {
  const server = read('server.legacy.ts');
  const domain = read('utils/pgdDomain.ts');
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(server, /app\.put\('\/api\/pgd\/requests\/:requestId'/);
  assert.match(server, /getPgdDossierEditDenial/);
  assert.match(server, /diffActivityFields\(current, next/);
  assert.match(server, /writePgdActivity/);
  assert.match(domain, /getPgdDossierEditDenial/);
  assert.match(api, /updatePgdInspectionRequest/);
  assert.match(store, /updateRequest/);
  assert.match(workspace, /Sửa thông tin hồ sơ/);
});

test('PGD artifact linkages cast identifier values before building JSONB', () => {
  const server = read('server.legacy.ts');
  assert.match(server, /jsonb_build_object\('assignmentId', \$2::text\)/);
  assert.match(server, /jsonb_build_object\('fieldInspectionId', \$2::text\)/);
  assert.match(server, /jsonb_build_object\('inspectionPlanId', \$2::text\)/);
  assert.match(server, /jsonb_build_object\('labResultReviewId', \$2::text\)/);
  assert.match(server, /jsonb_build_object\('dossierIndexId', \$2::text\)/);
  assert.match(server, /jsonb_build_object\('status', 'RESULT_RECEIVED', 'resultId', \$2::text\)/);
  assert.match(server, /jsonb_build_object\('handedOverAt', \$2::text, 'laboratoryName', \$3::text\)/);
});

test('PGD dossier upload tracks the private object for rollback after a later transaction failure', () => {
  const server = read('server.legacy.ts');
  assert.match(server, /uploadedObjectPath/);
  assert.match(server, /uploadedBucketName/);
  assert.match(server, /deleteObject\(\{[\s\S]{0,180}objectPath: uploadedObjectPath/);
});

test('PGD bootstrap and store carry dossier evidence without reusing PCN or generated-document state', () => {
  const server = read('server.legacy.ts');
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  assert.match(server, /PGD_COLLECTIONS\.dossierDocuments[\s\S]{0,900}dossierDocuments:/);
  assert.match(api, /dossierDocuments/);
  assert.match(store, /dossierDocuments/);
  assert.doesNotMatch(store, /CertificationDossier|PCN_CERTIFICATION_FIELD_CODES/);
});
