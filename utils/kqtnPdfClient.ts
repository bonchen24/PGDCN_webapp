// Author: Gemini
// OS support: Web/Node
// Description: Browser client for KQTN PDF upload, inspection, download, and AI metadata extraction.

import type { KqtnPdfMetadata } from '../types';
import { getGeminiHeaders } from './gemini';
import type { KqtnBulkFooterPage, KqtnBulkStructurePage } from './kqtnBulkSplit';
import { extractKqtnFooterKey } from './kqtnOcrMetadata';

export const KQTN_STRUCTURE_TIMEOUT_CODE = 'KQTN_STRUCTURE_TIMEOUT';

function isStructureTimeoutStatus(status: number): boolean {
  return status === 504 || status === 524;
}

export function isKqtnStructureTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes(KQTN_STRUCTURE_TIMEOUT_CODE) || /KQTN PDF request failed \((504|524)\)/.test(message);
}

async function parseResponse(response: Response, options: { structureTimeout?: boolean } = {}): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (options.structureTimeout && (payload.code === KQTN_STRUCTURE_TIMEOUT_CODE || isStructureTimeoutStatus(response.status))) {
      throw new Error(`${KQTN_STRUCTURE_TIMEOUT_CODE}: ${payload.error || 'KQTN structure extraction timed out; manual split is required.'}`);
    }
    throw new Error(payload.error || `KQTN PDF request failed (${response.status}).`);
  }
  return payload;
}

