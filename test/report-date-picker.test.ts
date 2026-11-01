// Author: Gemini
// OS support: Web/Node
// Description: Regression test asserting retired legacy CustomDatePicker component remains absent

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('retired legacy CustomDatePicker component remains absent', () => {
  const componentUrl = new URL('../components/CustomDatePicker.tsx', import.meta.url);
  assert.equal(fs.existsSync(componentUrl), false, 'Retired components/CustomDatePicker.tsx must remain absent');
});

// --- End of report-date-picker.test.ts ---
