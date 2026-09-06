import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('dossier workflow UI renders the saved graph instead of assuming five stations', () => {
  const panel = read('components/PcnDossierWorkflowPanel.tsx');
  assert.match(panel, /getPcnWorkflowForDossier/);
  assert.match(panel, /PcnArchifyWorkflowEmbed/);
  assert.match(panel, /workflow\.nodes\.filter/);
  assert.match(panel, /workflowTasks/);
  assert.doesNotMatch(panel, /ArrowDown/);
});

test('dashboard dossier cards surface the dynamic node instead of a fixed station label', () => {
  const board = read('components/PcnPipelineBoard.tsx');
  const workspace = read('components/PcnWorkspace.tsx');
  assert.match(board, /getPcnWorkflowFocusNode/);
  assert.match(board, /Hồ sơ theo lưu trình/);
  assert.match(board, /workflowTasks/);
  assert.doesNotMatch(board, /quy trình 5 bước/);
  assert.match(workspace, /workflowTasks=\{workflowTasks\}/);
});

test('dossier detail wires workflow tasks and keeps the legacy graphic as fallback', () => {
  const source = read('components/PcnDossierDetailView.tsx');
  assert.match(source, /PcnDossierWorkflowPanel/);
  assert.match(source, /workflowTasks/);
  assert.match(source, /onStartWorkflowTask/);
  assert.match(source, /onReturnWorkflowTask/);
  assert.match(source, /workflowSnapshot/);
  assert.match(source, /PcnWorkflowMap/);
});

test('workflow panel offers document-aware action controls and return-to-node handling', () => {
  const panel = read('components/PcnArchifyWorkflowEmbed.tsx');
  assert.match(panel, /onStartTask/);
  assert.match(panel, /onCompleteTask/);
  assert.match(panel, /onReturnTask/);
  assert.match(panel, /returnTargetNodeId/);
  assert.match(panel, /Tài liệu node/);
  assert.match(panel, /selectedStatus/);
});
