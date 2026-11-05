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

test('owner assignment status and action render at the top of detail before either workflow rail', () => {
  const contentStart = detailSource.indexOf('<section aria-label="Nội dung hồ sơ PCN"');
  const ownerPanel = detailSource.indexOf('{dossierOwnerAssignmentPanel}', contentStart);
  const snapshotWorkflow = detailSource.indexOf('<PcnDossierWorkflowPanel', contentStart);
  const legacyWorkflow = detailSource.indexOf('<DossierWorkflowSummary', contentStart);
  assert.ok(contentStart >= 0, 'detail content section must exist');
  assert.ok(ownerPanel > contentStart, 'owner status must appear inside detail content');
  assert.ok(snapshotWorkflow < 0 || ownerPanel < snapshotWorkflow, 'owner status must precede the snapshot workflow rail');
  assert.ok(legacyWorkflow < 0 || ownerPanel < legacyWorkflow, 'owner status must precede the legacy workflow rail');
  assert.match(detailSource, /Chưa giao người phụ trách/);
  assert.equal((detailSource.match(/<DossierOwnerPanel\s/g) || []).length, 1, 'assignment panel must be rendered once');
  const overviewTab = detailSource.match(/const overviewTab =([\s\S]*?)\n  const dossierOverviewTab/)?.[1] || '';
  assert.doesNotMatch(overviewTab, /DossierOwnerPanel/, 'overview must not repeat the assignment panel');
});
