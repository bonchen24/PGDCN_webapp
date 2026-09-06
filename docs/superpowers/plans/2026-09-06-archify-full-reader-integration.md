# Archify Full Reader Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate all five upstream Archify diagram readers into the PCN and PGD dossier pages through one authenticated, data-truthful, responsive viewer.

**Architecture:** Keep Archify as a vendored runtime dependency. Pure PCN/PGD suite adapters convert authorized dossier facts into upstream schemas for `workflow`, `lifecycle`, `dataflow`, `sequence`, and `architecture`. A server-only renderer invokes the workflow compiler directly and the four CLI-oriented upstream renderers through a controlled temporary-file runner, then serves complete reader HTML to one React iframe with a query-selected diagram type.

**Tech Stack:** Next.js 14, React 18, TypeScript, Express, Node `child_process`/`fs.promises`, vendored Archify `.mjs` renderers and `template.html`, Tailwind CSS, Node test runner through `tsx`, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-06-archify-full-reader-integration-design.md`

## Global Constraints

- `design.md` remains the single source of truth, especially sections 0.2.3, 0.8, 0A.3, 7.1–7.3 and 8.
- PCN and PGD stay separate business boundaries; routes read only authorized domain data and never trust browser topology.
- `vendor/archify/archify` stays pinned to revision `ed7f4d4b48d4424d36edfed8043de3de8dea6b45`; do not copy Archify layout or reader controls into React.
- Diagram state is ephemeral. `diagram`, `focus`, `reach`, `route`, `lens`, `story`, camera and preset are never persisted.
- No private file bytes, password, token, absolute server path or unredacted PII enters diagram JSON, HTML, export, audit log or browser message.
- Workflow mutations continue through existing server endpoints, assignment guards, RBAC, audit and private Storage. Non-workflow readers are read-only.
- Stable relationship IDs, upstream schema constraints and five guided-view limit remain authoritative.
- Existing unrelated edits in `components/PcnLabOperationsView.tsx`, `test/pcn-lab-integration.test.ts`, `test/pcn-sample-register.test.ts`, `utils/pcnLabIntegration.ts`, `utils/pcnSampleFlow.ts` and `utils/pcnSampleRegister.ts` remain untouched and unstaged.

---

### Task 1: Define multi-renderer contracts and failure states

**Files:**
- Create: `utils/archifyDiagram.ts`
- Modify: `utils/pcnArchifyWorkflow.ts`
- Modify: `utils/pgdArchifyWorkflow.ts`
- Test: `test/pcn-archify-diagram-contract.test.ts`

**Interfaces:**
- Consumes: existing workflow adapters, `CertificationDossier`, PGD request facts and authorized linked records.
- Produces: `ArchifyDiagramType`, unavailable result, typed five-view suite contracts and stable ID helpers.

- [ ] **Step 1: Write the failing contract test**

Create a fixture with sequential, decision, parallel split/join and return nodes, documents, PYC/result, approval and audit facts. Assert:

```ts
const suite = buildPcnArchifyDiagramSuite(fixture);
assert.equal(suite.workflow.diagram_type, 'workflow');
assert.equal(suite.lifecycle.available, false);
assert.equal(suite.architecture.available, false);
assert.equal(suite.dataflow.available, false);
assert.equal(suite.sequence.available, false);
```

Also assert a fixture without activity events returns `sequence.available === false` with a Vietnamese reason and no fabricated message.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-archify-diagram-contract.test.ts
```

Expected: FAIL because the shared contracts and suite builders do not exist.

- [ ] **Step 3: Add shared contracts and helpers**

Implement:

```ts
export const ARCHIFY_DIAGRAM_TYPES = ['workflow', 'lifecycle', 'dataflow', 'sequence', 'architecture'] as const;
export type ArchifyDiagramType = typeof ARCHIFY_DIAGRAM_TYPES[number];
export type ArchifyDiagramUnavailable = { available: false; diagramType: ArchifyDiagramType; reason: string };
export type ArchifyDiagramAvailable<T> = { available: true; diagramType: ArchifyDiagramType; document: T };
export function archifyStableId(prefix: string, value: string): string;
export function unavailableDiagram(diagramType: ArchifyDiagramUnavailable['diagramType'], reason: string): ArchifyDiagramUnavailable;
```

