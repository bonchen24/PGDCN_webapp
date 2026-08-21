<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch xử lý lỗi mất layer đồ thị Radimation ở production
-->

# Radimation Production Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Prevent production from displaying a partially rendered Radimation graph when one or more vector layers fail conversion.

**Architecture:** Extract the layer-completeness decision into a small, testable utility. The server will only publish a composite image when every expected vector layer converted successfully; otherwise the response will preserve all raw vectors so the browser compositor can retry consistently in the client runtime.

**Tech Stack:** TypeScript, React, Express, `tsx --test`, Vite, `emf-to-png`, `emf-converter`, `@resvg/resvg-js`.

## Global Constraints

- `design.md` remains the single source of truth; this fix changes runtime conversion fallback only and does not change schema or UI.
- Modified JS/TS/TSX files must retain the required Gemini header and filename footer.
- Do not modify `.env` or commit generated `dist` output.
- Follow TDD: the regression test must fail before production code is changed.

---

### Task 1: Add a failing regression test for incomplete vector composites

**Files:**
- Create: `test/radimation-layers.test.ts`
- Create: `utils/radimationLayers.ts`

**Interfaces:**
- Produces `isCompleteVectorComposite(expectedLayerCount: number, convertedLayerCount: number): boolean` for server/client boundary decisions.

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { isCompleteVectorComposite } from "../utils/radimationLayers";

test("rejects a composite when any vector layer was not converted", () => {
  assert.equal(isCompleteVectorComposite(4, 3), false);
});

test("accepts a composite only when every vector layer was converted", () => {
  assert.equal(isCompleteVectorComposite(4, 4), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test test/radimation-layers.test.ts`

Expected: FAIL because `utils/radimationLayers.ts` and `isCompleteVectorComposite` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function isCompleteVectorComposite(expectedLayerCount: number, convertedLayerCount: number): boolean {
  return expectedLayerCount > 0 && convertedLayerCount === expectedLayerCount;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx tsx --test test/radimation-layers.test.ts`

Expected: PASS.

### Task 2: Reject partial server composites and preserve a browser fallback

**Files:**
- Modify: `server.ts:924-1033`
- Modify: `components/EmcBepDien1VungNauForm.tsx:313-446`
- Modify: `test/radimation-layers.test.ts`

**Interfaces:**
- Consumes `isCompleteVectorComposite` from `utils/radimationLayers.ts`.
- Produces server behavior where `renderCompositeVectorLayers()` returns `null` if any expected vector entry fails conversion, allowing the existing `allVectors` response to reach the client fallback.
- Produces client behavior where raw vectors are attempted before accepting a server PNG for a graph that contains vector layers.

- [ ] **Step 1: Extend the failing test for the response-selection contract**

```ts
test("does not treat a server PNG as authoritative when raw vector layers are available", () => {
  assert.equal(isCompleteVectorComposite(3, 2), false);
});
```

- [ ] **Step 2: Run the focused test to verify it fails or exposes the missing contract**

Run: `npx tsx --test test/radimation-layers.test.ts`

Expected: The completeness assertion remains red until the shared utility is implemented and wired into the server conversion path.

- [ ] **Step 3: Implement one conversion outcome per vector entry**

Track `convertedLayerCount` and failed layer indexes inside `renderCompositeVectorLayers()`. Return `null` whenever `convertedLayerCount !== entries.length`; keep `allVectors` unchanged in the JSON response.

- [ ] **Step 4: Prefer a full browser composite for vector responses**

In `RadimationUploader`, when `result.allVectors` is non-empty, call `compositeVectorsInBrowser()` first. Use the server `images[field]`/`imageBase64` only when browser conversion returns `null`, so production does not silently display a partial native composite.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx tsx --test test/radimation-layers.test.ts` and `npm run lint`

Expected: PASS with no TypeScript errors.

### Task 3: Verify the production build path

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: Vite build succeeds; existing chunk-size warnings may remain.

- [ ] **Step 3: Inspect the final diff and generated-file status**

Run: `git diff -- server.ts components/EmcBepDien1VungNauForm.tsx utils/radimationLayers.ts test/radimation-layers.test.ts` and `git status --short`

Expected: Only the intended source/test files are changed; generated `dist` files are not included.

<!-- --- End of 2026-08-17-radimation-production-layers.md --- -->
