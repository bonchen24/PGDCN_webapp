import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('PGDCN viewport keeps zoom available and global CSS handles motion/focus', () => {
  assert.doesNotMatch(read('../app/layout.tsx'), /maximumScale/);
  const css = read('../index.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});

test('audited surfaces keep the official icon and visual direction', () => {
  assert.doesNotMatch(read('../components/PgdcnAppShell.tsx'), />\u2630</);
  for (const path of ['../components/PcnLoginScreen.tsx', '../components/PgdLoginScreen.tsx', '../components/LoginScreen.tsx']) {
    const source = read(path);
    assert.match(source, /focus-visible/);
    assert.doesNotMatch(source, /radial-gradient|backdrop-blur/);
  }
});

test('Vietnamese-safe typography remains explicit in the global stack', () => {
  const css = read('../index.css');
  assert.match(css, /Roboto/);
  assert.match(css, /Segoe UI|Arial|sans-serif/);
});
