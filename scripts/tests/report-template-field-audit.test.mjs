// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for parity between TCVN DOCX templates and clause configuration

import assert from 'node:assert/strict';
import test from 'node:test';
import { auditTcvnTemplates } from '../audit-report-template-fields.mjs';

test('all TCVN report templates have configured evaluation rows', () => {
  const results = auditTcvnTemplates();
  const missing = results.flatMap((result) => result.missing.map((id) => `${result.moduleId}/${result.criteriaType}:${id}`));
  assert.deepEqual(missing, []);
});

// --- End of scripts/tests/report-template-field-audit.test.mjs ---
