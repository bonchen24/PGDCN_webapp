import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnUserAccount } from '../types.ts';
import {
  PCN_WORKFLOW_STAGES,
  getPcnWorkflowStage,
} from '../utils/pcnWorkflowStages.ts';
import {
  buildPcnApprovalSteps,
  getPcnApprovalDecisionDenial,
} from '../utils/pcnApproval.ts';
import { withdrawPcnIssuancePackage } from '../utils/pcnIssuance.ts';

const detailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const approvalSource = fs.readFileSync(new URL('../components/PcnApprovalModal.tsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('models dossier completion as five actionable stages ending at leadership approval', () => {
  assert.deepEqual(PCN_WORKFLOW_STAGES.map((stage) => stage.key), [
    'INTAKE', 'SAMPLING_LAB', 'RESULTS', 'TECHNICAL_REVIEW', 'APPROVAL',
  ]);
  assert.deepEqual(PCN_WORKFLOW_STAGES.map((stage) => stage.title), [
    'Tiếp nhận & đầu vào',
    'Lấy mẫu & gửi PTN',
    'KQTN & đánh giá',
    'Hoàn thiện & soát xét trước duyệt',
    'Phê duyệt',
  ]);
  assert.equal(getPcnWorkflowStage('TECHNICAL_REVIEW')?.key, 'TECHNICAL_REVIEW');
  assert.equal(getPcnWorkflowStage('WAITING_APPROVAL')?.key, 'APPROVAL');
  assert.equal(getPcnWorkflowStage('APPROVED')?.key, 'APPROVAL');
  assert.equal(getPcnWorkflowStage('ISSUED')?.key, 'APPROVAL');
  assert.equal(getPcnWorkflowStage('DELIVERED')?.key, 'APPROVAL');
  assert.equal(getPcnWorkflowStage('ARCHIVED')?.key, 'APPROVAL');
});

test('creates one effective leadership approval decision', () => {
  const steps = buildPcnApprovalSteps('dossier-step-completion', '2026-09-02T00:00:00.000Z');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].sequence, 1);
  assert.match(steps[0].role, /Lãnh đạo/);

  const leader: PcnUserAccount = {
    username: 'leader', name: 'Lãnh đạo', role: 'admin', systemRole: 'admin',
    departmentRoleCode: 'LEADERSHIP', fieldCodes: ['QC4'], active: true,
  };
  const reviewer: PcnUserAccount = {
    username: 'reviewer', name: 'Người soát xét', role: 'staff', systemRole: 'staff',
    departmentRoleCode: 'TECHNICAL_REVIEWER', fieldCodes: ['QC4'], active: true,
  };

  assert.equal(getPcnApprovalDecisionDenial(steps[0], leader, ['QC4']), null);
  assert.match(getPcnApprovalDecisionDenial(steps[0], reviewer, ['QC4']) || '', /chức vụ|vai trò/i);
});

test('withdrawal reopens technical review without overwriting issued evidence', () => {
  const withdrawn = withdrawPcnIssuancePackage({
    id: 'issuance-step-completion',
    dossierId: 'dossier-step-completion',
    certificateTemplateCode: 'GCN',
    decisionTemplateCode: 'QD',
    documentType: 'CERTIFICATE',
    status: 'ISSUED',
    approvalStepIds: ['approval-leadership-dossier-step-completion'],
    issuanceNumber: 'PCN-001',
    issuedAt: '2026-09-01T01:00:00.000Z',
    signerUsername: 'leader-pcn',
    fileAssetIds: ['official-certificate'],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T01:00:00.000Z',
  }, { reason: 'Cần rà soát lại KQTN', withdrawnByUsername: 'leader-pcn', withdrawnAt: '2026-09-01T02:00:00.000Z' });
  assert.equal(withdrawn.status, 'RETURNED');
  assert.equal(withdrawn.issuanceNumber, 'PCN-001');
  assert.equal(withdrawn.withdrawalReason, 'Cần rà soát lại KQTN');
  assert.equal(withdrawn.withdrawnByUsername, 'leader-pcn');
});

test('dossier detail exposes per-step completion controls and post-approval lifecycle', () => {
  assert.match(detailSource, /Hoàn tất bước/);
  assert.match(detailSource, /Bước sau/);
  assert.match(detailSource, /ownerUsername/);
  assert.match(detailSource, /onWithdraw/);
  assert.match(detailSource, /Phê duyệt/);
  assert.match(approvalSource, /Phê duyệt bước 5/);
  assert.doesNotMatch(approvalSource, /Chuỗi phê duyệt PCN/);
});

test('server exposes a controlled withdrawal boundary for approved or issued dossiers', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/issuance\/:issuanceId\/withdraw'/);
  const withdrawalRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/withdraw'"),
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/issue'") > -1
      ? serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/issue'")
      : undefined,
  );
  assert.match(withdrawalRoute, /idempotencyKey/);
  assert.match(withdrawalRoute, /LEADERSHIP|signer|người ký/i);
  assert.match(withdrawalRoute, /reason|lý do/i);
  assert.match(designSource, /boundary thu hồi/);
});
