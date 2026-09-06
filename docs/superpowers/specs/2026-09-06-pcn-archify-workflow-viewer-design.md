# PCN Archify Workflow Viewer Design

## Goal

Replace the vertical node list on the standalone PCN dossier page with a truthful, interactive Archify-style reader for each dossier's saved workflow topology. The reader must expose the full Archify exploration and export vocabulary while keeping live PCN mutations, permissions, private documents, and audit boundaries in the existing application.

## Scope and truth boundary

The viewer is a read-oriented projection of one `CertificationDossier`:

`workflowSnapshot` + `pcnDossierWorkflowTasks` + dossier documents/waivers/results/approval steps + available audit/flow facts → `PcnArchifyDiagramIR` → viewer layers.

The viewer never creates a node, edge, actor, event, or route from visual proximity. Selecting, focusing, searching, tracing, changing theme, changing preset, opening the radar, playing a story, presenting, zooming, and exporting are ephemeral client state. Task actions and uploads remain server mutations through existing PCN APIs and the existing operator/RBAC guards.

The Archify repository is integrated as the upstream renderer/runtime under `vendor/archify/archify` at the pinned source revision recorded in project memory. PCN remains the only business-data source: the application converts saved dossier facts into Archify workflow schema v2, invokes Archify's official compiler, and serves its self-contained reader template through an authenticated dossier endpoint. The integration preserves the upstream MIT license and never embeds private PCN file bytes, access tokens, or server-only facts in the rendered artifact.

## User experience

### Primary workflow canvas

- The dossier page keeps its existing header and region selector, but the dynamic workflow viewer becomes the primary content immediately below the header.
- The canvas renders lanes and columns derived from the dossier snapshot. Sequential nodes follow the main path, parallel children occupy separate lanes, decision edges carry their saved branch labels/conditions, joins show `ALL`, `ANY`, or `QUORUM`, and return edges use a distinct dashed return route.
- Each node is a compact card with stable node id, label, kind, status, cycle, assignee, document count, and next action. The active/returned/locked state has both semantic color and text/icon cues.
- A focused node opens one Semantic Passport/drawer. It contains dossier identity, node metadata, current task state, requirements and current file versions, upstream/downstream relationships, exact outgoing edge labels, blocked/return reason, permitted task controls, and deep-link controls. It is the only permanent detail destination; no duplicate node details panel is added.
- Node selection only changes the visible work region and focus. It does not start, complete, return, or mutate a task.

### Archify reader controls

The toolbar and keyboard layer implement the following capabilities from the same IR:

| Capability | Product behavior |
| --- | --- |
| Guide | Shows current actions and shortcuts, with an explicit close/Escape path. |
| Node Finder | Searches node labels and stable ids; focus is committed only after a result is chosen. `/` opens it. |
| Intent Trace | Shows the target before a pointer/keyboard focus is committed where the browser supports it. |
| Focus / Semantic Passport | Opens the selected node's proof surface with stable id, metadata and exact relationships. Escape/outside close is supported. |
| Upstream / Downstream | Traverses authored incoming/outgoing edges from the selected node, reports node/link/hop counts, and fades unrelated topology. |
| Direct Relationship Pin | Focuses one exact edge by stable relationship id and fails closed if edge metadata conflicts. |
| Route Probe | Resolves a directed route between exactly two selected nodes using authored edges, never geometric proximity. `R` opens route mode. |
| Semantic Lens | Filters/emphasizes node and edge kinds without changing graph geometry. |
| Semantic Radar | Shows a small viewport/graph overview and mirrors the same IR instead of owning another layout. |
| Guided views | Provides at most five curated views derived from stable node ids: intake, document review, sample/lab parallelism, technical review, and approval/archive. Missing nodes are reported and not invented. |
| Story | Plays finite reader-started chapters from the guided views. Adjacent beats classify only their direct authored relation; no transitive runtime behavior is inferred. |
| Presentation Stage | Full-screen reader framing changes chrome only, not authored geometry or topology. `F` toggles it. |
| Reading depth | Collapses or expands node metadata at 100%/175% and uses a map-level presentation below 100%, without changing the graph. |
| Theme and preset | Light/dark theme plus `classic`, `signal-flow`, `blueprint`, and `editorial` presets. Semantic categories remain stable across modes. `T` toggles theme and `S` cycles presets. |
| Motion | Optional finite trace animation; static is default and reduced-motion/hidden-page/print/export remain meaningful. |
| Deep links | Hash/query state may restore focus, route, lens, reach, guided view, theme, preset, and presentation after validation against current stable ids. |

### Diagram projections

The viewer starts in `workflow` mode. A mode picker may switch to a derived view only when the corresponding facts exist:

- `workflow`: snapshot node/transition topology plus runtime task state.
- `lifecycle`: saved dossier lifecycle events/status transitions, with returned/rework cycles as real authored events.
- `dataflow`: requirement/file-version lineage through document nodes and downstream output nodes.
- `sequence`: recorded actor/task/audit operations for the dossier, ordered by timestamp; absent audit facts do not produce synthetic calls.
- `architecture`: the dossier's relevant PCN, private Storage, and internal lab boundaries, only when the source records a real relation.

Every non-workflow projection keeps a link back to the originating node/task and can return to the canonical workflow focus.

### Export and share assets

