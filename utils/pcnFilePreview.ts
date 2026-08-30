// Author: Codex
// OS support: Web
// Description: Safe client-side classification for the PCN inline file preview

export type PcnFilePreviewKind = 'PDF' | 'IMAGE' | 'UNSUPPORTED';

const SAFE_RASTER_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function normalizedMimeType(mimeType?: string): string {
  return String(mimeType || '').split(';', 1)[0].trim().toLowerCase();
}

function fileExtension(fileName?: string): string {
  const normalized = String(fileName || '').trim().toLowerCase();
  const separator = normalized.lastIndexOf('.');
  return separator > -1 ? normalized.slice(separator + 1) : '';
}

export function getPcnFilePreviewKind(mimeType?: string, fileName?: string): PcnFilePreviewKind {
  const normalized = normalizedMimeType(mimeType);
  if (normalized === 'application/pdf' || (!normalized && fileExtension(fileName) === 'pdf')) return 'PDF';
  if (SAFE_RASTER_IMAGE_TYPES.has(normalized)) return 'IMAGE';
  if (!normalized && ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(fileExtension(fileName))) return 'IMAGE';
  return 'UNSUPPORTED';
}

// --- End of pcnFilePreview.ts ---
