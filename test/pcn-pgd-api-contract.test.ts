import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD client exposes dedicated endpoints and never uses generic DB writes', () => {
  const source = read('utils/pgdApi.ts');
  assert.match(source, /\/api\/pgd\/bootstrap/);
  assert.match(source, /\/api\/pgd\/requests/);
  assert.match(source, /\/api\/pgd\/requests\/\$\{encodeURIComponent/);
  assert.match(source, /\/api\/pgd\/samples/);
  assert.match(source, /\/api\/pgd\/lab-results/);
  assert.match(source, /\/api\/pgd\/reports/);
  assert.doesNotMatch(source, /\/api\/db/);
});

test('PGD server boundary is domain-scoped and has no PCN collection fallback', () => {
  const source = read('server.ts');
  assert.match(source, /\/api\/pgd\/bootstrap/);
  assert.match(source, /\/api\/pgd\/requests/);
  assert.match(source, /\/api\/pgd\/requests\/:requestId\/transition/);
  assert.match(source, /\/api\/pgd\/assignments/);
  assert.match(source, /\/api\/pgd\/field-inspections/);
  assert.match(source, /\/api\/pgd\/samples/);
  assert.match(source, /\/api\/pgd\/lab-requests/);
  assert.match(source, /\/api\/pgd\/lab-results/);
  assert.match(source, /\/api\/pgd\/certificates/);
  assert.match(source, /readPgdTransitionContext/);
  assert.match(source, /getPgdOperationalStepGateDenial/);
  assert.match(source, /getPgdPostSignatureMutationDenial/);
  assert.match(source, /validatePgdResultValues/);
  assert.match(source, /snapshotPgdResultTemplate/);
  assert.match(source, /validatePgdAssignment/);
  assert.match(source, /validatePgdInspectors/);
  assert.match(source, /buildPgdLabRequest/);
  assert.match(source, /buildPgdLabResult/);
  assert.match(source, /getPgdAssignmentApprovalDenial/);
  assert.match(source, /getPgdCollectionMutationDenial/);
  assert.match(source, /requirePgdSession[\s\S]{0,700}departmentScopes/);
  assert.match(source, /writePgdActivity/);
  assert.match(source, /pgdActivityLogs/);
  assert.match(source, /pgdInspectionReports/);
  assert.match(source, /status: 'DRAFT'/);
  assert.match(source, /const approvedReport[\s\S]{0,180}status: 'APPROVED'/);
  assert.match(source, /Mã PYC PGD \$\{request\.requestCode\} đã tồn tại/);
  assert.match(source, /pgdInspectionRequests/);
  assert.match(source, /const pgdUsers[\s\S]{0,180}departmentScopes/);
  assert.match(source, /data->>'domain' = 'pgd' ORDER BY document_id/);
  assert.match(source, /assertPgdRequestEvidenceMutationAllowed\(current\)/);
  assert.doesNotMatch(source, /collectionName === 'certificationDossiers'.*[\s\S]{0,180}PGD/);
});

test('PCN schema seeds the PGD catalog and keeps QC20 only in PCN fields', () => {
  const source = read('sql/pcn-schema.sql');
  assert.match(source, /pgdResultTemplates/);
  assert.match(source, /STEEL_LOT_INSPECTION/);
  assert.match(source, /MACHINERY_LINE_INSPECTION/);
  assert.match(source, /COAL_LOT_INSPECTION/);
  assert.match(source, /pcnCertificationFields.*QC20|QC20.*pcnCertificationFields/);
  assert.doesNotMatch(source, /pgdInspectionRequests[^\n]*QC20|QC20[^\n]*pgdInspectionRequests/);
});

test('QC20 PCN profile carries the standard amendment and Method 7 references', () => {
  const schema = read('sql/pcn-schema.sql');
  const templateCatalog = read('utils/pcnDossierTemplateCatalog.ts');
  const workflow = read('utils/pcnWorkflow.ts');
  assert.match(schema, /Sửa đổi 1:2021 QCVN 20:2019\/BKHCN/);
  assert.match(schema, /METHOD_7|Phương thức 7/);
  assert.match(templateCatalog, /QC20_GCN\.docx/);
  assert.match(templateCatalog, /QC20_QD\.docx/);
  assert.match(templateCatalog, /QCVN 20:2019\/BKHCN/);
  assert.match(workflow, /code: 'QC20'[\s\S]{0,280}method: 'METHOD_7'/);
});
