// Author: Codex
// OS support: Web/Node
// Description: Regression tests for scanned combined KQTN PDF marker recovery.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildKqtnBulkSegments,
  buildKqtnFastCandidateSegments,
  buildKqtnFooterCandidateSegments,
  buildKqtnFooterSegments,
  classifyKqtnFastCandidate,
  validateKqtnBulkFooterPageCounts,
  type KqtnBulkFooterPage,
  type KqtnBulkStructurePage,
} from '../utils/kqtnBulkSplit';

const page = (pageNumber: number, overrides: Partial<KqtnBulkStructurePage> = {}): KqtnBulkStructurePage => ({
  pageNumber,
  isReportCover: false,
  isBlank: false,
  ...overrides,
});

const footerPage = (pageNumber: number, footerKey: string, isBlank = false, footerCurrentPage?: number, footerTotalPages?: number): KqtnBulkFooterPage => ({
  pageNumber,
  footerKey,
  isBlank,
  footerCurrentPage,
  footerTotalPages,
});

const fastCandidatePage = (
  pageNumber: number,
  footerKey: string,
  text: string,
  candidateScore = 0.9,
): KqtnBulkFooterPage => ({
  pageNumber,
  footerKey,
  text,
  candidateScore,
  isBlank: false,
  isCandidate: true,
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

test('does not turn visual OCR noise into extra groups when only seven candidates identify covers', () => {
  const candidates = [
    fastCandidatePage(1, 'ITD-01', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-01\nSố mã hóa: M-01\nModel: MODEL-01'),
    fastCandidatePage(3, 'OCR-NOISE-01', 'Kết quả thử nghiệm\nOCR-NOISE-01'),
    fastCandidatePage(5, 'ITD-02', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-02\nSố mã hóa: M-02\nModel: MODEL-02'),
    fastCandidatePage(7, 'OCR-NOISE-02', 'Kết quả thử nghiệm\nOCR-NOISE-02'),
    fastCandidatePage(9, 'ITD-03', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-03\nSố mã hóa: M-03\nModel: MODEL-03'),
    fastCandidatePage(13, 'ITD-04', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-04\nSố mã hóa: M-04\nModel: MODEL-04'),
    fastCandidatePage(15, 'OCR-NOISE-03', 'Kết quả thử nghiệm\nOCR-NOISE-03'),
    fastCandidatePage(17, 'ITD-05', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-05\nSố mã hóa: M-05\nModel: MODEL-05'),
    fastCandidatePage(21, 'ITD-06', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-06\nSố mã hóa: M-06\nModel: MODEL-06'),
    fastCandidatePage(23, 'OCR-NOISE-04', 'Kết quả thử nghiệm\nOCR-NOISE-04'),
    fastCandidatePage(25, 'ITD-07', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-07\nSố mã hóa: M-07\nModel: MODEL-07'),
  ];

  const segments = buildKqtnFastCandidateSegments(candidates, 28, 'scan.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd }) => ({ pageStart, pageEnd })), [
    { pageStart: 1, pageEnd: 4 },
    { pageStart: 5, pageEnd: 8 },
    { pageStart: 9, pageEnd: 12 },
    { pageStart: 13, pageEnd: 16 },
    { pageStart: 17, pageEnd: 20 },
    { pageStart: 21, pageEnd: 24 },
    { pageStart: 25, pageEnd: 28 },
  ]);
  assert.ok(segments.every((segment) => segment.detection === 'ai'));
});

test('coalesces repeated visual candidates that carry the same report identity', () => {
  const candidates = [
    fastCandidatePage(1, 'ITD-01', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-01\nSố mã hóa: M-01\nModel: MODEL-01'),
    fastCandidatePage(3, 'ITD-01', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-01\nSố mã hóa: M-01\nModel: MODEL-01'),
    fastCandidatePage(5, 'ITD-02', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-02\nSố mã hóa: M-02\nModel: MODEL-02'),
    fastCandidatePage(7, 'ITD-02', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-02\nSố mã hóa: M-02\nModel: MODEL-02'),
    fastCandidatePage(9, 'ITD-03', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố: ITD-03\nSố mã hóa: M-03\nModel: MODEL-03'),
  ];

  const segments = buildKqtnFastCandidateSegments(candidates, 12, 'scan.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd }) => ({ pageStart, pageEnd })), [
    { pageStart: 1, pageEnd: 4 },
    { pageStart: 5, pageEnd: 8 },
    { pageStart: 9, pageEnd: 12 },
  ]);
});

test('keeps six semantic report starts and rejects five result-page visual peaks from the 116-page scan', () => {
  const candidates = [
    fastCandidatePage(1, 'ITD-1132-26-M02', 'BÁO CÁO THỬ NGHIỆM AN TOÀN ĐIỆN\nSố (N°): ITD-1132-26-M02\nModel: HPC 3S16H'),
    fastCandidatePage(18, 'SO (N): ITD 1132-26-M02', 'Điều 10\nCông suất và dòng điện\nKết quả đo'),
    fastCandidatePage(22, 'SO (N): ITD 1132-26-M03', 'KẾT QUẢ THỬ NGHIỆM\n6 Phân loại\n7 Ghi nhãn và hướng dẫn'),
    fastCandidatePage(36, 'SO (N): ITD 1132-26-M03', 'Điều\nChỉ tiêu thử nghiệm\nThử nghiệm mô men xoắn'),
    fastCandidatePage(39, 'SO (N): ITD 1132-26-M03', 'PHỤ LỤC\nẢnh mẫu\nẢnh tem\nTên sản phẩm\nMÁY LỌC NƯỚC\nModtl\nHPN615\nMã sản phẩm\nHPN615'),
    fastCandidatePage(56, 'SO (N): ITD 1132-26-M04', 'Điều\nChỉ tiêu thử nghiệm\nKết quả thử nghiệm'),
    fastCandidatePage(59, 'SO (N): ITD 1132-26-M04', 'PHỤ LỤC\nẢnh mẫu\nẢnh tem\nTên sản phẩm\nMÁY LỌC NƯỚC\nModtl\nFHCT114\nMã sản phẩm\nFHCT114'),
    fastCandidatePage(78, 'SO (N): ITD 1132-26-M05', 'PHU LUC\nAnh mǎu\nAnh tem\nTén sàn phám\nMAY UAM MAT KHONG KHIHOAPHAT\nHPCF035BL\nMs sin phsm\nHPCF035\nTEM NIEM PHONG'),
    fastCandidatePage(96, 'SO (N): ITD 1132-26-M06', 'PHỤ LỤC\nẢnh mẫu\nẢnh tem\nMã màu\n262312NH10077AED\nTên sản phẩm\nMÁY LÀM MÁT KHÔNG KHÍ'),
    fastCandidatePage(112, 'SO (N): ITD 1132-26-M07', 'Điều\nChỉ tiêu thử nghiệm\nKết quả thử nghiệm'),
    fastCandidatePage(115, 'SO (N): ITD 1132-26-M07', 'PHU LUC\nAnh mǎu\nAnh tem\nHOAPHAT\nTin sin phsim\nNAYLQC NUOC RO NONG LANHHOA FHAT HPNSPS\nMs shn phin\nHPN69S\nTEM NIEMPHONG'),
  ];

  const segments = buildKqtnFastCandidateSegments(candidates, 116, 'ITD 1132-26-M2 đến M7.pdf');

  assert.equal(classifyKqtnFastCandidate(candidates[4]).kind, 'appendix');
  assert.deepEqual(segments.map(({ pageStart, pageEnd }) => ({ pageStart, pageEnd })), [
    { pageStart: 1, pageEnd: 20 },
    { pageStart: 21, pageEnd: 39 },
    { pageStart: 40, pageEnd: 59 },
    { pageStart: 60, pageEnd: 78 },
    { pageStart: 79, pageEnd: 96 },
    { pageStart: 97, pageEnd: 116 },
  ]);
});

test('recovers the same six groups from footer-only candidate pages and preserves mismatch warnings', () => {
  const candidate = (pageNumber: number, key: string, currentPage: number, totalGroupPages: number): KqtnBulkFooterPage => footerPage(
    pageNumber,
    key,
    false,
    currentPage,
    totalGroupPages,
  );
  const segments = buildKqtnFooterCandidateSegments([
    candidate(1, 'ITD 1132-26-M02', 1, 20),
    candidate(18, 'ITD 1132-26-M02', 18, 20),
    candidate(22, 'ITD 1132-26-M03', 2, 19),
    candidate(36, 'ITD 1132-26-M03', 16, 19),
    candidate(39, 'ITD 1132-26-M03', 19, 19),
    candidate(56, 'ITD 1132-26-M04', 16, 19),
    candidate(59, 'ITD 1132-26-M04', 19, 19),
    candidate(78, 'ITD 1132-26-M05', 18, 18),
    candidate(96, 'ITD 1132-26-M06', 18, 18),
    candidate(112, 'ITD 1132-26-M07', 16, 19),
    candidate(115, 'ITD 1132-26-M07', 19, 19),
  ], 116, 'ITD 1132-26-M2 đến M7.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd }) => ({ pageStart, pageEnd })), [
    { pageStart: 1, pageEnd: 20 },
    { pageStart: 21, pageEnd: 39 },
    { pageStart: 40, pageEnd: 59 },
    { pageStart: 60, pageEnd: 78 },
    { pageStart: 79, pageEnd: 96 },
    { pageStart: 97, pageEnd: 116 },
  ]);
  assert.deepEqual(validateKqtnBulkFooterPageCounts(segments), [
    'Nhóm 3 có 20 trang, nhưng footer OCR ghi tổng 19 trang.',
    'Nhóm 4 có 19 trang, nhưng footer OCR ghi tổng 18 trang.',
    'Nhóm 6 có 20 trang, nhưng footer OCR ghi tổng 19 trang.',
  ]);
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

test('groups the Desktop 116-page scan by footer report codes and keeps count warnings non-blocking', () => {
  const groups = [
    { key: 'ITD 1132-26-M02', start: 1, end: 20, total: 20 },
    { key: 'ITD 1132-26-M03', start: 21, end: 39, total: 19 },
    { key: 'ITD 1132-26-M04', start: 40, end: 59, total: 19 },
    { key: 'ITD 1132-26-M05', start: 60, end: 78, total: 18 },
    { key: 'ITD 1132-26-M06', start: 79, end: 96, total: 18 },
    { key: 'ITD 1132-26-M07', start: 97, end: 116, total: 19 },
  ];
  const pages = groups.flatMap(({ key, start, end, total }) => Array.from(
    { length: end - start + 1 },
    (_, offset) => footerPage(start + offset, key, false, offset + 1, total),
  ));

  const segments = buildKqtnFooterSegments(pages, 116, 'ITD 1132-26-M2 đến M7.pdf');

  assert.deepEqual(segments.map(({ pageStart, pageEnd, metadata }) => ({
    pageStart,
    pageEnd,
    reportNo: metadata.reportNo,
  })), groups.map(({ key, start, end }) => ({
    pageStart: start,
    pageEnd: end,
    reportNo: key.replace(/\s*[-_/]\s*/g, '-').replace(/\s+/g, '-'),
  })));
  assert.deepEqual(validateKqtnBulkFooterPageCounts(segments), [
    'Nhóm 3 có 20 trang, nhưng footer OCR ghi tổng 19 trang.',
    'Nhóm 4 có 19 trang, nhưng footer OCR ghi tổng 18 trang.',
    'Nhóm 6 có 20 trang, nhưng footer OCR ghi tổng 19 trang.',
  ]);
});

test('carries footer page totals and reports a mismatch with the OCR group count', () => {
  const segments = buildKqtnFooterSegments([
    footerPage(1, 'ITD-02', false, 1, 2),
    footerPage(2, 'ITD-02', false, 2, 2),
    footerPage(3, 'ITD-03', false, 1, 3),
    footerPage(4, 'ITD-03', false, 2, 3),
    footerPage(5, 'ITD-03', false, 3, 3),
  ], 5, 'combined.pdf');

  assert.equal(segments[0].metadata.footerTotalPages, 2);
  assert.equal(segments[1].metadata.footerCurrentPage, 3);
  const mismatched = segments.map((segment, index) => index === 1
    ? { ...segment, pageEnd: segment.pageEnd - 1 }
    : segment);
  assert.deepEqual(validateKqtnBulkFooterPageCounts(mismatched), [
    'Nhóm 2 có 2 trang, nhưng footer OCR ghi tổng 3 trang.',
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
