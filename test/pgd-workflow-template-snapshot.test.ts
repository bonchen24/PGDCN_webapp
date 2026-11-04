import assert from 'node:assert/strict';
import test from 'node:test';

import { snapshotPgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';
import type { PgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';

const publishedTemplate: PgdWorkflowTemplate = {
  domain: 'pgd',
  id: 'pgd-steel-v2',
  code: 'PGD-STEEL',
  name: 'Giám định thép',
  appliesTo: { productGroups: ['STEEL_METAL'] },
  version: 2,
  status: 'PUBLISHED',
  nodes: [
    { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementCodes: ['REQUEST_PYC'], active: true, sortOrder: 1 },
    { id: 'end', kind: 'END', label: 'Kết thúc', requirementCodes: [], active: true, sortOrder: 2 },
  ],
  transitions: [{ id: 't1', fromNodeId: 'intake', toNodeId: 'end', condition: 'ALWAYS' }],
  createdAt: '2026-10-01T00:00:00.000Z',
  createdBy: 'admin',
  updatedAt: '2026-10-01T00:00:00.000Z',
  updatedBy: 'admin',
};

test('PGD workflow snapshot captures the published version without sharing mutable arrays', () => {
  const snapshot = snapshotPgdWorkflowTemplate(publishedTemplate, {
    capturedAt: '2026-11-04T10:00:00.000Z',
    capturedBy: 'operator',
  });

  assert.equal(snapshot.templateCode, 'PGD-STEEL');
  assert.equal(snapshot.templateVersion, 2);
  assert.equal(snapshot.capturedAt, '2026-11-04T10:00:00.000Z');
  assert.equal(snapshot.capturedBy, 'operator');
  assert.deepEqual(snapshot.nodes, publishedTemplate.nodes);
  assert.deepEqual(snapshot.transitions, publishedTemplate.transitions);
  assert.notEqual(snapshot.nodes, publishedTemplate.nodes);
  assert.notEqual(snapshot.nodes[0], publishedTemplate.nodes[0]);
  assert.notEqual(snapshot.transitions, publishedTemplate.transitions);
});

test('PGD workflow snapshot rejects non-published templates', () => {
  assert.throws(() => snapshotPgdWorkflowTemplate({ ...publishedTemplate, status: 'DRAFT' }, {
    capturedAt: '2026-11-04T10:00:00.000Z',
    capturedBy: 'operator',
  }), /PUBLISHED/);
});

test('PGD workflow snapshot deep-copies arrays nested in transition conditions', () => {
  const template: PgdWorkflowTemplate = {
    ...publishedTemplate,
    transitions: [{
      id: 'method',
      fromNodeId: 'intake',
      toNodeId: 'end',
      condition: 'METHOD_MATCH',
      conditionConfig: {
        expectedProductGroups: ['STEEL_METAL'],
        expectedMethodCodes: ['METHOD_1'],
      },
    }],
  };
  const snapshot = snapshotPgdWorkflowTemplate(template, {
    capturedAt: '2026-11-04T10:00:00.000Z',
    capturedBy: 'operator',
  });

  template.transitions[0].conditionConfig?.expectedProductGroups?.push('MACHINERY_LINE');
  template.transitions[0].conditionConfig?.expectedMethodCodes?.push('METHOD_5');

  assert.deepEqual(snapshot.transitions[0].conditionConfig?.expectedProductGroups, ['STEEL_METAL']);
  assert.deepEqual(snapshot.transitions[0].conditionConfig?.expectedMethodCodes, ['METHOD_1']);
});
