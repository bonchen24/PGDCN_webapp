import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validatePgdWorkflowTemplate,
  type PgdWorkflowTemplate,
} from '../utils/pgdWorkflowTemplate.ts';

function validTemplate(overrides: Partial<PgdWorkflowTemplate> = {}): PgdWorkflowTemplate {
  return {
    domain: 'pgd',
    id: 'pgd-standard-v1',
    code: 'PGD-STANDARD',
    name: 'Quy trình giám định tiêu chuẩn',
    description: 'Template kiểm tra hồ sơ PGD.',
    appliesTo: { productGroups: ['OTHER'], methodCodes: ['METHOD_7'] },
    version: 1,
    status: 'DRAFT',
    nodes: [
      { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementCodes: ['REQUEST_PYC'], active: true, sortOrder: 10, laneId: 'intake', column: 1 },
      { id: 'split', kind: 'PARALLEL_SPLIT', label: 'Phân luồng', requirementCodes: [], active: true, sortOrder: 20, laneId: 'work', column: 2 },
      { id: 'field', kind: 'DOCUMENT_TASK', label: 'Hiện trường', requirementCodes: ['FIELD_INSPECTION_MINUTES'], active: true, sortOrder: 30, laneId: 'work', column: 3 },
      { id: 'lab', kind: 'DOCUMENT_TASK', label: 'PTN', requirementCodes: ['LAB_RESULT'], active: true, sortOrder: 40, laneId: 'work', column: 3 },
      { id: 'join', kind: 'PARALLEL_JOIN', label: 'Gom kết quả', requirementCodes: [], joinPolicy: 'ALL', active: true, sortOrder: 50, laneId: 'review', column: 4 },
      { id: 'end', kind: 'END', label: 'Lưu trữ', requirementCodes: ['ARCHIVE_INDEX'], active: true, sortOrder: 60, laneId: 'review', column: 5 },
    ],
    transitions: [
      { id: 't-intake-split', fromNodeId: 'intake', toNodeId: 'split', condition: 'ALWAYS' },
      { id: 't-split-field', fromNodeId: 'split', toNodeId: 'field', condition: 'ALWAYS' },
      { id: 't-split-lab', fromNodeId: 'split', toNodeId: 'lab', condition: 'ALWAYS' },
      { id: 't-field-join', fromNodeId: 'field', toNodeId: 'join', condition: 'ALWAYS' },
      { id: 't-lab-join', fromNodeId: 'lab', toNodeId: 'join', condition: 'ALWAYS' },
      { id: 't-join-end', fromNodeId: 'join', toNodeId: 'end', condition: 'ALWAYS' },
    ],
    createdAt: '2026-09-06T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-09-06T00:00:00.000Z',
    updatedBy: 'admin',
    ...overrides,
  };
}

test('PGD workflow validator accepts a valid topology with parallel branches', () => {
  assert.deepEqual(validatePgdWorkflowTemplate(validTemplate()), { valid: true, errors: [] });
});

test('PGD workflow validator catches missing target, split branch and join policy', () => {
  const missingTarget = validTemplate({
    transitions: [{ id: 'bad-edge', fromNodeId: 'intake', toNodeId: 'missing', condition: 'ALWAYS' }],
  });
  const invalidSplitAndJoin = validTemplate({
    nodes: validTemplate().nodes.map((node) => node.id === 'split'
      ? { ...node }
      : node.id === 'join' ? { ...node, joinPolicy: undefined } : node),
    transitions: validTemplate().transitions.filter((transition) => transition.id !== 't-split-lab' && transition.id !== 't-lab-join'),
  });

  const missingTargetResult = validatePgdWorkflowTemplate(missingTarget);
  const invalidSplitAndJoinResult = validatePgdWorkflowTemplate(invalidSplitAndJoin);
  assert.equal(missingTargetResult.valid, false);
  assert.ok(missingTargetResult.errors.some((error) => error.includes('toNodeId')));
  assert.ok(invalidSplitAndJoinResult.errors.some((error) => error.includes('split')));
  assert.ok(invalidSplitAndJoinResult.errors.some((error) => error.includes('join')));
});
