# PCN Sample-Centered Lab Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PCN sample/lot the primary management object, model ordered sample routes with parallel lots, and synchronize PYC acceptance, lab scheduling, execution milestones and outcomes with independent testing-room apps.

**Architecture:** Keep PostgreSQL PCN as the source of truth for samples, ordered routes, PYC records and cross-entity links. Treat each room app as the source of truth for its own execution schedule/status; PCN receives signed, idempotent webhooks and mirrors only validated execution snapshots. The management projection groups route/PYC/result data under each sample lot; mutations remain in the canonical dossier card and server boundaries.

**Tech Stack:** TypeScript, React 18, Next.js App Router, Express server routes, PostgreSQL JSONB document store, Zustand, Node `crypto`, native `fetch`, Node test runner with `tsx`, Tailwind utility classes.

**Spec:** `docs/superpowers/specs/2026-08-31-pcn-sample-centered-flow-design.md`

## Model correction: one PYC per lot, many sample items

The approved domain model is explicit: one PYC maps to exactly one sample lot, while a lot contains one or more `PcnSampleItem` records. A request sent to each target lab contains `samples[]`; routes may scope to `sampleItemIds`, and the active PCN projection renders one primary row/card per sample item grouped beneath its lot. Legacy single-sample fields on `PcnSampleLot` remain readable only as a compatibility fallback.

## Global Constraints

- `design.md` is the single source of truth and must retain the sample-centered projection, signed server-to-server integration, separate route/execution/result states and PCN/room-app data ownership rules.
- PCN remains a separate database/profile; never read or write the DDT database directly and never call a room-app API from the browser.
- `PcnSampleItem` is the primary object inside a `PcnSampleLot`; `PcnSampleLot` is the one-lot aggregate. `PcnSampleRoute.sequence` is optional for backward compatibility and new routes receive 1-based sequence values. New PYC payloads contain one lot and a `samples[]` collection.
- Sample items in one lot and different sample lots in one dossier run independently; a failed or delayed sample/model must not block another sample/model or lot.
- `ReturnedTestResult` remains the canonical formal KQTN record. A remote `FAIL` is an execution snapshot and must not silently create, delete or replace a formal result.
- Integration secrets are server-only environment/secret-store values; never persist secrets, raw webhook bodies, file bytes or absolute paths.
- Inbound webhook events are authenticated, replay-protected, deduplicated and sequence-guarded. Stale events never overwrite newer snapshots.
- Read-only management projections do not mutate routes or PYC records. Create/send PYC and reconcile actions go through dedicated server boundaries.
- Preserve all unrelated user changes in the dirty worktree; do not reset, clean or commit unrelated paths.

---

### Task 1: Extend sample item, route execution and integration types

**Files:**
- Modify: `types.ts` near `PcnSampleLot`, `PcnSampleRoute`, `PcnSampleFlowEvent` and `OutboundLabRequest`
- Modify: `utils/pcnSampleFlow.ts`
- Test: `test/pcn-sample-flow.test.ts`

**Interfaces:**
- Produces `PcnSampleItem`, `PcnSampleExecutionStatus`, `PcnSampleExecutionOutcome`, `PcnSampleExecutionSnapshot` and `PcnLabRequestIntegrationLink` types.
- Produces `getPcnSampleRouteSequence(route, allRoutes)`, `getPcnSampleRouteReadiness(route, allRoutes)`, `isPcnSampleRouteComplete(route)` and `isPcnSampleRouteBlockedByFailure(route)`.
- Preserves `buildPcnSampleLot`, `transitionPcnSampleRoute`, `derivePcnSampleLotStatus` and existing route status behavior for callers that do not use integration metadata.

- [ ] **Step 1: Write the failing tests for ordered execution readiness**

Add tests to `test/pcn-sample-flow.test.ts` using real `PcnSampleRoute` objects:

