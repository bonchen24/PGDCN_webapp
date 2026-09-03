import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { DEFAULT_PCN_CERTIFICATION_FIELDS } from '../utils/pcnWorkflow.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, getPcnDocumentRequirements } from '../utils/pcnDossierDocuments.ts';
import { getPcnDossierTemplateProfiles } from '../utils/pcnDossierTemplateCatalog.ts';
import { PCN_TEMPLATE_CATALOG, getPcnTemplatesForFields } from '../utils/pcnTemplateCatalog.ts';
import { getPcnFieldCodes } from '../utils/pcnAuth.ts';
import { classifyPcnCode } from '../utils/pcnCodePolicy.ts';
import { buildPcnQualityDocument } from '../utils/pcnQualityDocuments.ts';
import { mapPcnRosterRow } from '../utils/pcnUserRoster.ts';
import { buildPcnSampleLot, getPcnSampleLabCodesForFields } from '../utils/pcnSampleFlow.ts';
import { validatePcnProposalIntake } from '../utils/pcnIntakePolicy.ts';

test('QC20 is a first-class certification field with standards metadata', () => {
  const qc20 = DEFAULT_PCN_CERTIFICATION_FIELDS.find((field) => field.code === 'QC20');

  assert.ok(qc20, 'QC20 must be available in the active field catalog');
  assert.equal(qc20.name, 'Quy chuẩn 20');
  assert.deepEqual(qc20.standardRefs, [
    'QCVN 20:2019/BKHCN',
    'Sửa đổi 1:2021 QCVN 20:2019/BKHCN',
  ]);
  assert.equal(qc20.scopeStatus, 'NEEDS_PCN_CONFIRMATION');
  assert.equal(qc20.active, true);
});

test('QC20 receives a complete dossier checklist routed through the existing stations', () => {
  const requirements = getPcnDocumentRequirements(['QC20']);
  const codes = new Set(requirements.map((item) => item.code));
  assert.match(requirements.find((item) => item.code === 'COMMERCIAL')?.name || '', /hải quan/i);

  for (const code of ['PROPOSAL', 'COMMERCIAL', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'TEST_REPORT', 'CERTIFICATION_RESULT', 'CERTIFICATE', 'DECISION', 'CLIENT_PACKAGE', 'ARCHIVE_SCAN']) {
    assert.ok(codes.has(code), `QC20 checklist is missing ${code}`);
  }
  assert.ok(codes.has('SCOPE_EVIDENCE'));
  assert.ok(codes.has('LOT_IDENTITY'));
  assert.ok(requirements.every((item) => item.fieldCode === 'QC20'));
  assert.ok(requirements.every((item) => item.stationKeys && item.stationKeys.length > 0));
  assert.ok(DEFAULT_PCN_DOCUMENT_REQUIREMENTS.some((item) => item.id === 'QC20-CERTIFICATE'));
});

test('QC20 template metadata is safe-by-default and discoverable for a multi-field dossier', () => {
  const qc20Templates = getPcnTemplatesForFields(['QC4', 'QC20']);

  assert.ok(qc20Templates.some((template) => template.fieldCode === 'QC20'));
  assert.ok(qc20Templates.filter((template) => template.fieldCode === 'QC20').every((template) => template.status !== 'APPROVED'));
  assert.ok(qc20Templates.filter((template) => template.fieldCode === 'QC20').every((template) => !('sourceLabel' in template)));
  assert.ok(PCN_TEMPLATE_CATALOG.some((template) => template.fieldCode === 'QC4'));
});

test('QC20 has a blank dossier-pack profile without pretending to have source forms', () => {
  const profile = getPcnDossierTemplateProfiles().find((item) => item.fieldCode === 'QC20');

  assert.ok(profile, 'QC20 must be present in the blank dossier-pack catalog');
  assert.equal(profile.isBlank, true);
  assert.match(profile.title, /Quy chuẩn 20/);
  assert.doesNotMatch(JSON.stringify(profile), /sourceBasis|sourceFormReferences|sourceMappings/);
  assert.ok(profile.stationGroups.some((group) => group.key === 'SAMPLING_LAB'));
  assert.ok(profile.officialOutputs.includes('CERTIFICATE'));
});

test('PCN SQL bootstrap includes QC20 without changing the existing field model', () => {
  const sql = fs.readFileSync('sql/pcn-schema.sql', 'utf8');

  assert.match(sql, /'pcnCertificationFields',\s*'QC20'/);
  assert.match(sql, /QCVN 20:2019\/BKHCN/);
  assert.match(sql, /"id":"QC20-PROPOSAL"/);
  assert.match(sql, /"id":"QC20-CERTIFICATE"/);
  assert.match(sql, /"id":"QC20-DECISION"/);
  assert.match(sql, /"id":"QC20-SCOPE_EVIDENCE"/);
  assert.match(sql, /"id":"QC20-LOT_IDENTITY"/);
});

