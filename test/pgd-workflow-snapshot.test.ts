import assert from 'node:assert/strict';
import test from 'node:test';

import {
  selectPgdPublishedWorkflowTemplate,
  snapshotPgdWorkflowTemplate,
  type PgdWorkflowTemplate,
} from '../utils/pgdWorkflowTemplate.ts';

function template(input: Partial<PgdWorkflowTemplate> & Pick<PgdWorkflowTemplate, 'id' | 'status' | 'appliesTo'>): PgdWorkflowTemplate {
  return {
    domain: 'pgd',
    code: input.id.toUpperCase(),
    name: input.id,
    version: 1,
    nodes: [
      { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementCodes: ['REQUEST_PYC'], active: true, sortOrder: 1 },
      { id: 'end', kind: 'END', label: 'Lưu trữ', requirementCodes: [], active: true, sortOrder: 2 },
    ],
    transitions: [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end', condition: 'ALWAYS' }],
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: 'admin',
    ...input,
  };
}

test('PGD selection uses only a published template matching the dossier group and method', () => {
  const broad = template({ id: 'broad', status: 'PUBLISHED', appliesTo: { productGroups: ['MACHINERY_LINE'] } });
  const specific = template({ id: 'specific', status: 'PUBLISHED', appliesTo: { productGroups: ['MACHINERY_LINE'], methodCodes: ['QT-GĐ-12'] } });
  const wrongMethod = template({ id: 'wrong', status: 'PUBLISHED', appliesTo: { productGroups: ['MACHINERY_LINE'], methodCodes: ['QT-GĐ-04'] } });
  const draft = template({ id: 'draft', status: 'DRAFT', appliesTo: { productGroups: ['MACHINERY_LINE'], methodCodes: ['QT-GĐ-12'] } });

  assert.equal(selectPgdPublishedWorkflowTemplate([broad, wrongMethod, draft, specific], {
    productGroup: 'MACHINERY_LINE',
    method: 'QT-GĐ-12',
  })?.id, 'specific');
});

test('PGD snapshot deep-copies topology and requirement policy with the selected revision identity', () => {
  const source = template({
    id: 'pgd-v3',
    status: 'PUBLISHED',
    version: 3,
    appliesTo: { productGroups: ['OTHER'] },
    requirementPolicies: {
      REQUEST_PYC: { defaultClass: 'DEFAULT_REQUIRED', sourceMode: 'UPLOAD', cardinality: { min: 1, max: 1 } },
    },
  });
  const snapshot = snapshotPgdWorkflowTemplate(source, {
    capturedAt: '2026-10-31T00:00:00.000Z',
    capturedBy: 'owner',
  });

  assert.equal(snapshot.templateId, 'pgd-v3');
  assert.equal(snapshot.templateVersion, 3);
  assert.deepEqual(snapshot.requirementPolicies?.REQUEST_PYC, source.requirementPolicies?.REQUEST_PYC);
  snapshot.nodes[0].label = 'Changed in dossier';
  assert.equal(source.nodes[0].label, 'Tiếp nhận');
});