```ts
test('orders legacy routes deterministically and marks only the first pending route ready', () => {
  const routes: PcnSampleRoute[] = [
    { id: 'r-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING' },
    { id: 'r-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'PENDING' },
  ];
  assert.equal(getPcnSampleRouteSequence(routes[0], routes), 2);
  assert.equal(getPcnSampleRouteSequence(routes[1], routes), 1);
  assert.equal(getPcnSampleRouteReadiness(routes[1], routes), 'READY');
  assert.equal(getPcnSampleRouteReadiness(routes[0], routes), 'BLOCKED');
});

test('a failed route blocks the next route while a passed route releases it', () => {
  const first: PcnSampleRoute = {
    id: 'r-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RESULT_RETURNED', sequence: 1,
    execution: { status: 'COMPLETED', outcome: 'FAIL', sourceSystemCode: 'PERFORMANCE' },
  };
  const next: PcnSampleRoute = {
    id: 'r-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 2,
    execution: { status: 'UNSCHEDULED', sourceSystemCode: 'EMC' },
  };
  assert.equal(getPcnSampleRouteReadiness(first, [first, next]), 'BLOCKED');
  assert.equal(getPcnSampleRouteReadiness(next, [first, next]), 'BLOCKED');
  const passed = { ...first, execution: { ...first.execution!, outcome: 'PASS' as const } };
  assert.equal(getPcnSampleRouteReadiness(next, [passed, next]), 'READY');
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing contract**

Run:

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-sample-flow.test.ts
```

Expected: FAIL because the execution types/helpers do not exist yet; do not change the assertions to make the current implementation pass.

- [ ] **Step 3: Add backward-compatible sample item types and minimal helpers**

Add the following type shapes in `types.ts`:

```ts
export type PcnSampleExecutionStatus = 'UNSCHEDULED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
export type PcnSampleExecutionOutcome = 'PENDING' | 'PASS' | 'FAIL';

export interface PcnSampleExecutionSnapshot {
  status: PcnSampleExecutionStatus;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: PcnSampleExecutionOutcome;
  note?: string;
  sourceSystemCode: string;
  lastExternalStatus?: string;
  lastExternalEventId?: string;
  lastExternalSequence?: number;
  lastSyncedAt?: string;
}

export interface PcnLabRequestIntegrationLink {
  targetSystemCode: string;
  syncStatus: 'NOT_SENT' | 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED' | 'ERROR';
  externalRequestId?: string;
  externalRequestCode?: string;
  lastDispatchAt?: string;
  lastAcknowledgedAt?: string;
  payloadFingerprint?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

Add `sequence?: number` and `execution?: PcnSampleExecutionSnapshot` to `PcnSampleRoute`; add `integration?: PcnLabRequestIntegrationLink` to `OutboundLabRequest`; add optional source/event/sequence/fingerprint fields to `PcnSampleFlowEvent`.

Implement deterministic ordering in `utils/pcnSampleFlow.ts`: use explicit `sequence`, then `PCN_SAMPLE_LAB_OPTIONS` index, then `createdAt`, then `id`. Return `READY` only for the first pending route or a pending route whose immediately prior route has completed with `PASS`; return `BLOCKED` for a failed predecessor or missing PYC when the caller supplies that context in the projection. Preserve direct legacy transitions for old records.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same command from Step 2. Expected: PASS, including all existing sample-flow tests.

- [ ] **Step 5: Commit the isolated model/policy change**

```powershell
git add -- types.ts utils/pcnSampleFlow.ts test/pcn-sample-flow.test.ts
git commit --only types.ts utils/pcnSampleFlow.ts test/pcn-sample-flow.test.ts -m "feat: model sample execution milestones"
```

### Task 2: Build the sample-centered management projection

**Files:**
- Modify: `utils/pcnLabOperations.ts`
- Modify: `components/PcnLabOperationsView.tsx`
- Modify: `design.md` only if implementation wording needs a precise correction; keep the approved sample-centered rules intact
- Test: `test/pcn-management-drafting.test.ts` or a focused new `test/pcn-lab-operations.test.ts`

**Interfaces:**
- Consumes `CertificationDossier[]`, `CertificationProposal[]`, `PcnSampleLot[]`, `PcnSampleRoute[]`, `OutboundLabRequest[]` and `ReturnedTestResult[]`.
- Produces `buildPcnSampleFlowProjections(input)` and `filterPcnSampleFlowProjections(projections, query)`.
- Keeps `buildPcnLabOperationsRows` and its existing fields available for compatibility with drafting/assistant consumers unless all callers are safely migrated in the same task.

- [ ] **Step 1: Write failing projection tests**

Add focused tests for these behaviors:

```ts
test('groups every room route under one sample and exposes PYC/execution/result per route', () => {
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier()], proposals: [proposal],
    sampleLots: [{ id: 'lot-1', dossierId: 'd-1', lotCode: 'LO-01', sampleName: 'Mẫu A', quantity: 1, fieldCodes: ['QC4'], routeIds: ['r-1', 'r-2'], status: 'AT_LAB', currentLocation: 'Phòng thử EMC' }],
    sampleRoutes: [
      { id: 'r-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED', sequence: 2, execution: { status: 'IN_PROGRESS', sourceSystemCode: 'EMC' } },
      { id: 'r-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RESULT_RETURNED', sequence: 1, execution: { status: 'COMPLETED', outcome: 'PASS', sourceSystemCode: 'PERFORMANCE' }, labRequestId: 'pyc-1' },
    ],
    labRequests: [{ id: 'pyc-1', pycNumber: 'PYC-001', dossierId: 'd-1', fieldCode: 'QC4', laboratoryName: 'Hiệu suất', status: 'RESULT_RETURNED', requestedAt: '2026-08-31' }],
    returnedResults: [{ id: 'result-1', dossierId: 'd-1', labRequestId: 'pyc-1', round: 1, outcome: 'PASS', receivedAt: '2026-08-31', reportNumber: 'KQ-001' }],
  });
  assert.equal(projections.length, 1);
  assert.deepEqual(projections[0].routes.map((route) => route.sequence), [1, 2]);
  assert.equal(projections[0].routes[0].hasLabRequest, true);
  assert.equal(projections[0].routes[0].resultReportNumber, 'KQ-001');
  assert.equal(projections[0].routes[1].executionStatus, 'IN_PROGRESS');
});

