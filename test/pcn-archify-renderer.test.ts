import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnArchifyWorkflow } from '../utils/pcnArchifyWorkflow.ts';
import { renderArchifyWorkflowDocument } from '../utils/pcnArchifyRenderer.ts';

test('server renderer uses the vendored Archify compiler and complete reader template', async () => {
  const workflowDocument = buildPcnArchifyWorkflow({
    dossier: {
      id: 'dossier-render',
      dossierCode: 'PCN-RENDER-01',
      proposalId: 'proposal-render',
      fieldCodes: ['QC4'],
      method: 'METHOD_1',
      status: 'INTAKE_REVIEW',
      documentWaivers: {},
      labRequestIds: [],
      returnedResultIds: [],
    } as any,
    workflow: {
      templateCode: 'PCN-RENDER',
      templateVersion: 1,
      capturedAt: '2026-09-06T00:00:00.000Z',
      capturedBy: 'admin',
      nodes: [
        { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 0 },
        { id: 'end', kind: 'END', label: 'Kết thúc', requirementIds: [], active: true, sortOrder: 1 },
      ],
      transitions: [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end', label: 'Hoàn tất' }],
    } as any,
    tasks: [],
    documents: [],
    results: [],
    approvalSteps: [],
    activityLogs: [],
  });

  const html = await renderArchifyWorkflowDocument(workflowDocument, { domain: 'pcn', recordId: 'dossier-render' });
  assert.match(html, /ARCHIFY:SVG_SLOT|archify-guided-views-data/);
  assert.match(html, /data-node-id="start"/);
  assert.match(html, /data-edge-id="start-end"/);
  assert.match(html, /pcn-archify-focus/);
  assert.match(html, /dossier-render/);
});

test('both dossier domains serve Archify from authenticated server routes', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /app\.get\('\/api\/pcn\/dossiers\/:dossierId\/archify'/);
  assert.match(serverSource, /app\.get\('\/api\/pgd\/requests\/:requestId\/archify'/);
  assert.match(serverSource, /requirePcnSession/);
  assert.match(serverSource, /requirePgdSession/);
  assert.match(serverSource, /buildPcnArchifyWorkflow/);
  assert.match(serverSource, /buildPgdArchifyWorkflow/);
});
