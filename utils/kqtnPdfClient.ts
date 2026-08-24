// Author: Gemini
// OS support: Web/Node
// Description: Browser client for KQTN PDF upload, inspection, download, and AI metadata extraction.

import type { KqtnPdfMetadata } from '../types';
import { getGeminiHeaders } from './gemini';
import type { KqtnBulkFooterPage, KqtnBulkStructurePage } from './kqtnBulkSplit';

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

export interface KqtnPdfAiMetadata {
  sampleCode?: string;
  model?: string;
  brand?: string;
}

export async function extractKqtnPdfMetadata(base64Data: string, mimeType = 'application/pdf'): Promise<KqtnPdfAiMetadata> {
  const response = await fetch('/api/gemini/extract-kqtn-metadata', {
    method: 'POST',
    headers: getGeminiHeaders(),
    body: JSON.stringify({ base64Data, mimeType }),
  });
  return parseResponse(response);
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
