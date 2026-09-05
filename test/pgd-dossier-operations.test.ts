import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPgdInspectionRequest,
  assignPgdDossierOwner,
  type PgdInspectionRequest,
} from '../utils/pgdDomain.ts';
import {
  buildPgdDossierChecklist,
  buildPgdDossierDocument,
  getCurrentPgdDossierDocuments,
  getPgdDossierRequirements,
  getPgdDossierRequirementForTemplate,
} from '../utils/pgdDossier.ts';
import { buildPgdDossierPackageManifest } from '../utils/pgdDossierPackage.ts';

const intake = {
  id: 'pgd-request-operations-1',
  requestCode: 'PGD-2026-OPS-001',
  intakeChannel: 'EMAIL' as const,
  requester: { name: 'Công ty A', address: 'Hà Nội', contactPerson: 'Nguyễn Văn A', phone: '0900000000' },
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' },
  productGroup: 'STEEL_METAL' as const,
  catalogItemId: 'STEEL_LOT_INSPECTION',
  productName: 'Thép tấm không gỉ',
  quantity: 10,
  unit: 'tấn',
  inspectionScope: 'Kiểm tra lô hàng và lấy mẫu thử nghiệm',
  inspectionLocation: 'Kho khách hàng',
  standards: ['QCVN 20:2019/BKHCN'],
  method: 'TT58',
  assessmentMethod: 'METHOD_7' as const,
  lotCode: 'LOT-001',
  productDetails: {
    productForm: 'Thép tấm',
    grade: '304',
    dimensions: '2 x 1000 x 2000 mm',
    productStandard: 'JIS G4305',
    origin: 'Việt Nam',
    countryOfOrigin: 'Việt Nam',
    manufacturer: 'Nhà máy A',
    manufacturerLotCode: 'MFG-LOT-001',
    importer: 'Công ty A',
    hsCode: '7219.32.00',
    lotDefinition: 'SHIPMENT_LOT' as const,
    customsDocuments: [{ document: 'Tờ khai hải quan', number: 'HQ-001' }],
  },
};

function request(): PgdInspectionRequest {
  return createPgdInspectionRequest(intake, '2026-09-03T01:00:00.000Z');
}

test('PGD request has an explicit dossier owner and manager reassignment keeps an audit timestamp', () => {
  const initial = assignPgdDossierOwner(request(), 'nv.phu.trach', '2026-09-03T02:00:00.000Z');
  assert.equal(initial.ownerUsername, 'nv.phu.trach');
  assert.equal(initial.ownerAssignedAt, '2026-09-03T02:00:00.000Z');

  const reassigned = assignPgdDossierOwner(initial, 'manager.pgd', '2026-09-03T03:00:00.000Z');
  assert.equal(reassigned.ownerUsername, 'manager.pgd');
  assert.equal(reassigned.ownerAssignedAt, '2026-09-03T03:00:00.000Z');
  assert.equal(reassigned.id, initial.id);
  assert.equal(reassigned.domain, 'pgd');
});

test('PGD dossier requirements map every operational template to a checklist item without QC20', () => {
  const requirements = getPgdDossierRequirements('STEEL_METAL');
  const codes = new Set(requirements.map((item) => item.code));
  for (const code of [
    'REQUEST_PYC',
    'ASSIGNMENT_FORM',
    'INSPECTION_PLAN',
    'FIELD_INSPECTION_MINUTES',
    'FIELD_ACTIVITY_LOG',
    'SAMPLE_HANDOVER_LAB',
    'LAB_RESULT',
    'LAB_RESULT_REVIEW',
    'INSPECTION_REPORT',
    'DECISION',
    'INSPECTION_CERTIFICATE',
    'DOSSIER_COVER',
  ]) assert.ok(codes.has(code), `missing ${code}`);
  assert.equal(requirements.some((item) => /QC20/i.test(JSON.stringify(item))), false);
  assert.equal(getPgdDossierRequirementForTemplate('INSPECTION_CERTIFICATE')?.code, 'INSPECTION_CERTIFICATE');
  assert.equal(getPgdDossierRequirementForTemplate('SAMPLE_HANDOVER')?.code, 'SAMPLE_HANDOVER_LAB');
  assert.equal(getPgdDossierRequirementForTemplate('SAMPLE_TAKING', 'STEEL_METAL')?.code, 'FIELD_SAMPLE_TAKING');
});