Use conservative identifier normalization, deterministic deduplication and no geometry-based relationship inference. Preserve the existing workflow document type/schema.

- [ ] **Step 4: Add suite builders without changing current workflow callers**

Add `buildPcnArchifyDiagramSuite` and `buildPgdArchifyDiagramSuite`, initially delegating `workflow` to the existing functions and returning explicit unavailable results for the four new views. Keep `buildPcnArchifyWorkflow` and `buildPgdArchifyWorkflow` exports unchanged.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run the command from Step 2 and confirm shape, stable-ID and no-fabrication assertions pass.

- [ ] **Step 6: Commit only this task**

```powershell
git add -- utils/archifyDiagram.ts utils/pcnArchifyWorkflow.ts utils/pgdArchifyWorkflow.ts test/pcn-archify-diagram-contract.test.ts
git commit --only utils/archifyDiagram.ts utils/pcnArchifyWorkflow.ts utils/pgdArchifyWorkflow.ts test/pcn-archify-diagram-contract.test.ts -m "feat: define Archify multi-renderer contracts"
```

### Task 2: Build four non-workflow dossier projections

**Files:**
- Modify: `utils/pcnArchifyWorkflow.ts`
- Modify: `utils/pgdArchifyWorkflow.ts`
- Create: `utils/pcnArchifyOtherDiagrams.ts`
- Create: `utils/pgdArchifyOtherDiagrams.ts`
- Test: `test/pcn-archify-diagram-contract.test.ts`
- Test: `test/pcn-archify-integration.test.ts`

**Interfaces:**
- Consumes: Task 1 suite contracts and server-owned facts loaded by dossier routes.
- Produces: valid upstream schema v1 documents for lifecycle/dataflow/sequence/architecture, or explicit unavailable results when facts are insufficient.

- [ ] **Step 1: Extend tests with PCN facts**

Assert current lifecycle tagging, document/PYC dataflow, stable sequence messages and PCN architecture components:

```ts
const suite = buildPcnArchifyDiagramSuite({ ...fixture, activityLogs: [activity1, activity2] });
assert.equal(suite.lifecycle.document.states.find((state) => state.tag === 'Hiện tại')?.id, 'pcn-technical-review');
assert.ok(suite.dataflow.document.flows.some((flow) => flow.label.includes('tài liệu')));
assert.ok(suite.sequence.document.messages.every((message) => message.id));
assert.ok(suite.architecture.document.components.some((component) => component.label.includes('PCN')));
```

