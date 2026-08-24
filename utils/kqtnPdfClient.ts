// Author: Gemini
// OS support: Web/Node
// Description: Browser client for KQTN PDF upload, inspection, download, and AI metadata extraction.

import type { KqtnPdfMetadata } from '../types';
import { getGeminiHeaders } from './gemini';
import type { KqtnBulkStructurePage } from './kqtnBulkSplit';

async function parseResponse(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `KQTN PDF request failed (${response.status}).`);
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
  const payload = await parseResponse(response);
  return Array.isArray(payload.pages) ? payload.pages as KqtnBulkStructurePage[] : [];
}

// --- End of kqtnPdfClient.ts ---
