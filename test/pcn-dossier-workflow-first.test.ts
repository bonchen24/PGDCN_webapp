import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const detailSource = readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('../components/PcnDossierWorkflowPanel.tsx', import.meta.url), 'utf8');

test('dossier detail starts workflow-first and keeps explicit deep links compatible', () => {
  assert.match(detailSource, /workflowFirst/);
  assert.match(detailSource, /initialTab/);
  assert.match(detailSource, /!workflowFirst && <DossierRegionSelector/);
  assert.match(detailSource, /!workflowFirst && tabContent/);
  assert.match(detailSource, /onOpenBusiness/);
});

test('workflow panel projects the selected runtime node into the native work panel', () => {
  assert.match(workflowSource, /buildPcnDossierNodeWorkProjection/);
  assert.match(workflowSource, /projectPcnWorkflowRuntime/);
  assert.match(workflowSource, /onSelectNode/);
  assert.match(workflowSource, /PcnDossierNodeWorkPanel/);
  assert.match(workflowSource, /sampleLots/);
  assert.match(workflowSource, /labRequests/);
});
