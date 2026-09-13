import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sourcePath = new URL('../components/PgdcnWindowsWorkflowModal.tsx', import.meta.url);

test('shared intake modal exposes Windows window anatomy and accessibility contract', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  for (const marker of [
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby',
    'header',
    'shrink-0',
    'min-h-0',
    'mobile-scroll-y',
    'aria-label="Thu nhỏ cửa sổ"',
    'aria-label="Khôi phục cửa sổ"',
    'focus-visible:ring',
    'data-testid="pgdcn-workflow-modal-launcher"',
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /Escape|\bESC\b/);
  assert.match(source, /onMinimize/);
  assert.match(source, /onRestore/);
});