- Full diagram export supports SVG, PNG, JPEG, WebP, and WebM. The WebM trace is opt-in and finite.
- Share Card exports a complete 1200×630 static diagram with title, current theme/preset, and dossier identity without temporary reader state.
- Route Share Card is offered only after a real route probe resolves; it carries the ordered route and labels it as authored route evidence.
- Reach Share Card is offered only after a non-empty upstream/downstream traversal; it carries the matched nodes/edges and labels it as authored reachability, never impact, blast radius, breakage, or causality.
- Canonical exports remove finder, guide, lens, focus glow, passport, radar, camera, story, presentation and temporary overlays. File names are safe and include dossier code plus view variant; no private file bytes or tokens are embedded.

## Architecture

### Archify workflow adapter

`utils/pcnArchifyWorkflow.ts` and `utils/pgdArchifyWorkflow.ts` convert server-owned PCN/PGD facts into the upstream Archify workflow schema v2. The adapters use the saved PCN workflow snapshot and `projectPcnWorkflowRuntime` for node/task state; PGD uses its saved lifecycle, checklist, lab and approval facts. They preserve stable IDs, authored transitions, branch labels, join policies, return routes, document counts, status tags, lanes, `yOffset`, cards and up to five guided views. No relationship is inferred from geometric position and no browser-supplied topology is accepted.

The adapters support arbitrary node counts using the upstream schema's six logical columns plus lanes and offsets. PCN workflows can contain document tasks, approvals, decisions, parallel split/join branches and rework cycles. PGD receives the same Archify runtime with its own lifecycle/checklist/laboratory projection, so the two business boundaries remain separate while the reader behavior is shared.

The result is validated by the vendored `workflow-compiler.mjs` before it is served. Compilation failure is a blocking error rather than a partially rendered or invented graph.

### Upstream Archify runtime integration

The product uses the vendored Archify source rather than reimplementing its reader controls:

- `vendor/archify/archify/renderers/workflow/workflow-compiler.mjs` compiles the PCN workflow JSON into Archify SVG and layout receipt data.
- `vendor/archify/archify/renderers/shared/utils.mjs` supplies upstream `applyTemplate`; `vendor/archify/archify/assets/template.html` is the complete reader runtime used for the dossier view.
- `utils/pcnArchifyWorkflow.ts` is the pure PCN-to-Archify schema adapter. It maps every saved node/transition, branches, joins, return routes, labels, runtime status and up to five guided views without inventing relationships.
- `utils/pcnArchifyRenderer.ts` is the server-only bridge that loads the vendored modules, compiles schema version 2, applies the upstream template, and injects only a minimal same-origin `postMessage` focus bridge for PCN actions.
- `components/PcnArchifyWorkflowEmbed.tsx` embeds the authenticated HTML artifact per dossier. Archify owns guide, finder, focus/passport, reach, route probe, semantic lens, radar, stories, presentation, theme, presets, keyboard controls and exports; the parent only owns PCN mutations and the selected-node action bridge.
- `components/PcnDossierWorkflowPanel.tsx` delegates dynamic snapshots to the embedded upstream reader; the legacy summary remains a compatibility fallback.

The endpoint fails closed when compilation or validation fails and never accepts browser-supplied topology as authoritative input.

The vendored reader renders the compiled SVG and owns the accessible node cards, relationship controls and export surfaces. The host page only provides containment/loading/error states and the authenticated same-origin `postMessage` bridge needed to connect a selected node to existing PCN task actions.

### PCN action bridge

The viewer accepts the existing callbacks:

```ts
type PcnArchifyWorkflowActions = {
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  onOpenDocuments?: (nodeId: string) => void;
};
```

The passport disables controls for locked/completed/cancelled tasks, viewers, or absent callbacks. Return validation remains server-authoritative and requires a target plus non-empty reason.

## Error handling and accessibility

- Unknown node/edge ids, stale deep links, unreachable routes, conflicting edge metadata, unsupported export APIs, and incomplete mode facts fail closed with an explanatory inline status and a return-to-workflow action.
- Export failures never claim a downloaded artifact; the user keeps the current viewer state.
- Every icon-only control has an accessible name. Keyboard paths cover `/`, `?`, `R`, `L`, `M`, `P`, `F`, `S`, `T`, `+`, `-`, `0`, Escape and arrow navigation where applicable.
- Focus rings, text labels, icons and status chips supplement color. Reduced-motion and print render the full static topology.
- The graph containment must satisfy the existing PCN mobile scroll contract and must not create horizontal page overflow.

## Testing and acceptance evidence

1. Unit tests prove IR determinism, dynamic layout, branch/join placement, return routes, exact route probe, upstream/downstream counts, lens filtering, deep-link validation, and projection mode truth boundaries.
2. Component contract tests prove the viewer is used for dynamic snapshots, no vertical station list is the primary map, controls are present, callbacks stay wired, and legacy fallback remains isolated.
3. Export tests prove transient state is stripped, share-card variants fail closed without a valid route/reach result, and no file bytes/secret are included.
4. Accessibility/keyboard tests prove guide/finder/passport/presentation close paths and usable labels.
5. Run `npm test`, `npm run lint`, `npm run build`, `git diff --check`, Docker production build/up, health check, and a browser smoke check at `http://localhost:2357/pgdcn/pcn` after login.

## Rollout

The migration/backfill already gives existing local dossiers snapshots/tasks. The new viewer reads those rows without another migration. If a dossier has no snapshot, the existing legacy summary remains a compatibility fallback and is explicitly labeled as legacy; no station UI is shown for a dynamic snapshot.
