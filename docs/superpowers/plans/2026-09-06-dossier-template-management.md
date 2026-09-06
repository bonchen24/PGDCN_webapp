# Hồ sơ mẫu quản trị trực quan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây workspace “Hồ sơ mẫu” trực quan cho Admin/Quản lý, quản lý versioned workflow của PCN và PGD, gán checklist tài liệu theo node, và xem preview Archify mà không yêu cầu người dùng đọc JSON.

**Architecture:** Giữ storage/API tách theo domain: PCN tiếp tục dùng `PcnWorkflowTemplate`/`pcnWorkflowTemplates`, PGD bổ sung workflow-template contract/collection riêng. Một normalized editor view model dùng chung cho canvas, inspector và validation UI; adapter domain chịu trách nhiệm chuyển `requirementIds` PCN hoặc `requirementCodes` PGD. Archify chỉ là projection preview từ draft/persisted template, không phải editor và không chứa file private.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Zustand, Tailwind CSS, `@dnd-kit/core`/`@dnd-kit/sortable`, Node test runner, PostgreSQL JSONB, Archify v2 compiler/reader.

**Spec:** `docs/superpowers/specs/2026-09-06-dossier-template-management-design.md`

## Global Constraints

- `design.md` là nguồn chuẩn duy nhất; giữ nguyên boundary PCN/PGD và cập nhật tài liệu trước mọi thay đổi schema/UI.
- Người dùng không thao tác JSON; editor chính là palette + canvas lane/cột + inspector. JSON chỉ được sinh nội bộ cho Archify preview.
- PCN dùng `pcnDocumentRequirements`; PGD dùng `PgdDossierRequirement`/requirement code của PGD. Không cho tham chiếu chéo domain.
- `PUBLISHED` bất biến; sửa phải tạo draft revision; snapshot workflow hồ sơ runtime không bị thay đổi.
- Mutation chỉ đi qua endpoint domain chuyên biệt, kiểm tra session/scope/RBAC server-side và ghi audit append-only.
- Giữ nguyên các thay đổi runtime đang có trong `PcnDossierNodeWorkPanel`, `pcnDossierNodeWork`, Archify embed và workflow runtime; không reset/checkout hoặc overwrite các file đó.
- Tất cả control cảm ứng chính giữ kích thước tối thiểu khoảng 44px; desktop canvas là vùng chính, mobile dùng cùng topology với scroll ngang và inspector xếp dưới.

---

### Task 1: Domain contracts, normalized editor model và validation

**Files:**
- Create: `utils/pgdWorkflowTemplate.ts`
- Create: `utils/pgdcnDossierTemplate.ts`
- Modify: `types.ts` để bổ sung layout metadata tùy chọn cho `PcnWorkflowNodeDefinition` và export contract PGD nếu phù hợp với cấu trúc type hiện tại.
- Test: `test/pgd-workflow-template.test.ts`
- Test: `test/pgdcn-dossier-template-editor-model.test.ts`

**Interfaces:**
- `PgdWorkflowTemplate`, `PgdWorkflowNodeDefinition`, `PgdWorkflowTransitionDefinition`, `PgdWorkflowTemplateStatus` dùng domain `pgd`, version số nguyên, `productGroups`, `methodCodes`, `nodes`, `transitions`, actor/timestamp.
- `DossierTemplateDomain = 'PCN' | 'PGD'`.
- `DossierTemplateEditorNode` gồm `{ id, kind, label, description?, actionKey?, assigneeRole?, slaDays?, joinPolicy?, quorum?, active, laneId, column, sortOrder, requirementRefs: string[] }`.
- `DossierTemplateEditorModel` gồm `{ domain, id, code, name, description, version, status, appliesTo, nodes, transitions, updatedAt? }`.
- `toPcnDossierTemplateEditorModel(template, requirements)` và `toPgdDossierTemplateEditorModel(template, requirements)` tạo normalized model mà không làm mất field domain.
- `fromPcnDossierTemplateEditorModel(model, base)` và `fromPgdDossierTemplateEditorModel(model, base)` chuyển ngược về payload persist.
- `validatePgdWorkflowTemplate(template): { valid: boolean; errors: string[] }` dùng cùng invariant topology với `validatePcnWorkflowTemplate`.
- `validateDossierTemplateEditorModel(model): { valid: boolean; errors: string[] }` kiểm tra metadata, ID, start/end, edge, split/join, condition/action allowlist và requirement scope.
- `countTemplateRequirements(model): number` đếm requirement references duy nhất theo template.

