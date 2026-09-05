# PGD Source Forms Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa các biểu mẫu PGD mới thành luồng kế hoạch, diễn biến, ghi chép hiện trường, đánh giá KQTN và mục lục hồ sơ có thể lưu, sinh tài liệu và kiểm soát theo lifecycle.

**Architecture:** Mở rộng miền PGD bằng các kiểu dữ liệu/collection riêng trong `utils/pgdArtifacts.ts`, giữ request hiện hữu làm aggregate root và liên kết các artifact bằng `requestId`. Template DOCX/cell được mở rộng bằng các kind mới, asset đóng gói trong `templates/pgd`, API/store bootstrap trả cùng snapshot PGD, còn giao diện hồ sơ hiển thị các editor dạng bảng thay vì JSON.

**Tech Stack:** TypeScript, React, Zustand, Express, PostgreSQL `app_documents`, DOCX placeholder pack, Node test runner.

**Spec:** `design.md` mục `0A.2`, `0A.3`, `0A.5`, `0A.6`, `0A.7`, `0A.8`

## Global Constraints

- Mọi hồ sơ/tài liệu mới phải có `domain=pgd` và collection PGD allowlist riêng.
- Runtime không đọc, watcher, resolve, import hoặc hiển thị đường dẫn Desktop/UNC; folder PGD nguồn chỉ được đọc ở giai đoạn xây dựng.
- Không đưa QC20 vào PCN; PGD dùng catalog `GĐ-THEP-KG` và metadata tiêu chuẩn/phương thức.
- Không xây báo giá, thanh toán hoặc trường phí thử nghiệm trong UI/data model PGD.
- Hồ sơ sau ký dùng snapshot bất biến; không xóa cứng artifact hoặc mẫu đã hủy.
- Dùng `apply_patch` cho file nguồn; không sửa/xóa file trong Desktop.

---

### Task 1: Thêm hợp đồng artifact PGD và validation nghiệp vụ

**Files:**
- Create: `utils/pgdArtifacts.ts`
- Modify: `utils/pgdDomain.ts`
- Test: `test/pgd-source-artifacts.test.ts`

**Interfaces:**
- Produces `PgdInspectionPlan`, `PgdCaseEvent`, `PgdFieldActivityLog`, `PgdLabResultReview`, `PgdDossierIndex`, `PgdProductLine`, `PgdSamplingLine`.
- Produces `createPgdInspectionPlan`, `createPgdCaseEvent`, `createPgdFieldActivityLog`, `createPgdLabResultReview`, `buildPgdDossierIndex` and validators used by API/server.

- [ ] **Step 1: Write the failing tests**

