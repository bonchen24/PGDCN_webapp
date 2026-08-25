// Author: Gemini
// OS support: Web/Node
// Description: Pure page segmentation and validation helpers for combined KQTN PDFs.

import { extractKqtnReportKey, parseKqtnOcrMetadata } from './kqtnOcrMetadata';

export interface KqtnBulkStructurePage {
  pageNumber: number;
  isReportCover: boolean;
  isBlank: boolean;
  reportNo?: string;
  sampleCode?: string;
  model?: string;
  brand?: string;
  sealStamp?: string;
  sampleName?: string;
  footerKey?: string;
  footerCurrentPage?: number;
  footerTotalPages?: number;
}

export interface KqtnBulkFooterPage {
  pageNumber: number;
  isBlank: boolean;
  footerKey: string;
  text?: string;
  confidence?: number;
  candidateScore?: number;
  isCandidate?: boolean;
  footerCurrentPage?: number;
  footerTotalPages?: number;
}

export type KqtnFastCandidateKind = 'cover' | 'appendix' | 'noise' | 'ambiguous';

export interface KqtnFastCandidateEvidence {
  kind: KqtnFastCandidateKind;
  reason: string;
  identityKey?: string;
  reportKey?: string;
}

export type KqtnBulkSegmentDetection = 'ai' | 'footer' | 'manual' | 'single-file';

export interface KqtnBulkSegmentDraft {
  sourceFileName: string;
  pageStart: number;
  pageEnd: number;
  metadata: KqtnBulkStructurePage;
  detection: KqtnBulkSegmentDetection;
}

export interface KqtnBulkSegmentRange {
  pageStart: number;
  pageEnd: number;
}

function clampPage(value: number, totalPages: number): number {
  return Math.min(Math.max(Math.floor(Number.isFinite(value) ? value : 1), 1), totalPages);
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStrongKqtnBulkCoverMarker(page: KqtnBulkStructurePage): boolean {
  if (page.isReportCover) return true;

  const hasReportIdentifier = hasText(page.reportNo) || hasText(page.sampleCode);
  const hasCoverContext = hasText(page.sampleName) || hasText(page.model);
  return hasReportIdentifier && hasCoverContext;
}

export function normalizeKqtnBulkSegmentRange(
  pageStart: number,
  pageEnd: number,
  totalPages: number,
): KqtnBulkSegmentRange {
  const safeTotalPages = Math.max(1, Math.floor(totalPages));
  const start = clampPage(pageStart, safeTotalPages);
  const end = clampPage(pageEnd, safeTotalPages);
  return { pageStart: start, pageEnd: Math.max(start, end) };
}

function normalizeFooterKey(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([:/_-])\s*/g, '$1')
    .trim();
}

