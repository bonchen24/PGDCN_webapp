import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const flowSource = fs.readFileSync(new URL('../components/PcnDossierFlow.tsx', import.meta.url), 'utf8');
const workflowSource = fs.readFileSync(new URL('../components/PcnDossierWorkflowPanel.tsx', import.meta.url), 'utf8');
const nodeWorkSource = fs.readFileSync(new URL('../components/PcnDossierNodeWorkPanel.tsx', import.meta.url), 'utf8');
const operationsSource = fs.readFileSync(new URL('../components/PcnOperationsRegisterView.tsx', import.meta.url), 'utf8');

test('native flow exposes seven accessible stage tabs with keyboard navigation', () => {
  const stageBlock = flowSource.match(/export const PCN_DOSSIER_FLOW_STAGES:[\s\S]*?= \[([\s\S]*?)\] as const;/)?.[1] || '';
  const stageIds = [...stageBlock.matchAll(/\bid: '([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(stageIds, [
    'intake',
    'review-assignment',
    'plan',
    'execution',
    'results-evaluation',
    'reporting-approval',
    'issuance-archive',
  ]);
  assert.match(flowSource, /data-testid="pcn-dossier-flow-scroll"[^>]*role="tablist"/);
  assert.match(flowSource, /role="tablist"/);
  assert.match(flowSource, /role="tab"/);
  assert.match(flowSource, /aria-selected/);
  assert.match(flowSource, /aria-current/);
  assert.match(flowSource, /aria-posinset=\{index \+ 1\}/);
  assert.match(flowSource, /aria-setsize=\{PCN_DOSSIER_FLOW_STAGES\.length\}/);
  assert.match(flowSource, /ArrowLeft|ArrowRight/);
  assert.match(flowSource, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(flowSource, /focus-visible:ring-2/);
  assert.match(workflowSource, /data-testid="pcn-workflow-step-card"[\s\S]*<PcnDossierFlow[\s\S]*<PcnDossierNodeWorkPanel/);
});

test('PCN dossier workflow no longer renders the Archify embed', () => {
  assert.doesNotMatch(workflowSource, /PcnArchifyWorkflowEmbed/);
  assert.match(workflowSource, /PcnDossierFlow/);
  assert.match(workflowSource, /PcnDossierNodeWorkPanel/);
});

test('node work exposes guarded action affordances', () => {
  assert.match(nodeWorkSource, /Bắt đầu xử lý/);
  assert.match(nodeWorkSource, /Hoàn tất bước|Tiếp tục/);
  assert.match(nodeWorkSource, /Trả về/);
  assert.match(nodeWorkSource, /Mở toàn bộ tài liệu/);
});

test('PCN management defaults to a task queue and retains the data register', () => {
  const pcnPageSource = fs.readFileSync(new URL('../app/(workspace)/pcn/page.tsx', import.meta.url), 'utf8');
  assert.match(pcnPageSource, /PcnDossierQueueView/);
  assert.match(pcnPageSource, /PcnOperationsRegisterView/);
  assert.match(operationsSource, /Sổ tổng hợp PCN/);
  assert.match(operationsSource, /PgdcnDossierSummaryGrid/);
});