test('does not attach a same-dossier PYC to the wrong sample route', () => {
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier()], proposals: [proposal], sampleLots: [lot()],
    sampleRoutes: [routeWithoutRequest()],
    labRequests: [requestForSameDossierButDifferentRoute()], returnedResults: [],
  });
  assert.equal(projections[0].routes[0].hasLabRequest, false);
});
```

Use explicit fixture helper names and definitions in the test file; do not rely on mocks or random IDs.

- [ ] **Step 2: Run the focused projection test and verify it fails**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-lab-operations.test.ts
```

Expected: FAIL because the sample-grouped projection and route execution fields are not implemented.

- [ ] **Step 3: Implement the projection**

In `utils/pcnLabOperations.ts`:

1. Index proposals, lots, routes, requests and results without inferring a request from dossier-only membership.
2. Emit one projection per lot belonging to a visible dossier.
3. Resolve a route request only through `route.labRequestId`, `request.sampleRouteId`, or an exact existing canonical link; expose `hasLabRequest=false` when no exact link exists.
4. Join the newest result for that exact request and expose both external execution outcome and formal result outcome.
5. Derive `currentLocation`, `activeRouteId`, `activeRouteCount`, `hasDataIssue`, and per-route readiness using the helpers from Task 1.
6. Emit explicit `unlinkedPyc` records for requests that belong to a dossier but have no matching route, preserving them for search and warning display.

Use an interface shaped like:

```ts
export interface PcnSampleFlowProjection {
  id: string;
  dossierId: string;
  dossierCode: string;
  proposalCode: string;
  customerName: string;
  productName: string;
  lotId: string;
  lotCode: string;
  sampleName: string;
  model?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  lotStatus: PcnSampleLot['status'];
  currentLocation: string;
  activeRouteId?: string;
  activeRouteCount: number;
  hasDataIssue: boolean;
  routes: PcnSampleFlowRouteProjection[];
}
```

The route projection must include lab identity, sequence, route status, execution status/date/milestones/outcome, PYC link/status/sync status and formal result summary.

In `PcnLabOperationsView.tsx`, replace route/PYC cards with sample cards. Keep the search field, add sample-centered search copy, render one horizontal route stepper per lot, show current location and sync/result warnings above it, and show KPI counts by lot. Each node must display room, route status, execution badge, scheduled date, PASS/FAIL/Chưa có KQ, PYC Đã có/Chưa có and external code if acknowledged. The management view remains read-only and opens the canonical dossier card for creation/sending/reconcile actions.