Assert dataflow edges follow saved IDs, sequence sorts by valid `createdAt` then stable id, and architecture omits PTN when no lab request exists.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-archify-diagram-contract.test.ts test/pcn-archify-integration.test.ts
```

Expected: FAIL because non-workflow documents are unavailable.

- [ ] **Step 3: Implement PCN projections**

Implement in `utils/pcnArchifyOtherDiagrams.ts`:

```ts
export function buildPcnLifecycleDiagram(input: PcnArchifySource): ArchifyLifecycleDocument;
export function buildPcnDataflowDiagram(input: PcnArchifySource): ArchifyDiagramResult<ArchifyDataflowDocument>;
export function buildPcnSequenceDiagram(input: PcnArchifySource): ArchifyDiagramResult<ArchifySequenceDocument>;
export function buildPcnArchitectureDiagram(input: PcnArchifySource): ArchifyArchitectureDocument;
```

Lifecycle uses saved workflow/lifecycle state catalog and tags the actual current state. Dataflow follows requirement/document/PYC/result/approval pointers. Sequence maps saved activity/task/document events to safe actor participants and messages. Architecture represents only PCN, PostgreSQL/private Storage and linked PTN facts. Cards and guided views focus only existing semantic IDs.

- [ ] **Step 4: Implement PGD projections**

Implement the same four functions in `utils/pgdArchifyOtherDiagrams.ts` using only PGD request, checklist/document, field/sample, lab, report, certificate, approval and activity facts. Use `PGD_WORKFLOW_STATES`, preserve LAB/RETAINED meaning and add PTN components only from linked lab records. Do not copy PCN fields/customers into PGD diagrams.

- [ ] **Step 5: Validate all upstream schemas in tests**

Validate available suite documents against the vendored `architecture`, `dataflow`, `sequence` and `lifecycle` schemas. Assert relationship IDs resolve to semantic IDs and guided-view focus IDs exist.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run the command from Step 2. Expected: both domains pass including parallel/return workflow and no-fabrication availability behavior.

- [ ] **Step 7: Commit only this task**

```powershell
git add -- utils/pcnArchifyWorkflow.ts utils/pgdArchifyWorkflow.ts utils/pcnArchifyOtherDiagrams.ts utils/pgdArchifyOtherDiagrams.ts test/pcn-archify-diagram-contract.test.ts test/pcn-archify-integration.test.ts
git commit --only utils/pcnArchifyWorkflow.ts utils/pgdArchifyWorkflow.ts utils/pcnArchifyOtherDiagrams.ts utils/pgdArchifyOtherDiagrams.ts test/pcn-archify-diagram-contract.test.ts test/pcn-archify-integration.test.ts -m "feat: project dossier facts into Archify diagrams"
```

### Task 3: Implement the server-only renderer bridge

**Files:**
- Create: `utils/archifyRuntime.ts`
- Modify: `utils/pcnArchifyRenderer.ts`
- Test: `test/pcn-archify-renderer.test.ts`

**Interfaces:**
- Consumes: typed documents/results from Tasks 1–2.
- Produces: complete reader HTML with light theme, same-origin focus bridge and safe renderer errors.

- [ ] **Step 1: Write failing renderer tests**

Assert each renderer emits upstream reader markers and light root HTML:

```ts
const result = await renderArchifyDiagram('lifecycle', lifecycleDocument, { domain: 'pcn', recordId: 'dossier-1' });
assert.equal(result.available, true);
assert.match(result.html, /archify-guided-views-data/);
assert.match(result.html, /data-theme="light"/);
```

Also test malformed schema, unsupported type and child-process failure produce safe errors without temporary paths/commands in the response. Assert all four upstream renderer entrypoints and `assets/template.html` are referenced by constants.

- [ ] **Step 2: Run focused renderer tests and verify RED**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-archify-renderer.test.ts
```

Expected: FAIL because the shared runtime does not exist.

- [ ] **Step 3: Put current workflow rendering behind the shared runtime**

Keep this compatibility function:

```ts
export async function renderArchifyWorkflowDocument(workflow: ArchifyWorkflowDocument, input: { domain: ArchifyRenderDomain; recordId: string }): Promise<string> {
  return (await renderArchifyDiagram('workflow', workflow, input)).html;
}
```

Preserve current compiler/template invocation, light root normalization and escaped `pcn-archify-focus-bridge` payload.

- [ ] **Step 4: Implement the controlled CLI runner**

Use `mkdtemp`, `writeFile`, `spawn`, `readFile` and `rm` in `try/finally`. Resolve only these absolute vendor entrypoints:

```ts
const RENDERER_ENTRYPOINTS = {
  architecture: 'renderers/architecture/render-architecture.mjs',
  dataflow: 'renderers/dataflow/render-dataflow.mjs',
  sequence: 'renderers/sequence/render-sequence.mjs',
  lifecycle: 'renderers/lifecycle/render-lifecycle.mjs',
} as const;
```

Invoke `process.execPath` with `[entrypoint, inputPath, outputPath]`, set only a validated quality profile, reject output above 12 MB, kill after 15 seconds and convert non-zero exit to a safe 422 error. Never pass request paths, query strings, `ARCHIFY_REPO_ROOT` or user-controlled executable paths.

