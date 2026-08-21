// Author: Gemini
// OS support: Web/Node
// Description: Regression test for EMC and cable DOCX payload parity

import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSpecialTemplate } from '../audit-special-template-fields.mjs';

const SPECIAL_TEMPLATES = [
  'public/DCDNNTT placeholder.docx',
  'public/tulanh placeholder.docx',
  'public/1T placeholder.docx',
  'public/bepdien1vungnau placeholder.docx',
  'public/bepdien2vungnau placeholder.docx',
  'public/4T placeholder.docx',
  'public/3T placeholder.docx',
  'public/2T1HN placeholder.docx',
  'public/2T placeholder.docx',
  'public/1T1HN placeholder.docx',
  'public/loai2chieu placeholder.docx',
  'public/1khoiloai2chieu placeholder.docx',
  'public/1khoiloai1chieu placeholder.docx',
  'public/loai1chieuKCDNT placeholder.docx',
  'public/loai1chieu placeholder.docx',
  'public/MGCS placeholder.docx',
  'public/MGKCS placeholder.docx',
  'public/MHBCTG placeholder.docx',
  'public/MHBKTG placeholder.docx',
  'public/maysaytoc placeholder.docx',
  'public/MXCTG placeholder.docx',
  'public/MXKTG placeholder.docx',
  'public/maykhoan placeholder.docx',
  'public/daycapdien placeholder.docx',
  'public/daycapdien 4 placeholder.docx',
];

test('special-module templates have report payload coverage', () => {
  for (const template of SPECIAL_TEMPLATES) {
    assert.deepEqual(auditSpecialTemplate(template).missing, [], template);
  }
});

// --- End of report-special-template-audit.test.mjs ---
