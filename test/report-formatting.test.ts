// Author: Gemini
// OS support: Web/Node
// Description: Tests report date formatting and missing nameplate OCR values

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatBilingualReportDate,
  formatReportEnglishDate,
  normalizeNameplateOcrValues,
} from '../lib/reportFormatting.ts';

test('formats an ISO report date with an English month name', () => {
  assert.equal(formatReportEnglishDate('2026-08-18'), 'August 18, 2026');
});

test('formats a Vietnamese report date with an English month name', () => {
  assert.equal(formatReportEnglishDate('18/08/2026'), 'August 18, 2026');
});

test('formats the bilingual report date without numeric English date fields', () => {
  assert.equal(
    formatBilingualReportDate('2026-08-08'),
    'Hà Nội, ngày 08 tháng 8 năm 2026 (Hanoi, August 8, 2026)',
  );
});

test('pads single-digit report days and only pads Vietnamese months January and February', () => {
  assert.equal(
    formatBilingualReportDate('2026-01-01'),
    'Hà Nội, ngày 01 tháng 01 năm 2026 (Hanoi, January 1, 2026)',
  );
  assert.equal(
    formatBilingualReportDate('2026-02-02'),
    'Hà Nội, ngày 02 tháng 02 năm 2026 (Hanoi, February 2, 2026)',
  );
  assert.equal(
    formatBilingualReportDate('2026-03-03'),
    'Hà Nội, ngày 03 tháng 3 năm 2026 (Hanoi, March 3, 2026)',
  );
});

test('returns an empty string for an invalid report date', () => {
  assert.equal(formatReportEnglishDate('2026-99-18'), '');
  assert.equal(formatBilingualReportDate(''), '');
});

test('returns N/A for missing nameplate fields', () => {
  assert.deepEqual(normalizeNameplateOcrValues({ voltage: '220V' }), {
    manufacturer: 'N/A',
    countryOfOrigin: 'N/A',
    power: 'N/A',
    voltage: '220V',
    current: 'N/A',
    frequency: 'N/A',
    clockFreq: 'N/A',
  });
});

// --- End of report-formatting.test.ts ---
