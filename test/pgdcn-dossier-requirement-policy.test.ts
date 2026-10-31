import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectDossierRequirementPolicy,
  validateDossierRequirementPolicy,
  type DossierRequirementPolicy,
} from '../utils/pgdcnDossierRequirementPolicy.ts';
import { buildPcnDossierChecklist } from '../utils/pcnDossierDocuments.ts';
import { buildPgdDossierChecklist, reconcilePgdDossierChecklist } from '../utils/pgdDossier.ts';

const conditionalSteelPolicy: DossierRequirementPolicy = {
  defaultClass: 'DEFAULT_CONDITIONAL',
  appliesWhen: {
    operator: 'ALL',
    conditions: [
      { key: 'PGD_PRODUCT_GROUP', values: ['MACHINERY_LINE'] },
      { key: 'PGD_METHOD', values: ['QT-GĐ-12'] },
    ],
  },
  sourceMode: 'CREATE_DOCX',
  cardinality: { min: 1, max: 1 },
};

test('conditional requirement is required only when its allowlisted PGD context matches', () => {
  assert.deepEqual(projectDossierRequirementPolicy(conditionalSteelPolicy, {
    domain: 'PGD',
    productGroup: 'MACHINERY_LINE',
    method: 'QT-GĐ-12',
  }), { applicability: 'APPLICABLE', required: true });

  assert.deepEqual(projectDossierRequirementPolicy(conditionalSteelPolicy, {
    domain: 'PGD',
    productGroup: 'MACHINERY_LINE',
    method: 'QT-GĐ-04',
  }), { applicability: 'NOT_APPLICABLE', required: false });
});

test('PCN field conditions do not match PGD context or a different PCN field', () => {
  const policy: DossierRequirementPolicy = {
    defaultClass: 'DEFAULT_CONDITIONAL',
    appliesWhen: { operator: 'ANY', conditions: [{ key: 'PCN_FIELD', values: ['QC9'] }] },
    sourceMode: 'UPLOAD',
    cardinality: { min: 1, max: 2 },
  };

  assert.deepEqual(projectDossierRequirementPolicy(policy, { domain: 'PCN', fieldCodes: ['QC9'] }), {
    applicability: 'APPLICABLE', required: true,
  });
  assert.deepEqual(projectDossierRequirementPolicy(policy, { domain: 'PCN', fieldCodes: ['QC4'] }), {
    applicability: 'NOT_APPLICABLE', required: false,
  });
  assert.deepEqual(projectDossierRequirementPolicy(policy, { domain: 'PGD', productGroup: 'OTHER' }), {
    applicability: 'NOT_APPLICABLE', required: false,
  });
});

test('optional and free-added requirements remain non-blocking while retaining checklist applicability', () => {
  for (const defaultClass of ['DEFAULT_OPTIONAL', 'FREE_ADDITIONAL'] as const) {
    assert.deepEqual(projectDossierRequirementPolicy({
      defaultClass,
      sourceMode: 'MULTI',
      cardinality: { min: 1 },
    }, { domain: 'PGD', productGroup: 'OTHER' }), {
      applicability: 'APPLICABLE', required: false,
    });
  }
});

test('policy validation rejects arbitrary condition keys, unsupported PGD methods, and invalid cardinality', () => {
  const invalid = validateDossierRequirementPolicy({
    defaultClass: 'DEFAULT_CONDITIONAL',
    appliesWhen: { operator: 'ALL', conditions: [{ key: 'CUSTOM_EXPRESSION', values: ['true'] }] },
    sourceMode: 'CREATE_DOCX',
    cardinality: { min: 0, max: 1 },
  } as unknown as DossierRequirementPolicy, 'PGD');
  assert.ok(invalid.some((error) => error.toLocaleLowerCase('vi-VN').includes('điều kiện')));
  assert.ok(invalid.some((error) => error.toLocaleLowerCase('vi-VN').includes('số lượng')));

  const unsupportedMethod = validateDossierRequirementPolicy({
    ...conditionalSteelPolicy,
    appliesWhen: { operator: 'ALL', conditions: [{ key: 'PGD_METHOD', values: ['DELETE TABLE'] }] },
  }, 'PGD');
  assert.ok(unsupportedMethod.some((error) => error.toLocaleLowerCase('vi-VN').includes('phương pháp')));
});

test('PGD checklist snapshots conditional policy without pretending a missing file exists', () => {
  const rows = buildPgdDossierChecklist('MACHINERY_LINE', '2026-10-31T00:00:00.000Z', {
    method: 'QT-GĐ-04',
    requirementPolicies: { MACHINERY_SYNCHRONIZATION_ASSESSMENT: conditionalSteelPolicy },
  });
  const row = rows.find((item) => item.requirementCode === 'MACHINERY_SYNCHRONIZATION_ASSESSMENT');
  assert.equal(row?.applicability, 'NOT_APPLICABLE');
  assert.equal(row?.required, false);
  assert.equal(row?.status, 'MISSING');
  assert.deepEqual(row?.requirementPolicy, conditionalSteelPolicy);
});

test('PGD checklist reconcile preserves the policy snapshot from dossier creation', () => {
  const initial = buildPgdDossierChecklist('MACHINERY_LINE', '2026-10-31T00:00:00.000Z', {
    method: 'QT-GĐ-12', requirementPolicies: { MACHINERY_SYNCHRONIZATION_ASSESSMENT: conditionalSteelPolicy },
  });
  const reconciled = reconcilePgdDossierChecklist('MACHINERY_LINE', initial, [], '2026-11-01T00:00:00.000Z');
  assert.deepEqual(reconciled.find((item) => item.requirementCode === 'MACHINERY_SYNCHRONIZATION_ASSESSMENT')?.requirementPolicy, conditionalSteelPolicy);
  assert.equal(reconciled.find((item) => item.requirementCode === 'MACHINERY_SYNCHRONIZATION_ASSESSMENT')?.applicability, 'APPLICABLE');
});

test('PCN checklist distinguishes optional requirement policy from the legacy catalog default', () => {
  const rows = buildPcnDossierChecklist('dossier-1', ['QC4'], undefined, '2026-10-31T00:00:00.000Z', {
    requirementPolicies: {
      'QC4-COMMERCIAL': {
        defaultClass: 'DEFAULT_OPTIONAL',
        sourceMode: 'UPLOAD',
        cardinality: { min: 1, max: 2 },
      },
    },
  });
  const row = rows.find((item) => item.requirementId === 'QC4-COMMERCIAL');
  assert.equal(row?.applicability, 'APPLICABLE');
  assert.equal(row?.required, false);
  assert.equal(row?.status, 'MISSING');
  assert.deepEqual(row?.requirementPolicy, {
    defaultClass: 'DEFAULT_OPTIONAL', sourceMode: 'UPLOAD', cardinality: { min: 1, max: 2 },
  });
});