- [ ] **Step 5: Handle availability and shared post-processing**

Return unavailable results without invoking a renderer. For available documents, read HTML, normalize `data-theme="light"`, inject the focus bridge and return `{ available: true, diagramType, html }`. Do not use process-global HTML cache because dossier authorization can differ by user.

- [ ] **Step 6: Run renderer tests and confirm GREEN**

Run the focused renderer command and confirm all five renderer fixtures, cleanup and safe errors pass.

- [ ] **Step 7: Commit only this task**

```powershell
git add -- utils/archifyRuntime.ts utils/pcnArchifyRenderer.ts test/pcn-archify-renderer.test.ts
git commit --only utils/archifyRuntime.ts utils/pcnArchifyRenderer.ts test/pcn-archify-renderer.test.ts -m "feat: render all Archify diagram types"
```

### Task 4: Expand authenticated PCN/PGD routes

**Files:**
- Modify: `server.ts`
- Test: `test/pcn-archify-renderer.test.ts`
- Test: `test/pcn-pgd-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing domain queries, suite builders and Task 3 renderer.
- Produces: allowlisted `diagram` query support with correct scope, no-store HTML and explicit unavailable responses.

- [ ] **Step 1: Write failing route tests**

Assert both routes use `ARCHIFY_DIAGRAM_TYPES`, default `workflow`, call the correct suite builder and set private no-store. Add request-level cases where the harness allows: no session is 401 for every type, invalid type is 400 and unavailable type returns safe `{ error, diagram, reason }`.

- [ ] **Step 2: Run focused route tests and verify RED**

Run the relevant Archify/PGD/PCN route tests. Expected: current routes only build workflow and do not parse the diagram allowlist.

- [ ] **Step 3: Add the shared query parser**

Implement:

```ts
function parseArchifyDiagramType(value: unknown): ArchifyDiagramType {
  const diagram = String(value || 'workflow').trim().toLowerCase();
  if (!ARCHIFY_DIAGRAM_TYPES.includes(diagram as ArchifyDiagramType)) throw Object.assign(new Error('Loại sơ đồ Archify không hợp lệ.'), { statusCode: 400 });
  return diagram as ArchifyDiagramType;
}
```

Do not accept body/topology input. `embed`, `theme` and `focus` remain presentation-only.

- [ ] **Step 4: Select and render the requested suite document**

Retain existing domain filters and activity ordering by `data->>'createdAt'`. Build the source object from queried rows, select the requested suite result, return unavailable as 409 JSON, and render available documents with `renderArchifyDiagram`.

- [ ] **Step 5: Harden expected error responses**

Set:

```ts
res.type('html').set('Cache-Control', 'private, no-store').send(renderedHtml);
```

Expected errors return only safe error/diagram/reason fields. Keep SQL/filesystem/compiler details in logs and preserve current auth/not-found behavior.

- [ ] **Step 6: Run focused route tests and confirm GREEN**

Confirm all five values are accepted for both domains, invalid values are rejected, no-session remains 401 and the old `created_at` regression stays absent.

- [ ] **Step 7: Commit only this task**

```powershell
git add -- server.ts test/pcn-archify-renderer.test.ts test/pcn-pgd-ui-contract.test.ts
git commit --only server.ts test/pcn-archify-renderer.test.ts test/pcn-pgd-ui-contract.test.ts -m "feat: expose Archify diagram views per dossier"
```

### Task 5: Add the smooth multi-view dossier viewer

**Files:**
- Modify: `components/PcnArchifyWorkflowEmbed.tsx`
- Modify: `components/PcnDossierWorkflowPanel.tsx`
- Modify: `components/PgdWorkflowMap.tsx`
- Test: `test/pcn-archify-embed.test.ts`
- Test: `test/pcn-archify-mobile.test.ts`

**Interfaces:**
- Consumes: Task 4 route query and existing workflow/task callbacks.
- Produces: one responsive viewer with selector, unavailable state, retry state and workflow-only mutation dock.

- [ ] **Step 1: Write failing viewer tests**

Assert the component contains a five-type selector, `diagram=` URL state, `archify-diagram-selector` test ID, unavailable copy, light theme and the existing same-origin message guard. Assert workflow actions do not render for the four read-only types.

- [ ] **Step 2: Run focused viewer tests and verify RED**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-archify-embed.test.ts test/pcn-archify-mobile.test.ts
```

