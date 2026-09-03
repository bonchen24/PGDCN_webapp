# PCN Actor Activity Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate the authenticated PCN user who creates/sends an internal PYC to DDT and LABFTEE so each app records that same user in its local activity history without sharing credentials.

**Architecture:** PCN derives an immutable `initiatedBy` actor snapshot from the server-side session and includes it in the signed server-to-server dispatch payload. DDT and LABFTEE validate the snapshot, preserve it with the received request, and create one idempotent local activity record keyed by the PCN dispatch identity. Remote apps keep their own activity schemas and do not impersonate or create a login session for the PCN user.

**Tech Stack:** TypeScript, Express, PostgreSQL JSONB in PCN/DDT, Prisma in LABFTEE, Node test runner.

**Spec:** `design.md` section 0.2.1 and section 7.6.

## Global Constraints

- PCN is the source of truth for PYC, lot, sample and route identity.
- Activity attribution uses `initiatedBy` from the authenticated PCN session, never browser-provided identity.
- No password, token, secret or credential may enter the integration payload or activity snapshot.
- Duplicate delivery must not create duplicate remote activity records.
- DDT and LABFTEE retain their existing activity schemas through app-specific adapters.

---

### Task 1: Define and test the portable actor snapshot contract

**Files:**
- Modify: `design.md: section 0.2.1 and integration contract section`
- Modify: `utils/pcnLabIntegration.ts`
- Test: `test/pcn-lab-integration.test.ts`

**Interfaces:**
- Produces `PcnIntegrationActorSnapshot` and `PcnLabDispatchPayload.initiatedBy`.
- `buildPcnLabDispatchPayload` accepts an optional server-derived actor snapshot and strips empty fields.

- [ ] **Step 1: Update the design source of truth**

Document that `initiatedBy` is a signed, immutable PCN actor snapshot, that remote activity must use the snapshot as display attribution, and that the receiving/system integration actor remains separate.

- [ ] **Step 2: Write failing tests**

Add tests for inclusion of `username`, `name`, `role`, and `position`; rejection of an actor without username/name; and absence of credential-like fields from the serialized payload.

- [ ] **Step 3: Run the focused test and verify the expected failure**

Run `npm test -- --test-name-pattern="actor|initiatedBy" test/pcn-lab-integration.test.ts`.

Expected: the new assertions fail because the payload has no `initiatedBy` support.

- [ ] **Step 4: Implement the minimal PCN contract change**

Add the portable actor type, validate required identity fields, and include only non-empty portable fields in the root payload.

- [ ] **Step 5: Run the focused test and verify it passes**

Run `npm test -- --test-name-pattern="actor|initiatedBy" test/pcn-lab-integration.test.ts`.

Expected: all actor contract tests pass.

### Task 2: Bind the actor snapshot to authenticated PCN dispatch

**Files:**
- Modify: `server.ts: POST /api/pcn/lab-requests/:requestId/dispatch`
- Modify: `utils/pcnLabIntegration.ts`
- Test: `test/pcn-lab-integration.test.ts` or the existing dispatch route contract test

**Interfaces:**
- `PcnLabDispatchInput.initiatedBy` is populated only from `getPcnSessionUser(req)`.
- Existing PCN activity continues to record the authenticated PCN actor locally.

- [ ] **Step 1: Write a failing route-contract assertion**

Assert that a dispatch built from the authenticated user produces `initiatedBy.username === 'luongxuanhung'` and does not use a request-body actor.

- [ ] **Step 2: Run the route test and verify it fails for the missing field**

Run the focused dispatch test command and confirm the payload does not yet contain the authenticated actor.

- [ ] **Step 3: Pass the server-derived snapshot into the payload builder**

Map only username, name, role, and position from `getPcnSessionUser(req)` and pass it through the existing dispatch transaction. Never read actor identity from `req.body`.

- [ ] **Step 4: Run the focused PCN integration suite**

