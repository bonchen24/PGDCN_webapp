// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for the compact report standard grid classes

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');

test('report standard grid uses compact responsive spacing and columns', () => {
  assert.match(source, /grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8/);
  assert.match(source, /gap-2 sm:gap-3/);
  assert.match(source, /pb-4 mt-0/);
});

test('report standard cards and icons use compact dimensions', () => {
  assert.match(source, /min-h-\[88px\] sm:min-h-\[104px\]/);
  assert.match(source, /w-6 h-6 sm:w-7 sm:h-7/);
  assert.match(source, /text-\[9px\] sm:text-\[10px\]/);
});

test('expanded report cards expose enough space for selection controls', () => {
  assert.match(source, /min-h-\[132px\] sm:min-h-\[152px\] overflow-visible/);
});

// --- End of report-grid-layout.test.ts ---
