import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDossierTemplateRequirementDefinition } from '../utils/pgdcnDossierTemplate.ts';
import type { DossierTemplateRequirementDefinition } from '../types.ts';

const validRequirement: DossierTemplateRequirementDefinition = {
  domain: 'PCN',
  id: 'pcn-custom-7f91',
  code: 'FIELD_PHOTOS',
  name: 'Ảnh hiện trường',
  level: 'CONDITIONAL',
  source: 'UPLOAD_EXTERNAL',
  condition: 'RESULT_FAILED',
  ownerRole: 'CERTIFICATION_EXPERT',
  multiplicity: 'SINGLE',
};

test('custom requirement definitions accept the supported source and policy fields', () => {
  assert.deepEqual(validateDossierTemplateRequirementDefinition(validRequirement, 'PCN'), { valid: true, errors: [] });
});

test('custom requirements cannot advertise multiple files while runtime keeps one current attachment', () => {
  const pcn = validateDossierTemplateRequirementDefinition({ ...validRequirement, multiplicity: 'MULTIPLE' }, 'PCN');
  const pgd = validateDossierTemplateRequirementDefinition({
    ...validRequirement,
    domain: 'PGD',
    id: 'pgd-custom-multi-01',
    ownerRole: 'PGD_FIELD_INSPECTOR',
    multiplicity: 'MULTIPLE',
  }, 'PGD');

  assert.equal(pcn.valid, false);
  assert.equal(pgd.valid, false);
  assert.ok(pcn.errors.some((error) => /một tệp hiện hành|MULTIPLE|chưa hỗ trợ/i.test(error)));
  assert.ok(pgd.errors.some((error) => /một tệp hiện hành|MULTIPLE|chưa hỗ trợ/i.test(error)));
});

test('DOCX-linked draft source is available for PGD only', () => {
  const linkedDocx = {
    ...validRequirement,
    source: 'DRAFT_FROM_DOCX_TEMPLATE' as const,
    linkedDocxTemplateId: 'approved-template-1',
  };

  assert.equal(validateDossierTemplateRequirementDefinition({ ...linkedDocx, domain: 'PGD', id: 'pgd-custom-docx-01', ownerRole: 'PGD_FIELD_INSPECTOR' }, 'PGD').valid, true);
  const pcn = validateDossierTemplateRequirementDefinition(linkedDocx, 'PCN');
  assert.equal(pcn.valid, false);
  assert.ok(pcn.errors.some((error) => /PCN.*DOCX|DOCX.*PCN/i.test(error)));
});

test('custom requirements reject an unsafe domain, source, role, or conditional key', () => {
  const invalid = {
    ...validRequirement,
    domain: 'PGD',
    source: 'FILE_SYSTEM_PATH',
    condition: 'EVAL' as any,
    ownerRole: 'ROOT',
  };
  const result = validateDossierTemplateRequirementDefinition(invalid as any, 'PCN');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.toLowerCase().includes('domain')));
  assert.ok(result.errors.some((error) => error.toLowerCase().includes('nguồn')));
  assert.ok(result.errors.some((error) => error.toLowerCase().includes('condition')));
  assert.ok(result.errors.some((error) => error.toLowerCase().includes('vai trò')));
});

test('DOCX and business-module sources require a stable scoped reference', () => {
  const docx = validateDossierTemplateRequirementDefinition({
    ...validRequirement,
    source: 'DRAFT_FROM_DOCX_TEMPLATE',
  }, 'PCN');
  const business = validateDossierTemplateRequirementDefinition({
    ...validRequirement,
    source: 'BUSINESS_MODULE_LINK',
  }, 'PCN');

  assert.equal(docx.valid, false);
  assert.ok(docx.errors.some((error) => error.includes('DOCX')));
  assert.equal(business.valid, false);
  assert.ok(business.errors.some((error) => error.toLowerCase().includes('module')));
});

test('non-conditional requirements cannot carry a condition and codes are stable identifiers', () => {
  const invalid = validateDossierTemplateRequirementDefinition({
    ...validRequirement,
    code: 'Ảnh tại chỗ',
    level: 'OPTIONAL',
    condition: 'RESULT_FAILED',
  }, 'PCN');

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('condition')));
  assert.ok(invalid.errors.some((error) => error.toLowerCase().includes('mã')));
});
