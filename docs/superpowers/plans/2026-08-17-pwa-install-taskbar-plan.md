<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch triển khai cài webapp PWA và icon taskbar cho DDT Lab
-->

# PWA Install & Taskbar Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho DDT Lab có thể cài thành webapp từ Chrome/Edge, có nút `Cài webapp` dự phòng trong giao diện và dùng logo TVCI làm icon taskbar.

**Architecture:** Dùng Web App Manifest làm hợp đồng nhận diện, các PNG logo chuẩn trong `public/icons/`, service worker đã có để đáp ứng điều kiện PWA và nút cài đặt hiện tại trong `App.tsx` được chuẩn hóa copy/fallback. Entry HTML chỉ đăng ký service worker, không hủy đăng ký hoặc xóa cache.

**Tech Stack:** React 18, TypeScript, Vite, Web App Manifest, Service Worker, Node test runner (`tsx --test`), PowerShell/.NET image conversion.

## Global Constraints

- Dùng nhãn `Cài webapp` hoặc `Cài đặt webapp`; không dùng `Download` trong UI.
- Manifest phải khai báo `id`, `scope`, `start_url`, `display: standalone`, `theme_color`, `background_color` và icon PNG `192x192`/`512x512`.
- Icon phải khai báo `purpose: any maskable` và giữ logo TVCI hiện có.
- Không unregister service worker hoặc xóa cache trong `index.html`.
- Lỗi PWA không được chặn render hoặc dữ liệu nghiệp vụ.
- Mọi file JS/TS/TSX/Markdown tạo hoặc sửa phải giữ header/footer theo `AGENTS.md`.
- Không sửa `.env`, schema, API server hoặc dữ liệu nghiệp vụ.
- Workspace không phải Git repository; không thực hiện bước commit và không giả định có lịch sử Git.

---

## File Map

- Create: `test/pwa-installability.test.ts` — contract tests cho manifest, icon, service worker registration và UI copy.
- Create: `public/icons/tvci-icon-32.png` — favicon nhỏ từ logo TVCI.
- Create: `public/icons/tvci-icon-192.png` — icon PWA 192px.
- Create: `public/icons/tvci-icon-512.png` — icon PWA 512px/taskbar.
- Modify: `public/manifest.json` — metadata cài webapp và icon paths.
- Modify: `public/sw.js` — cache version/assets để icon và manifest có sẵn khi offline.
- Modify: `index.html` — đăng ký service worker, cập nhật favicon/metadata, bỏ cleanup phá điều kiện PWA.
- Modify: `App.tsx` — copy `Cài webapp`, xử lý `appinstalled`, fallback và responsive action.
- Existing verification: `design.md`, `docs/superpowers/specs/2026-08-17-pwa-install-taskbar-design.md` — không thay đổi thêm trong implementation trừ khi test phát hiện hợp đồng lệch.

### Task 1: Add failing PWA contract tests

**Files:**
- Create: `test/pwa-installability.test.ts`

**Interfaces:**
- Consumes: `public/manifest.json`, `public/index.html` at build time (source `index.html` in repo), `App.tsx`, and icon files.
- Produces: four regression tests that fail before the PWA changes and pass after them.

- [ ] **Step 1: Write the failing tests**

