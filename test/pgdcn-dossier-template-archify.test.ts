import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { DossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import { buildPcnArchifyWorkflowTemplate } from '../utils/pcnArchifyWorkflowTemplate.ts';
import { buildPgdArchifyWorkflowTemplate } from '../utils/pgdArchifyWorkflowTemplate.ts';

const previewComponent = readFileSync(new URL('../components/PgdcnDossierTemplateArchifyPreview.tsx', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const model: DossierTemplateEditorModel = {
  domain: 'PCN',
  id: 'pcn-qc4-template-v1',
  code: 'PCN-QC4',
  name: 'PCN QC4 tiêu chuẩn',
  description: 'Preview template.',
  version: 1,
  status: 'DRAFT',
  appliesTo: { fieldCodes: ['QC4'] },
  nodes: [
    { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', active: true, laneId: 'intake', column: 1, sortOrder: 10, requirementRefs: ['QC4-PROPOSAL'] },
    { id: 'end', kind: 'END', label: 'Lưu trữ', active: true, laneId: 'archive', column: 4, sortOrder: 20, requirementRefs: [] },
  ],
  transitions: [{ id: 'edge-intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: 'ALWAYS', label: 'Hoàn tất' }],
};

test('PCN and PGD builders produce private-data-free Archify v2 projections', () => {
  const pcn = buildPcnArchifyWorkflowTemplate(model);
  const pgd = buildPgdArchifyWorkflowTemplate({ ...model, domain: 'PGD', appliesTo: { productGroups: ['OTHER'], methodCodes: ['METHOD_7'] }, nodes: model.nodes.map((node) => ({ ...node, requirementRefs: ['REQUEST_PYC'] })) });
  for (const document of [pcn, pgd]) {
    assert.equal(document.schema_version, 2);
    assert.equal(document.diagram_type, 'workflow');
    assert.equal(document.nodes[0].id, 'intake');
    assert.equal(document.edges[0].id, 'edge-intake-end');
    assert.match(document.nodes[0].sublabel || '', /1 tài liệu/);
    const serialized = JSON.stringify(document);
    assert.doesNotMatch(serialized, /fileAssetId|sha256|checksum|private object path|dossierId|runtimeDocument/i);
  }
});

test('template preview uses the Archify reader in an iframe and server preview endpoints', () => {
  assert.match(previewComponent, /data-testid="pgdcn-dossier-template-archify-preview"/);
  assert.match(previewComponent, /data-testid="pgdcn-dossier-template-archify-reader"/);
  assert.match(previewComponent, /URL\.createObjectURL/);
  assert.match(previewComponent, /URL\.revokeObjectURL/);
  assert.doesNotMatch(previewComponent, /contentEditable|onMouseDown=.*svg|<svg/);
  assert.match(serverSource, /\/api\/pcn\/workflow-templates\/preview/);
  assert.match(serverSource, /\/api\/pgd\/workflow-templates\/preview/);
});
