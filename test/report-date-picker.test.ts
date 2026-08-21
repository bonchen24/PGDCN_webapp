// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for report date picker overflow behavior

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const datePicker = fs.readFileSync(new URL('../components/CustomDatePicker.tsx', import.meta.url), 'utf8');

test('renders report date picker popper outside scrolling form containers', () => {
  assert.match(datePicker, /portalId="report-date-picker-portal"/);
});

test('keeps report date picker popper above the report form stylesheet', () => {
  assert.match(datePicker, /popperClassName="!z-\[2000\]"/);
});

// --- End of report-date-picker.test.ts ---
