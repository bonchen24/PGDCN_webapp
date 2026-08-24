// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for combined KQTN PDF page segmentation.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildKqtnBulkSegments,
  normalizeKqtnBulkSegmentRange,
  validateKqtnBulkSegments,
  type KqtnBulkStructurePage,
} from '../utils/kqtnBulkSplit';

const page = (pageNumber: number, overrides: Partial<KqtnBulkStructurePage> = {}): KqtnBulkStructurePage => ({
  pageNumber,
  isReportCover: false,
  isBlank: false,
  ...overrides,
});

test('builds non-overlapping segments from report covers and trims blank boundary pages', () => {
  const segments = buildKqtnBulkSegments([
    page(1, { isReportCover: true, reportNo: 'M02', sampleCode: 'ATD-001' }),
    page(2),
    page(3, { isBlank: true }),
    page(4, { isReportCover: true, reportNo: 'M03', sampleCode: 'ATD-002' }),
    page(5),
    page(6, { isBlank: true }),
  ], 6, 'ITD 1132-26-M2 đến M3.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd, detection }) => ({ pageStart, pageEnd, detection })), [
    { pageStart: 1, pageEnd: 2, detection: 'ai' },
    { pageStart: 4, pageEnd: 5, detection: 'ai' },
  ]);
  assert.equal(segments[0].metadata.sampleCode, 'ATD-001');
});

test('falls back to one manual segment when no report cover is detected', () => {
  const segments = buildKqtnBulkSegments([page(1), page(2)], 2, 'scan.pdf');

  assert.deepEqual(segments, [{
    sourceFileName: 'scan.pdf',
    pageStart: 1,
    pageEnd: 2,
    metadata: page(1),
    detection: 'manual',
  }]);
});

test('normalizes edited ranges inside the source document', () => {
  assert.deepEqual(normalizeKqtnBulkSegmentRange(0, 99, 6), { pageStart: 1, pageEnd: 6 });
  assert.deepEqual(normalizeKqtnBulkSegmentRange(5, 2, 6), { pageStart: 5, pageEnd: 5 });
});

test('reports overlap and out-of-range segment edits', () => {
  const errors = validateKqtnBulkSegments([
    { pageStart: 1, pageEnd: 3 },
    { pageStart: 3, pageEnd: 7 },
  ], 6);

  assert.deepEqual(errors.sort(), [
    'Nhóm 2 bị chồng trang với nhóm trước.',
    'Nhóm 2 vượt quá tổng số trang PDF nguồn.',
  ].sort());
});

// --- End of kqtn-bulk-split.test.ts ---
