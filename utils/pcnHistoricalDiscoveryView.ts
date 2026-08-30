// Author: Codex
// OS support: Browser
// Description: Pure filtering and pagination helpers for the large PCN history discovery list

import type { PcnHistoricalDiscoveryResult, PcnHistoricalSourceCandidate } from './pcnHistoricalSourceDiscovery.ts';

export type PcnHistoricalIgnoredFolder = PcnHistoricalDiscoveryResult['ignoredFolders'][number];

export function getPcnHistoricalCandidateKey(candidate: Pick<PcnHistoricalSourceCandidate, 'fieldCode' | 'businessCode'>): string {
  return `${String(candidate.fieldCode || '').trim().toUpperCase()}:${String(candidate.businessCode || '').trim().toUpperCase()}`;
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi-VN');
}

export function filterPcnHistoricalCandidates(
  candidates: PcnHistoricalSourceCandidate[],
  query = '',
): PcnHistoricalSourceCandidate[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return candidates;
  return candidates.filter((candidate) => normalizeSearchText([
    getPcnHistoricalCandidateKey(candidate),
    candidate.folderName,
    candidate.customerName,
    candidate.productName,
    candidate.sourceRelativePath,
  ].join(' ')).includes(normalizedQuery));
}

export interface PcnHistoricalCandidatePage {
  items: PcnHistoricalSourceCandidate[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}

export function paginatePcnHistoricalCandidates(
  candidates: PcnHistoricalSourceCandidate[],
  requestedPage = 1,
  pageSize = 100,
): PcnHistoricalCandidatePage {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('pageSize phải là số nguyên dương.');
  const total = candidates.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.floor(requestedPage), 1), pageCount)
    : 1;
  const start = (page - 1) * pageSize;
  return { items: candidates.slice(start, start + pageSize), page, pageCount, total, pageSize };
}

export function filterPcnHistoricalIgnoredFolders(
  folders: PcnHistoricalIgnoredFolder[],
  query = '',
): PcnHistoricalIgnoredFolder[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return folders;
  return folders.filter((folder) => normalizeSearchText([
    folder.fieldCode,
    folder.folderName,
    folder.sourceRelativePath,
    folder.reason,
  ].join(' ')).includes(normalizedQuery));
}

export interface PcnHistoricalIgnoredFolderPage {
  items: PcnHistoricalIgnoredFolder[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}

export function paginatePcnHistoricalIgnoredFolders(
  folders: PcnHistoricalIgnoredFolder[],
  requestedPage = 1,
  pageSize = 50,
): PcnHistoricalIgnoredFolderPage {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('pageSize phải là số nguyên dương.');
  const total = folders.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.floor(requestedPage), 1), pageCount)
    : 1;
  const start = (page - 1) * pageSize;
  return { items: folders.slice(start, start + pageSize), page, pageCount, total, pageSize };
}

// --- End of pcnHistoricalDiscoveryView.ts ---
