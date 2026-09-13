import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const issuance = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
const delegation = fs.readFileSync(new URL('../components/PcnSignerDelegationPanel.tsx', import.meta.url), 'utf8');
const labRequest = fs.readFileSync(new URL('../components/PcnLabRequestView.tsx', import.meta.url), 'utf8');
const formType = workspace.slice(workspace.indexOf('type PcnProposalForm'), workspace.indexOf('function ProposalView'));
const proposalView = workspace.slice(workspace.indexOf('function ProposalView'), workspace.indexOf('function Field'));

test('proposal form captures the server-relevant received date without exposing proposal-code editing', () => {
  assert.match(proposalView, /id="pcn-proposal-received-at"/);
  assert.match(proposalView, /PgdcnDateInput/);
  assert.doesNotMatch(proposalView, /placeholder=/);
  assert.match(proposalView, /receivedAt: form\.receivedAt/);
  assert.match(proposalView, /readOnly=\{Boolean\(editingProposal\)\}/);
  assert.match(proposalView, /PCN-YYMMDD-TT/);
  assert.doesNotMatch(formType, /proposalCode/);
});

test('proposal form shows the complete supported status contract as read-only state', () => {
  assert.match(workspace, /proposalStatusLabels/);
  for (const status of ['DRAFT', 'RECEIVED', 'REJECTED', 'CONVERTED']) {
    assert.match(workspace, new RegExp(status));
  }
  assert.match(proposalView, /trạng thái.*hệ thống|hệ thống.*trạng thái|status.*server|server.*status/i);
});

test('proposal form documents domain-owned unit and evidence boundaries instead of inventing fields', () => {
  assert.doesNotMatch(formType, /\bunit\b|\bnotes\b|\bevidence\b|\battachments\b/);
  assert.match(proposalView, /Đơn vị mẫu/);
  assert.match(proposalView, /checklist tài liệu|tài liệu.*chứng cứ/i);
});

test('proposal form exposes field-level required semantics and moves focus to the first invalid control', () => {
  assert.match(proposalView, /required/);
  assert.match(proposalView, /aria-describedby=\{validationErrors/);
  assert.match(proposalView, /querySelector<HTMLElement>\('\[aria-invalid="true"\]'\)/);
  assert.match(proposalView, /returnFocusRef/);
  assert.match(proposalView, /proposalCloseButtonRef/);
});

test('proposal labels mirror required controls with a visible red star', () => {
  assert.match(workspace, /React\.isValidElement\(children\)/);
  assert.match(workspace, /childProps\?\.required/);
  assert.match(workspace, /text-rose-600/);
});

test('PCN downstream forms mirror required controls with visible red stars', () => {
  for (const source of [issuance, delegation, labRequest]) {
    assert.match(source, /text-rose-600/);
  }
  assert.match(issuance, /Số phát hành <span[^>]*text-rose-600/);
  assert.match(issuance, /Người\/đơn vị nhận <span[^>]*text-rose-600/);
  assert.match(delegation, /function RequiredLabel/);
  assert.match(delegation, /<RequiredLabel>Lĩnh vực được phép<\/RequiredLabel>/);
  assert.match(labRequest, /React\.isValidElement\(children\)/);
  assert.match(labRequest, /childProps\?\.required/);
});

// --- End of pcn-proposal-form-contract.test.ts ---
