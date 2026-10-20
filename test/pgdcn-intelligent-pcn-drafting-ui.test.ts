import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import PcnDraftingWorkspaceView from '../components/PcnDraftingWorkspaceView';
import { validatePcnDraftAction } from '../utils/pcnDrafting';
import type { CertificationDossier } from '../types';

const workspace = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');

test('PCN drafting keeps save available while required data is incomplete and shows save progress', () => {
  const actionBarStart = workspace.indexOf('<DraftingStickyActionBar');
  const actionBarEnd = workspace.indexOf('</DraftingStickyActionBar>', actionBarStart);
  const actionBar = workspace.slice(actionBarStart, actionBarEnd);

  assert.equal(validatePcnDraftAction('PROPOSAL_FORM', {}, 'GENERATE').valid, false);
  const render = (initialRequirementId?: string) => renderToStaticMarkup(createElement(PcnDraftingWorkspaceView, {
    proposals: [],
    dossiers: [{ id: 'incomplete-draft-save-test', dossierCode: 'PCN-DRAFT-001', fieldCodes: [], status: 'DRAFT' } as unknown as CertificationDossier],
    templates: [],
    onUploadTemplate: async () => undefined,
    onReviewTemplate: async () => undefined,
    initialDossierId: 'incomplete-draft-save-test',
    initialRequirementId,
    initialKind: 'PROPOSAL_FORM',
  }));
  const buttonMarkup = (markup: string) => Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), (match) => match[0]);
  const incompleteDraftButtons = buttonMarkup(render());
  const saveButton = incompleteDraftButtons.find((button) => button.includes('Lưu bản nháp'));
  assert.ok(saveButton, 'the incomplete draft still exposes its save action');
  assert.doesNotMatch(saveButton, /\sdisabled(?:=|>)/, 'saving must remain enabled when generation fields are incomplete');
  assert.equal(buttonMarkup(render('unsupported-requirement')).some((button) => button.includes('Lưu bản nháp')), false, 'an unsupported requirement context must not be saved');
  assert.ok(/\{canSaveDraft &&/.test(actionBar));
  assert.match(actionBar, /onClick=\{\(\) => void save\(\)\}/);
  assert.match(actionBar, /busyAction === 'SAVE' \? 'Đang lưu…' : 'Lưu bản nháp'/);
  assert.match(actionBar, /disabled=\{busy\}/);
});
test('PCN next-step links open collapsed field sections before focusing an issue', () => {
  assert.ok(/instanceof HTMLDetailsElement[\s\S]*?\.open = true/.test(workspace));
});

test('PCN drafting saves changed values before regenerating and blocks review of stale outputs', () => {
  const generateStart = workspace.indexOf('const generate = async () => {');
  const generateEnd = workspace.indexOf('const reviewOutput', generateStart);
  const generate = workspace.slice(generateStart, generateEnd);

  assert.ok(/if \(!currentId \|\| hasUnsavedChanges\)/.test(generate));
  assert.ok(/const outputIsStale = currentOutputs\.length > 0 && hasUnsavedChanges/.test(workspace));
  assert.ok(/if \(outputIsStale\) return/.test(workspace));
});

test('PCN drafting announces save, attach and stale-output states in readiness guidance', () => {
  assert.ok(/busyAction === 'SAVE'\s*\? 'Đang lưu bản nháp/.test(workspace));
  assert.ok(/busyAction === 'CONFIRM'\s*\? 'Đang gắn tài liệu/.test(workspace));
  assert.ok(/outputIsStale\s*\? 'Bản nháp đã thay đổi/.test(workspace));
});

test('PCN drafting exposes an A4 PDF preview alongside generated outputs', () => {
  assert.ok(workspace.includes("import { PcnFilePreviewButton } from './PcnDossierFilePreview';"));
  assert.ok(/output\.format === 'PDF'[\s\S]*?Xem trước A4[\s\S]*?PcnFilePreviewButton/.test(workspace));
  assert.match(workspace, /Lưu & sinh DOCX \+ PDF/);
  assert.match(workspace, /Đang sinh tài liệu/);
});
