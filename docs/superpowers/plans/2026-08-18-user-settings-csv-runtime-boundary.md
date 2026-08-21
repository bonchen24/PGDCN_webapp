<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch triển khai loại bỏ tên hiển thị cá nhân và tách preload CSV khỏi đồng bộ PostgreSQL
-->

# User Settings and CSV Runtime Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ thiết lập tên hiển thị cá nhân, giữ danh sách `systemUsers` lấy từ PostgreSQL và chỉ preload CSV danh mục một lần lúc khởi tạo mà không tự ghi seed CSV vào DB.

**Architecture:** Startup của `App` gọi hàm preload idempotent trong store trước lần đồng bộ đầu tiên. Store lưu snapshot các bản ghi danh mục được preload từ CSV để `syncTwoWay()` có thể bỏ qua các bản ghi seed chưa chỉnh sửa khi tính batch ghi, nhưng vẫn ghi các danh mục mới hoặc đã thay đổi. Luồng người dùng tiếp tục đọc collection `systemUsers` và không phụ thuộc CSV.

**Tech Stack:** React 18, TypeScript, Zustand, Node test runner qua `tsx`, REST PostgreSQL API.

**Spec:** `docs/superpowers/specs/2026-08-18-user-settings-csv-runtime-boundary-design.md` và `design.md`.

## Global Constraints

- `design.md` là nguồn sự thật duy nhất cho kiến trúc, dữ liệu và UI/UX của dự án.
- `UserPreferences` không đọc, ghi hoặc dùng `displayName`; dữ liệu legacy có thể tồn tại trong JSONB.
- `systemUsers` trong Thiết lập hệ thống là collection runtime đọc từ PostgreSQL; CSV không tham gia tài khoản.
- `brands.csv`, `products.csv`, `customers.csv` chỉ được đọc trong startup preload; dữ liệu seed CSV chưa chỉnh sửa không được tự động ghi PostgreSQL.
- Mọi file JS/TS/TSX/Markdown được sửa phải giữ header/footer bắt buộc của repo.

---

### Task 1: Add failing regression contracts

**Files:**
- Modify: `test/user-identity.test.ts`
- Create: `test/user-settings-csv-runtime-boundary.test.ts`
- Test: `test/user-identity.test.ts`, `test/user-settings-csv-runtime-boundary.test.ts`

**Interfaces:**
- Consumes: current source contracts in `components/UserSettingsModal.tsx`, `store.ts`, `App.tsx`, `utils/userIdentity.ts`.
- Produces: executable requirements proving the personal settings UI/persistence no longer supports `displayName`, startup owns CSV loading, sync owns no CSV loading, and `systemUsers` is fetched from PostgreSQL.

- [ ] **Step 1: Remove obsolete display-name expectations from the identity test**

Delete the `getUserDisplayName` import and the two tests that assert persisted display-name behavior. Keep the canonical-key and alias lookup tests because password/API-key preference lookup still uses those helpers.

- [ ] **Step 2: Write the failing source contracts**

Create `test/user-settings-csv-runtime-boundary.test.ts` with this test structure:

```typescript
// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for personal identity and CSV/PostgreSQL boundaries

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const modal = read('components/UserSettingsModal.tsx');
const store = read('store.ts');
const app = read('App.tsx');

test('personal settings no longer expose or persist a display name', () => {
  assert.doesNotMatch(modal, /setDisplayName|displayName:\s*displayName|Tên hiển thị/);
  assert.doesNotMatch(store, /prefs\.displayName|userPreferences\[['"]admin['"]\]\?\.displayName/);
});

test('system users are read from PostgreSQL and rendered from store state', () => {
  assert.match(store, /fetchCollection\("systemUsers", true\)/);
  assert.match(read('components/SettingsModal.tsx'), /systemUsers\.map/);
});

test('CSV preload is owned by startup and is not part of two-way sync', () => {
  assert.match(store, /preloadCsvCatalogs/);
  assert.match(app, /preloadCsvCatalogs/);
  assert.doesNotMatch(store, /syncTwoWay[\s\S]*loadCSVFallback/);
});

test('CSV seed rows are excluded from catalog write batches until changed', () => {
  assert.match(store, /csvCatalogBaseline/);
  assert.match(store, /filterCatalogWrites|shouldPersistCatalog/);
});

// --- End of user-settings-csv-runtime-boundary.test.ts ---
```

- [ ] **Step 3: Run the focused tests and verify the expected red state**

Run:

