import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const detailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const workflowSource = fs.readFileSync(new URL('../components/PcnDossierWorkflowPanel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('dossier detail exposes a compact context summary before secondary content', () => {
  assert.match(detailSource, /data-testid="pcn-dossier-context-summary"/);
  assert.match(detailSource, /Bước hiện tại:/);
  assert.match(detailSource, /Chủ hồ sơ:/);
  assert.match(detailSource, /missingRequiredCount > 0/);
});

test('workflow-first detail renders next action ahead of natural step flow', () => {
  assert.match(workflowSource, /data-testid="pcn-current-step-summary"/);
  assert.match(workflowSource, /Bước cần xử lý/);
  assert.match(workflowSource, /PcnDossierFlow/);
  assert.ok(workflowSource.indexOf('data-testid="pcn-current-step-summary"') < workflowSource.indexOf('<PcnDossierFlow'));
});

test('detail primary work region uses action-first language', () => {
  assert.match(detailSource, /data-testid="pcn-legacy-work-panel"[\s\S]*?Việc cần làm ngay/);
  assert.match(detailSource, /data-testid="pcn-step-secondary-actions"/);
  assert.match(detailSource, /Xem thêm hành động/);
  assert.match(detailSource, /data-testid="pcn-dossier-secondary-actions"/);
});
