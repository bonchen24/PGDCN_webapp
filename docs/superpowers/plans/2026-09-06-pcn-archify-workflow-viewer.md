# PCN Archify Workflow Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the upstream Archify reader into the PCN and PGD dossier surfaces, projecting each server-owned workflow/lifecycle into Archify schema v2 while preserving existing mutations and RBAC.

**Architecture:** Vendor the upstream Archify source under `vendor/archify/archify`, convert the saved PCN dossier topology into Archify workflow schema v2, invoke Archify's own compiler and `template.html` reader on the server, and embed the resulting authenticated HTML per dossier. The parent React surface only bridges selected-node PCN actions; Archify owns the graph reader, exploration, stories, presentation, themes, presets and exports.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, lucide-react, browser SVG/Canvas/MediaRecorder APIs, existing PCN runtime projection and test runner.

**Spec:** `docs/superpowers/specs/2026-09-06-pcn-archify-workflow-viewer-design.md`

## Global Constraints

- `design.md` remains the single source of truth and the dynamic dossier snapshot remains the only topology source.
- The integration must preserve stable node/edge ids and must never infer relationships from geometry.
- Upstream Archify source/runtime is committed in `vendor/archify/archify`; its commit hash and MIT license are recorded in project memory.
- Task controls continue through existing server mutations, operator guards, RBAC, audit, and private Storage boundaries.
- Viewer state is ephemeral and must not be persisted to the dossier, workflow template, runtime task, or database.
- Static output is the default; trace motion is finite, opt-in, and honors `prefers-reduced-motion`.
- Desktop keeps one dominant canvas; narrow screens use containment/scroll and do not receive a second topology.
- Existing unrelated lab/sample worktree edits must not be staged or reverted.

---

### Task 1: Vendor Archify and test the PCN-to-Archify contract

**Files:**
- Modify: `design.md` sections `0.2` and `0.2.3` (already specified by the design update)
- Add: `vendor/archify/archify/` from the upstream Archify repository
- Create: `utils/pcnArchifyWorkflow.ts`
- Create: `utils/pgdArchifyWorkflow.ts`
- Test: `test/pcn-archify-integration.test.ts`

**Interfaces:**
- Consumes: `CertificationDossier`, `PcnWorkflowSnapshot`, `PcnDossierWorkflowTask`, `PcnDossierDocument`, waiver/result/approval facts.
- Produces: valid Archify workflow schema v2, deterministic PCN/Archify id maps, and the guided views used by the upstream reader.

- [x] **Step 1: Write failing adapter tests**

Add tests that build a dossier with sequential, decision, parallel split/join, and return transitions, then assert the generated object is accepted by the vendored Archify schema/compiler:

```ts
const workflowDocument = buildPcnArchifyWorkflow({ dossier, workflow, tasks, documents, documentWaivers, results, approvalSteps, activityLogs });
assert.deepEqual(workflowDocument.mainPath, ['intake', 'decision', 'review', 'end']);
assert.equal(workflowDocument.edges.find((edge) => edge.role === 'return')?.from, 'review');
assert.ok(workflowDocument.meta.views.every((view) => view.focus.every((id) => workflowDocument.nodes.some((node) => node.id === id))));
```

Cover the PCN graph and the PGD lifecycle/checklist/lab graph with real input facts, and verify missing facts do not produce fabricated records.

- [x] **Step 2: Run the focused test and verify the expected failure**

Run the focused test and confirm the new adapter test fails before the adapters exist. Fix test setup errors before continuing.

- [x] **Step 3: Implement the pure PCN and PGD adapters**

Use workflow transitions as the only PCN workflow edge source and saved PGD lifecycle/checklist/lab facts for PGD. Use runtime projection for status/blocked/return fields. Assign stable Archify lanes/columns from topology and node kind; preserve edge labels and return roles. Map PCN/PGD facts to Archify component types, include task status in labels/tags/cards, and build guided views by filtering existing ids only. Keep the official schema's six logical columns while packing arbitrary node counts via lanes and `yOffset`; do not collapse either domain to five stations.

- [x] **Step 4: Run the focused tests and confirm they pass**

Run the focused adapter tests and confirm they pass with no fabricated node/edge facts.

- [x] **Step 5: Keep the adapter in the combined feature commit**

### Task 2: Invoke the upstream compiler and serve the full reader

**Files:**
- Create: `utils/pcnArchifyRenderer.ts`
- Modify: `server.ts`
- Test: `test/pcn-archify-renderer.test.ts`

**Interfaces:**
- Consumes: the validated Archify workflow document from Task 1 and server-owned dossier facts.
- Produces: a complete Archify HTML reader document with upstream controls and truthful PCN graph data.

- [x] **Step 1: Write failing renderer tests**

Assert that the renderer invokes the vendored compiler/template, emits the upstream reader markers and Archify data hooks, preserves arbitrary node counts, and fails closed for invalid compiler input. Assert both endpoints read dossier facts server-side and do not accept browser topology.

- [x] **Step 2: Run focused tests and verify RED**

Run `npm test` and confirm the new tests fail because the layout/state functions are absent.

- [x] **Step 3: Implement the server renderer bridge**

Load the upstream `.mjs` modules from an absolute repository path, call `compileWorkflow({ workflow, qualityProfile })`, pass the compiled SVG and PCN-safe cards/views to `applyTemplate`, and return a `text/html` response. Add a minimal focus/click bridge that posts only domain, record id and stable node/edge ids to the embedding page.

- [x] **Step 4: Run focused tests and confirm GREEN**

Run `npm test` and confirm the layout/state tests pass.

