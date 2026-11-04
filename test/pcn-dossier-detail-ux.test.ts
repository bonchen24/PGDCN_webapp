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

test('workflow-first detail renders the 7-stage flow prominently at top without collapsed disclosure', () => {
  assert.match(workflowSource, /data-testid="pcn-workflow-map"/);
  assert.match(workflowSource, /PcnDossierFlow/);
  assert.doesNotMatch(workflowSource, /data-testid="pcn-current-step-summary"/);
  assert.doesNotMatch(workflowSource, /data-testid="pcn-workflow-map-disclosure"/);
});

test('detail primary work region uses action-first language', () => {
  assert.match(detailSource, /data-testid="pcn-legacy-work-panel"[\s\S]*?Việc cần làm ngay/);
  assert.match(detailSource, /data-testid="pcn-step-secondary-actions"/);
  assert.match(detailSource, /Xem thêm hành động/);
  assert.match(detailSource, /data-testid="pcn-dossier-secondary-actions"/);
});
