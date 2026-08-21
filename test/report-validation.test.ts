// Author: Gemini
// OS support: Web/Node
// Description: Unit tests for report date and metadata consistency validation

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeComparableValue,
  normalizeSealStamp,
  parseReportDateRange,
  validateReportConsistency,
} from '../lib/reportValidation.ts';

test('parses a single date and a date range', () => {
  assert.deepEqual(parseReportDateRange('14/08/2026'), { start: '2026-08-14', end: '2026-08-14' });
  assert.deepEqual(parseReportDateRange('10/08/2026 – 14/08/2026'), { start: '2026-08-10', end: '2026-08-14' });
});

test('normalizes metadata and seal tokens for comparison', () => {
  assert.equal(normalizeComparableValue('  Đa-Star / Custom '), 'dastarcustom');
  assert.equal(normalizeSealStamp('IEMM-8892, IEMM.26/8891'), 'iemm268891|iemm8892');
});

test('reports an error when the report date precedes the test range', () => {
  const result = validateReportConsistency({
    dates: {
      requestDate: '2026-07-19',
      sampleReceiptDate: '2026-07-20',
      testDate: '10/08/2026 – 14/08/2026',
      reportDate: '2026-08-13',
    },
  });
  assert.equal(result.hasErrors, true);
  assert.ok(result.issues.some(issue => issue.code === 'DATE_ORDER'));
});

test('reports metadata, OCR and technical specification mismatches', () => {
  const result = validateReportConsistency({
    dates: {},
    source: {
      requestCode: 'DDT-2026-001',
      model: 'Dastar Custom',
      brand: 'Daestar',
      sealStamp: 'IEMM-8891',
      specifications: '220-240V; 50Hz; 660W',
    },
    report: {
      requestCode: 'DDT-2026-001',
      model: 'Dastar Other',
      brand: 'Daestar',
      sealStamp: 'IEMM-8892',
    },
    ocr: { model: 'Dastar Custom', brand: 'Wrong Brand', voltage: '110V', frequency: '50Hz', power: '660W' },
  });
  assert.equal(result.hasErrors, false);
  assert.equal(result.hasWarnings, true);
  assert.equal(result.issues.every(issue => issue.severity === 'warning'), true);
  assert.ok(result.issues.some(issue => issue.field === 'model'));
  assert.ok(result.issues.some(issue => issue.field === 'sealStamp'));
  assert.ok(result.issues.some(issue => issue.field === 'ocr.brand'));
  assert.ok(result.issues.some(issue => issue.field === 'ocr.voltage'));
});

test('missing optional values produce warnings without blocking', () => {
  const result = validateReportConsistency({
    dates: {},
    source: { model: 'Model A' },
    report: {},
  });
  assert.equal(result.hasErrors, false);
  assert.ok(result.issues.some(issue => issue.severity === 'warning'));
});

// --- End of report-validation.test.ts ---
