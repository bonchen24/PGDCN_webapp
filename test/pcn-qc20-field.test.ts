import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_PCN_CERTIFICATION_FIELDS } from '../utils/pcnWorkflow.ts';
import { getPcnDocumentRequirements } from '../utils/pcnDossierDocuments.ts';
import { getPcnTemplatesForFields, PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';
import { getPcnFieldCodes } from '../utils/pcnAuth.ts';
import { getPcnSampleLabCodesForFields } from '../utils/pcnSampleFlow.ts';

test('PCN active field catalog excludes stainless steel', () => {
  assert.deepEqual(DEFAULT_PCN_CERTIFICATION_FIELDS.map((field) => field.code), ['QC4', 'QC9']);
  assert.equal(DEFAULT_PCN_CERTIFICATION_FIELDS.some((field) => field.code === 'QC20'), false);
  assert.deepEqual(getPcnFieldCodes({ fieldCodes: ['QC20', 'QC4', 'QC9'] }), ['QC4', 'QC9']);
});
test('PCN checklist and template catalogs reject QC20 instead of creating a PCN dossier', () => {
  assert.deepEqual(getPcnDocumentRequirements(['QC20']), []);
  assert.equal(getPcnTemplatesForFields(['QC20']).length, 0);
  assert.equal(PCN_TEMPLATE_CATALOG.some((template) => template.fieldCode === 'QC20'), false);
});

test('PCN sample routing has no stainless-steel laboratory route', () => {
  assert.deepEqual(getPcnSampleLabCodesForFields(['QC20']), []);
  assert.deepEqual(getPcnSampleLabCodesForFields(['QC4']), ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY']);
});