- [ ] **Step 4: Run projection and existing management tests**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-lab-operations.test.ts test/pcn-management-drafting.test.ts
```

Expected: PASS. Existing route-row compatibility assertions must remain green.

- [ ] **Step 5: Commit the sample-centered projection**

```powershell
git add -- utils/pcnLabOperations.ts components/PcnLabOperationsView.tsx test/pcn-lab-operations.test.ts test/pcn-management-drafting.test.ts
git commit --only utils/pcnLabOperations.ts components/PcnLabOperationsView.tsx test/pcn-lab-operations.test.ts test/pcn-management-drafting.test.ts -m "feat: center lab operations on samples"
```

### Task 3: Add signed server-to-server PYC dispatch and status webhook processing

**Files:**
- Create: `utils/pcnLabIntegration.ts` for browser-safe integration types, event validation/mapping and payload fingerprints
- Modify: `server.ts` near the existing PCN lab-request boundaries and shared transaction helpers
- Modify: `.env.example` with non-secret integration configuration names only
- Modify: `types.ts` if any envelope types are shared by server and client
- Test: `test/pcn-lab-integration.test.ts`
- Test: `test/pcn-sample-api-contract.test.ts`

**Interfaces:**
- Produces `buildPcnLabDispatchPayload`, `buildPcnLabIntegrationFingerprint`, `mapPcnLabStatusEvent` and `getPcnLabIntegrationEventId`.
- Produces `POST /api/pcn/lab-requests/:requestId/dispatch` for a logged-in PCN user.
- Produces `POST /api/pcn/integrations/lab-status-events` for configured room-app services using HMAC authentication.
- Uses existing `pcnSampleFlowEvents` as append-only integration inbox/audit evidence; no second business source of truth is created.

- [ ] **Step 1: Write failing pure integration tests**

Create `test/pcn-lab-integration.test.ts` with tests for:

```ts
test('dispatch payload contains PCN route identity and no credential/file fields', () => {
  const payload = buildPcnLabDispatchPayload({
    request: requestFixture(), lot: lotFixture(), route: routeFixture(), dossier: dossierFixture(), proposal: proposalFixture(),
    targetSystemCode: 'PERFORMANCE', messageId: 'msg-1', idempotencyKey: 'PCN:r-1:pyc-1:v1',
  });
  assert.equal(payload.request.pcnRouteId, 'r-1');
  assert.equal(payload.sample.lotId, 'lot-1');
  assert.equal('secret' in payload, false);
  assert.equal('fileBytes' in payload.sample, false);
});

test('status event mapping carries schedule, execution milestones and outcome', () => {
  const mapped = mapPcnLabStatusEvent({
    sourceSystemCode: 'PERFORMANCE', externalEventId: 'evt-1', externalRequestId: 'ext-1', externalSequence: 3,
    pcnRouteId: 'r-1', pcnLabRequestId: 'pyc-1', eventType: 'RESULT_UPDATED',
    scheduledDate: '2026-09-03', completedAt: '2026-09-03T08:00:00.000Z', outcome: 'FAIL', occurredAt: '2026-09-03T08:01:00.000Z',
  });
  assert.equal(mapped.execution.status, 'COMPLETED');
  assert.equal(mapped.execution.outcome, 'FAIL');
  assert.equal(mapped.execution.scheduledDate, '2026-09-03');
});

test('duplicate and stale event keys are stable and distinguishable', () => {
  assert.equal(getPcnLabIntegrationEventId('PERFORMANCE', 'evt-1'), getPcnLabIntegrationEventId('PERFORMANCE', 'evt-1'));
  assert.notEqual(getPcnLabIntegrationEventId('PERFORMANCE', 'evt-1'), getPcnLabIntegrationEventId('EMC', 'evt-1'));
});
```

- [ ] **Step 2: Run the integration tests and verify they fail**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-lab-integration.test.ts
```

Expected: FAIL because the integration module and mapping functions do not exist.

- [ ] **Step 3: Implement pure payload/event helpers**

Use canonical JSON and SHA-256 for fingerprints. Normalize system/event codes to uppercase, require a non-empty PCN route/request identity, accept only the explicit event types from the spec, and never carry raw request bodies into `PcnSampleFlowEvent`.

Implement the mapping rules:

- `RECEIVED` updates transport to `RECEIVED` and execution to `UNSCHEDULED` unless the event also carries a later execution state.
- `SCHEDULED`/`RESCHEDULED` updates execution to `SCHEDULED` and `scheduledDate`.
- `IN_PROGRESS` updates execution to `IN_PROGRESS` and `startedAt`.
- `TEST_COMPLETED` updates execution to `COMPLETED` and `completedAt` without creating a formal result.
- `RESULT_UPDATED` updates execution outcome and optional external report number; `FAIL` is visible but does not advance the next route.
- `RETURNED`, `ISSUE` and `CANCELLED` update the route transport/issue state as permitted by the existing state machine.

- [ ] **Step 4: Add server dispatch boundary**

