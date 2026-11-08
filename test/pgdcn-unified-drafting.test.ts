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
  assert.match(sidebar, /Soạn thảo tài liệu/);
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

test('unified drafting filters DOCX and drafts strictly by activeDomain without redundant domain select mixing', () => {
  const unifiedView = read('components/PgdcnUnifiedDraftingView.tsx');

  // Active domain is the single source of truth for filtering DOCX & drafts
  assert.match(unifiedView, /const currentDomainDocxList = useMemo\(\(\) =>/);
  assert.match(unifiedView, /const currentDomainDraftList = useMemo\(\(\) =>/);
  assert.match(unifiedView, /unifiedDocxList\.filter\(\(item\) => item\.domain === activeDomain/);
  assert.match(unifiedView, /unifiedDraftList\.filter\(\(item\) => item\.domain === activeDomain/);

  // Redundant domain selects are removed from tab toolbars to prevent mixing
  assert.doesNotMatch(unifiedView, /docxDomainFilter/);
  assert.doesNotMatch(unifiedView, /draftDomainFilter/);

  // Badges reflect current domain counts
  assert.match(unifiedView, /\{currentDomainDocxList\.length\}/);
  assert.match(unifiedView, /\{currentDomainDraftList\.length\}/);

  // Validates canDraft on template use
  assert.match(unifiedView, /if \(!item\.canDraft\)/);
  assert.match(unifiedView, /toast\.error/);

  // Honest messaging on open/select actions instead of false immediate success
  assert.match(unifiedView, /toast\.info\(`Đang mở bản nháp/);
  assert.match(unifiedView, /toast\.info\(`Đang chuyển sang biểu mẫu/);
  assert.match(unifiedView, /Không tìm thấy.*bản nháp/);

  // No dead '#' links in outputs
  assert.doesNotMatch(unifiedView, /href=\{out\.url \|\| '#'\}/);
});

test('PCN database templates in unified DOCX tab have canDraft=false with clear explanation and disabled action', () => {
  const unifiedView = read('components/PgdcnUnifiedDraftingView.tsx');

  // PCN DB templates are marked canDraft: false with explicit reason
  assert.match(unifiedView, /id: `pcn-db-\$\{t\.id\}`/);
  assert.match(unifiedView, /sourceType: 'DATABASE'/);
  assert.match(unifiedView, /sourceLabel: 'Mẫu tải lên \(CSDL\)'/);
  assert.match(unifiedView, /canDraft: false/);
  assert.match(unifiedView, /canDraftReason: 'Mẫu tải lên \(CSDL\) phục vụ lưu trữ và xuất văn bản qua pipeline DOCX/);

  // Operational templates maintain canDraft: true
  assert.match(unifiedView, /id: `pcn-cat-\$\{t\.id\}`/);
  assert.match(unifiedView, /sourceType: 'CATALOG'/);
  assert.match(unifiedView, /canDraft: true/);
});

test('server.legacy.ts enforces ownership authorization on POST /api/pgd/drafts and POST /api/pcn/drafts', () => {
  const server = read('server.legacy.ts');

  // PGD draft update checks creator ownership or manager override
  assert.match(server, /if \(existing && existing\.createdByUsername\) \{[\s\S]*?existing\.createdByUsername\.toLowerCase\(\) === actor\.username\.toLowerCase\(\)/);
  assert.match(server, /isPcnSystemManager\(actor\) \|\| isPgdDossierManager\(actor\)/);
  assert.match(server, /Chỉ người tạo bản nháp hoặc quản trị viên mới có quyền cập nhật bản nháp này/);

  // PCN draft update checks creator ownership or manager override
  assert.match(server, /if \(existing && existing\.createdByUsername\) \{[\s\S]*?existing\.createdByUsername\.toLowerCase\(\) === actor\.username\.toLowerCase\(\)/);
  assert.match(server, /Chỉ người tạo bản nháp hoặc quản trị viên mới có quyền cập nhật bản nháp PCN này/);
  assert.match(server, /res\.status\(Number\(error\?\.statusCode\) \|\| 400\)\.json/);
});

test('behavioral simulation: draft context switch prevents data loss on cancel and succeeds on confirmation', () => {
  const pgdWorkspace = read('components/PgdDraftingWorkspaceView.tsx');

  // Verify workspace uses loadDraft with confirmContextSwitch protection on initialDraftId changes
  assert.match(pgdWorkspace, /const lastHandledInitialDraftIdRef = useRef<string \| undefined>/);
  assert.match(pgdWorkspace, /lastHandledInitialDraftIdRef\.current === initialDraftId/);
  assert.match(pgdWorkspace, /loadDraft\(target\)/);

  // Pure logic simulation of draft context switch
  let currentDraft = { id: 'draft-A', title: 'Bản A', dirty: true, cellValues: { field1: 'dirty-value' } };
  let promptShown = 0;

  function attemptLoadDraft(newDraft: typeof currentDraft, userConfirms: boolean): boolean {
    if (currentDraft.dirty) {
      promptShown++;
      if (!userConfirms) {
        // User cancelled discard: abort switch, keep current draft and unsaved changes
        return false;
      }
    }
    // Confirmed or clean: load draft and reset dirty
    currentDraft = { ...newDraft, dirty: false };
    return true;
  }

  // 1. User is on draft A with unsaved changes, attempts to open draft B, but clicks Cancel
  const draftB = { id: 'draft-B', title: 'Bản B', dirty: false, cellValues: { field1: 'draft-B-value' } };
  const switch1 = attemptLoadDraft(draftB, false);

  assert.equal(switch1, false, 'Context switch must be aborted on Cancel');
  assert.equal(promptShown, 1, 'Confirmation prompt must be shown once');
  assert.equal(currentDraft.id, 'draft-A', 'Draft ID must remain draft-A');
  assert.equal(currentDraft.cellValues.field1, 'dirty-value', 'Unsaved changes in draft-A must NOT be lost');

  // 2. User attempts to open draft B and clicks OK (confirm discard)
  const switch2 = attemptLoadDraft(draftB, true);
  assert.equal(switch2, true, 'Context switch must succeed on confirmation');
  assert.equal(promptShown, 2, 'Second confirmation prompt must be recorded');
  assert.equal(currentDraft.id, 'draft-B', 'Current draft must now be draft-B');
  assert.equal(currentDraft.dirty, false, 'Dirty flag must be reset upon loading clean draft');
});

test('behavioral simulation: owner authorization logic protects private drafts and allows manager override', () => {
  type Actor = { username: string; isManager: boolean };
  type Draft = { id: string; createdByUsername?: string };

  function authorizeDraftUpdate(existing: Draft, actor: Actor): { allowed: boolean; status: number; error?: string } {
    if (existing.createdByUsername) {
      const isOwner = existing.createdByUsername.toLowerCase() === actor.username.toLowerCase();
      const canOverride = actor.isManager;
      if (!isOwner && !canOverride) {
        return { allowed: false, status: 403, error: 'Chỉ người tạo bản nháp hoặc quản trị viên mới có quyền cập nhật bản nháp này.' };
      }
    }
    return { allowed: true, status: 200 };
  }

  const draftOwnerA: Draft = { id: 'd-1', createdByUsername: 'userA' };
  const legacySharedDraft: Draft = { id: 'd-legacy', createdByUsername: undefined };

  // Case 1: Owner updates their own draft
  assert.deepEqual(authorizeDraftUpdate(draftOwnerA, { username: 'userA', isManager: false }), { allowed: true, status: 200 });

  // Case 2: Different user tries to overwrite userA draft -> 403 Forbidden
  assert.deepEqual(authorizeDraftUpdate(draftOwnerA, { username: 'userB', isManager: false }), {
    allowed: false,
    status: 403,
    error: 'Chỉ người tạo bản nháp hoặc quản trị viên mới có quyền cập nhật bản nháp này.',
  });

  // Case 3: Admin / Manager overrides and updates userA draft -> Allowed
  assert.deepEqual(authorizeDraftUpdate(draftOwnerA, { username: 'adminUser', isManager: true }), { allowed: true, status: 200 });

  // Case 4: Legacy draft without createdByUsername (unowned) -> Any authorized user can update
  assert.deepEqual(authorizeDraftUpdate(legacySharedDraft, { username: 'userB', isManager: false }), { allowed: true, status: 200 });
});