export async function uploadKqtnPdf(recordId: string, file: File): Promise<KqtnPdfMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api/kqtn/${encodeURIComponent(recordId)}/pdf`, {
    method: 'POST',
    body: formData,
  });
  const payload = await parseResponse(response);
  return payload.resultPdf as KqtnPdfMetadata;
}

export async function deleteKqtnPdf(recordId: string): Promise<void> {
  const response = await fetch(`/api/kqtn/${encodeURIComponent(recordId)}/pdf`, { method: 'DELETE' });
  await parseResponse(response);
}

export function getKqtnPdfUrl(recordId: string, download = false): string {
  return `/api/kqtn/${encodeURIComponent(recordId)}/pdf${download ? '?download=1' : ''}`;
}

export async function establishKqtnSession(username: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/kqtn-session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: String(username || '').trim(), password: String(password || '') }),
  });
  await parseResponse(response);
}

export async function clearKqtnSession(): Promise<void> {
  const response = await fetch('/api/auth/kqtn-session', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  await parseResponse(response);
}

export async function downloadKqtnPdf(
  recordId: string,
  username: string,
  fileName = 'kqtn-result.pdf',
): Promise<void> {
  const normalizedUsername = String(username || '').trim();
  if (!normalizedUsername) throw new Error('Thiếu thông tin người dùng để tải PDF KQTN.');

  const response = await fetch(getKqtnPdfUrl(recordId, true), {
    credentials: 'same-origin',
    headers: { 'x-user-name': normalizedUsername },
  });
  if (!response.ok) {
    await parseResponse(response);
    return;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = String(fileName || 'kqtn-result.pdf').trim() || 'kqtn-result.pdf';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export interface KqtnPdfAiMetadata {
  sampleCode?: string;
  model?: string;
  brand?: string;
}

export interface KqtnPaddleOcrResult {
  success: boolean;
  page: number;
  text: string;
  confidence: number;
  word_count: number;
  processing_time_s: number;
}

export interface KqtnFooterJobStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  strategy?: 'footer-batch';
  totalPages: number;
  processedPages: number;
  pages: KqtnBulkFooterPage[];
  error?: string;
}

export async function startKqtnFooterJob(
  file: File,
  totalPages = 0,
): Promise<KqtnFooterJobStatus> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('totalPages', String(Math.max(0, Math.floor(totalPages))));
  const response = await fetch('/api/kqtn/ocr/footer-jobs', {
    method: 'POST',
    body: formData,
  });
  const payload = await parseResponse(response);
  if (!payload.jobId) throw new Error('KQTN footer OCR job không trả về jobId.');
  return {
    jobId: String(payload.jobId),
    status: payload.status,
    strategy: payload.strategy === 'footer-batch' ? payload.strategy : undefined,
    totalPages: Number(payload.totalPages) || totalPages,
    processedPages: Number(payload.processedPages) || 0,
    pages: [],
  };
}

export async function getKqtnFooterJob(jobId: string): Promise<KqtnFooterJobStatus> {
  const response = await fetch('/api/kqtn/ocr/footer-jobs/' + encodeURIComponent(jobId));
  const payload = await parseResponse(response);
  return {
    jobId: String(payload.jobId || jobId),
    status: payload.status,
    strategy: payload.strategy === 'footer-batch' ? payload.strategy : undefined,
    totalPages: Number(payload.totalPages) || 0,
    processedPages: Number(payload.processedPages) || 0,
    pages: Array.isArray(payload.pages) ? payload.pages.map((page: any, index: number) => ({
      pageNumber: Number(page?.pageNumber) || index + 1,
      isBlank: Boolean(page?.isBlank),
      footerKey: String(page?.footerKey || '').trim(),
      text: typeof page?.text === 'string' ? page.text : undefined,
      confidence: Number(page?.confidence || 0),
    candidateScore: Number(page?.candidateScore ?? page?.candidate_score ?? 0),
    isCandidate: page?.isCandidate !== false,
    footerCurrentPage: Number(page?.footerCurrentPage ?? page?.footer_current_page) || undefined,
    footerTotalPages: Number(page?.footerTotalPages ?? page?.footer_total_pages) || undefined,
  })) : [],
    ...(payload.error ? { error: String(payload.error) } : {}),
  };
}

export async function extractKqtnPdfMetadata(base64Data: string, mimeType = 'application/pdf'): Promise<KqtnPdfAiMetadata> {
  const response = await fetch('/api/gemini/extract-kqtn-metadata', {
    method: 'POST',
    headers: getGeminiHeaders(),
    body: JSON.stringify({ base64Data, mimeType }),
  });
  return parseResponse(response);
}

export async function extractKqtnFooterWithPaddle(
  base64Data: string,
  pageNumber = 1,
): Promise<KqtnBulkFooterPage> {
  const response = await fetch('/api/kqtn/ocr/footer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, pageNumber }),
  });
  const payload = await parseResponse(response) as KqtnPaddleOcrResult;
  return {
    pageNumber,
    isBlank: !String(payload.text || '').trim() && Number(payload.confidence || 0) <= 0,
    footerKey: extractKqtnFooterKey(String(payload.text || '')),
  };
}

export async function extractKqtnPageTextWithPaddle(
  base64Data: string,
  pageNumber = 1,
): Promise<KqtnPaddleOcrResult> {
  const response = await fetch('/api/kqtn/ocr/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, pageNumber }),
  });
  return parseResponse(response) as Promise<KqtnPaddleOcrResult>;
}

export async function extractKqtnBulkStructure(
  base64Data: string,
  pageOffset = 0,
): Promise<KqtnBulkStructurePage[]> {
  const response = await fetch('/api/gemini/extract-kqtn-bulk-structure', {
    method: 'POST',
    headers: { ...getGeminiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType: 'application/pdf', pageOffset }),
  });
  const payload = await parseResponse(response, { structureTimeout: true });
  return Array.isArray(payload.pages) ? payload.pages as KqtnBulkStructurePage[] : [];
}

export async function extractKqtnBulkFooter(
  base64Data: string,
  pageOffset = 0,
): Promise<KqtnBulkFooterPage[]> {
  const response = await fetch('/api/gemini/extract-kqtn-bulk-structure', {
    method: 'POST',
    headers: { ...getGeminiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType: 'application/pdf', pageOffset, mode: 'footer' }),
  });
  const payload = await parseResponse(response, { structureTimeout: true });
  return Array.isArray(payload.pages) ? payload.pages.map((page: any, index: number) => ({
    pageNumber: Number(page?.pageNumber) || pageOffset + index + 1,
    isBlank: Boolean(page?.isBlank),
    footerKey: String(page?.footerKey || '').trim(),
  })) as KqtnBulkFooterPage[] : [];
}

// --- End of kqtnPdfClient.ts ---