- [x] **Step 5: Cover both authenticated server routes**

### Task 3: Embed the upstream reader and bridge PCN actions

**Files:**
- Create: `components/PcnArchifyWorkflowEmbed.tsx`
- Modify: `components/PcnDossierWorkflowPanel.tsx`
- Test: `test/pcn-archify-embed.test.ts`

**Interfaces:**
- Consumes: the dossier id and existing workflow task callbacks.
- Produces: one per-dossier iframe embedding the complete upstream Archify reader plus a compact PCN action dock.

- [x] **Step 1: Write failing component contract tests**

Assert the component uses the authenticated Archify endpoint, handles same-origin focus messages, exposes selected-node PCN actions, and no longer uses the vertical station list as the primary dynamic renderer.

- [x] **Step 2: Run focused tests and verify RED**

Run `npm test` and confirm the component contract fails because the component does not exist.

- [x] **Step 3: Implement the shared graph reader embed**

Implement the iframe with a stable dossier URL, same-origin message validation, loading/error states, and action callbacks for the selected task. Do not duplicate Archify's reader controls in React; the vendored template remains the source of truth for those features.

- [x] **Step 4: Wire accessibility, deep links and responsive containment**

Give the iframe an accessible title, clear loading/error text, and a compact action area with accessible labels. Keep mobile containment on the host page; guide/finder/passport/keyboard/print/export semantics come from the upstream template.

- [x] **Step 5: Run focused tests and confirm GREEN**

Run `npm test` and confirm viewer UI contracts pass.

- [x] **Step 6: Share the reader surface across PCN and PGD**

`PcnDossierWorkflowPanel` and the compatibility `PgdWorkflowMap` both delegate to `PcnArchifyWorkflowEmbed`.

### Task 4: Integrate the reader into the dossier detail and action bridge

**Files:**
- Modify: `components/PcnDossierWorkflowPanel.tsx`
- Modify: `components/PgdWorkflowMap.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pcn-workflow-ui.test.ts`
- Test: `test/pcn-pipeline.test.ts`

**Interfaces:**
- Consumes: the server endpoint from Task 2 and the iframe embed from Task 3.
- Produces: dynamic dossiers render the upstream Archify reader; legacy dossiers remain an explicitly isolated fallback; selected-node controls call existing PCN callbacks.

- [x] **Step 1: Write failing integration assertions**

Assert that dynamic snapshots render `PcnArchifyWorkflowEmbed`, pass the dossier id and task callbacks, and keep `onStartWorkflowTask`, `onCompleteWorkflowTask`, `onReturnWorkflowTask`, and `onUploadDocument` wired. Assert the legacy summary is only selected when `workflowSnapshot` is absent.

- [x] **Step 2: Run the focused tests and verify RED**

Run `npm test` and confirm the integration assertions fail because the panel still maps nodes into vertical details.

- [x] **Step 3: Replace the dynamic PCN/PGD map renderers**

Replace the dynamic vertical node list with the iframe embed. Keep all document/task permissions in the existing panel callbacks; Archify is a read/explore/export surface and does not become a new mutation boundary.

- [x] **Step 4: Preserve task permission and document behavior**

Keep the current `canEdit`, task status, return reason/target, private file version, waiver, and upload rules. The graph selection changes the selected node/region only; task mutations remain the existing callbacks.

- [x] **Step 5: Run focused tests and confirm GREEN**

Run `npm test` and confirm workflow UI/pipeline tests pass.

- [x] **Step 6: Keep the legacy PCN fallback isolated**

The legacy summary remains available only when a dossier has no workflow snapshot.

### Task 5: Verify upstream feature coverage and deploy

**Files:**
- Modify: `docs/PCN_DYNAMIC_DOSSIER_WORKFLOW_MEMORY.md`
- Modify: the repository's current PCN memory/Obsidian note
- Verify: upstream Archify renderer, Docker production image and local browser surface

**Interfaces:**
- Consumes: generated PCN workflow fixture and the actual embedded upstream reader.
- Produces: verification evidence for the upstream Archify feature surface and production Docker deployment.

- [x] **Step 1: Write failing upstream/render tests**

Run the upstream Archify validator/renderer and artifact checks against a generated PCN workflow fixture. Assert the generated HTML contains the upstream toolbar/runtime markers, authored node/edge hooks, and no private file bytes or tokens.

- [x] **Step 2: Run the focused tests and verify RED**

Run the upstream checks and confirm any integration failure is visible before deployment.

- [x] **Step 3: Verify production build and Docker deployment**

Run `npm test`, `npm run lint`, `npm run build`, `git diff --check`, Docker production build/up, the health check, and a browser smoke check. Record the vendored source hash, exact verification results, Docker status and rollback notes in memory/Obsidian.

- [x] **Step 4: Verify upstream feature coverage and capability guards**

Confirm the upstream reader exposes guide, finder, focus/passport, reach, route probe, semantic lens, radar, guided views, stories, presentation, theme, presets, keyboard controls and exports. Do not reimplement or falsely claim these features in the host React component.

- [x] **Step 5: Run focused tests and confirm GREEN**

Run the complete verification suite and confirm the deployment is healthy.

- [x] **Step 6: Commit exports**

Commit the vendor, adapter, renderer, endpoint, embed, tests and docs together after verification.

## Execution notes

Use the existing `codex/pcn-dynamic-dossier-workflow` branch. The upstream repository is now a literal vendored runtime dependency of this feature, not merely a visual reference. Keep PCN API/RBAC authority on the server and never embed private document bytes or tokens in the Archify artifact.
