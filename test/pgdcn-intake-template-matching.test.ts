import assert from 'node:assert/strict';
import test from 'node:test';

import type { PcnWorkflowTemplate } from '../types.ts';
import type { PgdProductGroup } from '../utils/pgdDomain.ts';
import type { PgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';
import {
  matchPcnPublishedWorkflowTemplates,
  matchPgdPublishedWorkflowTemplates,
  resolveWorkflowTemplateForCreate,
  resolveTemplateSelectionState,
} from '../utils/pgdcnIntakeTemplateMatching.ts';

// Hand-checked PCN fixtures
function createPcnTemplate(overrides: Partial<PcnWorkflowTemplate> = {}): PcnWorkflowTemplate {
  return {
    id: 'pcn-tpl-1',
    code: 'PCN-QC4-STD',
    name: 'PCN QC4 Tiêu chuẩn',
    description: 'Mẫu kiểm định QC4',
    appliesTo: { fieldCodes: ['QC4'] },
    version: 1,
    status: 'PUBLISHED',
    nodes: [
      { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['req-1'], active: true, sortOrder: 1 },
      { id: 'end', kind: 'END', label: 'Hoàn tất', requirementIds: [], active: true, sortOrder: 2 },
    ],
    transitions: [
      { id: 't-intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: 'ALWAYS' },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: 'admin',
    ...overrides,
  };
}

// Hand-checked PGD fixtures
function createPgdTemplate(overrides: Partial<PgdWorkflowTemplate> = {}): PgdWorkflowTemplate {
  return {
    domain: 'pgd',
    id: 'pgd-tpl-1',
    code: 'PGD-STEEL-STD',
    name: 'PGD Thép tiêu chuẩn',
    description: 'Mẫu giám định thép',
    appliesTo: { productGroups: ['STEEL_METAL'] as PgdProductGroup[] },
    version: 1,
    status: 'PUBLISHED',
    nodes: [
      { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementCodes: ['REQ_INTAKE'], active: true, sortOrder: 1 },
      { id: 'end', kind: 'END', label: 'Kết thúc', requirementCodes: ['REQ_END'], active: true, sortOrder: 2 },
    ],
    transitions: [
      { id: 't1', fromNodeId: 'intake', toNodeId: 'end', condition: 'ALWAYS' },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: 'admin',
    ...overrides,
  };
}

test('PCN matching requires at least one field code', () => {
  const catalog = [createPcnTemplate()];
  assert.deepEqual(matchPcnPublishedWorkflowTemplates(catalog, { fieldCodes: [] }), []);
  assert.deepEqual(matchPcnPublishedWorkflowTemplates(catalog, {}), []);
});

test('PCN matching ignores unpublished or invalid templates', () => {
  const published = createPcnTemplate({ id: 'pub', code: 'A' });
  const draft = createPcnTemplate({ id: 'draft', code: 'B', status: 'DRAFT' });
  const retired = createPcnTemplate({ id: 'retired', code: 'C', status: 'RETIRED' });
  const invalid = createPcnTemplate({
    id: 'invalid',
    code: 'D',
    nodes: [], // invalid: requires at least one node
  });

  const results = matchPcnPublishedWorkflowTemplates([published, draft, retired, invalid], { fieldCodes: ['QC4'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'pub');
});

test('PCN matching respects field codes and does not assume unstated restricting conditions', () => {
  const general = createPcnTemplate({ id: 'gen', code: 'PCN-GEN', appliesTo: { fieldCodes: ['QC4'] } });
  const methodRestricted = createPcnTemplate({
    id: 'method-1',
    code: 'PCN-M1',
    appliesTo: { fieldCodes: ['QC4'], methods: ['METHOD_1'] },
  });
  const typeRestricted = createPcnTemplate({
    id: 'type-std',
    code: 'PCN-TYPE',
    appliesTo: { fieldCodes: ['QC4'], dossierType: 'REGULAR' },
  });
  const qc9Only = createPcnTemplate({ id: 'qc9', code: 'PCN-QC9', appliesTo: { fieldCodes: ['QC9'] } });

  const catalog = [general, methodRestricted, typeRestricted, qc9Only];

  // When method and dossierType are unknown: methodRestricted and typeRestricted MUST NOT match
  const withoutRestrictions = matchPcnPublishedWorkflowTemplates(catalog, { fieldCodes: ['QC4'] });
  assert.deepEqual(withoutRestrictions.map((t) => t.id), ['gen']);

  // When method is known: methodRestricted matches
  const withMethod = matchPcnPublishedWorkflowTemplates(catalog, { fieldCodes: ['QC4'], method: 'METHOD_1' });
  assert.deepEqual(new Set(withMethod.map((t) => t.id)), new Set(['gen', 'method-1']));

  // When dossierType is known: typeRestricted matches
  const withType = matchPcnPublishedWorkflowTemplates(catalog, { fieldCodes: ['QC4'], dossierType: 'REGULAR' });
  assert.deepEqual(new Set(withType.map((t) => t.id)), new Set(['gen', 'type-std']));

  // Mismatched method does not match
  const withDifferentMethod = matchPcnPublishedWorkflowTemplates(catalog, { fieldCodes: ['QC4'], method: 'METHOD_5' });
  assert.deepEqual(withDifferentMethod.map((t) => t.id), ['gen']);
});

test('PCN matching returns candidates in stable display sort without winner ranking', () => {
  const tplB = createPcnTemplate({ id: 'b', code: 'PCN-B', name: 'Beta', version: 1 });
  const tplA2 = createPcnTemplate({ id: 'a2', code: 'PCN-A', name: 'Alpha', version: 2 });
  const tplA1 = createPcnTemplate({ id: 'a1', code: 'PCN-A', name: 'Alpha', version: 1 });

  const results = matchPcnPublishedWorkflowTemplates([tplB, tplA1, tplA2], { fieldCodes: ['QC4'] });
  assert.deepEqual(results.map((t) => t.id), ['a2', 'a1', 'b']);
});

test('PGD matching requires at least one product group', () => {
  const catalog = [createPgdTemplate()];
  assert.deepEqual(matchPgdPublishedWorkflowTemplates(catalog, { productGroups: [] }), []);
  assert.deepEqual(matchPgdPublishedWorkflowTemplates(catalog, {}), []);
});

test('PGD matching ignores unpublished, non-pgd domain, or invalid templates', () => {
  const published = createPgdTemplate({ id: 'pub', code: 'PGD-A' });
  const draft = createPgdTemplate({ id: 'draft', code: 'PGD-B', status: 'DRAFT' });
  const wrongDomain = { ...createPgdTemplate({ id: 'wrong', code: 'PGD-C' }), domain: 'pcn' as any };
  const invalid = createPgdTemplate({
    id: 'invalid',
    code: 'PGD-D',
    nodes: [], // invalid
  });

  const results = matchPgdPublishedWorkflowTemplates([published, draft, wrongDomain, invalid], { productGroups: ['STEEL_METAL'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'pub');
});

test('PGD matching respects product group and does not assume unstated restricting method', () => {
  const generalSteel = createPgdTemplate({
    id: 'steel-gen',
    code: 'PGD-STEEL-GEN',
    appliesTo: { productGroups: ['STEEL_METAL'] },
  });
  const methodRestricted = createPgdTemplate({
    id: 'steel-m7',
    code: 'PGD-STEEL-M7',
    appliesTo: { productGroups: ['STEEL_METAL'], methodCodes: ['METHOD_7'] },
  });
  const coalOnly = createPgdTemplate({
    id: 'coal',
    code: 'PGD-COAL',
    appliesTo: { productGroups: ['COAL'] },
  });

  const catalog = [generalSteel, methodRestricted, coalOnly];

  // When methodCode is unknown: methodRestricted must NOT match
  const withoutMethod = matchPgdPublishedWorkflowTemplates(catalog, { productGroups: ['STEEL_METAL'] });
  assert.deepEqual(withoutMethod.map((t) => t.id), ['steel-gen']);

  // When methodCode is known: methodRestricted matches
  const withMethod = matchPgdPublishedWorkflowTemplates(catalog, { productGroups: ['STEEL_METAL'], methodCode: 'METHOD_7' });
  assert.deepEqual(new Set(withMethod.map((t) => t.id)), new Set(['steel-gen', 'steel-m7']));

  // Mismatched method
  const withOtherMethod = matchPgdPublishedWorkflowTemplates(catalog, { productGroups: ['STEEL_METAL'], methodCode: 'METHOD_1' });
  assert.deepEqual(withOtherMethod.map((t) => t.id), ['steel-gen']);
});

test('PGD matching returns candidates in stable display sort', () => {
  const tpl2 = createPgdTemplate({ id: 't2', code: 'PGD-B', name: 'Beta', version: 1 });
  const tpl1 = createPgdTemplate({ id: 't1', code: 'PGD-A', name: 'Alpha', version: 1 });

  const results = matchPgdPublishedWorkflowTemplates([tpl2, tpl1], { productGroups: ['STEEL_METAL'] });
  assert.deepEqual(results.map((t) => t.id), ['t1', 't2']);
});

test('resolveTemplateSelectionState handles empty candidates (status: none, non-blocking)', () => {
  const result = resolveTemplateSelectionState({
    candidates: [],
    selectedId: 'stale-id',
  });
  assert.equal(result.status, 'none');
  assert.equal(result.selectedId, undefined);
  assert.equal(result.selectedTemplate, undefined);
  assert.equal(result.suggestedTemplate, undefined);
  assert.equal(result.isAmbiguous, false);
});

test('create selection resolution leaves no-match non-blocking and uniquely resolves one candidate', () => {
  assert.deepEqual(resolveWorkflowTemplateForCreate([], undefined), { status: 'none' });
  const only = createPgdTemplate();
  assert.deepEqual(resolveWorkflowTemplateForCreate([only], undefined), { status: 'resolved', template: only });
});

test('create selection resolution requires an explicit ambiguous choice and rejects stale versions', () => {
  const first = createPgdTemplate({ id: 'one', code: 'ONE' });
  const second = createPgdTemplate({ id: 'two', code: 'TWO' });
  assert.deepEqual(resolveWorkflowTemplateForCreate([first, second], undefined), { status: 'ambiguous' });
  assert.deepEqual(resolveWorkflowTemplateForCreate([first, second], { id: 'one', version: 1 }), { status: 'resolved', template: first });
  assert.deepEqual(resolveWorkflowTemplateForCreate([first, second], { id: 'one', version: 2 }), { status: 'invalid-selection' });
  assert.deepEqual(resolveWorkflowTemplateForCreate([], { id: 'stale', version: 1 }), { status: 'invalid-selection' });
});

test('resolveTemplateSelectionState proposes single candidate visibly when unselected or stale', () => {
  const cand = { id: 'cand-1', name: 'Mẫu 1' };

  // Case 1: unselected
  const unselectedResult = resolveTemplateSelectionState({
    candidates: [cand],
    selectedId: undefined,
  });
  assert.equal(unselectedResult.status, 'suggested');
  assert.equal(unselectedResult.selectedId, undefined);
  assert.deepEqual(unselectedResult.suggestedTemplate, cand);
  assert.equal(unselectedResult.isAmbiguous, false);

  // Case 2: stale id
  const staleResult = resolveTemplateSelectionState({
    candidates: [cand],
    selectedId: 'old-stale-id',
  });
  assert.equal(staleResult.status, 'suggested');
  assert.equal(staleResult.selectedId, undefined);
  assert.deepEqual(staleResult.suggestedTemplate, cand);
  assert.equal(staleResult.isAmbiguous, false);

  // Case 3: already selected
  const selectedResult = resolveTemplateSelectionState({
    candidates: [cand],
    selectedId: 'cand-1',
  });
  assert.equal(selectedResult.status, 'selected');
  assert.equal(selectedResult.selectedId, 'cand-1');
  assert.deepEqual(selectedResult.selectedTemplate, cand);
  assert.equal(selectedResult.suggestedTemplate, undefined);
  assert.equal(selectedResult.isAmbiguous, false);
});

test('resolveTemplateSelectionState handles ambiguous candidates and drops stale selection', () => {
  const candA = { id: 'cand-a', name: 'Mẫu A' };
  const candB = { id: 'cand-b', name: 'Mẫu B' };
  const candidates = [candA, candB];

  // Case 1: unselected
  const unselected = resolveTemplateSelectionState({
    candidates,
    selectedId: undefined,
  });
  assert.equal(unselected.status, 'ambiguous');
  assert.equal(unselected.selectedId, undefined);
  assert.equal(unselected.selectedTemplate, undefined);
  assert.equal(unselected.isAmbiguous, true);

  // Case 2: stale id is dropped immediately
  const stale = resolveTemplateSelectionState({
    candidates,
    selectedId: 'non-existent',
  });
  assert.equal(stale.status, 'ambiguous');
  assert.equal(stale.selectedId, undefined);
  assert.equal(stale.selectedTemplate, undefined);
  assert.equal(stale.isAmbiguous, true);

  // Case 3: valid selection is preserved
  const valid = resolveTemplateSelectionState({
    candidates,
    selectedId: 'cand-b',
  });
  assert.equal(valid.status, 'selected');
  assert.equal(valid.selectedId, 'cand-b');
  assert.deepEqual(valid.selectedTemplate, candB);
  assert.equal(valid.isAmbiguous, false);

  // Case 4: null or whitespace selectedId is treated as unselected
  const nullSelected = resolveTemplateSelectionState({
    candidates,
    selectedId: null,
  });
  assert.equal(nullSelected.status, 'ambiguous');
  assert.equal(nullSelected.selectedId, undefined);
  assert.equal(nullSelected.isAmbiguous, true);
});

test('PCN and PGD matching handle null/empty catalogs and multi-field/group containment safely', () => {
  // Empty/null catalogs
  assert.deepEqual(matchPcnPublishedWorkflowTemplates(null, { fieldCodes: ['QC4'] }), []);
  assert.deepEqual(matchPcnPublishedWorkflowTemplates([], { fieldCodes: ['QC4'] }), []);
  assert.deepEqual(matchPgdPublishedWorkflowTemplates(null, { productGroups: ['STEEL_METAL'] }), []);
  assert.deepEqual(matchPgdPublishedWorkflowTemplates([], { productGroups: ['STEEL_METAL'] }), []);

  // PCN multi-field: template must support all intake fieldCodes
  const dualPcn = createPcnTemplate({ id: 'dual', code: 'PCN-DUAL', appliesTo: { fieldCodes: ['QC4', 'QC9'] } });
  const singlePcn = createPcnTemplate({ id: 'single', code: 'PCN-SINGLE', appliesTo: { fieldCodes: ['QC4'] } });
  const multiFieldCatalog = [dualPcn, singlePcn];

  // Intake requiring both QC4 and QC9
  const multiMatch = matchPcnPublishedWorkflowTemplates(multiFieldCatalog, { fieldCodes: ['QC4', 'QC9'] });
  assert.deepEqual(multiMatch.map((t) => t.id), ['dual']);

  // PGD multi-group: template must support all intake productGroups
  const dualPgd = createPgdTemplate({ id: 'dual-pgd', code: 'PGD-DUAL', appliesTo: { productGroups: ['STEEL_METAL', 'COAL'] } });
  const singlePgd = createPgdTemplate({ id: 'single-pgd', code: 'PGD-SINGLE', appliesTo: { productGroups: ['STEEL_METAL'] } });
  const multiGroupCatalog = [dualPgd, singlePgd];

  // Intake requiring both STEEL_METAL and COAL
  const multiGroupMatch = matchPgdPublishedWorkflowTemplates(multiGroupCatalog, { productGroups: ['STEEL_METAL', 'COAL'] });
  assert.deepEqual(multiGroupMatch.map((t) => t.id), ['dual-pgd']);
});