test('PGD intake creates a persisted checklist snapshot with required gaps', () => {
  const checklist = buildPgdDossierChecklist('STEEL_METAL', '2026-09-03T01:00:00.000Z');
  assert.ok(checklist.length > 0);
  assert.equal(checklist.find((item) => item.requirementCode === 'REQUEST_PYC')?.status, 'MISSING');
  assert.equal(checklist.find((item) => item.requirementCode === 'REQUEST_PYC')?.required, true);
  assert.equal(checklist.find((item) => item.requirementCode === 'COMMERCIAL_CONTRACT')?.required, false);
  assert.equal(checklist.some((item) => /QC20/i.test(JSON.stringify(item))), false);
});

test('PGD package manifest is deterministic, PGD-only, and reports missing private assets', () => {
  const checklist = buildPgdDossierChecklist('STEEL_METAL', '2026-09-03T03:00:00.000Z');
  const manifest = buildPgdDossierPackageManifest({
    dossierCode: 'PGD-2026-OPS-001',
    ownerUsername: 'nv.phu.trach',
    now: '2026-09-03T04:00:00.000Z',
    checklist,
    pointers: [
      {
        id: 'generated-1',
        domain: 'pgd',
        requestId: 'pgd-request-operations-1',
        fileName: 'bien-ban-hien-truong.docx',
        sourceCollection: 'pgdDocuments',
        sourceDocumentId: 'generated-1',
        version: 2,
        checksum: 'a'.repeat(64),
        fileAssetId: 'asset-1',
        kind: 'GENERATED_DOCUMENT',
      },
      {
        id: 'dossier-1',
        domain: 'pgd',
        requestId: 'pgd-request-operations-1',
        fileName: 'phieu-yeu-cau.pdf',
        sourceCollection: 'pgdDossierDocuments',
        sourceDocumentId: 'dossier-1',
        version: 1,
        checksum: 'b'.repeat(64),
        kind: 'DOSSIER_DOCUMENT',
      },
    ],
  });
  assert.equal(manifest.format, 'PGD_DOSSIER_PACKAGE_V1');
  assert.equal(manifest.dossierCode, 'PGD-2026-OPS-001');
  assert.equal(manifest.complete, false);
  assert.deepEqual(manifest.missingAssetIds, ['dossier-1']);
  assert.ok(manifest.missingRequirementCodes.includes('REQUEST_PYC'));
  assert.equal(manifest.checklist.find((item) => item.requirementCode === 'REQUEST_PYC')?.status, 'MISSING');
  assert.deepEqual(manifest.entries.map((entry) => entry.archivePath), ['01-bien-ban-hien-truong.docx', '02-phieu-yeu-cau.pdf']);
  assert.equal(manifest.entries[0]?.assetId, 'asset-1');
  assert.throws(() => buildPgdDossierPackageManifest({
    dossierCode: 'PGD-2026-OPS-001',
    pointers: [{
      id: 'pcn-1',
      domain: 'pcn',
      requestId: 'pcn-1',
      fileName: 'wrong.pdf',
      sourceCollection: 'certificationDocuments',
      sourceDocumentId: 'pcn-1',
      version: 1,
      checksum: 'c'.repeat(64),
      kind: 'DOSSIER_DOCUMENT',
    } as any],
  }), /PGD/);
});

test('current dossier projection keeps only the newest version for each checklist requirement', () => {
  const createDocument = (id: string, requirementCode: string, version: number, uploadedAt: string) => buildPgdDossierDocument({
    id,
    requestId: 'pgd-request-operations-1',
    requirementCode,
    title: requirementCode,
    fileName: `${id}.pdf`,
    version,
    checksum: 'd'.repeat(64),
    uploadedByUsername: 'nv.phu.trach',
  }, uploadedAt);
  const current = getCurrentPgdDossierDocuments([
    createDocument('pyc-v1', 'REQUEST_PYC', 1, '2026-09-03T01:00:00.000Z'),
    createDocument('pyc-v2', 'REQUEST_PYC', 2, '2026-09-03T02:00:00.000Z'),
    createDocument('report-v1', 'INSPECTION_REPORT', 1, '2026-09-03T01:30:00.000Z'),
  ]);
  assert.equal(current.length, 2);
  assert.equal(current.find((document) => document.requirementCode === 'REQUEST_PYC')?.id, 'pyc-v2');
  assert.equal(current.find((document) => document.requirementCode === 'INSPECTION_REPORT')?.id, 'report-v1');
});