test('PCN user field scope preserves QC20 while rejecting unknown scope values', () => {
  assert.deepEqual(getPcnFieldCodes({ fieldCodes: ['qc20', 'QC4', 'QC20', 'DDT'] }), ['QC20', 'QC4']);
});

test('PCN roster mapping accepts QC20 in a staff field assignment', () => {
  const mapped = mapPcnRosterRow({
    rowNumber: 4,
    name: 'Chuyên gia QC20',
    accountType: 'staff',
    position: 'Chuyên viên chứng nhận',
    fieldAssignment: 'QC20',
  });

  assert.deepEqual(mapped.fieldCodes, ['QC20']);
});

test('PCN code policy recognizes QC20 certification references without inventing the code', () => {
  const result = classifyPcnCode('QC20', 'QC20.123.1');

  assert.equal(result.recognized, true);
  assert.equal(result.family, 'CERTIFICATION_REFERENCE');
  assert.equal(result.normalized, 'QC20.123.1');
});

test('PCN quality documents accept QC20 as a controlled field scope', () => {
  const document = buildPcnQualityDocument({
    id: 'qc20-procedure',
    documentCode: 'QT-QC20-001',
    title: 'Quy trình QC20',
    category: 'PROCEDURE',
    fieldCodes: ['QC20'],
    version: '01',
  });

  assert.deepEqual(document.fieldCodes, ['QC20']);
});

test('QC20 routes to chemical analysis by default while QC4/QC9 keep the three testing-room routes', () => {
  assert.deepEqual(getPcnSampleLabCodesForFields(['QC20']), ['CHEMICAL_ANALYSIS']);
  assert.deepEqual(getPcnSampleLabCodesForFields(['QC4']), ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY']);
  assert.deepEqual(getPcnSampleLabCodesForFields(['QC4', 'QC20']), ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY', 'CHEMICAL_ANALYSIS']);
});

test('QC20 intake requires the minimum scope and lot-definition evidence', () => {
  const incomplete = validatePcnProposalIntake({
    customerSnapshot: { name: 'Công ty A', address: 'Hà Nội', taxId: '0100000000' },
    warehouseAddress: 'Kho A', productName: 'Thép không gỉ', productType: 'Tấm', model: '304', brand: 'A',
    specifications: 'Tấm inox', manufacturer: 'Nhà máy A', quantity: 1, fieldCodes: ['QC20'],
  });
  assert.equal(incomplete.valid, false);
  assert.deepEqual(incomplete.issues.map((issue) => issue.field), [
    'qc20Scope.productForm',
    'qc20Scope.grade',
    'qc20Scope.nominalDimensions',
    'qc20Scope.hsCode',
    'qc20Scope.appliedStandard',
    'qc20Scope.lotDefinition',
  ]);

  const complete = validatePcnProposalIntake({
    customerSnapshot: { name: 'Công ty A', address: 'Hà Nội', taxId: '0100000000' },
    warehouseAddress: 'Kho A', productName: 'Thép không gỉ', productType: 'Tấm', model: '304', brand: 'A',
    specifications: 'Tấm inox', manufacturer: 'Nhà máy A', quantity: 1, fieldCodes: ['QC20'],
    qc20Scope: {
      productForm: 'Tấm/cuộn', grade: 'SUS304', nominalDimensions: '2 x 1220 x 2440 mm', hsCode: '7219',
      appliedStandard: 'JIS G4304', lotDefinition: 'PRODUCT_LOT', manufacturerLotCode: 'HEAT-01',
    },
  });
  assert.equal(complete.valid, true);
});

test('QC20 lot keeps its confirmed material/lot snapshot for downstream flow', () => {
  const { lot, routes } = buildPcnSampleLot({
    id: 'lot-qc20-001', dossierId: 'dossier-qc20-001', lotCode: 'QC20-0001-01', sampleName: 'Thép không gỉ SUS304',
    quantity: 2, fieldCodes: ['QC20'], labCodes: ['CHEMICAL_ANALYSIS'],
    qc20Snapshot: {
      grade: 'SUS304', nominalDimensions: '2 x 1220 x 2440 mm', manufacturerLotCode: 'HEAT-01', lotDefinition: 'PRODUCT_LOT',
    },
  }, '2026-08-31T00:00:00.000Z');
  assert.equal(lot.qc20Snapshot?.grade, 'SUS304');
  assert.equal(lot.qc20Snapshot?.lotDefinition, 'PRODUCT_LOT');
  assert.deepEqual(routes.map((route) => route.labCode), ['CHEMICAL_ANALYSIS']);
});
