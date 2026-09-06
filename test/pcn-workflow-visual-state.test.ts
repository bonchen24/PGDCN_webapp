import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, PcnDossierWorkflowTask, PcnWorkflowSnapshot } from '../types.ts';
import { buildPcnArchifyWorkflow } from '../utils/pcnArchifyWorkflow.ts';
import { renderArchifyWorkflowDocument } from '../utils/pcnArchifyRenderer.ts';

const dossier: CertificationDossier = {
  id: 'dossier-visual-state',
  dossierCode: 'PCN-2026-001',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'AWAITING_DOCUMENTS',
  labRequestIds: [],
  returnedResultIds: [],
};

const workflow: PcnWorkflowSnapshot = {
  templateCode: 'PCN_SAMPLE',
  templateVersion: 2,
  capturedAt: '2026-09-06T00:00:00.000Z',
  capturedBy: 'SYSTEM',
  nodes: [
    { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 10 },
    { id: 'review', kind: 'DOCUMENT_TASK', label: 'Soát xét', requirementIds: [], active: true, sortOrder: 20 },
  ],
  transitions: [{ id: 'edge-intake-review', fromNodeId: 'intake', toNodeId: 'review', condition: 'ALWAYS' }],
};

const tasks: PcnDossierWorkflowTask[] = [
  { id: 'task-intake', dossierId: dossier.id, nodeId: 'intake', status: 'READY', cycleNo: 1, updatedAt: '2026-09-06T00:00:00.000Z', updatedBy: 'SYSTEM' },
  { id: 'task-review', dossierId: dossier.id, nodeId: 'review', status: 'LOCKED', cycleNo: 1, updatedAt: '2026-09-06T00:00:00.000Z', updatedBy: 'SYSTEM' },
];

test('locked workflow nodes are muted without rendering locked/open status words', async () => {
  const document = buildPcnArchifyWorkflow({ dossier, workflow, tasks, documents: [] });
  const lockedNode = document.nodes.find((node) => node.id === 'review');
  assert.ok(lockedNode);
  assert.doesNotMatch(`${lockedNode.sublabel || ''} ${lockedNode.tag || ''}`, /Đang khóa|Sẵn sàng|Đang mở/);

  const html = await renderArchifyWorkflowDocument(document, { domain: 'pcn', recordId: dossier.id });
  assert.match(html, /data-node-state="locked"/);
  assert.match(html, /pcn-node-locked/);
  assert.doesNotMatch(html, /Đang khóa|Đang mở|Sẵn sàng/);
});
