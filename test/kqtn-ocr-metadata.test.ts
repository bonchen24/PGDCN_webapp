// Author: Codex
// OS support: Web/Node
// Description: Unit tests for PaddleOCR footer-key and KQTN metadata parsing.

import assert from 'node:assert/strict';
import test from 'node:test';

import { extractKqtnFooterKey, extractKqtnFooterPageNumber, extractKqtnReportKey, parseKqtnOcrMetadata } from '../utils/kqtnOcrMetadata';

test('extracts a stable footer key and ignores page/date lines', () => {
  assert.equal(
    extractKqtnFooterKey('ITD-02\nTrang 1/5\n24/08/2026'),
    'ITD-02',
  );
});

test('returns no footer key when OCR only sees dynamic page markers', () => {
  assert.equal(extractKqtnFooterKey('Trang 2/5\n24-08-2026'), '');
});

test('removes an unlabeled page counter appended to a stable footer key', () => {
  assert.equal(extractKqtnFooterKey('ITD-02 1/5\n24-08-2026'), 'ITD-02');
});

test('parses labeled KQTN metadata from PaddleOCR text', () => {
  assert.deepEqual(parseKqtnOcrMetadata([
    'Số mã hóa: ITD-02',
    'Model: ABC-123',
    'Hãng sản xuất: Demo Brand',
  ].join('\n')), {
    sampleCode: 'ITD-02',
    model: 'ABC-123',
    brand: 'Demo Brand',
  });
});

test('keeps ambiguous OCR metadata empty for Gemini/manual fallback', () => {
  assert.deepEqual(parseKqtnOcrMetadata('Báo cáo kết quả thử nghiệm\nABC-123'), {
    sampleCode: '',
    model: '',
    brand: '',
  });
});

test('parses common PaddleOCR spelling variants from appendix identity fields', () => {
  assert.deepEqual(parseKqtnOcrMetadata([
    'PHỤ LỤC',
    'Ảnh mẫu',
    'Ảnh tem',
    'Modtl',
    'FHCT114',
    'Mã shn phn',
    'FHCT114',
  ].join('\n')), {
    sampleCode: 'FHCT114',
    model: 'FHCT114',
    brand: '',
  });
});

test('parses dropped-vowel PaddleOCR labels from the 116-page scan', () => {
  assert.deepEqual(parseKqtnOcrMetadata([
    'PHU LUC',
    'Anh mǎu',
    'Anh tem',
    'Tén sàn phám',
    'MAY UAM MAT KHONG KHIHOAPHAT',
    'HPCF035BL',
    'Ms sin phsm',
    'HPCF035',
  ].join('\n')), {
    sampleCode: 'HPCF035',
    model: '',
    brand: '',
  });
});

test('prefers a report identifier over a longer TCVN reference on the cover page', () => {
  assert.equal(
    extractKqtnFooterKey('TCVN 5699-1:2010 An toàn\nSố (N°): ITD 1132-26-M02\nTrang 1/20'),
    'ITD-1132-26-M02',
  );
});

test('extracts a sample code from the footer when no report-family code is present', () => {
  assert.equal(
    extractKqtnFooterKey('Số mã hóa: HPN695\nTrang 1/20'),
    'HPN695',
  );
});

test('recognizes ITDC as a report-family footer key', () => {
  assert.equal(extractKqtnFooterKey('Số (N°): ITDC 2026-01-M04\n4/12'), 'ITDC-2026-01-M04');
  assert.equal(extractKqtnReportKey('ITDC 2026-01-M04'), 'ITDC-2026-01-M04');
});

test('normalizes OCR report identifiers for footer-based group boundaries', () => {
  assert.equal(extractKqtnReportKey('Số (N°): ITD 1132 -26-M03'), 'ITD-1132-26-M03');
  assert.equal(extractKqtnReportKey('ITD-01'), 'ITD-01');
});

test('extracts current and total page numbers without treating dates as pagination', () => {
  assert.deepEqual(extractKqtnFooterPageNumber('Ngày 01/08/2026\nTrang 2 / 20'), { currentPage: 2, totalPages: 20 });
  assert.equal(extractKqtnFooterPageNumber('Ngày 01/08/2026'), undefined);
});

// --- End of kqtn-ocr-metadata.test.ts ---