```powershell
npm test -- test/user-identity.test.ts test/user-settings-csv-runtime-boundary.test.ts
```

Expected: FAIL because production still contains `displayName`, `syncTwoWay()` still calls `loadCSVFallback()`, and the startup preload method/baseline helper do not yet exist. Do not change production code before this failure is observed.

---

### Task 2: Remove personal display-name behavior

**Files:**
- Modify: `components/UserSettingsModal.tsx`
- Modify: `store.ts`
- Modify: `types.ts`
- Modify: `utils/userIdentity.ts`
- Modify: `test/user-identity.test.ts`
- Test: `test/user-settings-csv-runtime-boundary.test.ts`, `test/user-identity.test.ts`

**Interfaces:**
- Consumes: existing `UserPreferences` persistence and canonical user-key helpers.
- Produces: personal preference writes containing only password, Gemini and avatar fields; login identity always comes from `systemUsers` or the fixed fallback admin identity.

- [ ] **Step 1: Remove the display-name state and section from the modal**

Delete the `displayName` state, its initialization in `useEffect`, the entire “Tên hiển thị” JSX section, and the `displayName` property from the `updateUserPreferences` payload. Leave password, avatar, Gemini API key and model behavior unchanged.

- [ ] **Step 2: Remove display-name resolution from store login and sync**

Delete the `getUserDisplayName` import. In the fallback admin login, set `name: 'Admin'`. In regular login, construct `name` from the matching `systemUsers` row only. In `syncTwoWay()`, remove `persistedDisplayName` and stop rewriting `currentUser.name` from `userPreferences`.

- [ ] **Step 3: Remove the obsolete preference type/helper**

Remove `displayName?: string` from `UserPreferences` and remove `getUserDisplayName()` from `utils/userIdentity.ts`. Keep `findUserPreference()` because it is still needed for custom password and Gemini settings.

- [ ] **Step 4: Run the focused tests and typecheck**

Run:

```powershell
npm test -- test/user-identity.test.ts test/user-settings-csv-runtime-boundary.test.ts
npm run lint
```

Expected: the focused tests pass and TypeScript reports no references to the removed display-name API.

---

### Task 3: Extract idempotent startup CSV preload

**Files:**
- Modify: `store.ts`
- Modify: `App.tsx`
- Test: `test/user-settings-csv-runtime-boundary.test.ts`

**Interfaces:**
- Consumes: `loadCSVFallback()`, current local catalog state, and `getProductDefaultTime()`.
- Produces: exported store action `preloadCsvCatalogs(): Promise<void>` that fetches each needed CSV at most once per app module lifetime and updates only local Zustand state.

- [ ] **Step 1: Add the idempotent preload action and baseline state**

Add module-level state in `store.ts`:

```typescript
type CsvCatalogBaseline = {
  customers: Map<string, CustomerRef>;
  products: Map<string, ProductRef>;
  brands: Set<string>;
};

let csvPreloadPromise: Promise<void> | null = null;
let csvCatalogBaseline: CsvCatalogBaseline = {
  customers: new Map(),
  products: new Map(),
  brands: new Set()
};
```

Add `preloadCsvCatalogs` to `AppState` and the store object. It must:

1. Return the existing `csvPreloadPromise` if the action was already started.
2. Read only `/brands.csv`, `/products.csv` and `/customers.csv`.
3. Populate an empty local catalog only; do not call `saveDocToPostgres`, `batchSaveToPostgres`, `syncTwoWay` or any DB API.
4. Store normalized baseline snapshots for the rows it inserted.
5. Resolve even when a CSV request fails, logging the existing warning and allowing DB sync to continue.

- [ ] **Step 2: Move startup invocation into `App.tsx`**

Import/destructure `preloadCsvCatalogs` and change the initial effect to await preload before the initial `fetchData()` call:

```typescript
useEffect(() => {
  let cancelled = false;

  const initialize = async () => {
    await preloadCsvCatalogs();
    if (!cancelled) {
      await fetchData();
      setupRealtimeSync();
    }
  };

  void initialize();
  return () => { cancelled = true; };
}, []);
```

Keep the existing interval refresh behavior unchanged.

- [ ] **Step 3: Remove the module-bottom duplicate preload**

Delete the asynchronous CSV preload block at the end of `store.ts`. Keep the unrelated cleanup/normalization block that precedes it. After this step, only `preloadCsvCatalogs()` may call `loadCSVFallback()`.

- [ ] **Step 4: Run the source contracts**

