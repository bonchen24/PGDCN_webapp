# Native dossier flow design

## Goal

Replace the visible Archify workflow reader on the PCN dossier surfaces with a native, full-width horizontal workflow. The workflow must help an operator answer three questions immediately: where is the dossier, what must be done now, and which action can be taken next.

## Approved UX

- The dossier detail uses a full-width horizontal rail. Each active snapshot node is a numbered tab in `sortOrder`; the selected tab exposes only that node's documents and business work.
- Each tab shows number, short type label, node label, progress (`resolved/total` for document requirements), and text status. Locked nodes are visibly muted and are not selectable; active and completed nodes remain selectable.
- Type and status are separate visual dimensions. `DOCUMENT_TASK` uses indigo/file treatment, work/action uses emerald, `APPROVAL_TASK` uses violet, decision/parallel uses amber/cyan, and end uses slate. Every color is paired with a label and Lucide icon.
- Desktop keeps the rail and work area in one page-width column. Mobile scrolls the rail inside its own `mobile-scroll-x` container; the page itself must not gain horizontal overflow. The work area remains below the rail.
- The work area keeps existing server-bound callbacks and shows document actions (`Tải tài liệu`, `Thay phiên bản`, `Tạo & gắn tài liệu`, `Tạo DOCX`, `Xem tài liệu`) and node actions (`Bắt đầu xử lý`, `Lưu nháp` where the current boundary supports it, `Hoàn tất bước`, `Trả về` where the callback is available). Buttons must be disabled while the related mutation is busy.
- The management page opens in a task-first queue view: KPI summary, searchable/filterable dossier cards, current step, missing count, owner, and one clear `Mở hồ sơ` CTA. The existing dense register remains available as an explicit `Sổ dữ liệu` mode so no data-grid capability is lost.
- Query deep links (`node`, `tab`) and existing dossier callbacks remain compatible. No schema, API, RBAC, lifecycle, or persistence contract changes are introduced.

## Data and interaction boundaries

- The flow is projected from `workflowSnapshot`, `projectPcnWorkflowRuntime`, and `buildPcnDossierNodeWorkProjection`; the client does not create topology or infer task state from visual position.
- All mutations continue through the existing callbacks/server boundaries. The native flow only changes presentation and selection state.
- Parallel nodes are presented in their configured order with a branch/join cue; the UI must not fabricate edges or claim a linear lifecycle when runtime state is parallel.
- Archify backend files/routes remain untouched in this UI iteration for rollback and for any still-supported non-PCN surface. The PCN dossier detail and PCN management entrypoint must not import or render the Archify embed.

## Accessibility and responsive acceptance

- Tabs use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `aria-current="step"` for the current runtime step, and roving keyboard focus with Arrow/Home/End.
- Controls have at least 44px hit targets, visible focus rings, accessible names, and loading/disabled feedback. Status is never conveyed by color alone.
- At 320/375/390/430px the rail scrolls internally, selected work stays readable, and no body-level horizontal overflow is introduced.
- Reduced motion remains respected; no decorative animation is required.

## Delivery slices and file count

1. Spec/design contract: this spec and the relevant native-flow overrides in `design.md` — 2 documents.
2. Native flow component and dossier wiring: `PcnDossierFlow.tsx`, `PcnDossierWorkflowPanel.tsx`, `PcnDossierNodeWorkPanel.tsx` — 3 code files. `PcnDossierDetailView.tsx` already exposes the compatible deep-link and callback wiring, so it is verified but not changed.
3. Task-first management: `PcnDossierQueueView.tsx`, `PcnOperationsRegisterView.tsx` — 2 code files.
4. Regression contracts: one new native-flow test and updates to the three PCN workflow/Archify UI contract tests — 4 test files.

Total first implementation slice: 5 product code files and 6 specification/test files (the design contract plus four tests; the implementation plan is tracked separately). Existing Archify backend/embed files are intentionally retained but unused by the PCN dossier flow.

## Acceptance criteria

- The PCN dossier page renders no Archify iframe/embed and presents a full-width numbered native rail.
- Selecting a tab changes only the visible node work area and preserves deep-link selection.
- The current node's document/business actions are visible and call the existing guarded callbacks.
- The management default is a useful queue; `Sổ dữ liệu` restores the existing summary grid and inline editing.
- Existing workflow/runtime and RBAC tests remain green, with new UI contracts covering no Archify import, tabs, type/status labels, action affordances, and internal mobile scrolling.