```ts
test('creates a steel inspection plan with a time-boxed agenda and product lines', () => {
  const plan = createPgdInspectionPlan({
    id: 'plan-1', requestId: 'req-1', inspectionDate: '2026-09-03',
    team: [{ username: 'nam', role: 'LEAD' }],
    productLines: [{ productName: 'Thép thanh', grade: 'S35C', standard: 'JIS G4051:2009' }],
    schedule: [{ startTime: '08:30', endTime: '09:00', activity: 'Họp khai mạc' }],
  }, '2026-09-03T08:00:00.000Z');
  assert.equal(plan.domain, 'pgd');
  assert.equal(plan.schedule[0].activity, 'Họp khai mạc');
  assert.throws(() => createPgdInspectionPlan({ id: 'bad', requestId: 'req-1', inspectionDate: '2026-09-03', team: [], productLines: [], schedule: [] }));
});

test('normalizes case events and field notes without turning them into audit logs', () => {
  const event = createPgdCaseEvent({ id: 'event-1', requestId: 'req-1', occurredAt: '2026-09-03T08:30:00.000Z', activity: 'Kiểm tra hồ sơ', actorUsername: 'nam' });
  const note = createPgdFieldActivityLog({ id: 'note-1', requestId: 'req-1', session: 'MORNING', entries: [{ time: '10:00', activity: 'Đo kích thước', comments: 'Đã chụp ảnh' }] });
  assert.equal(event.domain, 'pgd');
  assert.equal(note.entries[0].time, '10:00');
});

test('blocks result review until every required laboratory result is present', () => {
  assert.throws(() => createPgdLabResultReview({ id: 'review-1', requestId: 'req-1', labResultIds: [], completeness: 'INCOMPLETE', conformity: 'NOT_REVIEWED', conclusion: '' }));
  const review = createPgdLabResultReview({ id: 'review-2', requestId: 'req-1', labResultIds: ['lab-result-1'], completeness: 'COMPLETE', conformity: 'CONFORMING', conclusion: 'Phù hợp' });
  assert.equal(review.domain, 'pgd');
});

test('builds a dossier index from current PGD documents only', () => {
  const index = buildPgdDossierIndex({ requestId: 'req-1', entries: [{ requirementCode: 'FIELD', title: 'Biên bản hiện trường', status: 'PRESENT', pageCount: 2 }] });
  assert.equal(index.domain, 'pgd');
  assert.equal(index.entries[0].pageCount, 2);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the artifact module is missing**

Run: `node --test test/pgd-source-artifacts.test.ts`

Expected: FAIL with an import/module or exported-function error for `utils/pgdArtifacts.ts`.

- [ ] **Step 3: Implement the minimal artifact types, normalization and validation**

`PgdInspectionPlan` requires a PGD domain, request id, valid date, one team member, one product line and one schedule row. `PgdCaseEvent` requires timestamp, activity and actor. `PgdFieldActivityLog` accepts `MORNING` or `AFTERNOON` and normalizes entry rows. `PgdLabResultReview` requires at least one result id, `COMPLETE`, a reviewed conformity state and a non-empty conclusion. `buildPgdDossierIndex` copies only supplied current dossier entries and never resolves external paths.

Add `inspectionPlans`, `caseEvents`, `fieldActivityLogs`, `labResultReviews` and `dossierIndexes` to `PGD_COLLECTIONS` and add `inspectionPlanId`/artifact id arrays to the request aggregate where needed.

- [ ] **Step 4: Run the focused test and then the existing PGD domain tests**

Run: `node --test test/pgd-source-artifacts.test.ts test/pgd-domain.test.ts test/pgd-document-templates.test.ts`

Expected: all focused tests PASS.

### Task 2: Mở rộng template/cell pack theo biểu mẫu nguồn PGD

**Files:**
- Modify: `utils/pgdDocumentTemplates.ts`
- Modify: `components/PgdCellManager.tsx`
- Modify: `components/PgdTableFieldEditor.tsx`
- Modify: `components/PgdDocumentGenerationPanel.tsx`
- Modify: `templates/pgd/manifest.json`
- Create: `templates/pgd/PGD-BM-10.docx`
- Create: `templates/pgd/PGD-BM-11.docx`
- Create: `templates/pgd/PGD-BM-12.docx`
- Create: `templates/pgd/PGD-BM-13.docx`
- Modify: `scripts/generate-pgd-docx-templates.ts`
- Test: `test/pgd-source-template-pack.test.ts`

**Interfaces:**
- Adds template kinds `DOSSIER_COVER`, `CASE_TIMELINE`, `FIELD_ACTIVITY_LOG`, `LAB_RESULT_REVIEW`.
- Adds table-column label metadata while preserving `tableColumns` compatibility.

- [ ] **Step 1: Write failing pack/cell tests**

```ts
test('exposes the four source-derived PGD template kinds with packaged DOCX files', () => {
  for (const kind of ['DOSSIER_COVER', 'CASE_TIMELINE', 'FIELD_ACTIVITY_LOG', 'LAB_RESULT_REVIEW'] as const) {
    const template = getPgdDocumentTemplate(kind, 'STEEL_METAL');
    assert.ok(template);
    assert.equal(template.domain, 'pgd');
    assert.equal(inspectPgdTemplateSource(template).status, 'READY');
  }
});

