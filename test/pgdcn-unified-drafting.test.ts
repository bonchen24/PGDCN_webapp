import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPgdcnVisibleNavigation } from '../utils/pgdcnNavigation.ts';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('navigation includes shared drafting entry Hỗ trợ soạn thảo văn bản', () => {
  const visible = getPgdcnVisibleNavigation(['PCN', 'PGD']);
  const draftingItem = visible.find((item) => item.id === 'document-drafting');
  assert.ok(draftingItem, 'document-drafting must be present in shared navigation');
  assert.equal(draftingItem.label, 'Hỗ trợ soạn thảo văn bản');
  assert.equal(draftingItem.kind, 'shared');

  const sidebar = read('components/PgdcnSidebar.tsx');
  assert.match(sidebar, /section:\s*'document-drafting'/);
  assert.match(sidebar, /Soạn thảo văn bản/);
});

test('shared drafting route page forwards domain, tabs and context to PgdcnAppShell', () => {
  const draftingPage = read('app/pgdcn/drafting/page.tsx');
  assert.match(draftingPage, /initialDepartmentSection="document-drafting"/);
  assert.match(draftingPage, /initialDraftingDomain=\{domain\}/);
  assert.match(draftingPage, /initialDraftingTab=\{tab\}/);
  assert.match(draftingPage, /initialPcnDraftDossierId/);
  assert.match(draftingPage, /initialPgdDraftRequestId/);

  const appShell = read('components/PgdcnAppShell.tsx');
  assert.match(appShell, /PgdcnUnifiedDraftingView/);
  assert.match(appShell, /activeTarget\.section === 'document-drafting'/);
});

test('unified drafting view contains segmented domain selector, 3 tabs and non-destructive mounting', () => {
  const unifiedView = read('components/PgdcnUnifiedDraftingView.tsx');

  // Segmented control Giám định (PGD) | Chứng nhận (PCN)
  assert.match(unifiedView, /Giám định \(PGD\)/);
  assert.match(unifiedView, /Chứng nhận \(PCN\)/);
  assert.match(unifiedView, /role="radiogroup"/);

  // 3 tabs
  assert.match(unifiedView, /Soạn thảo/);
  assert.match(unifiedView, /Danh sách biểu mẫu DOCX/);
  assert.match(unifiedView, /Bản nháp của tôi/);

  // State preservation: workspaces remain mounted via conditional display classes
  assert.match(unifiedView, /activeTab === 'drafting' \? 'block' : 'hidden'/);
  assert.match(unifiedView, /activeTab === 'docx' \? 'block' : 'hidden'/);
  assert.match(unifiedView, /activeTab === 'drafts' \? 'block' : 'hidden'/);

  // Embedding existing drafting workspaces without duplication
  assert.match(unifiedView, /<PcnDraftingWorkspaceView/);
  assert.match(unifiedView, /<PgdDraftingWorkspaceView/);

  // DOCX tab features: filters, table columns, action Sử dụng
  assert.match(unifiedView, /filteredDocxList/);
  assert.match(unifiedView, /handleUseTemplate/);
  assert.match(unifiedView, /Sử dụng/);
  assert.match(unifiedView, /Tải về/);

  // Drafts tab features: real draft fetch, continue drafting action
  assert.match(unifiedView, /fetchPcnDraftWorkspaces/);
  assert.match(unifiedView, /fetchPgdDraftWorkspaces/);
  assert.match(unifiedView, /handleContinueDraft/);
  assert.match(unifiedView, /Tiếp tục soạn/);
});