- [ ] **Step 1: Write the failing tests**

  Thêm test cho: adapter PCN giữ `requirementIds`, adapter PGD giữ `requirementCodes`; layout drag state chuyển lane/cột nhưng không đổi ID; validator chặn edge tới node không tồn tại, split thiếu nhánh, join thiếu policy và requirement sai domain; validator chấp nhận topology hợp lệ có nhánh song song.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-workflow-template.test.ts test/pgdcn-dossier-template-editor-model.test.ts`

  Expected: FAIL vì các contract/validator mới chưa tồn tại.

- [ ] **Step 3: Write the minimal implementation**

  Implement pure types, clone/normalize helpers và validator. Dùng `PcnWorkflowNodeKind`/`PcnWorkflowJoinPolicy` hiện có nếu type tương thích; nếu PGD cần độc lập, khai báo enum cùng giá trị nhưng không import PCN runtime. Layout metadata là additive và optional để template PCN cũ tiếp tục đọc được.

- [ ] **Step 4: Run tests to verify they pass**

  Run the same focused command. Expected: all new model/validation tests pass.

- [ ] **Step 5: Commit**

  Commit only the new contracts, adapters, validator and their tests with message `feat: add shared dossier template editor contracts`.

### Task 2: Persistence/API workflow template cho PGD và draft update cho PCN

**Files:**
- Modify: `utils/pgdDomain.ts` thêm `PGD_COLLECTIONS.workflowTemplates`.
- Create: `utils/pgdWorkflowTemplateApi.ts` với `fetchPgdWorkflowTemplates`, `createPgdWorkflowTemplate`, `updatePgdWorkflowTemplate`, `createPgdWorkflowRevision`, `publishPgdWorkflowTemplate`, `retirePgdWorkflowTemplate`.
- Modify: `utils/pgdApi.ts` bootstrap response/parser.
- Modify: `store-pgd.ts` state/actions `workflowTemplates`, `createWorkflowTemplate`, `updateWorkflowTemplate`, `createWorkflowRevision`, `publishWorkflowTemplate`, `retireWorkflowTemplate`.
- Modify: `utils/pcnWorkflowTemplateApi.ts` thêm `updatePcnWorkflowTemplate` cho draft.
- Modify: `store-pcn.ts` thêm `updateWorkflowTemplate` nếu chưa có.
- Modify: `server.ts` PGD workflow-template routes and PCN draft update route.
- Modify: `sql/pcn-schema.sql` collection index/seed PGD template contract.
- Test: `test/pgd-workflow-template-api-contract.test.ts`
- Test: `test/pcn-workflow-template-draft-update.test.ts`

**Interfaces:**
- `POST /api/pgd/workflow-templates` creates only `DRAFT`.
- `PUT /api/pgd/workflow-templates/:templateId` updates only a `DRAFT` with optional `updatedAt` conflict token.
- `POST /api/pgd/workflow-templates/:templateId/revisions`, `/publish`, `/retire` mirror the PCN versioning semantics.
- `PUT /api/pcn/workflow-templates/:templateId` updates only a `DRAFT`; existing revision/publish/retire endpoints remain compatible.
- Every mutation uses `requirePgdWorkflowManager` or `requirePcnWorkflowManager`, validates domain-specific requirements, writes the canonical payload and creates an activity log in one transaction.

- [ ] **Step 1: Write the failing tests**

  Assert bootstrap exposes PGD workflow templates; PGD routes reject missing PGD scope/manager role; published templates reject `PUT`; a valid draft update preserves ID/version; PCN draft update has the same behavior; SQL includes a PGD workflow collection index and no PCN collection fallback.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-workflow-template-api-contract.test.ts test/pcn-workflow-template-draft-update.test.ts`

  Expected: FAIL on missing routes/bootstrap/actions/SQL contract.

- [ ] **Step 3: Write the minimal implementation**

  Add allowlisted collection handling to PGD bootstrap and dedicated server routes. Reuse current `mapDocumentRow`, transaction helper and activity writer patterns. Do not expose private assets or query PCN workflow rows from PGD. Add optimistic conflict check using the persisted `updatedAt` when supplied.

- [ ] **Step 4: Run tests to verify they pass**

  Run the same focused command, then `npm run test:pcn -- --test-name-pattern="workflow template|PGD workflow"` if the runner accepts the filter. Expected: all focused contracts pass without breaking current workflow tests.

- [ ] **Step 5: Commit**

  Commit API/store/schema changes with message `feat: persist PCN and PGD dossier templates`.

### Task 3: Visual editor canvas, palette và inspector

