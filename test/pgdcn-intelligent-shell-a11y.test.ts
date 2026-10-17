import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const shell = fs.readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');

test('Ctrl/Cmd+K leaves editable controls alone and still opens the palette elsewhere', () => {
  const handler = shell.match(/const handleShortcut = \(event: KeyboardEvent\) => \{([\s\S]*?)\n    \};/)?.[1];
  assert.ok(handler, 'Expected the global keyboard shortcut handler');
  assert.match(handler, /event\.target instanceof HTMLElement/);
  assert.match(handler, /matches\('input, textarea, select'\)/);
  assert.match(handler, /\.isContentEditable/);
  assert.ok(handler.indexOf('return;') < handler.indexOf('event.preventDefault()'), 'Editable targets must return before Ctrl/Cmd+K is consumed');
  assert.match(handler, /if\s*\(\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*event\.key\.toLowerCase\(\)\s*===\s*'k'\)\s*\{\s*event\.preventDefault\(\);\s*setCommandOpen\(true\);/);
});

test('the keyboard skip link focuses the main content target', () => {
  assert.match(shell, /<a href="#pgdcn-main-content"[^>]*>\s*Bỏ qua điều hướng đến nội dung chính\s*<\/a>/);
  const main = shell.match(/<main\b[^>]*>/)?.[0];
  assert.ok(main, 'Expected a main content landmark');
  assert.match(main, /id="pgdcn-main-content"/);
  assert.match(main, /tabIndex=\{-1\}/);
  assert.doesNotMatch(main, /aria-live=/);
});

test('the live announcement is limited to the active navigation context', () => {
  assert.match(shell, /<span className="sr-only" aria-live="polite" aria-atomic="true">\{getActiveContextLabel\(activeTarget\)\}<\/span>/);
});