test('preserves table column labels and row limits in a template snapshot', () => {
  const template = getPgdDocumentTemplate('CASE_TIMELINE', 'STEEL_METAL')!;
  const cell = template.cells.find((item) => item.key === 'eventRows')!;
  assert.deepEqual(cell.tableColumnLabels?.time, 'Thời gian');
  assert.equal(cell.validation?.minRows, 1);
  assert.equal(snapshotPgdDocumentTemplate(template, '2026-09-03T00:00:00.000Z').cells.find((item) => item.key === 'eventRows')?.tableColumns?.includes('activity'), true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails before adding the new kinds**

Run: `node --test test/pgd-source-template-pack.test.ts`

Expected: FAIL because the new kinds and packaged files do not exist.

- [ ] **Step 3: Add the four template definitions and DOCX generator definitions**

Use PGD-BM-10 for bìa/mục lục, PGD-BM-11 for diễn biến, PGD-BM-12 for ghi chép sáng/chiều and PGD-BM-13 for đánh giá KQTN. Bind table cells to `request`, `caseEvent`, `fieldActivityLog`, `labResultReview` and `dossierIndex` projections. Keep all templates available to `STEEL_METAL`, and do not add payment cells.

- [ ] **Step 4: Make cell management show table columns and row limits**

Extend `PgdTemplateCell` with optional `tableColumnLabels?: Record<string, string>`. `PgdCellManager` exposes comma-separated column keys, labels and min/max rows for TABLE cells; `PgdTableFieldEditor` uses labels and disables “Thêm dòng” at `maxRows`, showing the required minimum. No raw JSON editor is introduced.

- [ ] **Step 5: Regenerate the packaged PGD DOCX manifest and run pack tests**

Run: `npx tsx scripts/generate-pgd-docx-templates.ts` followed by `node --test test/pgd-source-template-pack.test.ts test/pgd-docx-template-pack.test.ts`.

Expected: 13 PGD templates pass placeholder/source readiness checks.

### Task 3: API, bootstrap và Zustand cho artifact PGD

**Files:**
- Modify: `utils/pgdApi.ts`
- Modify: `store-pgd.ts`
- Modify: `server.ts`
- Test: `test/pgd-source-artifacts-api.test.ts`

**Interfaces:**
- Adds bootstrap arrays for the five artifact collections.
- Adds `savePgdInspectionPlan`, `savePgdCaseEvent`, `savePgdFieldActivityLog`, `savePgdLabResultReview` and `savePgdDossierIndex`.
- Adds POST boundaries `/api/pgd/inspection-plans`, `/api/pgd/case-events`, `/api/pgd/field-activity-logs`, `/api/pgd/lab-result-reviews`, `/api/pgd/dossier-indexes`.

- [ ] **Step 1: Write failing API contract tests**

```ts
test('PGD bootstrap and artifact mutations use dedicated PGD collections', () => {
  const source = readFileSync('utils/pgdApi.ts', 'utf8');
  const server = readFileSync('server.ts', 'utf8');
  for (const path of ['/api/pgd/inspection-plans', '/api/pgd/case-events', '/api/pgd/field-activity-logs', '/api/pgd/lab-result-reviews', '/api/pgd/dossier-indexes']) assert.match(server, new RegExp(path.replaceAll('/', '\\/')));
  assert.match(source, /savePgdInspectionPlan/);
});

test('artifact API does not mention Desktop, UNC or payment fields', () => {
  const source = readFileSync('utils/pgdApi.ts', 'utf8');
  assert.doesNotMatch(source, /TVCI_NAS|Desktop|\\\\/i);
  assert.doesNotMatch(source, /payment|thanh toán|phí thử nghiệm/i);
});
```

- [ ] **Step 2: Run the API contract test and verify it fails for missing endpoints**

Run: `node --test test/pgd-source-artifacts-api.test.ts`

Expected: FAIL because the new API methods/routes are not present.

- [ ] **Step 3: Extend bootstrap/API/store contracts**

Parse arrays defensively in `fetchPgdBootstrap`, expose save methods using JSON POST, and update Zustand with replace-by-id plus request links. Never use generic `/api/db` for these entities.

- [ ] **Step 4: Add server persistence and lifecycle checks**

Each route checks `requirePgdCollectionMutation`, validates `domain=pgd`, request existence and post-signature lock. The result-review route rejects incomplete reviews; the dossier-index route derives/validates entries from current `pgdDossierDocuments` and never accepts an external source path. Include new collections in bootstrap and document-generation context reads.

- [ ] **Step 5: Run API/domain tests**

Run: `node --test test/pgd-source-artifacts-api.test.ts test/pgd-api-contract.test.ts test/pgd-domain.test.ts`

Expected: all PASS.

### Task 4: Giao diện hồ sơ PGD cho kế hoạch, timeline, ghi chép và đánh giá KQTN

**Files:**
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdCaseEvidencePanel.tsx`
- Modify: `store-pgd.ts`
- Create: `components/PgdSourceFormsPanel.tsx`
- Test: `test/pgd-source-forms-ui.test.ts`

**Interfaces:**
- `PgdSourceFormsPanel` consumes request, plan, case events, field logs, lab results/review, dossier index and save callbacks; it renders table editors with no JSON textarea.

- [ ] **Step 1: Write failing UI contract tests**

```ts
test('PGD workspace exposes source-derived form panels and no payment surface', () => {
  const source = readFileSync('components/PgdWorkspace.tsx', 'utf8') + readFileSync('components/PgdSourceFormsPanel.tsx', 'utf8');
  for (const label of ['Kế hoạch & phân công', 'Diễn biến vụ giám định', 'Ghi chép hiện trường', 'Đánh giá KQTN', 'Bìa hồ sơ']) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /Báo giá|Thanh toán|Phí thử nghiệm/);
  assert.doesNotMatch(source, /JSON\.stringify|textarea[^>]+json/i);
});
```

- [ ] **Step 2: Run the UI contract test and verify it fails before adding the panel**

Run: `node --test test/pgd-source-forms-ui.test.ts`

Expected: FAIL because the source-form panel is not present.

- [ ] **Step 3: Implement the panel and wire store callbacks**

Add compact PGD sections with add/edit/remove rows for schedule, timeline and field notes; add product/sampling rows and lab review decision fields. Disable writes after signature and show source-derived labels. Update `PgdWorkspace` detail view to render the panel with current PGD artifact data.

- [ ] **Step 4: Run UI/PGD tests**

Run: `node --test test/pgd-source-forms-ui.test.ts test/pgd-register-ui.test.ts test/pgd-case-evidence-ui.test.ts`

Expected: all PASS.

### Task 5: Hoàn thiện kiểm thử, render DOCX và kiểm tra build

**Files:**
- Modify: `test/pgd-source-artifacts.test.ts`
- Modify: `test/pgd-source-template-pack.test.ts`
- Modify: `test/pgd-source-artifacts-api.test.ts`
- Modify: `test/pgd-source-forms-ui.test.ts`
- Generated: `templates/pgd/manifest.json`, `templates/pgd/PGD-BM-10.docx` through `PGD-BM-13.docx`

- [ ] **Step 1: Run focused PGD tests and typecheck**

Run: `node --test test/pgd-source-artifacts.test.ts test/pgd-source-template-pack.test.ts test/pgd-source-artifacts-api.test.ts test/pgd-source-forms-ui.test.ts` and `npm run lint`.

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 2: Render the four new DOCX assets for visual QA**

Use the documents skill render script with the bundled LibreOffice executable when needed; write all output under `tmp/pgd-source-forms-render`, inspect generated page images, and verify no missing placeholder or clipped table header is present.

- [ ] **Step 3: Run the complete existing suite and production build**

Run: `npm test`, `npm run build`, and `git diff --check`.

Expected: active PCN tests and new PGD tests pass; any pre-existing retired-history failures remain documented and are not reintroduced.

- [ ] **Step 4: Verify source/runtime isolation**

Run targeted search over changed runtime files for `Desktop`, `TVCI_NAS`, `UNC`, `payment`, `thanh toán`, and verify the only source-derived references are design/test prose, not runtime path resolution.