function normalizeCandidateText(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAnyCandidatePhrase(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function isGenericFooterKey(value: string | undefined): boolean {
  return /^(?:BM|M)[-_ ]?\d{1,2}[-_]\d{1,2}$/.test(normalizeFooterKey(value));
}

function candidateIdentityKey(page: KqtnBulkFooterPage, metadata: ReturnType<typeof parseKqtnOcrMetadata>): string {
  const metadataKeys = [metadata.sampleCode, metadata.model, metadata.brand]
    .map((value) => normalizeFooterKey(value))
    .filter(Boolean);
  const footerKey = normalizeFooterKey(page.footerKey);
  const stableFooterKey = footerKey && !isGenericFooterKey(footerKey) ? footerKey : '';
  if (metadataKeys.length === 0 && !stableFooterKey) return '';
  return [...(stableFooterKey ? [stableFooterKey] : []), ...metadataKeys].join('|');
}

export function classifyKqtnFastCandidate(page: KqtnBulkFooterPage): KqtnFastCandidateEvidence {
  const normalizedText = normalizeCandidateText(page.text);
  if (!normalizedText) return { kind: 'ambiguous', reason: 'Ứng viên không có text OCR.' };

  const metadata = parseKqtnOcrMetadata(page.text || '');
  const reportKey = extractKqtnReportKey(`${page.footerKey}\n${page.text || ''}`);
  const hasReportTitle = hasAnyCandidatePhrase(normalizedText, [
    'BAO CAO THU NGHIEM',
    'ELECTRICAL SAFETY TEST REPORT',
  ]);
  const hasReportIdentifier = /\b(?:ITD|EMC|KQTN)\b/.test(normalizedText)
    || normalizedText.includes('SO N')
    || normalizedText.includes('S N');
  const hasAppendixTitle = normalizedText.includes('PHU LUC');
  const hasAppendixImageBlock = hasAnyCandidatePhrase(normalizedText, [
    'ANH MAU',
    'ANH TEM',
    'TEM NIEM PHONG',
  ]);
  const identitySignals = [
    normalizedText.includes('TEN SAN PHAM'),
    hasAnyCandidatePhrase(normalizedText, [
      'MA SAN PHAM',
      'MA SHN PHN',
      'MA SIN PHSM',
      'MS SIN PHSM',
      'MS SIN PHIN',
      'MS SHN PHIN',
      'MA MAU',
      'MA HIEU',
    ]),
    hasAnyCandidatePhrase(normalizedText, ['MODEL', 'MODTL', 'MODCL', 'KIEU LOAI', 'TYPE']),
    hasAnyCandidatePhrase(normalizedText, ['NHAN HIEU', 'HANG SAN XUAT', 'BRAND', 'MANUFACTURER']),
  ].filter(Boolean).length;
  const hasIdentityValue = Boolean(metadata.sampleCode || metadata.model || metadata.brand);
  const hasResultPageMarker = hasAnyCandidatePhrase(normalizedText, [
    'KET QUA THU NGHIEM',
    'CHI TIEU THU NGHIEM',
  ]) || /\bDIEU(?:\s+\d+)?\b/.test(normalizedText);
  const identityKey = candidateIdentityKey(page, metadata);

  if (hasReportTitle && (hasReportIdentifier || hasIdentityValue || identitySignals > 0)) {
    return { kind: 'cover', reason: 'Trang báo cáo có tiêu đề và identity.', identityKey: identityKey || undefined, reportKey: reportKey || undefined };
  }
  if (hasAppendixTitle && hasAppendixImageBlock && hasIdentityValue && identitySignals >= 1) {
    return { kind: 'appendix', reason: 'Trang phụ lục ảnh là end-anchor của report.', identityKey: identityKey || undefined, reportKey: reportKey || undefined };
  }
  if (hasResultPageMarker && !hasAppendixTitle && !hasReportTitle) {
    return { kind: 'noise', reason: 'Trang nội dung kết quả thử nghiệm.', reportKey: reportKey || undefined };
  }
  return { kind: 'ambiguous', reason: 'Không đủ dấu hiệu cover ổn định.', reportKey: reportKey || undefined };
}

function buildManualFooterSegment(totalPages: number, sourceFileName: string): KqtnBulkSegmentDraft[] {
  return [{
    sourceFileName,
    pageStart: 1,
    pageEnd: Math.max(1, Math.floor(totalPages)),
    metadata: {
      pageNumber: 1,
      isReportCover: false,
      isBlank: false,
    },
    detection: 'manual',
  }];
}

export function buildKqtnFooterSegments(
  footerPages: KqtnBulkFooterPage[],
  totalPages: number,
  sourceFileName: string,
): KqtnBulkSegmentDraft[] {
  const safeTotalPages = Math.max(0, Math.floor(totalPages));
  if (safeTotalPages === 0) return [];

  const pagesByNumber = new Map(
    footerPages
      .filter((page) => page.pageNumber >= 1 && page.pageNumber <= safeTotalPages)
      .map((page) => [page.pageNumber, page]),
  );
  if (pagesByNumber.size !== safeTotalPages) return buildManualFooterSegment(safeTotalPages, sourceFileName);

  const normalizedKeys = Array.from({ length: safeTotalPages }, (_, index) => normalizeFooterKey(pagesByNumber.get(index + 1)?.footerKey));
  if (!normalizedKeys[0] || safeTotalPages < 2 || normalizedKeys[1] !== normalizedKeys[0]) {
    return buildManualFooterSegment(safeTotalPages, sourceFileName);
  }

  const starts = [1];
  for (let pageNumber = 2; pageNumber <= safeTotalPages; pageNumber += 1) {
    const currentKey = normalizedKeys[pageNumber - 1];
    const previousKey = normalizedKeys[pageNumber - 2];
    if (!currentKey || currentKey === previousKey) continue;
    const nextKey = normalizedKeys[pageNumber] || '';
    if (nextKey !== currentKey) return buildManualFooterSegment(safeTotalPages, sourceFileName);
    starts.push(pageNumber);
  }
  if (starts.length < 2) return buildManualFooterSegment(safeTotalPages, sourceFileName);

  return starts.flatMap((pageStart, index) => {
    const nextStart = starts[index + 1] || safeTotalPages + 1;
    let pageEnd = nextStart - 1;
    while (pageEnd > pageStart && pagesByNumber.get(pageEnd)?.isBlank) pageEnd -= 1;
    if (pageStart > pageEnd) return [];
    const footerPage = Array.from({ length: pageEnd - pageStart + 1 }, (_, offset) => pagesByNumber.get(pageEnd - offset))
      .find((page) => Number.isFinite(page?.footerCurrentPage) && Number.isFinite(page?.footerTotalPages))
      || pagesByNumber.get(pageStart);
    return [{
      sourceFileName,
      pageStart,
      pageEnd,
      metadata: {
        pageNumber: pageStart,
        isReportCover: false,
        isBlank: Boolean(footerPage?.isBlank),
        footerKey: footerPage?.footerKey?.trim() || normalizedKeys[pageStart - 1],
        footerCurrentPage: footerPage?.footerCurrentPage,
        footerTotalPages: footerPage?.footerTotalPages,
      },
      detection: 'footer' as const,
    }];
  });
}

export function buildKqtnBulkSegments(
  pages: KqtnBulkStructurePage[],
  totalPages: number,
  sourceFileName: string,
): KqtnBulkSegmentDraft[] {
  const safeTotalPages = Math.max(0, Math.floor(totalPages));
  if (safeTotalPages === 0) return [];

  const pagesByNumber = new Map(
    pages
      .filter((page) => page.pageNumber >= 1 && page.pageNumber <= safeTotalPages)
      .map((page) => [page.pageNumber, page]),
  );
  const covers = [...pagesByNumber.values()]
    .filter(isStrongKqtnBulkCoverMarker)
    .sort((left, right) => left.pageNumber - right.pageNumber);

  if (covers.length === 0) {
    return [{
      sourceFileName,
      pageStart: 1,
      pageEnd: safeTotalPages,
      metadata: pagesByNumber.get(1) || {
        pageNumber: 1,
        isReportCover: false,
        isBlank: false,
      },
      detection: 'manual',
    }];
  }

  return covers.flatMap((cover, index) => {
    const nextCoverPage = covers[index + 1]?.pageNumber ?? safeTotalPages + 1;
    let pageEnd = Math.min(safeTotalPages, nextCoverPage - 1);
    while (pageEnd > cover.pageNumber && pagesByNumber.get(pageEnd)?.isBlank) {
      pageEnd -= 1;
    }
    if (cover.pageNumber > pageEnd) return [];
    return [{
      sourceFileName,
      pageStart: cover.pageNumber,
      pageEnd,
      metadata: cover,
      detection: 'ai' as const,
    }];
  });
}

export function buildKqtnFastCandidateSegments(
  candidatePages: KqtnBulkFooterPage[],
  totalPages: number,
  sourceFileName: string,
): KqtnBulkSegmentDraft[] {
  const safeTotalPages = Math.max(0, Math.floor(totalPages));
  if (safeTotalPages === 0) return [];

  const entries = candidatePages
    .filter((page) => page.isCandidate !== false && page.pageNumber >= 1 && page.pageNumber <= safeTotalPages)
    .map((page) => {
      const ocrMetadata = parseKqtnOcrMetadata(page.text || '');
      const evidence = classifyKqtnFastCandidate(page);

      return { page, ocrMetadata, evidence };
    })
    .sort((left, right) => left.page.pageNumber - right.page.pageNumber);

  const reportKeys = [...new Set(entries
    .map(({ evidence }) => evidence.reportKey)
    .filter((value): value is string => Boolean(value)))];

  if (reportKeys.length >= 2) {
    const groups = reportKeys.map((reportKey) => ({
      reportKey,
      entries: entries.filter(({ evidence }) => evidence.reportKey === reportKey),
    }));
    if (groups.some((group) => !group.entries.some(({ evidence }) => evidence.kind === 'cover' || evidence.kind === 'appendix'))) {
      return buildManualFooterSegment(safeTotalPages, sourceFileName);
    }
    const firstEntry = groups[0]?.entries[0];
    if (!firstEntry || (firstEntry.page.pageNumber !== 1 && firstEntry.evidence.kind !== 'cover')) {
      return buildManualFooterSegment(safeTotalPages, sourceFileName);
    }

    const starts = [1];
    for (let index = 1; index < groups.length; index += 1) {
      const previousGroup = groups[index - 1];
      const currentEntry = groups[index].entries[0];
      if (!currentEntry) return buildManualFooterSegment(safeTotalPages, sourceFileName);

      const appendixEnd = previousGroup.entries
        .filter(({ evidence }) => evidence.kind === 'appendix')
        .at(-1)?.page.pageNumber;
      const nextStart = appendixEnd
        ? appendixEnd + 1
        : currentEntry.evidence.kind === 'cover'
          ? currentEntry.page.pageNumber
          : currentEntry.evidence.kind === 'noise' && currentEntry.page.pageNumber > 1
            ? currentEntry.page.pageNumber - 1
            : 0;
      if (nextStart < 1 || nextStart > safeTotalPages || nextStart <= starts[index - 1]) {
        return buildManualFooterSegment(safeTotalPages, sourceFileName);
      }
      starts.push(nextStart);
    }

    const structurePages = groups.map((group, index) => {
      const representative = group.entries.find(({ evidence }) => evidence.kind === 'cover') || group.entries[0];
      const metadata = group.entries.reduce((current, entry) => ({
        sampleCode: current.sampleCode || entry.ocrMetadata.sampleCode,
        model: current.model || entry.ocrMetadata.model,
        brand: current.brand || entry.ocrMetadata.brand,
      }), { sampleCode: '', model: '', brand: '' });
      const appendixEnd = group.entries
        .filter(({ evidence }) => evidence.kind === 'appendix')
        .at(-1)?.page.pageNumber;
      const expectedEnd = starts[index + 1] ? starts[index + 1] - 1 : safeTotalPages;
      if (appendixEnd && index < groups.length - 1 && appendixEnd !== expectedEnd) {
        return null;
      }
      return {
        pageNumber: starts[index],
        isReportCover: true,
        isBlank: false,
        reportNo: group.reportKey,
        sampleCode: metadata.sampleCode,
        model: metadata.model,
        brand: metadata.brand,
        footerKey: representative?.page.footerKey || group.reportKey,
        footerCurrentPage: [...group.entries]
          .map(({ page }) => page)
          .filter((page) => Number.isFinite(page.footerCurrentPage) && Number.isFinite(page.footerTotalPages))
          .sort((left, right) => (left.footerCurrentPage || 0) - (right.footerCurrentPage || 0))
          .at(-1)?.footerCurrentPage,
        footerTotalPages: [...group.entries]
          .map(({ page }) => page)
          .filter((page) => Number.isFinite(page.footerCurrentPage) && Number.isFinite(page.footerTotalPages))
          .sort((left, right) => (left.footerCurrentPage || 0) - (right.footerCurrentPage || 0))
          .at(-1)?.footerTotalPages,
      } satisfies KqtnBulkStructurePage;
    });
    if (structurePages.some((page) => page === null)) {
      return buildManualFooterSegment(safeTotalPages, sourceFileName);
    }
    return buildKqtnBulkSegments(structurePages as KqtnBulkStructurePage[], safeTotalPages, sourceFileName);
  }

  const confirmedPages = entries
    .filter(({ evidence }) => evidence.kind === 'cover')

  const seenIdentities = new Set<string>();
  const structurePages = confirmedPages
    .filter(({ evidence }) => {
      if (!evidence.identityKey) return true;
      if (seenIdentities.has(evidence.identityKey)) return false;
      seenIdentities.add(evidence.identityKey);
      return true;
    })
    .map(({ page, ocrMetadata, evidence }) => ({
      pageNumber: page.pageNumber,
      isReportCover: true,
      isBlank: page.isBlank,
      reportNo: evidence.reportKey || page.footerKey,
      sampleCode: ocrMetadata.sampleCode,
      model: ocrMetadata.model,
      brand: ocrMetadata.brand,
      footerKey: page.footerKey,
      footerCurrentPage: page.footerCurrentPage,
      footerTotalPages: page.footerTotalPages,
    }));

  return buildKqtnBulkSegments(structurePages, safeTotalPages, sourceFileName);
}

export function validateKqtnBulkSegments(
  segments: Array<Pick<KqtnBulkSegmentDraft, 'pageStart' | 'pageEnd'>>,
  totalPages: number,
): string[] {
  const errors: string[] = [];
  const safeTotalPages = Math.max(1, Math.floor(totalPages));
  const ordered = segments
    .map((segment, index) => ({ ...segment, index }))
    .sort((left, right) => left.pageStart - right.pageStart || left.index - right.index);

  let previous: (typeof ordered)[number] | undefined;
  for (const segment of ordered) {
    const label = `Nhóm ${segment.index + 1}`;
    if (segment.pageStart > segment.pageEnd) {
      errors.push(`${label} có khoảng trang không hợp lệ.`);
    }
    if (segment.pageStart < 1 || segment.pageEnd > safeTotalPages) {
      errors.push(`${label} vượt quá tổng số trang PDF nguồn.`);
    }
    if (previous && segment.pageStart <= previous.pageEnd) {
      errors.push(`${label} bị chồng trang với nhóm trước.`);
    }
    previous = segment;
  }
  return errors;
}

export function validateKqtnBulkFooterPageCounts(
  segments: Array<Pick<KqtnBulkSegmentDraft, 'pageStart' | 'pageEnd' | 'metadata'>>,
): string[] {
  return segments.flatMap((segment, index) => {
    const expectedPages = segment.metadata.footerTotalPages;
    if (!Number.isFinite(expectedPages) || (expectedPages || 0) < 1) return [];
    const actualPages = segment.pageEnd - segment.pageStart + 1;
    return actualPages === expectedPages
      ? []
      : [`Nhóm ${index + 1} có ${actualPages} trang, nhưng footer OCR ghi tổng ${expectedPages} trang.`];
  });
}

// --- End of kqtnBulkSplit.ts ---