Run `npm test -- test/pcn-lab-integration.test.ts test/pcn-lab-operations.test.ts test/pcn-sample-flow.test.ts test/pcn-lab-request-ui.test.ts`.

Expected: all focused PCN integration tests pass.

### Task 3: Add DDT ingress validation and idempotent activity attribution

**Files:**
- Modify: `E:\CODING\DDT_webapp\utils\pcnLabIntegration.ts`
- Modify: `E:\CODING\DDT_webapp\server.ts`
- Modify: `E:\CODING\DDT_webapp\utils\activityLog.ts` only if its adapter needs a typed external actor
- Test: DDT PCN integration/contract tests

**Interfaces:**
- DDT accepts `payload.initiatedBy` and preserves the snapshot in its received PYC envelope.
- DDT writes one activity record using its existing `ActivityLog` schema, with `userId`/`userName` from the snapshot and a deterministic id such as `pcn-activity-${idempotencyKey}`.

- [ ] **Step 1: Add failing DDT contract/activity tests**

Test valid `initiatedBy`, invalid missing username/name, and duplicate ingress producing one activity row.

- [ ] **Step 2: Update the DDT validator and payload type**

Allow the root key, validate the portable fields, and include the normalized actor in the returned payload.

- [ ] **Step 3: Persist the snapshot and activity in the same transaction**

Use the existing JSONB document/activity transaction and current action/entity enums. Do not upsert a password-bearing user account; the activity record is sufficient for attribution.

- [ ] **Step 4: Run DDT integration tests and typecheck**

Run the DDT repository's focused PCN test command and `npm run typecheck`.

### Task 4: Add LABFTEE ingress validation and idempotent activity attribution

**Files:**
- Modify: `E:\CODING\LABFTEE_APP\server\integrations\pcn\contract.ts`
- Modify: `E:\CODING\LABFTEE_APP\server\integrations\pcn\service.ts`
- Modify: `E:\CODING\LABFTEE_APP\server\services\operationalCollectionsService.ts` only if a transaction-safe activity helper is required
- Test: LABFTEE PCN contract/service tests

**Interfaces:**
- LABFTEE accepts and stores `initiatedBy` in the envelope identity snapshot.
- LABFTEE creates one Prisma `activityLog` row with `userId`, `userName`, `userRole`, and optional `userPosition` from the snapshot; duplicate delivery returns the existing envelope and does not create another activity.

- [ ] **Step 1: Add failing LABFTEE contract/service tests**

Cover valid actor parsing, rejection of malformed actor input, stored identity snapshot, and idempotent activity creation.

- [ ] **Step 2: Update the strict validator**

Add the root key and validate only the actor fields allowed by the portable contract.

- [ ] **Step 3: Add the transaction-local activity adapter**

Create an activity record after the request/envelope records are created, using a deterministic id based on `sourceSystem`, `messageId`, and route identity.

- [ ] **Step 4: Run LABFTEE PCN tests and typecheck**

Run the focused test command and `npm run typecheck` in the LABFTEE repository.

### Task 5: Verify the cross-app contract and document deployment order

**Files:**
- Modify: `design.md` if verification reveals a contract detail not documented
- Test: PCN, DDT, and LABFTEE focused integration suites

- [ ] **Step 1: Verify payload signing and strict validation end to end**

Generate a dispatch payload for `luongxuanhung`, sign it using the existing PCN HMAC boundary, and verify both receivers accept it with the same actor snapshot.

- [ ] **Step 2: Verify duplicate delivery**

Replay the same idempotency key and confirm each receiver has exactly one attributed activity entry.

- [ ] **Step 3: Run PCN build/lint and remote typechecks**

Run `npm run typecheck`, `npm run build`, and each remote app's focused checks; record any existing unrelated failure separately.

- [ ] **Step 4: Commit only the scoped files**

Review `git status --short`, preserve unrelated user changes, and commit the PCN and any authorized remote-repository changes with a focused message.
