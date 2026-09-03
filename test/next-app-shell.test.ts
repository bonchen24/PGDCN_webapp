import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Next App Router exposes the shared PGDCN shell at the root route', () => {
  const layout = read('app/layout.tsx');
  const page = read('app/page.tsx');
  const shell = read('components/PcnAppShell.tsx');
  const nextConfig = read('next.config.mjs');

  assert.match(layout, /metadata/);
  assert.match(layout, /Phòng Chứng nhận/);
  assert.match(layout, /manifest.*manifest\.json|manifest:.*manifest\.json/s);
  assert.match(page, /PcnAppShell/);
  assert.match(shell, /^['"]use client['"]/m);
  assert.match(shell, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/);
  assert.match(shell, /PgdcnAppShell/);
  assert.match(shell, /initialDomain="PCN"/);
  assert.doesNotMatch(shell, /from ['"]\.\.\/App['"]/);
  assert.match(nextConfig, /reactStrictMode/);
});

// --- End of next-app-shell.test.ts ---