Expected: FAIL because the iframe URL is hard-coded to workflow.

- [ ] **Step 3: Implement selector and URL state**

Initialize from validated `URLSearchParams(window.location.search)` or `workflow`; update only the iframe URL with `diagram=<type>`, preserve `#focus` for workflow, and reset frame/selection state when type changes without navigating the parent page.

- [ ] **Step 4: Implement loading, unavailable, error and retry states**

Before assigning the iframe `src`, preflight the same authenticated URL with `fetch(url, { credentials: 'include', cache: 'no-store' })`. On `409/422`, parse `{ error, diagram, reason }` and display a light unavailable card in the host; on another non-2xx response display the retryable error state; on a 2xx response assign the URL to the iframe. This avoids rendering raw JSON inside the iframe while retaining the authenticated server boundary. Use text plus status badges, not color alone.

- [ ] **Step 5: Keep action semantics narrow**

Render start/complete/return/document buttons only for `diagramType === 'workflow'`, a selected PCN task and permitted callbacks. For every type, parent messages may select semantic IDs but never trigger mutation automatically.

- [ ] **Step 6: Preserve mobile and PGD sharing**

Keep the current flex-height chain, `min-h-[420px]` mobile, `sm:min-h-[560px]` desktop, light host and one shared component. Do not reintroduce station arrows or a separate PGD graph renderer.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run the focused viewer command and confirm selector, URL, disabled state, action guard, message guard, light theme and mobile scroll pass.

- [ ] **Step 8: Commit only this task**

```powershell
git add -- components/PcnArchifyWorkflowEmbed.tsx components/PcnDossierWorkflowPanel.tsx components/PgdWorkflowMap.tsx test/pcn-archify-embed.test.ts test/pcn-archify-mobile.test.ts
git commit --only components/PcnArchifyWorkflowEmbed.tsx components/PcnDossierWorkflowPanel.tsx components/PgdWorkflowMap.tsx test/pcn-archify-embed.test.ts test/pcn-archify-mobile.test.ts -m "feat: add the multi-view Archify dossier reader"
```

### Task 6: Wire canonical PCN/PGD dossier pages

