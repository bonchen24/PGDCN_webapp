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
    orientation: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };

  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait');

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

test('entry HTML lets the Vite entry own global CSS loading', () => {
  const html = read('index.html');
  const entry = read('index.tsx');
  assert.match(entry, /import ['"]\.\/index\.css['"]/);
  assert.doesNotMatch(html, /<link rel="stylesheet" href="\/index\.css">/);
});

test('PWA lifecycle remains while the header install button is hidden', () => {
  const source = read('App.tsx');
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /appinstalled/);
  assert.match(source, /deferredPrompt/);
  assert.doesNotMatch(source, /title="Cài webapp"/);
  assert.doesNotMatch(source, /<span className="hidden md:inline">Cài webapp<\/span>/);
});

test('standalone PWA requests portrait orientation when supported', () => {
  const source = read('App.tsx');
  assert.match(source, /pointer:\s*coarse/);
  assert.match(source, /screen\.orientation/);
  assert.match(source, /if \(isTouchDevice && typeof orientation\.lock === 'function'\)/);
  assert.match(source, /orientation\.lock\(['"]portrait['"]\)/);
});

test('service worker pre-caches the PWA identity assets', () => {
  const source = read('public/sw.js');
  assert.match(source, /CACHE_NAME\s*=\s*['"]ddt-lab-pwa-v4['"]/);
  assert.match(source, /\/manifest\.json/);
  assert.match(source, /\/icons\/tvci-icon-192\.png/);
  assert.match(source, /\/icons\/tvci-icon-512\.png/);
});

test('service worker handles failed non-navigation fetches without an unhandled rejection', () => {
  const source = read('public/sw.js');
  assert.match(source, /return cachedResponse \|\| fetch\(event\.request\)\.catch\(\(\) => Response\.error\(\)\)/);
});

// --- End of pwa-installability.test.ts ---
