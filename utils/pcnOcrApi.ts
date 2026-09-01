import type { PcnOcrContext, PcnOcrDraft } from '../types.ts';
import { isPcnOcrFileSupported, normalizePcnOcrDraft } from './pcnOcrPolicy.ts';

export interface PcnOcrResponse {
  draft: PcnOcrDraft;
  provider: string;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : (payload as { error?: string; message?: string })?.error || (payload as { message?: string })?.message;
    throw new Error(message || `OCR PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function runPcnOcr(file: File, context: PcnOcrContext): Promise<PcnOcrResponse> {
  if (!isPcnOcrFileSupported(file.type, file.name)) throw new Error('OCR PCN chỉ nhận PDF, DOCX, PNG, JPG hoặc JPEG.');
  const response = await fetch('/api/pcn/ocr', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context, fileName: file.name, mimeType: file.type, base64Data: await fileToBase64(file) }),
  });
  const payload = await parseResponse(response) as { draft?: unknown; provider?: string };
  return { draft: normalizePcnOcrDraft(payload.draft), provider: String(payload.provider || 'PADDLEOCR') };
}

// --- End of pcnOcrApi.ts ---