In `server.ts`, add `POST /api/pcn/lab-requests/:requestId/dispatch` behind `requirePcnMutationMiddleware`:

1. Load and lock the request, linked route, lot and dossier in PCN PostgreSQL; reject missing or cross-dossier links.
2. Resolve the room-app adapter from a server-only `PCN_LAB_INTEGRATIONS_JSON` configuration containing `systemCode`, `baseUrl` and `secretEnv`; read the actual secret from `process.env[secretEnv]`.
3. Build the canonical payload and stable idempotency key `PCN:<routeId>:<requestId>:v1`; sign `method + path + timestamp + messageId + bodySha256` with HMAC-SHA256.
4. Call the configured app endpoint `POST /api/integrations/v1/lab-requests` using server `fetch`, with timeout and no browser forwarding.
5. Validate the ACK (`accepted`, matching target, idempotency key, external request ID/code, status and accepted time); update `OutboundLabRequest.integration`, route external linkage and audit in one transaction after the network call.
6. On timeout/rejection, persist `integration.syncStatus=ERROR` and a safe error code/message without changing a previously acknowledged external ID; retrying the same request reuses the same idempotency key.

Add `.env.example` entries for `PCN_LAB_INTEGRATIONS_JSON` and a comment showing that each `secretEnv` points to a separately injected secret. Do not add a real URL or secret.

- [ ] **Step 5: Add server webhook boundary and sequence/idempotency guard**

Implement `POST /api/pcn/integrations/lab-status-events` without PCN browser session auth but with:

- configured `sourceSystemCode` validation;
- timestamp replay window and HMAC verification against the raw/canonical body hash;
- required `externalEventId`, `externalRequestId`, `externalSequence`, route/PYC identity and event type;
- advisory lock on `sourceSystemCode + externalRequestId`;
- stable event document ID from `getPcnLabIntegrationEventId` and `ON CONFLICT DO NOTHING` for duplicate delivery;
- a route/PYC row lock and stale-sequence rejection before applying the mapped snapshot;
- append-only `pcnSampleFlowEvents` metadata plus route/PYC/audit updates in the same transaction;
- HTTP 200 with `idempotent=true` for a duplicate or stale event, and 4xx for invalid signatures/identity/payload.

Do not create `ReturnedTestResult` from a webhook. Only update the existing execution snapshot and external result summary.

- [ ] **Step 6: Extend API contract tests and run them**

Add source assertions to `test/pcn-sample-api-contract.test.ts` for the dispatch/webhook paths, HMAC, external sequence, `pcnSampleFlowEvents`, transaction locking and no raw secret/body persistence. Run:

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-lab-integration.test.ts test/pcn-sample-api-contract.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit server integration**

```powershell
git add -- utils/pcnLabIntegration.ts server.ts .env.example test/pcn-lab-integration.test.ts test/pcn-sample-api-contract.test.ts
git commit --only utils/pcnLabIntegration.ts server.ts .env.example test/pcn-lab-integration.test.ts test/pcn-sample-api-contract.test.ts -m "feat: integrate PCN lab request status"
```

### Task 4: Add client/store dispatch and reconcile actions to the canonical dossier card

**Files:**
- Modify: `utils/pcnLabRequestApi.ts`
- Modify: `store-pcn.ts`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PcnLabRequestView.tsx`
- Modify: `components/PcnLabRequestDetailModal.tsx`
- Test: `test/pcn-lab-request-ui.test.ts` (create if no focused file exists)

**Interfaces:**
- Produces `dispatchPcnLabRequest(requestId)` and `reconcilePcnLabRequest(requestId)` API clients.
- Produces store methods `dispatchLabRequest(requestId)` and `reconcileLabRequest(requestId)` that merge returned request/route/lot/dossier/events/activity logs.
- Adds canonical-card UI actions while keeping the management projection read-only.

- [ ] **Step 1: Write failing client/UI contract tests**

Assert that the source contains the dedicated dispatch/reconcile endpoints, the canonical card wires the callbacks, and the PYC card renders `integration.syncStatus`, external request code, schedule/execution state and a reconcile action. Include a test that the operations projection does not call `fetch` or write to the database.

- [ ] **Step 2: Run the focused UI test and verify it fails**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-lab-request-ui.test.ts
```

Expected: FAIL on the missing dispatch/reconcile contract and UI wiring.

- [ ] **Step 3: Implement API clients and store actions**

