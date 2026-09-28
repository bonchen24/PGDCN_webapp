import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnDraftFieldDefinitions, hasPcnDeepContext, validatePcnDraftAction } from '../utils/pcnDrafting.ts';

const workspace = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');
const primitives = fs.readFileSync(new URL('../components/PgdcnDraftingPrimitives.tsx', import.meta.url), 'utf8');

test('PCN drafting hydrates dossier, requirement, kind and template from deep context', () => {
  assert.match(workspace, /initialDossierId/);
  assert.match(workspace, /initialRequirementId/);
  assert.match(workspace, /initialKind/);
  assert.match(workspace, /const requirementFromProps/);
  assert.match(workspace, /const kindFromRequirement/);
  assert.match(workspace, /const nextRequirementId/);
  assert.match(workspace, /setContextLocked\(true\)/);
  assert.match(workspace, /getPcnOperationalTemplates/);
});

test('PCN kind-only routes remain unlocked while dossier routes preserve context', () => {
  assert.equal(hasPcnDeepContext({ kind: 'PROPOSAL_FORM' }), false);
  assert.equal(hasPcnDeepContext({ requirementId: 'requirement-1', kind: 'PROPOSAL_FORM' }), false);
  assert.equal(hasPcnDeepContext({ dossierId: 'dossier-1', kind: 'PROPOSAL_FORM' }), true);
});

test('PCN drafting exposes exact Vietnamese missing labels with focus actions', () => {
  const validation = validatePcnDraftAction('PROPOSAL_FORM', {}, 'GENERATE');
  const labels = getPcnDraftFieldDefinitions('PROPOSAL_FORM')
    .filter((field) => validation.missingKeys.includes(field.key))
    .map((field) => field.label);

  for (const label of ['Số Đề nghị / đăng ký', 'Tên khách hàng', 'Tên sản phẩm', 'Số lượng mẫu']) assert.ok(labels.includes(label), `missing exact label: ${label}`);
  assert.match(workspace, /onIssueClick=\{\(issue\) => focusField\(issue\.key\)\}/);
  assert.match(workspace, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(workspace, /Đi tới trường còn thiếu/);
});

test('PCN drafting keeps BLOCKED state explicit and prioritizes missing sections', () => {
  assert.match(workspace, /!template \|\| !validation\.valid/);
  assert.match(workspace, /BLOCKED/);
  assert.match(workspace, /missingCount > 0/);
  assert.match(workspace, /collapsible defaultOpen=/);
  assert.match(workspace, /Cần bổ sung dữ liệu/);
});

test('PCN drafting exposes READY/generated review before attach', () => {
  assert.match(workspace, /currentOutputs\.length > 0/);
  assert.match(workspace, /READY/);
  assert.match(workspace, /GENERATED/);
  assert.match(workspace, /Soát xét tài liệu|Soát xét trước khi gắn/);
  assert.match(workspace, /data-testid="pcn-drafting-review-context"/);
  assert.match(workspace, /Xác nhận đã soát xét/);
  assert.match(workspace, /Xác nhận & gắn vào bộ hồ sơ/);
  assert.match(workspace, /currentOutputs\.length > 0/);
});

test('PCN drafting distinguishes CONFIRMED and ATTACHED success states', () => {
  assert.match(workspace, /hasConfirmedOutput/);
  assert.match(workspace, /\? 'CONFIRMED'/);
  assert.match(workspace, /hasAttachedOutput/);
  assert.match(workspace, /\? 'ATTACHED'/);
  assert.match(workspace, /confirmPcnDraftOutput/);
  assert.match(workspace, /Quay (?:về|lại) hồ sơ/);
  assert.match(primitives, /CONFIRMED/);
  assert.match(primitives, /ATTACHED/);
});