**Files:**
- Create: `components/PgdcnDossierTemplateCanvas.tsx`
- Create: `components/PgdcnDossierTemplateInspector.tsx`
- Create: `components/PgdcnDossierTemplateEditor.tsx`
- Test: `test/pgdcn-dossier-template-editor-ui.test.ts`

**Interfaces:**
- `PgdcnDossierTemplateCanvasProps` accepts `model`, `selectedNodeId`, `connectionSourceId`, `onSelectNode`, `onMoveNode(nodeId, position)`, `onBeginConnection(nodeId)`, `onCompleteConnection(nodeId)`, `onAddNode(kind, laneId, column)`, `onDeleteNode`, `onDeleteTransition`.
- `PgdcnDossierTemplateInspectorProps` accepts `selectedNode`, `selectedTransition`, `requirementOptions`, `onChangeNode`, `onChangeTransition`, `onToggleRequirement`, `onClose`.
- `PgdcnDossierTemplateEditorProps` accepts `model`, `requirements`, `onChange`, `onSaveDraft`, `onPreview`, `canMutate`, `saving`, `saveError`.

- [ ] **Step 1: Write the failing tests**

  Add source-contract/UI tests proving the editor renders `data-testid="pgdcn-dossier-template-editor"`, palette node kinds, canvas lane/cột drop zones, inspector requirement search/checkboxes, “Nối tới”, “Xóa node”, “Lưu bản nháp”, inline validation area and no visible JSON textarea. Add a model-level test that clicking connection source then target creates one stable transition ID and repeated target selection does not duplicate it.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dossier-template-editor-ui.test.ts test/pgdcn-dossier-template-editor-model.test.ts`

  Expected: FAIL because editor components and connection reducer are missing.

- [ ] **Step 3: Write the minimal implementation**

  Use `DndContext`, `useDroppable` and sortable utilities already installed. Represent the canvas as fixed lane/cột drop zones rather than arbitrary coordinates. Add node creates a stable client draft ID; move only changes `laneId`, `column` and `sortOrder`; connect mode is explicit and click-based. Inspector shows only the selected node’s requirement references, with searchable catalog options and required/optional labels derived from the domain catalog. Preserve the runtime mental model: selected node opens its detail surface; no file upload/waiver actions are rendered here.

- [ ] **Step 4: Run tests to verify they pass**

  Run the focused UI/model command. Expected: all editor contracts pass.

- [ ] **Step 5: Commit**

  Commit visual editor components and tests with message `feat: add visual dossier template editor`.

### Task 4: Shared “Hồ sơ mẫu” workspace, navigation và domain adapters

**Files:**
- Create: `components/PgdcnDossierTemplateManagementView.tsx`
- Modify: `components/PgdcnSidebar.tsx` add shared target `dossier-templates` and visible manager-only item `Hồ sơ mẫu`.
- Modify: `components/PgdcnAppShell.tsx` render management view and pass PCN/PGD stores, users, requirements and mutations.
- Modify: `components/PgdcnSystemSettingsView.tsx` remove the duplicate raw-JSON workflow management surface or replace it with a link/notice to `Hồ sơ mẫu`.
- Modify: `utils/pgdcnNavigation.ts`/shared navigation types if needed.
- Modify: `components/PcnWorkflowTemplateManagementView.tsx` only for compatibility extraction/reuse; do not leave a second primary editor.
- Test: `test/pgdcn-dossier-template-management-ui.test.ts`

**Interfaces:**
- `PgdcnDossierTemplateManagementViewProps` receives `currentUser`, `pcnTemplates`, `pcnRequirements`, `pgdTemplates`, `pgdRequirements`, and domain-specific CRUD/revision/publish/retire callbacks.
- The view derives allowed domains from `departmentScopes` and manager policy; system admin can see both only when scope exists, domain manager sees the scoped domain, and non-manager receives a read-only denial surface/direct-navigation denial.
- Management view renders list/filter/search and editor; it uses `to*DossierTemplateEditorModel` adapters and passes only the selected node’s references to the inspector.

- [ ] **Step 1: Write the failing tests**

  Assert sidebar exposes `Hồ sơ mẫu` only for an eligible manager, the view has domain tabs and status/search filters, initial template detail is collapsed until a node is selected, PCN and PGD requirements remain separated, and published cards expose “Tạo revision” rather than in-place edit. Assert the old settings surface no longer renders the raw JSON workflow editor as the primary control.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dossier-template-management-ui.test.ts`

  Expected: FAIL because the shared target/view is missing.