```typescript
// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for PWA installability and taskbar identity

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const toProjectPath = (file: string) => {
  const normalized = file.replace(/^[/\\]+/, '');
  return resolve(root, file.startsWith('/') ? 'public' : '', normalized);
};
const read = (file: string) => readFileSync(toProjectPath(file), 'utf8');

const readPngDimensions = (file: string) => {
  const buffer = readFileSync(toProjectPath(file));
  assert.equal(buffer.readUInt32BE(0), 0x89504e47);
  assert.equal(buffer.readUInt32BE(4), 0x0d0a1a0a);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

test('manifest exposes valid installable taskbar icons', () => {
  const manifest = JSON.parse(read('public/manifest.json')) as {
    id: string;
    scope: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };

  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');

  for (const expected of [192, 512]) {
    const icon = manifest.icons.find((candidate) => candidate.sizes === `${expected}x${expected}`);
    assert.ok(icon, `missing ${expected}px manifest icon`);
    assert.equal(icon.type, 'image/png');
    assert.match(icon.purpose ?? '', /maskable/);
    assert.deepEqual(readPngDimensions(icon.src), { width: expected, height: expected });
  }
});

test('entry HTML registers the service worker without destructive cleanup', () => {
  const html = read('index.html');
  assert.match(html, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/);
  assert.doesNotMatch(html, /registration\.unregister\(\)/);
  assert.doesNotMatch(html, /caches\.keys\(\)/);
  assert.match(html, /rel="manifest"/);
});

test('install UI uses Cài webapp copy and handles appinstalled', () => {
  const source = read('App.tsx');
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /appinstalled/);
  assert.match(source, /Cài webapp/);
  assert.doesNotMatch(source, />\s*Download\s*</);
  assert.match(source, /deferredPrompt/);
});

test('service worker pre-caches the PWA identity assets', () => {
  const source = read('public/sw.js');
  assert.match(source, /CACHE_NAME\s*=\s*['"]ddt-lab-pwa-v3['"]/);
  assert.match(source, /\/manifest\.json/);
  assert.match(source, /\/icons\/tvci-icon-192\.png/);
  assert.match(source, /\/icons\/tvci-icon-512\.png/);
});

// --- End of pwa-installability.test.ts ---
```

- [ ] **Step 2: Run the new tests and verify the expected red state**

Run: `npx tsx --test test/pwa-installability.test.ts`

Expected: FAIL because the manifest still points to the JPEG, the PNG files do not exist, `index.html` unregisters the service worker, `App.tsx` does not yet expose `Cài webapp`, and `sw.js` is still on cache version `v2`.

### Task 2: Create PNG assets and update manifest

**Files:**
- Create: `public/icons/tvci-icon-32.png`
- Create: `public/icons/tvci-icon-192.png`
- Create: `public/icons/tvci-icon-512.png`
- Modify: `public/manifest.json`
- Test: `test/pwa-installability.test.ts`

**Interfaces:**
- Consumes: `public/tvci_logo.jpg`.
- Produces: root-relative PNG paths `/icons/tvci-icon-32.png`, `/icons/tvci-icon-192.png`, `/icons/tvci-icon-512.png` and manifest metadata consumed by Chrome/Edge.

- [ ] **Step 1: Convert the existing TVCI logo to exact-size PNG files**

Use a local image converter available on Windows (for example `magick`) to create square canvas images from `public/tvci_logo.jpg`, preserving the logo and adding transparent or white padding as needed. Verify the output dimensions with the test helper or an image metadata command. Do not download a new logo or change the source JPEG.

- [ ] **Step 2: Update the manifest to the installable contract**

Keep the existing manifest comment metadata and set the fields as follows:

