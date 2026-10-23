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

test('server.legacy.ts implements secure mineOnly filtering on both PGD and PCN drafts with strict createdByUsername ownership', () => {
  const server = read('server.legacy.ts');

  // PGD drafts route
  assert.match(server, /app\.get\('\/api\/pgd\/drafts'/);
  assert.match(server, /requirePgdSession\(req, res\)/);
  assert.match(server, /mineOnly = String\(req\.query\.mineOnly/);
  assert.match(server, /getPgdSessionUser\(req\)/);
  assert.match(server, /NULLIF\(data->>'createdByUsername', ''\) = \$/);
  // Ensure we don't mix up updatedByUsername as owner
  assert.doesNotMatch(server, /data->>'domain' = 'pgd'[\s\S]*?updatedByUsername' = \$/);

  // PCN drafts route
  assert.match(server, /app\.get\('\/api\/pcn\/drafts'/);
  assert.match(server, /requirePcnSession\(req, res\)/);
  assert.match(server, /mineOnly = String\(req\.query\.mineOnly/);
  assert.match(server, /getPcnSessionUser\(req\)/);
  assert.match(server, /collection_name = \$1[\s\S]*?NULLIF\(data->>'createdByUsername', ''\) = \$/);
});

test('client wrappers pgdApi and pcnDraftApi support opt-in mineOnly querying', () => {
  const pgdApi = read('utils/pgdApi.ts');
  assert.match(pgdApi, /fetchPgdDraftWorkspaces\(requestId\?: string, options\?: \{ mineOnly\?: boolean \}\)/);
  assert.match(pgdApi, /options\?\.mineOnly\)/);
  assert.match(pgdApi, /params\.set\('mineOnly', 'true'\)/);

  const pcnDraftApi = read('utils/pcnDraftApi.ts');
  assert.match(pcnDraftApi, /fetchPcnDraftWorkspaces\(options\?: \{ mineOnly\?: boolean \}\)/);
  assert.match(pcnDraftApi, /options\?\.mineOnly \? '\?mineOnly=true' : ''/);
});

test('unified drafting preserves mounted state of both editors without ternary unmounting', () => {
  const unifiedView = read('components/PgdcnUnifiedDraftingView.tsx');

  // Neither child workspace should be conditionally mounted via ternary in Tab 1
  assert.doesNotMatch(unifiedView, /activeDomain === 'PCN' \? <PcnDraftingWorkspaceView/);
  assert.doesNotMatch(unifiedView, /activeDomain === 'PGD' \? <PgdDraftingWorkspaceView/);

  // Both editors are mounted concurrently when scopes are present and toggle visibility with CSS
  assert.match(unifiedView, /hasPcn && \([\s\S]*?<div className=\{activeDomain === 'PCN' \? 'p-3 lg:p-4' : 'hidden'\}>[\s\S]*?<PcnDraftingWorkspaceView/);
  assert.match(unifiedView, /hasPgd && \([\s\S]*?<div className=\{activeDomain === 'PGD' \? 'p-3 lg:p-4' : 'hidden'\}>[\s\S]*?<PgdDraftingWorkspaceView/);
});

test('child editors and unified view support continuing draft by specific ID', () => {
  const unifiedView = read('components/PgdcnUnifiedDraftingView.tsx');
  assert.match(unifiedView, /selectedPcnDraftId/);
  assert.match(unifiedView, /selectedPgdDraftId/);
  assert.match(unifiedView, /initialDraftId=\{selectedPcnDraftId\}/);
  assert.match(unifiedView, /initialDraftId=\{selectedPgdDraftId\}/);

  const pcnWorkspace = read('components/PcnDraftingWorkspaceView.tsx');
  assert.match(pcnWorkspace, /initialDraftId\?: string/);
  assert.match(pcnWorkspace, /drafts\.find\(\(d\) => d\.id === initialDraftId\)/);

  const pgdWorkspace = read('components/PgdDraftingWorkspaceView.tsx');
  assert.match(pgdWorkspace, /initialDraftId\?: string/);
  assert.match(pgdWorkspace, /drafts\.find\(\(d\) => d\.id === initialDraftId\)/);
});

test('unified drafting filters DOCX and drafts by activeDomain and validates drafting capability', () => {
  const unifiedView = read('components/PgdcnUnifiedDraftingView.tsx');

  // Initial filter defaults to defaultDomain, not ALL
  assert.match(unifiedView, /useState<'ALL' \| 'PGD' \| 'PCN'>\(defaultDomain\)/);

  // Switching active domain syncs filters
  assert.match(unifiedView, /handleDomainChange/);

  // Validates canDraft on template use
  assert.match(unifiedView, /if \(!item\.canDraft\)/);
  assert.match(unifiedView, /toast\.error/);

  // No dead '#' links in outputs
  assert.doesNotMatch(unifiedView, /href=\{out\.url \|\| '#'\}/);
});