**Files:**
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdcnAppShell.tsx`
- Test: `test/pcn-workflow-ui.test.ts`
- Test: `test/pgd-pcn-navigation.test.ts`
- Test: `test/pcn-pgd-ui-contract.test.ts`

**Interfaces:**
- Consumes: shared viewer from Task 5.
- Produces: canonical PCN/PGD pages with correct record IDs, native document regions and no legacy primary map for dynamic records.

- [ ] **Step 1: Write failing page assertions**

Assert both detail surfaces pass record ID/code, domain, task callbacks and document opener to the shared viewer; standalone route retains `h-full`/`min-h-0`; PGD fallback remains light; legacy PCN fallback is selected only without a snapshot.

- [ ] **Step 2: Run focused page tests and verify RED**

Run the three page/UI test files and confirm diagram view props are not fully wired.

- [ ] **Step 3: Wire PCN details**

Pass dynamic workflow projection, task callbacks and document opener from `PcnDossierDetailView` through `PcnDossierWorkflowPanel`. Keep native checklist/document sections outside the iframe and preserve node/tab query as initial selection only.

- [ ] **Step 4: Wire PGD details**

Keep `PgdWorkflowMap` as the compatibility name while passing request ID/code and `domain="pgd"`. Do not pass PCN mutation callbacks into PGD.

- [ ] **Step 5: Run focused page tests and confirm GREEN**

Confirm both domains use the shared viewer and native actions/fallback boundaries remain intact.

- [ ] **Step 6: Commit only this task**

```powershell
git add -- components/PcnDossierDetailView.tsx components/PgdWorkspace.tsx components/PgdcnAppShell.tsx test/pcn-workflow-ui.test.ts test/pgd-pcn-navigation.test.ts test/pcn-pgd-ui-contract.test.ts
git commit --only components/PcnDossierDetailView.tsx components/PgdWorkspace.tsx components/PgdcnAppShell.tsx test/pcn-workflow-ui.test.ts test/pgd-pcn-navigation.test.ts test/pcn-pgd-ui-contract.test.ts -m "feat: wire Archify views into dossier pages"
```

### Task 7: Full verification, Docker deployment and memory update

**Files:**
- Modify: `PROJECT_MEMORY.md`
- Modify: `docs/PCN_DYNAMIC_DOSSIER_WORKFLOW_MEMORY.md`
- Modify: `obsidian-vault/2026-09-06 - PCN_webapp - Dynamic dossier workflow.md`
- Test: `test/pcn-archify-diagram-contract.test.ts`
- Test: `test/pcn-archify-renderer.test.ts`
- Test: `test/pcn-archify-integration.test.ts`

**Interfaces:**
- Consumes: all implementation tasks and current Docker Compose production configuration.
- Produces: verified five-view integration, production image, health evidence and memory record without secrets.

- [ ] **Step 1: Add final capability/security assertions**

Assert all five vendor entrypoints remain referenced, the host does not duplicate upstream toolbar controls, the server allowlists diagram types, no renderer receives `ARCHIFY_REPO_ROOT`, HTML stays light and fixtures contain no private bytes/tokens.

- [ ] **Step 2: Run the focused Archify suite**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-archify-diagram-contract.test.ts test/pcn-archify-integration.test.ts test/pcn-archify-renderer.test.ts test/pcn-archify-embed.test.ts test/pcn-archify-mobile.test.ts
```

Expected: all adapter, renderer, route and viewer contracts pass.

- [ ] **Step 3: Run complete verification**

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Expected: zero test failures, TypeScript/build success and no whitespace errors. Pre-existing unrelated edits may remain in `git status`.

- [ ] **Step 4: Build and start Docker production**

```powershell
docker compose --env-file .env --env-file ..\TVCI_APP\.env.local -f docker-compose.pcn.yml up -d --build
```

Verify:

```powershell
docker inspect -f "{{.State.Status}}|{{.Image}}|{{.Config.Image}}" pcn_webapp-webapp
try { $response = Invoke-WebRequest -UseBasicParsing http://localhost:2357/api/health; "HTTP $($response.StatusCode)"; $response.Content } catch { exit 1 }
docker logs --tail 50 pcn_webapp-webapp
```

Expected: running container, health HTTP 200 with `{"status":"ok"}`, PostgreSQL connected and schema initialized.

- [ ] **Step 5: Update memory and Obsidian**

Record final commit, upstream revision, five-view capability, exact test/build results, Docker image digest, container status and health endpoint. Do not record credentials, real dossier contents or temporary paths.

- [ ] **Step 6: Commit docs and perform final status check**

```powershell
git diff --check
git status --short
git add -- PROJECT_MEMORY.md docs/PCN_DYNAMIC_DOSSIER_WORKFLOW_MEMORY.md "obsidian-vault/2026-09-06 - PCN_webapp - Dynamic dossier workflow.md"
git commit --only PROJECT_MEMORY.md docs/PCN_DYNAMIC_DOSSIER_WORKFLOW_MEMORY.md "obsidian-vault/2026-09-06 - PCN_webapp - Dynamic dossier workflow.md" -m "docs: record full Archify reader deployment"
git rev-parse HEAD
```

Expected final status lists only the six pre-existing unrelated user edits.
