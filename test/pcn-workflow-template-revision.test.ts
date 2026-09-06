import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import type { PcnWorkflowTemplate } from '../types.ts';
import { validatePcnWorkflowTemplate } from '../utils/pcnWorkflowTemplate.ts';

const schema = readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');

function seededTemplate(id: string): PcnWorkflowTemplate {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = schema.match(new RegExp(`'${escapedId}',\\s*\\$\\$(.*?)\\$\\$::jsonb`, 's'));
  assert.ok(match, `Không tìm thấy template seed ${id}`);
  return { ...JSON.parse(match[1]), id } as PcnWorkflowTemplate;
}

test('workflow revision 2 is seeded as valid field-specific topology', () => {
  const qc4 = seededTemplate('pcn-qc4-standard-v2');
  const qc9 = seededTemplate('pcn-qc9-standard-v2');
  for (const template of [qc4, qc9]) {
    assert.equal(template.version, 2);
    assert.equal(template.status, 'PUBLISHED');
    assert.deepEqual(validatePcnWorkflowTemplate(template), { valid: true, errors: [] });
    assert.equal(template.nodes.at(-1)?.kind, 'END');
    assert.ok(template.nodes.length >= 14);
  }
  assert.deepEqual(qc4.appliesTo.fieldCodes, ['QC4']);
  assert.deepEqual(qc9.appliesTo.fieldCodes, ['QC9']);
  assert.deepEqual(qc4.nodes.map((node) => node.label).slice(0, 6), ['Đề nghị', 'Thương mại', 'Phân công', 'Kế hoạch đánh giá', 'Kiểm tra hiện trường', 'PYC']);
  assert.ok(qc4.nodes.some((node) => node.label === 'Tiếp nhận KQTN'));
  assert.ok(qc4.nodes.some((node) => node.label === 'Hoàn thiện kết quả'));
  assert.ok(qc9.nodes.some((node) => node.label === 'Trả mẫu'));
});

test('revision 2 is additive and leaves v1 seed present for old snapshots', () => {
  assert.match(schema, /'pcn-qc-standard-v1'/);
  assert.match(schema, /'pcn-qc4-standard-v2'/);
  assert.match(schema, /'pcn-qc9-standard-v2'/);
  assert.match(schema, /ON CONFLICT \(collection_name, document_id\) DO NOTHING;/);
});
