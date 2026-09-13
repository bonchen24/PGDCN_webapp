import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const assistant = fs.readFileSync(new URL('../components/PcnAssistantView.tsx', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('approval assistant UI selects one dossier and streams an advisory review', () => {
  assert.match(assistant, /Trợ lý phê duyệt/);
  assert.match(assistant, /approval-assistant\/candidates/);
  assert.match(assistant, /approval-assistant\/review/);
  assert.match(assistant, /Xác nhận/);
  assert.match(assistant, /type="radio"/);
  assert.match(assistant, /criterion_started|criterion_result/);
  assert.match(assistant, /Mở hồ sơ|Mở bằng chứng/);
  assert.match(assistant, /PDF/);
  assert.match(assistant, /DOCX/);
  for (const marker of ['classifyPcnAssistantError', 'Tiêu chí đã hoàn tất', 'Mở tệp', 'role="status"', 'role="alert"']) {
    assert.ok(assistant.includes(marker), `Missing assistant UX marker: ${marker}`);
  }
  assert.doesNotMatch(assistant, /PcnApprovalModal|\/api\/pcn\/issuance|applyPcnApprovalDecision|onApprove|onReturn/);
});

test('PCN workspace exposes the assistant as an independent sidebar surface', () => {
  assert.match(workspace, /assistant:\s*'Trợ lý phê duyệt'/);
  assert.match(workspace, /activeSection === 'assistant'/);
});
