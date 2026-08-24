// Author: Gemini
// OS support: Web/Node
// Description: Pure page segmentation and validation helpers for combined KQTN PDFs.

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
}

export interface KqtnBulkFooterPage {
  pageNumber: number;
  isBlank: boolean;
  footerKey: string;
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
    const footerPage = pagesByNumber.get(pageStart);
    return [{
      sourceFileName,
      pageStart,
      pageEnd,
      metadata: {
        pageNumber: pageStart,
        isReportCover: false,
        isBlank: Boolean(footerPage?.isBlank),
        footerKey: footerPage?.footerKey?.trim() || normalizedKeys[pageStart - 1],
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

// --- End of kqtnBulkSplit.ts ---
