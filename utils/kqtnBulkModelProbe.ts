// Author: Codex
// OS support: Web/Node
// Description: Bounded first-page model probing helpers for combined KQTN PDFs.

import { parseKqtnOcrMetadata } from './kqtnOcrMetadata';

export const KQTN_MODEL_PROBE_MAX_PAGES = 3;

export function getKqtnModelProbePageNumbers(
  pageStart: number,
  pageEnd: number,
  maxPages = KQTN_MODEL_PROBE_MAX_PAGES,
): number[] {
  const start = Math.max(1, Math.floor(Number(pageStart)));
  const end = Math.max(start - 1, Math.floor(Number(pageEnd)));
  const limit = Math.max(0, Math.floor(Number(maxPages)));
  const length = Math.min(Math.max(0, end - start + 1), limit);
  return Array.from({ length }, (_, index) => start + index);
}

export function extractKqtnModelFromProbeTexts(texts: readonly string[]): string {
  for (const text of texts) {
    const model = parseKqtnOcrMetadata(text).model.trim();
    if (model) return model;
  }
  return '';
}

