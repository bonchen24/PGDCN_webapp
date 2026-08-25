// Author: Codex
// OS support: Web/Node
// Description: Normalized search/filter helpers for KQTN bulk target mapping.

import type { KqtnBulkCandidate } from './kqtnBulkMatching';

const SEARCH_FIELDS: Array<keyof Pick<KqtnBulkCandidate, 'sampleCode' | 'sampleKey' | 'reportNo' | 'sampleName' | 'model' | 'brand' | 'sealStamp'>> = [
  'sampleCode',
  'sampleKey',
  'reportNo',
  'sampleName',
  'model',
  'brand',
  'sealStamp',
];

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .replace(/[Đđ]/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function searchableFields(candidate: KqtnBulkCandidate): string[] {
  return SEARCH_FIELDS.map((field) => normalizeSearchText(candidate[field]));
}

export function filterKqtnBulkCandidates(
  candidates: readonly KqtnBulkCandidate[],
  query: string,
): KqtnBulkCandidate[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...candidates];

  return candidates.filter((candidate) => {
    const fields = searchableFields(candidate);
    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}

export function getKqtnCandidateLabel(candidate: KqtnBulkCandidate): string {
  const identity = candidate.sampleCode || candidate.sampleKey || 'Chưa có mã';
  const descriptor = candidate.model || candidate.sampleName || 'Chưa có model';
  return identity + ' · ' + descriptor;
}

// --- End of kqtnCandidateFilter.ts ---
