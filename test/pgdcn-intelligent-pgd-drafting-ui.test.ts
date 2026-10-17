import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspace = fs.readFileSync(new URL('../components/PgdDraftingWorkspaceView.tsx', import.meta.url), 'utf8');
const generation = fs.readFileSync(new URL('../components/PgdDocumentGenerationPanel.tsx', import.meta.url), 'utf8');

const expectSource = (source: string, pattern: RegExp, behavior: string) => assert.ok(pattern.test(source), behavior);

test('PGD drafting can save incomplete work and announces save progress', () => {
  expectSource(generation, /const canSaveDraft =[^;]*'BLOCKED'[^;]*'ERROR'/, 'incomplete PGD drafts must remain saveable');
  expectSource(generation, /\{canSaveDraft && onSaveDraft/, 'the save action must be rendered while validation is blocked');
  expectSource(generation, /savingDraft \? 'Đang lưu…' : 'Lưu bản nháp'/, 'the save action must announce pending persistence');
  expectSource(generation, /aria-busy=\{busy \|\| savingDraft\}/, 'pending save and generation work must be exposed as busy');
});

test('PGD required field errors are connected to their fields for assistive technology', () => {
  expectSource(generation, /'aria-describedby': hasFieldIssue \? issueId : undefined/, 'invalid fields must reference their inline error');
  expectSource(generation, /id=\{issueId\}[^>]*>[\s\S]*?Bắt buộc: \{cell\.label\}/, 'the referenced inline error must keep its required-field label');
});

test('PGD workspace offers an A4 preview for a generated PDF in the current session', () => {
  expectSource(workspace, /showA4Preview=\{true\}/, 'the PGD workspace must opt into its generated PDF preview');
  expectSource(generation, /showA4Preview\?: boolean/, 'the generation panel must keep preview opt-in');
  expectSource(generation, /showA4Preview && lastOutput && isPgdPdfOutput\(lastOutput\)/, 'only the current PDF output may be previewed');
  expectSource(generation, /<iframe[^>]*title=\{`Xem trước A4/, 'the A4 preview must have an accessible title');
  expectSource(generation, /src=\{lastOutput\.url\}/, 'the preview must use the generated session URL');
});
