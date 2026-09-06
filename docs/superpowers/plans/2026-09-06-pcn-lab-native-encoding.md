# PCN Lab-Native Encoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each connected testing app create PYC, lot, and sample codes with its own native encoding while preserving PCN crosswalk identity.

**Architecture:** PCN sends canonical identity plus `labCode`; DDT and LABFTEE allocate native codes inside their own database transactions. `EMC` and `ELECTRICAL_SAFETY` share target app `DDT` but select different native sample prefixes. ACK/callbacks carry native display codes and stable PCN item keys.

**Tech Stack:** TypeScript, Express, PostgreSQL JSON documents, Prisma (LABFTEE), Node test runner, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-06-pcn-lab-native-encoding-design.md`

## Global Constraints

- `design.md` is the single source of truth for PCN behavior and contract.
- Never overwrite `pcnNumber`, `lotCode`, or `sampleCode` with a PTN-native code.
- DDT is one target app for both `EMC` and `ELECTRICAL_SAFETY`; `labCode` remains branch-scoped.
- Allocation must be idempotent and transactionally serialized by the destination app.
- Do not expose secrets or raw payloads in persistence, logs, or tests.

---

### Task 1: Lock the PCN route-to-app contract

**Files:**
- Modify: `types.ts`
- Modify: `server.ts`
- Modify: `utils/pcnLabIntegration.ts`
- Modify: `.env.example`
- Test: `test/pcn-lab-integration.test.ts`

- [x] Add a failing test asserting `EMC` and `ELECTRICAL_SAFETY` resolve to target app `DDT`, while `route.labCode` remains unchanged in the payload.
- [x] Run the focused PCN test and confirm failure before implementation.
- [x] Add route-code/app-code separation in the integration config and outbound payload normalization.
- [x] Keep legacy config readable but normalize the documented config to `routeCode` plus `systemCode`.
- [x] Extend PCN integration link with optional `externalLotCode` and accept it from ACK.
- [x] Run the focused test and confirm it passes.

### Task 2: Allocate DDT-native encoding in one transaction

**Files:**
- Modify: `E:\CODING\DDT_webapp\utils\pcnLabIntegration.ts`
- Modify: `E:\CODING\DDT_webapp\server.ts`
- Modify: `E:\CODING\DDT_webapp\types.ts`
- Test: `E:\CODING\DDT_webapp\test\pcn-lab-integration.test.ts`

- [x] Add failing tests for DDT PYC `DDT-YYMMDD-TT`, year lot sequence, `EMC ...-M01`, and `ITD ...-M01`.
- [x] Run the focused DDT test and confirm failure before implementation.
- [x] Add a pure DDT encoding allocator input/output and a transaction-boundary query that serializes date/year sequences.
- [x] Persist PCN/native crosswalk in request `pcnIntegration` and envelope identity snapshot.
- [x] Return native request and lot codes in DDT ACK; use branch-scoped source codes in callbacks.
- [x] Run focused DDT tests and typecheck.

### Task 3: Allocate LABFTEE-native encoding in one transaction

**Files:**
- Modify: `E:\CODING\LABFTEE_APP\server\integrations\pcn\service.ts`
- Modify: `E:\CODING\LABFTEE_APP\server\integrations\pcn\contract.ts`
- Modify: `E:\CODING\LABFTEE_APP\prisma\schema.prisma`
- Create: `E:\CODING\LABFTEE_APP\prisma\migrations\20260906000000_pcn_lab_native_encoding\migration.sql`
- Test: `E:\CODING\LABFTEE_APP\test\pcn-integration.test.ts`

- [x] Add failing tests for `HS-YYMMDD-TT`, year lot sequence, `ECN ...-M01`, and native-code callback.
- [x] Run the focused test and confirm failure before implementation.
- [x] Add transaction-scoped allocation under an advisory lock and save native codes in Request plus identity snapshots.
- [x] Return native request and lot codes in LABFTEE ACK; use native request code in callbacks.
- [x] Keep the crosswalk in existing JSON identity snapshots; no schema migration is required.
- [x] Run focused tests and targeted typecheck/syntax verification. Full LABFTEE build remains blocked by a pre-existing report-template export error.

### Task 4: Verify cross-app behavior and production runtime

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-pcn-lab-native-encoding-design.md` only if verification exposes a contract correction.
- Test: PCN/DDT/LABFTEE focused integration suites.

- [x] Run PCN focused tests, DDT tests, LABFTEE tests, and all relevant typechecks/builds.
- [x] Rebuild/recreate the three Docker services without resetting any database volume.
- [x] Dispatch anonymized live EMC and PERFORMANCE fixtures, reconcile them, and verify native PYC/lot/sample identity; ITD is covered by the DDT allocator test.
- [x] Run `/api/health` on ports 2357, 2358, and 2359.
- [x] Run `git diff --check` and report unrelated pre-existing line-ending warnings separately.
