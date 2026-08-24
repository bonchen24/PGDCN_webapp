// Author: Codex
// OS support: Web/Node
// Description: Regression tests for scanned combined KQTN PDF marker recovery.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildKqtnBulkSegments,
  buildKqtnFooterSegments,
  type KqtnBulkFooterPage,
  type KqtnBulkStructurePage,
} from '../utils/kqtnBulkSplit';

const page = (pageNumber: number, overrides: Partial<KqtnBulkStructurePage> = {}): KqtnBulkStructurePage => ({
  pageNumber,
  isReportCover: false,
  isBlank: false,
  ...overrides,
});

const footerPage = (pageNumber: number, footerKey: string, isBlank = false): KqtnBulkFooterPage => ({
  pageNumber,
  footerKey,
  isBlank,
});

test('recovers report starts when scan metadata identifies the cover but isReportCover is false', () => {
  const segments = buildKqtnBulkSegments([
    page(1, { reportNo: 'ITD 1132-26-M02', sampleName: 'Bếp từ', model: 'HPC 3S16H' }),
    page(2),
    page(3, { isBlank: true }),
    page(4, { reportNo: 'ITD 1132-26-M03', sampleName: 'Dụng cụ điện', model: 'HPN615' }),
    page(5),
  ], 5, 'ITD 1132-26-M2 đến M3.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd }) => ({ pageStart, pageEnd })), [
    { pageStart: 1, pageEnd: 2 },
    { pageStart: 4, pageEnd: 5 },
  ]);
  assert.equal(segments[0].metadata.reportNo, 'ITD 1132-26-M02');
});

test('does not promote a repeated footer report number without cover metadata', () => {
  const segments = buildKqtnBulkSegments([
    page(1, { reportNo: 'ITD 1132-26-M02' }),
    page(2, { reportNo: 'ITD 1132-26-M02' }),
    page(3, { reportNo: 'ITD 1132-26-M03' }),
  ], 3, 'scan.pdf');

  assert.equal(segments.length, 1);
  assert.equal(segments[0].detection, 'manual');
});

test('builds combined segments from footer keys repeated across the report run', () => {
  const segments = buildKqtnFooterSegments([
    footerPage(1, 'ITD-02'),
    footerPage(2, 'ITD-02'),
    footerPage(3, 'ITD-03'),
    footerPage(4, 'ITD-03'),
    footerPage(5, 'ITD-03', true),
  ], 5, 'combined.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd, detection, metadata }) => ({
    pageStart,
    pageEnd,
    detection,
    footerKey: metadata.footerKey,
  })), [
    { pageStart: 1, pageEnd: 2, detection: 'footer', footerKey: 'ITD-02' },
    { pageStart: 3, pageEnd: 4, detection: 'footer', footerKey: 'ITD-03' },
  ]);
});

test('falls back to manual when a footer change is not stable on the next page', () => {
  const segments = buildKqtnFooterSegments([
    footerPage(1, 'ITD-02'),
    footerPage(2, 'ITD-02'),
    footerPage(3, 'OCR-NOISE'),
    footerPage(4, 'ITD-02'),
  ], 4, 'unstable-footer.pdf');

  assert.equal(segments.length, 1);
  assert.equal(segments[0].detection, 'manual');
  assert.deepEqual({ pageStart: segments[0].pageStart, pageEnd: segments[0].pageEnd }, { pageStart: 1, pageEnd: 4 });
});

test('falls back to manual when the footer never identifies a second report', () => {
  const segments = buildKqtnFooterSegments([
    footerPage(1, 'STATIC-FOOTER'),
    footerPage(2, 'STATIC-FOOTER'),
    footerPage(3, 'STATIC-FOOTER'),
  ], 3, 'static-footer.pdf');

  assert.equal(segments.length, 1);
  assert.equal(segments[0].detection, 'manual');
});
