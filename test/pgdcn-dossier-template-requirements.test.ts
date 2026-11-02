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
  multiplicity: 'MULTIPLE',
};

test('custom requirement definitions accept the supported source and policy fields', () => {
  assert.deepEqual(validateDossierTemplateRequirementDefinition(validRequirement, 'PCN'), { valid: true, errors: [] });
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
