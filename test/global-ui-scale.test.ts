// Author: Gemini
// OS support: Web/Node
// Description: Regression test for the global 100% UI scale

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const stylesheet = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('global UI scale is 100% and stays within the viewport', () => {
  assert.match(
    stylesheet,
    /#root\s*\{[\s\S]*zoom:\s*1;[\s\S]*width:\s*100%;[\s\S]*min-height:\s*100%;[\s\S]*\}/
  );
  assert.doesNotMatch(stylesheet, /111\.111111%/);
});

test('defines a scoped compact density without overriding report forms or touch targets', () => {
  assert.match(stylesheet, /\.app-compact\s*,\s*\.pcn-compact\s*\{/);
  assert.match(stylesheet, /\.app-compact[\s\S]*\.text-sm/);
  assert.match(stylesheet, /\.app-compact[\s\S]*class~="gap-3"/);
  assert.match(stylesheet, /\.app-compact[\s\S]*class~="gap-6"/);
  assert.match(stylesheet, /\.app-compact[\s\S]*class~="space-y-6"/);
  assert.match(stylesheet, /\.app-compact[\s\S]*class~="p-8"/);
  assert.match(stylesheet, /\.app-compact[\s\S]*\.report-form-compact/);
  assert.match(stylesheet, /\.app-compact \.report-form-compact[\s\S]*class~="p-6"/);
  assert.match(stylesheet, /\.app-compact[\s\S]*\.mobile-touch-target/);
});

// --- End of global-ui-scale.test.ts ---
