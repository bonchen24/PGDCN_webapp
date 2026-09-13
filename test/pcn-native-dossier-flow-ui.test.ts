import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const flowSource = fs.readFileSync(new URL('../components/PcnDossierFlow.tsx', import.meta.url), 'utf8');
const workflowSource = fs.readFileSync(new URL('../components/PcnDossierWorkflowPanel.tsx', import.meta.url), 'utf8');
const nodeWorkSource = fs.readFileSync(new URL('../components/PcnDossierNodeWorkPanel.tsx', import.meta.url), 'utf8');
const operationsSource = fs.readFileSync(new URL('../components/PcnOperationsRegisterView.tsx', import.meta.url), 'utf8');

test('native flow is a numbered accessible rail with separate type and status cues', () => {
  assert.match(flowSource, /role="tablist"/);
  assert.match(flowSource, /role="tab"/);
  assert.match(flowSource, /aria-selected/);
  assert.match(flowSource, /aria-current/);
  assert.match(flowSource, /ArrowLeft|ArrowRight/);
  assert.match(flowSource, /DOCUMENT_TASK/);
  assert.match(flowSource, /APPROVAL_TASK/);
  assert.match(flowSource, /PARALLEL_SPLIT|PARALLEL_JOIN/);
  assert.match(flowSource, /mobile-scroll-x/);
  assert.match(flowSource, /FILE|ACTION|APPROVAL|DECISION|PARALLEL|END/);
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
  assert.match(operationsSource, /PcnDossierQueueView/);
  assert.match(operationsSource, /QUEUE/);
  assert.match(operationsSource, /DATA/);
  assert.match(operationsSource, /Hàng đợi hồ sơ/);
  assert.match(operationsSource, /Sổ dữ liệu/);
  assert.match(operationsSource, /PgdcnDossierSummaryGrid/);
});
