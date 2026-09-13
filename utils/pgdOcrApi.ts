import type { PgdOcrDraft } from './pgdOcrParser.ts';

export type { PgdOcrDraft } from './pgdOcrParser.ts';

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

export async function runPgdOcr(file: File): Promise<PgdOcrDraft> {
  const response = await fetch('/api/pgd/ocr', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Data: await fileToBase64(file) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `OCR PGD trả về HTTP ${response.status}`));
  const draft = payload?.draft || {};
  return {
    fields: typeof draft.fields === 'object' && draft.fields ? draft.fields as Record<string, string> : {},
    confidence: Number.isFinite(Number(draft.confidence)) ? Number(draft.confidence) : 0,
    ...(Number.isInteger(Number(draft.sourcePage)) ? { sourcePage: Number(draft.sourcePage) } : {}),
    ...(typeof draft.sourceFileName === 'string' ? { sourceFileName: draft.sourceFileName } : {}),
    ...(typeof payload?.provider === 'string' ? { provider: payload.provider.toUpperCase() as PgdOcrDraft['provider'] } : {}),
  };
}
