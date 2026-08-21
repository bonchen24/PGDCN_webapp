// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for compact typography in report input forms

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const reportView = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');
const stylesheet = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('all report input forms use the compact typography scope', () => {
  assert.equal((reportView.match(/report-form-compact/g) || []).length, 3);
});

test('compact report typography reduces large utility sizes and form controls', () => {
  assert.match(stylesheet, /\.report-form-compact \.text-sm[\s\S]*font-size:\s*0\.75rem\s*!important/);
  assert.match(stylesheet, /\.report-form-compact \.text-base[\s\S]*font-size:\s*0\.875rem\s*!important/);
  assert.match(stylesheet, /\.report-form-compact \.text-lg[\s\S]*font-size:\s*1rem\s*!important/);
  assert.match(stylesheet, /\.report-form-compact\s+:is\(input, textarea, select\)[\s\S]*font-size:\s*0\.75rem\s*!important/);
});

// --- End of report-form-typography.test.ts ---
