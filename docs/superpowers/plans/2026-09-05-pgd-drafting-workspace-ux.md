# PGD Drafting Workspace UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the standalone PGD document drafting page so users choose a PYC once, choose a document type once, enter only business data, and work in the compact three-column PCN layout on desktop with a clear one-column mobile flow.

**Architecture:** Keep `PgdDocumentGenerationPanel` request-scoped and responsible only for template resolution, business fields, table editing, validation, and server generation. Move the standalone page shell into `PgdDraftingWorkspaceView`, which owns the single PYC combobox, session draft list, responsive three-column layout, and generated-file history. No new database collection, persistence API, lifecycle transition, or client-side placeholder editor is introduced.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS v4, Zustand PGD store, existing PGD document-generation API, Node `node:test` static UI contracts.

**Spec:** `docs/superpowers/specs/2026-09-05-pgd-central-dossier-workspace-design.md` and `design.md`

## Global Constraints

- `design.md` remains the single source of truth for PGD workflow, template mapping, responsive layout, RBAC, and persistence boundaries.
- The standalone Soạn thảo page must allow the user to choose the PYC/hồ sơ and must not be replaced by the central dossier workspace.
- A source PYC selector and document-type selector each appear exactly once in the drafting flow.
- Template, placeholder, mapping, cell, source inspection, byte size, and version details remain in the Admin/Manager `Cài đặt DOCX` modal, not in the normal data-entry form.
- Existing `generatePgdDocument` and `usePgdStore` boundaries remain unchanged; no PGD lifecycle transition is triggered by saving or generating a draft.
- Desktop uses `xl:grid-cols-[250px_minmax(0,1fr)_270px]`; mobile stacks saved drafts, source/document form, and generated results without page-level horizontal overflow.
- Run tests first for every behavior change, then `npm run typecheck` if available through the repository script equivalent (`npm run lint`), `npm run build`, and `git diff --check`.

---

### Task 1: Replace the outdated PGD drafting UI contract tests

**Files:**
- Modify: `test/pgd-drafting-navigation.test.ts:41-60`
- Test: `test/pgd-drafting-navigation.test.ts`

**Interfaces:**
- Consumes: current `PgdDocumentGenerationPanel` and `PgdWorkspace` source text.
- Produces: a regression contract for `PgdDraftingWorkspaceView` and the simplified request-scoped generation panel.

- [ ] **Step 1: Write the failing test**

Replace the old catalog-fallback test with a contract for the approved UX:

```ts
test('PGD drafting follows the compact PCN workspace without duplicate selectors', () => {
  const drafting = read('components/PgdDraftingWorkspaceView.tsx');
  const generation = read('components/PgdDocumentGenerationPanel.tsx');
  assert.match(workspace, /PgdDraftingWorkspaceView/);
  assert.match(drafting, /PcnCatalogCombobox/);
  assert.match(drafting, /xl:grid-cols-\[250px_minmax\\\(0,1fr\\\)_270px\]/);
  assert.match(drafting, /Bản đã lưu/);
  assert.match(drafting, /Kết quả sinh file/);
  assert.equal((drafting.match(/PcnCatalogCombobox/g) || []).length, 1);
  assert.doesNotMatch(drafting, /Hồ sơ PGD cần soạn tài liệu/);
  assert.doesNotMatch(generation, /Danh mục loại tài liệu PGD/);
  assert.equal((generation.match(/Loại template tài liệu PGD/g) || []).length, 1);
  assert.doesNotMatch(generation, /placeholder=/);
  assert.match(generation, /onSaveDraft/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing structure**

Run: `node --test test/pgd-drafting-navigation.test.ts`

Expected: FAIL because `components/PgdDraftingWorkspaceView.tsx` does not exist, `PgdWorkspace` still renders `PgdTemplateWorkspace`, and the current generation panel still renders the duplicate catalog and native source selector.

- [ ] **Step 3: Keep the existing mapping-read-only assertions**

Do not remove the test that checks `PgdTableFieldEditor`, the absence of `PgdCellManager`, and the Admin-only mapping modal. Those assertions protect the already-approved placeholder boundary while the visible drafting layout changes.

### Task 2: Add the standalone PCN-pattern PGD workspace shell

**Files:**
- Create: `components/PgdDraftingWorkspaceView.tsx`
- Modify: `components/PgdWorkspace.tsx:72,867`
- Test: `test/pgd-drafting-navigation.test.ts`

**Interfaces:**
- Consumes: `PgdInspectionRequest[]`, `PgdDocumentTemplate[]`, `PgdGeneratedDocument[]`, `PcnCatalogCombobox`, `usePgdStore`, and the request-scoped generation panel.
- Produces: `PgdDraftingWorkspaceView({ templates, documents, canMutate, onOpenSettings })` and a single `PcnCatalogCombobox` source control.

- [ ] **Step 1: Define the session draft shape before rendering**

Add this exported type to `components/PgdDraftingWorkspaceView.tsx`:

```ts
export type PgdDraftSession = {
  id: string;
  requestId: string;
  title: string;
  templateId: string;
  format: PgdDocumentTemplateFormat;
  cellValues: Record<string, unknown>;
  updatedAt: string;
};
```

Keep these draft records in component state only. They are a temporary workspace convenience, not a persisted PGD entity and not a replacement for generated-document metadata.

- [ ] **Step 2: Add the single source option model**

Derive options from `usePgdStore((state) => state.requests)` with one option per active request:

```ts
const sourceOptions = useMemo<PcnCatalogOption[]>(() => requests.map((request) => ({
  value: request.id,
  label: `${request.requestCode} · ${request.productName}`,
  description: `${request.customerSnapshot.name} · ${request.lotCode || 'Chưa có số lô'}`,
  searchText: [request.requestCode, request.customerSnapshot.name, request.productName, request.lotCode, request.inspectionLocation].filter(Boolean).join(' '),
})), [requests]);
```

Initialize `requestId` to an empty string so the page does not silently choose the first hồ sơ. When a saved session is clicked, set `requestId` and the draft id together.

- [ ] **Step 3: Render the compact three-column desktop shell**

Render one page header with the PGD eyebrow, `Soạn thảo tài liệu`, `Cài đặt DOCX`, and `Bản soạn mới`. Then render:

```tsx
<div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
  <aside aria-label="Bản đã lưu">
    <h2>Bản đã lưu</h2>
    {drafts.map((draft) => <button key={draft.id} type="button" onClick={() => loadDraft(draft)}>{draft.title}</button>)}
  </aside>
  <main>
    <PcnCatalogCombobox id="pgd-draft-source" label="Chọn nguồn hồ sơ" value={requestId} options={sourceOptions} onChange={setRequestId} />
    {request && <PgdDocumentGenerationPanel key={`${request.id}:${activeDraftId || 'new'}`} request={request} templates={templates} canMutate={canMutate} onSaveDraft={saveDraft} />}
  </main>
  <aside aria-label="Kết quả sinh file">
    <h2>Kết quả sinh file</h2>
    {selectedDocuments.map((document) => <a key={document.id} href={getPgdDocumentDownloadUrl(document.id)}>{document.fileName}</a>)}
  </aside>
