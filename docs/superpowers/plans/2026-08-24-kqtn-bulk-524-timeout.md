# KQTN Bulk 524 Timeout Mitigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent KQTN combined-PDF structure extraction from exceeding the reverse-proxy timeout and make timeout fallback deterministic.

**Architecture:** Keep the existing synchronous Gemini endpoint, but give bulk structure extraction a bounded Gemini client configuration: one selected model, no SDK retries, and a request timeout below the proxy budget. Reduce browser batches to two pages and treat timeout responses as an immediate manual-split condition instead of launching more expensive page retries.

**Tech Stack:** TypeScript, Express, `@google/genai`, React, Node test runner, `pdf-lib`.

**Spec:** `design.md` sections 7.3 and 11.2.

## Global Constraints

- `design.md` remains the single source of truth.
- Bulk PDF structure detection is best-effort; timeout or invalid AI output must not auto-upload a mapping.
- Existing uncommitted user changes must be preserved.
- No `.env` changes.

### Task 1: Document and lock the timeout contract

**Files:**
- Modify: `design.md:605-650`
- Modify: `test/kqtn-pdf-api-contract.test.ts`
- Modify: `test/kqtn-ui-contract.test.ts`

- [x] Add the design rule that bulk structure requests are bounded and timeout into manual split.
- [x] Add failing contract assertions for bounded server settings, explicit timeout response handling, two-page batches, and timeout-specific UI fallback.
- [x] Run the focused tests and confirm they fail because the new contract is absent.

### Task 2: Bound server-side Gemini extraction

**Files:**
- Modify: `server.ts:252-406,1557-1641`

- [x] Add an optional Gemini client timeout without changing defaults for unrelated AI endpoints.
- [x] Configure bulk structure extraction for a 45-second request timeout, no wrapper retry, and one selected model attempt.
- [x] Return HTTP 504 with a stable error code when the Gemini request times out.
- [x] Run the focused contract tests and typecheck.

### Task 3: Reduce client amplification of timeout failures

**Files:**
- Modify: `components/KqtnBulkPdfUploadModal.tsx:27-320`
- Modify: `utils/kqtnPdfClient.ts:9-63`

- [x] Set structure batch size to two pages.
- [x] Recognize 504/524 as a structure timeout and skip page-by-page retries for that failure class.
- [x] Preserve page-level retry for fast non-timeout extraction failures and keep manual split as the safe fallback.
- [x] Run focused tests, full tests, typecheck, and production build.

### Task 4: Review the final diff

- [x] Run `git diff --check`.
- [x] Confirm only the documented timeout mitigation files changed beyond the plan and the pre-existing user edits remain intact.