Run:

```powershell
npm test -- test/user-settings-csv-runtime-boundary.test.ts
```

Expected: preload/startup contracts pass; the catalog write contract remains red until Task 4.

---

### Task 4: Prevent unchanged CSV seeds from entering DB write batches

**Files:**
- Modify: `store.ts`
- Modify: `test/user-settings-csv-runtime-boundary.test.ts`
- Test: `test/user-settings-csv-runtime-boundary.test.ts`

**Interfaces:**
- Consumes: `csvCatalogBaseline`, merged local/cloud catalogs, existing deleted-ID markers and CRUD sync queues.
- Produces: catalog write filtering that excludes unchanged CSV seed rows but retains new or edited rows and all explicit deletions.

- [ ] **Step 1: Add focused pure filtering tests**

Add tests for the intended cases:

```typescript
test('unchanged CSV catalog seeds are not selected for persistence', () => {
  const source = read('store.ts');
  assert.match(source, /csvCatalogBaseline/);
  assert.match(source, /customersToSave.*filter|filter.*customersToSave/);
  assert.match(source, /productsToSave.*filter|filter.*productsToSave/);
  assert.match(source, /brandsToSave.*filter|filter.*brandsToSave/);
});

test('catalog CRUD methods still trigger the existing DB sync path', () => {
  const source = read('store.ts');
  assert.match(source, /addCustomer:[\s\S]*syncWithCloud/);
  assert.match(source, /addProduct:[\s\S]*syncWithCloud/);
  assert.match(source, /addBrand:[\s\S]*syncWithCloud/);
});
```

- [ ] **Step 2: Filter customer and product write candidates against baseline**

When building `customersToSave` and the product equivalent, retain the current cloud/LWW condition, then add the no-cloud condition:

```typescript
const shouldPersistCsvAwareRecord = <T extends object>(
  record: T,
  key: string,
  cloudExists: boolean,
  baseline: Map<string, T>,
  normalize: (value: T) => unknown
) => cloudExists || !baseline.has(key) ||
  JSON.stringify(normalize(record)) !== JSON.stringify(normalize(baseline.get(key)!));
```

The normalizer must ignore transient `updatedAt`/`createdAt` values when comparing CSV seed content, while preserving business fields such as customer address, product test times and names. A manually edited CSV row therefore becomes a DB write candidate.

- [ ] **Step 3: Filter brand write candidates against baseline**

When constructing `brandsToSave`, skip names that are unchanged CSV baseline values and absent from cloud. Keep new names and names introduced by CRUD operations. Do not change the existing `deletedBrandNames` deletion loop.

- [ ] **Step 4: Remove CSV and `data.json` reads from `syncTwoWay()`**

Delete the CSV Promise block and the `data.json` fallback branches from the customer/product merge logic. The merge must use only current local state and fetched PostgreSQL collections. `loadCSVFallback()` must remain reachable only from startup preload.

- [ ] **Step 5: Run the focused regression suite**

Run:

```powershell
npm test -- test/user-settings-csv-runtime-boundary.test.ts test/user-identity.test.ts test/system-user-persistence.test.ts
```

Expected: all focused tests pass with no DB writes caused solely by unchanged CSV seeds.

---

### Task 5: Full verification and source audit

**Files:**
- Modify only files required by Tasks 1–4.
- Test: all existing tests and production build.

**Interfaces:**
- Consumes: completed implementation and regression contracts.
- Produces: verified working tree with no stale display-name runtime references and no CSV loading in sync.

- [ ] **Step 1: Run the complete test suite**

Run:

```powershell
npm test
```

Expected: exit code 0 and no failing tests.

- [ ] **Step 2: Run TypeScript and production build verification**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the static source audit**

Run:

```powershell
rg -n -S --glob '!node_modules/**' --glob '!dist/**' 'displayName|Tên hiển thị|loadCSVFallback|data\.json' components/UserSettingsModal.tsx store.ts App.tsx types.ts utils/userIdentity.ts
```

Expected: no personal display-name UI/runtime references; `loadCSVFallback` appears only in the startup preload definition/call path; no `data.json` catalog fallback remains in `syncTwoWay()`.

- [ ] **Step 4: Check formatting and changed-file headers/footers**

Run:

```powershell
git diff --check
```

If Git metadata is unavailable, inspect the changed files directly and report that the repository has no `.git` directory.

<!-- --- End of 2026-08-18-user-settings-csv-runtime-boundary.md --- -->
