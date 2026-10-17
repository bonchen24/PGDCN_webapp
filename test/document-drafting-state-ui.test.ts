import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DraftingReadinessPanel } from '../components/PgdcnDraftingPrimitives';

const pcnSource = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');
const pgdSource = fs.readFileSync(new URL('../components/PgdDocumentGenerationPanel.tsx', import.meta.url), 'utf8');
const sharedSource = fs.readFileSync(new URL('../components/PgdcnDraftingPrimitives.tsx', import.meta.url), 'utf8');

test('PCN drafting workspace exposes an explicit state contract and readiness region', () => {
  assert.match(pcnSource, /data-testid="pcn-drafting-workspace"/);
  assert.match(pcnSource, /stateTestId="pcn-drafting-state"/);
  assert.match(pcnSource, /testId="pcn-drafting-readiness"/);
  assert.match(pcnSource, /testId="pcn-drafting-outputs"/);
  assert.match(pcnSource, /EMPTY|EDITING|SAVED|GENERATING|READY|BLOCKED|ERROR/);
  assert.match(sharedSource, /data-testid=\{stateTestId\}/);

  const readyMarkup = renderToStaticMarkup(createElement(DraftingReadinessPanel, {
    state: 'READY',
    stateLabel: 'Đã sẵn sàng',
    message: 'Có thể tiếp tục.',
    stateTestId: 'state-ready',
  }));
  const errorMarkup = renderToStaticMarkup(createElement(DraftingReadinessPanel, {
    state: 'ERROR',
    stateLabel: 'Có lỗi',
    message: 'Không thể tạo tài liệu.',
    stateTestId: 'state-error',
  }));

  assert.match(readyMarkup, /role="status"/);
  assert.doesNotMatch(readyMarkup, /aria-live=/);
  assert.match(errorMarkup, /role="alert"/);
  assert.doesNotMatch(errorMarkup, /aria-live=/);
});

test('PGD document generation exposes explicit state, readiness and output regions', () => {
  assert.match(pgdSource, /data-testid="pgd-document-generation"/);
  assert.match(pgdSource, /stateTestId="pgd-document-state"/);
  assert.match(pgdSource, /testId="pgd-document-readiness"/);
  assert.match(pgdSource, /testId="pgd-document-outputs"/);
  assert.match(pgdSource, /EMPTY|EDITING|SAVED|GENERATING|READY|BLOCKED|ERROR/);
});

test('document drafting source keeps Vietnamese strings UTF-8 clean', () => {
  assert.doesNotMatch(`${pcnSource}\n${pgdSource}`, /(?:Ã.|Ä.|áº|Â.)/);
});
