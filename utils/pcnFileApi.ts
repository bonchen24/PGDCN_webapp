// Author: Codex
// OS support: Web
// Description: Same-origin client boundary for private PCN file assets

export interface PcnFileAsset {
  id: string;
  bucketName: string;
  objectPath: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceJsonPath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  originalName?: string;
  createdAt?: string;
}

export interface UploadPcnFileInput {
  file: File;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceJsonPath: string;
  actorUsername?: string;
}

async function parsePcnFileResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN file API trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function uploadPcnFile(input: UploadPcnFileInput): Promise<PcnFileAsset> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('sourceCollection', input.sourceCollection);
  form.append('sourceDocumentId', input.sourceDocumentId);
  form.append('sourceJsonPath', input.sourceJsonPath);

  const response = await fetch('/api/pcn/files', {
    method: 'POST',
    ...(input.actorUsername ? { headers: { 'x-user-name': input.actorUsername } } : {}),
    body: form,
  });
  const payload = await parsePcnFileResponse(response);
  return payload.asset as PcnFileAsset;
}

export function getPcnFileUrl(assetId: string, options: { download?: boolean } = {}): string {
  const query = options.download ? '?download=1' : '';
  return `/api/pcn/files/${encodeURIComponent(assetId)}${query}`;
}

// --- End of pcnFileApi.ts ---