- [ ] **Step 3: Write the minimal implementation**

  Add a shared department navigation target and manager-gated menu item. Build list cards with status tokens, version and counts. Add new/clone actions, editor open/close, save draft, create revision, publish and retire flows with `toast` plus inline error. Use `PcnDossierNodeWorkPanel`/`pcnDossierNodeWork` terminology for node/document labels but do not import runtime mutation actions into template management. Keep desktop/mobile containment aligned with `design.md`.

- [ ] **Step 4: Run tests to verify they pass**

  Run the focused UI command, then run the existing node-work tests to prove the runtime panel contract remains intact:

  `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dossier-template-management-ui.test.ts test/pcn-dossier-node-work.test.ts test/pcn-node-work-panel-ui.test.ts`

- [ ] **Step 5: Commit**

  Commit navigation and management view with message `feat: add shared dossier template management workspace`.

### Task 5: Archify preview từ template draft/persisted

**Files:**
- Create: `utils/pcnArchifyWorkflowTemplate.ts`
- Create: `utils/pgdArchifyWorkflowTemplate.ts`
- Create: `components/PgdcnDossierTemplateArchifyPreview.tsx`
- Modify: `server.ts` add session-only preview endpoints under `/api/pcn/workflow-templates/preview` and `/api/pgd/workflow-templates/preview`.
- Test: `test/pgdcn-dossier-template-archify.test.ts`

**Interfaces:**
- `buildPcnArchifyWorkflowTemplate(model): ArchifyWorkflowDocument`.
- `buildPgdArchifyWorkflowTemplate(model): ArchifyWorkflowDocument`.
- Preview component accepts `{ domain, model, onSelectNode? }`, POSTs the normalized draft to the domain endpoint, creates a same-origin Blob URL for the returned HTML, and revokes the previous URL on change/unmount.
- Preview builders preserve stable node/edge IDs, lane/cột layout, edge labels, node kind and requirement count/labels; they never serialize file assets, checksums, runtime documents or dossier data.

- [ ] **Step 1: Write the failing tests**

  Test both builders produce `schema_version: 2`, `diagram_type: 'workflow'`, stable IDs and requirement summaries; test serialized preview input does not contain `fileAssetId`, checksum, private object path or dossier runtime fields; test the component exposes reader/preview test IDs and no editable SVG controls.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dossier-template-archify.test.ts`

  Expected: FAIL because builders/preview component/endpoints are missing.

- [ ] **Step 3: Write the minimal implementation**

  Map the normalized editor model to Archify v2 IR and render with existing `renderArchifyWorkflowDocument`/upstream template. Apply the same light reader defaults and bounded error states used by `PcnArchifyWorkflowEmbed`. Server validates the draft before rendering, checks the caller’s domain manager/session scope, and returns no persistence side effect. Use stable sanitized IDs and one preview `recordId` namespace so node selection cannot affect runtime dossiers.

- [ ] **Step 4: Run tests to verify they pass**

  Run the focused preview test, then the existing Archify focused contracts to verify no regression in dossier readers.

- [ ] **Step 5: Commit**

  Commit builders, preview component and routes with message `feat: preview dossier templates with Archify`.

### Task 6: End-to-end verification and documentation integrity

**Files:**
- Modify: `design.md` only if implementation reveals an explicit contract addition; keep section 0.10 aligned with the final names/collections.
- Modify: focused tests discovered during execution; do not modify existing runtime tests just to weaken assertions.

- [ ] **Step 1: Run all focused feature tests**

  Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-workflow-template.test.ts test/pgdcn-dossier-template-editor-model.test.ts test/pgd-workflow-template-api-contract.test.ts test/pcn-workflow-template-draft-update.test.ts test/pgdcn-dossier-template-editor-ui.test.ts test/pgdcn-dossier-template-management-ui.test.ts test/pgdcn-dossier-template-archify.test.ts`

  Expected: 0 failures.

- [ ] **Step 2: Run the complete PCN suite**

  Run: `npm test`

  Expected: existing and new tests pass; report the exact count.

- [ ] **Step 3: Run static/type/build verification**

  Run: `npm run lint`

  Run: `npm run build`

  Run: `git diff --check`

  Expected: all commands exit 0; build includes the PGDCN shell routes and no type errors.

- [ ] **Step 4: Verify requirement coverage against the spec**

  Confirm by reading the final diff and tests: two-domain access, version immutability, visual canvas, node-scoped requirements, no JSON UI, Archify preview privacy, responsive editor, runtime panel compatibility and audit/API boundary are all evidenced.

- [ ] **Step 5: Commit documentation-only alignment if required**

  If `design.md` changed during implementation, commit only the lines belonging to this feature after preserving unrelated user changes; otherwise leave unrelated working-tree changes untouched.
