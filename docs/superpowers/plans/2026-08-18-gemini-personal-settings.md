# Gemini Personal Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Gemini model discovery and selection from the admin-only System Settings page into each authenticated user's Personal Settings, while preserving compatibility with the legacy system model.

**Architecture:** `userPreferences[canonicalUsername].geminiModel` becomes the per-user source of truth. A shared resolver returns the personal value when the field exists, falls back to legacy `settings.geminiModel` for users who have not configured a personal value, and otherwise lets the server choose. The Gemini model picker and Google discovery action live only in `UserSettingsModal`.

**Tech Stack:** React, Zustand, TypeScript, PostgreSQL REST document persistence, Node test runner with `tsx`, Vite.

**Spec:** `design.md`

## Global Constraints

- PostgreSQL remains the runtime persistence source; `userPreferences` is stored through the existing `updateUserPreferences` flow.
- `GET /api/gemini/models` runs only after the user explicitly clicks **Kiểm tra Google**.
- Existing `AppSettings.geminiModel` data is not deleted; it is read only as a compatibility fallback.
- New or modified TypeScript/TSX files retain the required Gemini header/footer format.
- No `.env` changes and no new dependencies.

---

### Task 1: Add the canonical personal-model resolver

**Files:**
- Create: `utils/geminiSettings.ts`
- Modify: `types.ts:374-379`
- Test: `test/gemini-personal-settings.test.ts`

**Interfaces:**
- Produces `resolveGeminiModel(state): string | undefined`.
- `state.currentUser` may be null; `state.userPreferences` is keyed by normalized username; `state.settings.geminiModel` is the legacy fallback.

- [ ] **Step 1: Write the failing tests**

```typescript
test('prefers a personal Gemini model over the legacy system model', () => {
  assert.equal(resolveGeminiModel({
    currentUser: { username: 'tester' },
    userPreferences: { tester: { geminiModel: 'gemini-2.5-pro' } },
    settings: { geminiModel: 'gemini-1.5-flash' }
  }), 'gemini-2.5-pro');
});

test('preserves automatic mode when a user explicitly saves an empty model', () => {
  assert.equal(resolveGeminiModel({
    currentUser: { username: 'tester' },
    userPreferences: { tester: { geminiModel: '' } },
    settings: { geminiModel: 'gemini-1.5-flash' }
  }), undefined);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; npm test -- test/gemini-personal-settings.test.ts
```

Expected: FAIL because `utils/geminiSettings.ts` and `resolveGeminiModel` do not exist yet.

- [ ] **Step 3: Implement the minimal resolver and type field**

Add `geminiModel?: string` to `UserPreferences`. Implement `resolveGeminiModel` with an own-property check so an explicit empty personal value means automatic mode instead of falling back to the legacy system model.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command and expect both resolver tests to pass.

### Task 2: Move Gemini discovery and selection into Personal Settings

**Files:**
- Modify: `components/UserSettingsModal.tsx`
- Modify: `components/SystemManagementViews.tsx`
- Modify: `test/gemini-settings.test.ts`
- Test: `test/gemini-personal-settings.test.ts`

**Interfaces:**
- `UserSettingsModal` reads `geminiModel` and `geminiApiKey` from the current user's preference record.
- Saving calls `updateUserPreferences(currentUser.username, { ..., geminiModel })`.
- System Settings no longer owns `availableGeminiModels`, `fetchGoogleGeminiModels`, or the Gemini selector.

- [ ] **Step 1: Update UI contract tests before production changes**

Assert that `UserSettingsModal.tsx` contains the explicit Google discovery handler, the model select, and `geminiModel` in its save payload. Change `test/gemini-settings.test.ts` to assert that `SystemManagementViews.tsx` does not contain the Gemini picker or `fetchGoogleGeminiModels`.

- [ ] **Step 2: Run UI contract tests and verify RED**

Run:

```powershell
$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; npm test -- test/gemini-settings.test.ts test/gemini-personal-settings.test.ts
```

Expected: FAIL because the selector still belongs to System Settings and Personal Settings has no model control.

- [ ] **Step 3: Implement the Personal Settings UI**

Add model state, explicit model discovery, loading/error/status state, and the same fallback model options to `UserSettingsModal`. Load the legacy system model only when the personal preference field is absent. Save an empty value as explicit automatic mode.

- [ ] **Step 4: Remove the admin-only model UI**

Delete the Gemini state, fetch handler, JSX card, and admin authorization checks from `SystemSettingsView`; retain unrelated weekend, tester, backup, restore, and user-management settings.

- [ ] **Step 5: Run UI contract tests and verify GREEN**

Run the focused command again and expect all personal-settings and system-settings contract tests to pass.

### Task 3: Apply personal model selection to every Gemini caller

**Files:**
- Modify: `utils/gemini.ts`
- Modify: `components/AIChatBot.tsx`
- Modify: `components/EmcBepDien1VungNauForm.tsx`
- Modify: `components/ReportGeneratorView.tsx`
- Test: `test/gemini-personal-settings.test.ts`

**Interfaces:**
- `utils/gemini.ts` uses `resolveGeminiModel` for extraction headers.
- Direct Gemini callers use the same resolver rather than reading `state.settings.geminiModel` directly.

- [ ] **Step 1: Add failing caller contract assertions**

Assert that the shared helper and each direct caller use `resolveGeminiModel` instead of `state.settings?.geminiModel` for the outgoing `x-gemini-model` header.

- [ ] **Step 2: Run the focused tests and verify RED**

Run the focused Gemini test command and expect the direct-caller assertions to fail against the current global-only reads.

- [ ] **Step 3: Implement shared model resolution**

Update `utils/gemini.ts` and the direct callers to resolve the current user's model first, preserving existing API-key behavior and server fallback behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the focused Gemini tests and expect all resolver and caller assertions to pass.

### Task 4: Full verification and handoff

**Files:**
- Verify: `design.md`, `docs/superpowers/plans/2026-08-18-gemini-personal-settings.md`, all files above.

- [ ] **Step 1: Run the full test suite**

```powershell
$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; npm test
```

- [ ] **Step 2: Run typecheck and production build**

```powershell
npm run lint
npm run build
```

- [ ] **Step 3: Inspect the final contract**

Confirm there is no Gemini selector or model discovery handler left in `SystemManagementViews.tsx`, all AI callers use personal-first resolution, and the required file headers/footers remain intact.

The workspace has no `.git` metadata, so no commit or branch integration command is performed here.

<!-- --- End of 2026-08-18-gemini-personal-settings.md --- -->
