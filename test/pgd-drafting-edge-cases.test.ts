import assert from 'node:assert/strict';
import test from 'node:test';

import { getPgdDossierRequirements } from '../utils/pgdDossier.ts';
import { getPgdDocumentTemplates } from '../utils/pgdDocumentTemplates.ts';
import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain.ts';
import {
  getPgdDocumentsForRequirement,
  getPgdDocumentRequirementCode,
  hasPgdDeepContext,
  isPgdDocumentForRequirement,
  resolvePgdDraftingContext,
} from '../utils/pgdDrafting.ts';

const request = { id: 'req-1', productGroup: 'STEEL_METAL' } as PgdInspectionRequest;

const generated = (id: string, kind: string, requestId = request.id) => ({
  id,
  domain: 'pgd',
  requestId,
  kind,
  generatedAt: id === 'older' ? '2026-09-20T00:00:00.000Z' : '2026-09-21T00:00:00.000Z',
} as unknown as PgdGeneratedDocument);

test('PGD deep context is locked only by a dossier/request identity, not by kind alone', () => {
  assert.equal(hasPgdDeepContext({}), false);
  assert.equal(hasPgdDeepContext({ templateKind: 'INSPECTION_PLAN' }), false);
  assert.equal(hasPgdDeepContext({ requestId: 'req-1', templateKind: 'INSPECTION_PLAN' }), true);
});

test('PGD generated/review documents are scoped to the active requirement', () => {
  const plan = generated('plan', 'INSPECTION_PLAN');
  const field = generated('field', 'FIELD_INSPECTION');
  const foreignRequest = generated('foreign', 'INSPECTION_PLAN', 'req-2');

  assert.equal(getPgdDocumentRequirementCode(plan, request.productGroup), 'INSPECTION_PLAN');
  assert.equal(getPgdDocumentRequirementCode(field, request.productGroup), 'FIELD_INSPECTION_MINUTES');
  assert.equal(isPgdDocumentForRequirement({
    document: field,
    requestId: request.id,
    requirementCode: 'INSPECTION_PLAN',
    productGroup: request.productGroup,
  }), false);
  assert.deepEqual(
    getPgdDocumentsForRequirement({
      documents: [foreignRequest, plan, field],
      requestId: request.id,
      requirementCode: 'FIELD_INSPECTION_MINUTES',
      productGroup: request.productGroup,
    }),
    [field],
  );
});

test('PGD drafting resolver follows the selected requirement and its mapped template', () => {
  const requirements = getPgdDossierRequirements(request.productGroup);
  const templates = getPgdDocumentTemplates();
  const resolved = resolvePgdDraftingContext({
    request,
    requirements,
    templates,
    selectedRequirementCode: 'FIELD_INSPECTION_MINUTES',
  });

  assert.equal(resolved.activeRequirementCode, 'FIELD_INSPECTION_MINUTES');
  assert.equal(resolved.activeRequirement?.code, 'FIELD_INSPECTION_MINUTES');
  assert.equal(resolved.selectedTemplate?.kind, 'FIELD_INSPECTION');
  assert.equal(resolved.invalidDeepContext, false);
});