</div>
```

The left column lists only session drafts with request code, business document title, and updated time. The center begins with one `PcnCatalogCombobox` (`id="pgd-draft-source"`) and one compact selected-request summary, then mounts `PgdDocumentGenerationPanel` only when a request is selected. The right column lists generated documents for the selected request using `getPgdDocumentDownloadUrl`; it must not repeat request summary or template technical metadata.

- [ ] **Step 4: Wire draft creation/loading without changing lifecycle**

When the child calls `onSaveDraft`, create or replace one `PgdDraftSession` with a stable id, the selected request id, selected template id, format, cell values, and `new Date().toISOString()`. `Bản soạn mới` clears the active draft and source selection. Selecting a saved draft restores its source, template, format, and cell values. Saving a draft only updates the local session list and shows a success toast; it does not call a new API or mutate the PGD request.

- [ ] **Step 5: Switch the PGD shell to the new component**

Change the import in `components/PgdWorkspace.tsx` to import `PgdDraftingWorkspaceView`, and change the `activeSection === 'templates'` projection to render it with the existing `pgd.documentTemplates`, `pgd.documents`, `canMutate && isAdmin`, and DOCX-settings callback. Remove the old `PgdTemplateWorkspace` export from `PgdDocumentGenerationPanel.tsx` after Task 3 moves its responsibilities.

- [ ] **Step 6: Run the focused contract test**

Run: `node --test test/pgd-drafting-navigation.test.ts`

Expected: the new workspace-shell assertions pass while the generation-panel assertions still fail until Task 3 removes the duplicate catalog and adds the draft callback.

### Task 3: Simplify the request-scoped generation panel

**Files:**
- Modify: `components/PgdDocumentGenerationPanel.tsx:23-29,174-268`
- Test: `test/pgd-drafting-navigation.test.ts`

**Interfaces:**
- Consumes: `request`, filtered template catalog, existing PGD artifact prefill, `usePgdStore.generateDocument`, and optional initial draft values.
- Produces: `PgdDocumentGenerationPanel({ request, templates, canMutate, initialTemplateId, initialFormat, initialCellValues, onSaveDraft, onOpenSettings })` with one document-type selector and no source selector/catalog tiles/file-history duplication.

- [ ] **Step 1: Add draft initialization and callback props**

Extend the props with:

```ts
initialTemplateId?: string;
initialFormat?: PgdDocumentTemplateFormat;
initialCellValues?: Record<string, unknown>;
onSaveDraft?: (input: {
  templateId: string;
  format: PgdDocumentTemplateFormat;
  cellValues: Record<string, unknown>;
}) => void;
```

Initialize local state from these props, and keep the existing request-prefill effect so fields not present in a draft continue to derive from the selected request snapshot.

- [ ] **Step 2: Remove the duplicate document catalog and technical header**

Delete the `Danh mục loại tài liệu PGD` tile section and the child `Cài đặt DOCX`/product-group pill header. Keep the business-facing section title `Sinh tài liệu PGD`, one `Loại template tài liệu PGD` native select, one format select, and the existing server generation button. Template resolution continues through the filtered `availableTemplates`, `getPgdTemplateCellsForProductGroup`, and the selected template id; no placeholder key or mapping editor is added.

- [ ] **Step 3: Keep the dense business form grid and remove duplicate file history**

Keep the existing `sm:grid-cols-2 lg:grid-cols-4` field grid, full-width table cells, and business labels. Replace the footer template metadata string with a short business message such as `Dữ liệu sẽ lấy từ hồ sơ đã chọn và template phù hợp.` Remove `requestDocuments` rendering from this panel so the parent’s right column is the only generated-file result surface.

- [ ] **Step 4: Add the save-draft action beside generation**

Add a `Lưu bản soạn` button that calls `onSaveDraft?.({ templateId: template.id, format, cellValues })`, disabled when mutation is not allowed, the panel is busy, or no template is available. Keep validation only for generation; saving a draft must allow incomplete fields so users can return later.

- [ ] **Step 5: Run the focused contract test and typecheck**

Run: `node --test test/pgd-drafting-navigation.test.ts`

Expected: PASS with the single source selector in the new shell, one document-type selector in the generation panel, no catalog tile section, and no visible `placeholder=` attributes in the generation form.

Run: `npm run typecheck`

Expected: PASS, or if the repository has no `typecheck` script, run the configured equivalent `npm run lint` and record that result.

### Task 4: Verify responsive and repository integration

**Files:**
- Modify: `components/PgdDraftingWorkspaceView.tsx` if verification finds layout overflow.
- Modify: `components/PgdDocumentGenerationPanel.tsx` if verification finds duplicate controls or incorrect initial-state behavior.
- Test: `test/pgd-drafting-navigation.test.ts` and the relevant PGD test suite.

**Interfaces:**
- Consumes: the completed standalone PGD drafting workspace.
- Produces: verified UI contract and production build readiness without changes to PGD API/schema/lifecycle.

- [ ] **Step 1: Run the focused PGD drafting and document tests**

Run: `node --test test/pgd-drafting-navigation.test.ts test/pgd-document-generation.test.ts test/pgd-document-templates.test.ts`

Expected: PASS with no raw technical placeholder configuration exposed in the normal form.

- [ ] **Step 2: Run the full PCN test runner**

Run: `npm test`

Expected: PASS with no regression in PGD navigation, template mapping, document generation, or shared shell contracts.

- [ ] **Step 3: Run production validation**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `npm run build`

Expected: successful Next.js production build.

- [ ] **Step 4: Review the final diff and commit the implementation**

Run: `git status --short` and `git diff --stat`

Expected: only the planned workspace, generation panel, navigation test, and plan files are changed. Commit with:

```bash
git commit --only -m "feat: streamline PGD drafting workspace" -- components/PgdDraftingWorkspaceView.tsx components/PgdDocumentGenerationPanel.tsx components/PgdWorkspace.tsx test/pgd-drafting-navigation.test.ts docs/superpowers/plans/2026-09-05-pgd-drafting-workspace-ux.md
```