```json
{
  "name": "PTN Điện - Điện tử | TVCI Lab",
  "short_name": "PTN Điện - Điện tử",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#ffffff",
  "theme_color": "#059669",
  "icons": [
    { "src": "/icons/tvci-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/tvci-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: Run the manifest test and verify it passes**

Run: `npx tsx --test test/pwa-installability.test.ts --test-name-pattern "manifest exposes valid installable taskbar icons"`

Expected: PASS for the manifest/icon test; the remaining tests stay red.

### Task 3: Enable service worker registration and cache PWA assets

**Files:**
- Modify: `index.html`
- Modify: `public/sw.js`
- Test: `test/pwa-installability.test.ts`

**Interfaces:**
- Consumes: manifest icon paths from Task 2.
- Produces: one non-destructive service worker registration at `/sw.js` and cache version `ddt-lab-pwa-v3`.

- [ ] **Step 1: Remove the destructive cleanup from `index.html`**

Delete the inline calls to `navigator.serviceWorker.getRegistrations()`, `registration.unregister()`, `caches.keys()` and `caches.delete()`. Keep the manifest link and add or retain:

```html
<link rel="icon" type="image/png" sizes="32x32" href="/icons/tvci-icon-32.png">
<link rel="apple-touch-icon" sizes="192x192" href="/icons/tvci-icon-192.png">
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
</script>
```

- [ ] **Step 2: Bump the service worker cache and pre-cache identity assets**

Change `CACHE_NAME` to `ddt-lab-pwa-v3` and add these entries to `ASSETS_TO_CACHE`:

```typescript
'/icons/tvci-icon-32.png',
'/icons/tvci-icon-192.png',
'/icons/tvci-icon-512.png'
```

Keep the current navigation fallback and `clients.claim()` behavior.

- [ ] **Step 3: Run the HTML/service-worker tests and verify they pass**

Run: `npx tsx --test test/pwa-installability.test.ts --test-name-pattern "entry HTML registers|service worker pre-caches"`

Expected: PASS for registration and service-worker asset tests; the UI test remains red until Task 4.

### Task 4: Normalize the in-app `Cài webapp` fallback

**Files:**
- Modify: `App.tsx`
- Test: `test/pwa-installability.test.ts`

**Interfaces:**
- Consumes: `beforeinstallprompt` and existing `deferredPrompt` state.
- Produces: UI copy `Cài webapp`, `appinstalled` cleanup, standalone-aware visibility and manual-install fallback without changing business state.

- [ ] **Step 1: Run the existing UI contract as the red check**

Run: `npx tsx --test test/pwa-installability.test.ts --test-name-pattern "install UI"`

Expected: FAIL because `App.tsx` does not yet contain the `appinstalled` cleanup handler or the exact `Cài webapp` label.

- [ ] **Step 2: Add `appinstalled` cleanup to the install effect**

Register a handler beside the existing `beforeinstallprompt` listener:

```typescript
const handleAppInstalled = () => {
  setShowInstallBtn(false);
  setDeferredPrompt(null);
};

window.addEventListener('appinstalled', handleAppInstalled);

return () => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
};
```

Preserve the existing standalone check so installed app mode does not show the button.

- [ ] **Step 3: Update install copy and responsive action styling**

Use this user-facing behavior in `handleInstallApp` and the button:

```tsx
toast.info('Để cài webapp, hãy chọn biểu tượng cài đặt trên thanh địa chỉ hoặc chọn “Thêm vào màn hình chính” từ menu trình duyệt.', { duration: 6000 });
```

```tsx
<button
  onClick={handleInstallApp}
  className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-indigo-100 shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0"
  title="Cài webapp"
>
  <Download size={12} />
  <span className="hidden md:inline">Cài webapp</span>
</button>
```

Keep the existing `beforeinstallprompt` `preventDefault()`, `prompt()`, `userChoice`, accepted-state hiding and nulling of `deferredPrompt`.

- [ ] **Step 4: Run the UI contract test and verify it passes**

Run: `npx tsx --test test/pwa-installability.test.ts --test-name-pattern "install UI"`

Expected: PASS with no `Download` label match.

### Task 5: Run full verification

**Files:**
- Verify: `test/pwa-installability.test.ts`, `public/manifest.json`, `public/sw.js`, `index.html`, `App.tsx`, generated `public/icons/*.png`.

**Interfaces:**
- Consumes: all completed changes from Tasks 1–4.
- Produces: evidence that the complete PWA install contract, existing regression suite, TypeScript validation and production build all pass.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all existing tests plus the four PWA contract tests pass with zero failures.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm run lint`

Expected: `tsc --noEmit` exits with code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite build exits with code 0 and emits `dist/manifest.json`, `dist/sw.js` and `dist/icons/tvci-icon-192.png`/`tvci-icon-512.png`.

- [ ] **Step 4: Run diff and requirement checks**

Run: `rg -n "Download|unregister\(\)|caches\.keys\(\)|Cài webapp|serviceWorker\.register|tvci-icon-(192|512)" App.tsx index.html public/manifest.json public/sw.js`

Expected: `Cài webapp`, service worker registration and icon paths are present; no UI `Download`, unregister or cache-deletion startup code remains.

- [ ] **Step 5: Perform the manual browser acceptance check**

Serve the production output over `localhost` or HTTPS, open it in Chrome, confirm the install icon appears in the address bar, choose `Cài webapp` if needed, and verify the installed shortcut/taskbar icon uses the TVCI logo and launches standalone.

<!-- --- End of 2026-08-17-pwa-install-taskbar-plan.md --- -->
