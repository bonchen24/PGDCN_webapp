import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnDraftTextPreflightWarnings, canSuggestPcnDraftAiField, hasPcnDraftWorkspaceChanges } from '../components/PcnDraftingWorkspaceView.tsx';
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

test('PCN unsaved state compares the current title and values with its baseline', () => {
  const baseline = { title: 'PYC draft', values: { amount: '4', details: { lot: 'A', date: '2026-10-10' } } };

  assert.equal(hasPcnDraftWorkspaceChanges({ title: 'PYC draft', values: { details: { date: '2026-10-10', lot: 'A' }, amount: '4' } }, baseline), false);
  assert.equal(hasPcnDraftWorkspaceChanges({ title: baseline.title, values: { ...baseline.values, blankField: '' } }, baseline), false);
  assert.equal(hasPcnDraftWorkspaceChanges({ title: 'PYC draft copy', values: baseline.values }, baseline), true);
  assert.equal(hasPcnDraftWorkspaceChanges({ title: baseline.title, values: { ...baseline.values, amount: '5' } }, baseline), true);
});

test('PCN AI gợi ý is limited to nonempty editable prose fields', () => {
  const prose = { key: 'ghi_chu', label: 'Ghi chú', type: 'textarea' };
  assert.equal(canSuggestPcnDraftAiField(prose, 'Nội dung ghi chú', false), true);
  assert.equal(canSuggestPcnDraftAiField(prose, '   ', false), false);
  assert.equal(canSuggestPcnDraftAiField(prose, '125.5', false), false);
  assert.equal(canSuggestPcnDraftAiField(prose, '2026-10-10', false), false);
  assert.equal(canSuggestPcnDraftAiField(prose, 'Nội dung ghi chú', true), false);
  assert.equal(canSuggestPcnDraftAiField({ ...prose, type: 'date' }, '2026-10-10', false), false);
  assert.equal(canSuggestPcnDraftAiField({ ...prose, type: 'number' }, '12', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'ma_ho_so', label: 'Số hồ sơ' }, 'PCN-123', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'dien_thoai', label: 'Điện thoại' }, '0901234567', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'ngay_lap', label: 'Ngày lập' }, '2026-10-10', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'model', label: 'Kiểu loại' }, 'Model X-12', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'nguoi_ky_ben_a', label: 'Người ký bên A' }, 'Nguyễn Văn A', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'nguoi_phe_duyet', label: 'Người phê duyệt' }, 'Nguyễn Văn A', false), false);
  assert.equal(canSuggestPcnDraftAiField({ key: 'ket_luan', label: 'Kết luận', type: 'textarea' }, 'Đạt', false), false);
  assert.match(workspace, /const aiEligible = Boolean\(template\?\.id\) && canSuggestPcnDraftAiField/);
  assert.match(workspace, /PgdcnDraftAiSuggestionPanel/);
  const requestStart = workspace.indexOf("fetch('/api/pgdcn/drafting-ai'");
  const requestEnd = workspace.indexOf('const responseJson', requestStart);
  const request = workspace.slice(requestStart, requestEnd);
  assert.match(request, /domain: 'PCN'/);
  assert.match(request, /mode: 'PROOFREAD'/);
  assert.match(request, /templateCode: current\.snapshot\.templateCode/);
  assert.match(request, /fieldKey: current\.snapshot\.fieldKey/);
  assert.match(request, /fieldLabel: current\.snapshot\.fieldLabel/);
  assert.match(request, /originalText: current\.snapshot\.originalText/);
  assert.doesNotMatch(request, /\bcontext\s*:/);
  assert.match(workspace, /updateValue\(current\.snapshot\.fieldKey, suggestion\)/);
});

test('PCN text preflight warns on editable text fields and skips dates and readonly source fields', () => {
  const fields = [
    { key: 'ghi_chu', label: 'Ghi chú', type: 'textarea' },
    { key: 'ma_ho_so', label: 'Số hồ sơ', type: 'text', required: true },
    { key: 'ngay_lap', label: 'Ngày lập', type: 'date', required: true },
    { key: 'source_note', label: 'Ghi chú nguồn', type: 'text' },
  ];
  const values = {
    ghi_chu: 'Có  nội dung . {TEN_DON_VI}',
    ma_ho_so: '   ',
    ngay_lap: '',
    source_note: 'Giá trị  nguồn',
  };
  const originalValues = structuredClone(values);

  const warnings = buildPcnDraftTextPreflightWarnings(fields, values, new Set(['source_note']));

  assert.deepEqual(
    warnings.map(({ fieldKey, fieldLabel, code }) => [fieldKey, fieldLabel, code]),
    [
      ['ghi_chu', 'Ghi chú', 'double-space'],
      ['ghi_chu', 'Ghi chú', 'space-before-punctuation'],
      ['ghi_chu', 'Ghi chú', 'unfilled-placeholder'],
      ['ma_ho_so', 'Số hồ sơ', 'required-empty'],
    ],
  );
  assert.deepEqual(values, originalValues);
  assert.match(workspace, /data-testid="pcn-draft-text-preflight"/);
  assert.match(workspace, /onClick=\{\(\) => focusField\(warning\.fieldKey\)\}/);
  assert.match(workspace, /không kiểm tra chính tả đầy đủ/i);
});