Add to `utils/pcnLabRequestApi.ts`:

```ts
export async function dispatchPcnLabRequest(requestId: string): Promise<PcnLabRequestMutationResponse> {
  const response = await fetch(`/api/pcn/lab-requests/${encodeURIComponent(requestId)}/dispatch`, {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  return parseResponse(response) as Promise<PcnLabRequestMutationResponse>;
}

export async function reconcilePcnLabRequest(requestId: string): Promise<PcnLabRequestMutationResponse> {
  const response = await fetch(`/api/pcn/lab-requests/${encodeURIComponent(requestId)}/reconcile`, {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  return parseResponse(response) as Promise<PcnLabRequestMutationResponse>;
}
```

Add store methods that call `assertPcnStoreMutationAllowed`, merge every returned entity by ID, prepend new flow events/audit logs without duplicates, and leave the current snapshot untouched when the server returns an error.

- [ ] **Step 4: Wire the canonical card and render operator feedback**

Pass the store callbacks from `PcnWorkspace` through `PcnDossierDetailView` to `PcnLabRequestView`. For a draft PYC with an exact sample route, show **Gửi PYC sang phòng thử**; on error show the safe integration error. For an acknowledged/error PYC, show external request ID/code, sync status and **Đồng bộ lại**. Keep existing local status/handover actions and RBAC guards.

In `PcnLabRequestDetailModal`, show the target system, external code, last ACK, last sync error and the linked sample/route. Do not show secrets or raw integration payloads.

- [ ] **Step 5: Run focused tests and type validation**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-lab-request-ui.test.ts test/pcn-sample-flow.test.ts
npm run lint
```

Expected: PASS with no TypeScript errors; `npm run lint` is the repository's TypeScript `noEmit` check.

- [ ] **Step 6: Commit canonical dispatch UI**

```powershell
git add -- utils/pcnLabRequestApi.ts store-pcn.ts components/PcnWorkspace.tsx components/PcnDossierDetailView.tsx components/PcnLabRequestView.tsx components/PcnLabRequestDetailModal.tsx test/pcn-lab-request-ui.test.ts
git commit --only utils/pcnLabRequestApi.ts store-pcn.ts components/PcnWorkspace.tsx components/PcnDossierDetailView.tsx components/PcnLabRequestView.tsx components/PcnLabRequestDetailModal.tsx test/pcn-lab-request-ui.test.ts -m "feat: dispatch lab requests from dossier card"
```

### Task 5: Verify the complete sample-centered workflow and hand off

**Files:**
- Modify only files needed to correct verified failures from Tasks 1–4.
- Review: `design.md`, `docs/superpowers/specs/2026-08-31-pcn-sample-centered-flow-design.md`, `docs/superpowers/plans/2026-08-31-pcn-sample-lab-integration.md`

- [ ] **Step 1: Run the focused PCN regression suite**

```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-sample-flow.test.ts test/pcn-lab-operations.test.ts test/pcn-management-drafting.test.ts test/pcn-lab-integration.test.ts test/pcn-sample-api-contract.test.ts test/pcn-lab-request-ui.test.ts
```

Expected: all listed tests pass with zero failures.

- [ ] **Step 2: Run the complete active PCN suite**

```powershell
npm test
```

Expected: the active PCN runner exits with code 0. If unrelated pre-existing tests fail, report the exact failures and do not mask them with test changes.

- [ ] **Step 3: Run formatting, type and production checks**

```powershell
git diff --check
npm run lint
npm run build
```

Expected: `git diff --check` has no whitespace errors, type validation exits 0, and the production build exits 0.

- [ ] **Step 4: Review the requirement checklist against evidence**

Confirm from code/tests that:

- one sample card contains ordered room routes;
- multiple lots render independent parallel flows;
- each route shows PYC present/missing, schedule, execution status/milestones and PASS/FAIL;
- a failed route blocks the next route;
- PCN dispatch returns and stores external request identity;
- duplicate/stale webhooks are safe and do not overwrite newer state;
- formal KQTN remains distinct from remote execution outcome;
- the browser never directly calls a room-app endpoint;
- integration secrets/raw payloads are not persisted;
- management projection remains read-only and canonical card actions remain RBAC-protected.

- [ ] **Step 5: Inspect the final diff and report exact files/tests**

```powershell
git status --short
git diff --stat
git diff --check
```

Only after fresh verification should the final response claim completion, with the actual test/build results and any limitations such as unconfigured room-app URLs.
