// Author: Codex
// Description: Build safe response headers for private KQTN PDF objects.

export type KqtnPdfDisposition = 'inline' | 'attachment';

function replaceUnsafeFilenameCharacters(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) || 0;
    if (
      codePoint <= 0x1f
      || (codePoint >= 0x7f && codePoint <= 0x9f)
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return '_';
    }
    return character;
  }).join('').replace(/[\\/]/g, '_');
}

export function sanitizeKqtnPdfFileName(value: unknown): string {
  const rawName = replaceUnsafeFilenameCharacters(String(value ?? '').trim());
  return rawName.slice(0, 255) || 'result.pdf';
}

function buildAsciiFilenameFallback(fileName: string): string {
  const withoutDiacritics = fileName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return withoutDiacritics.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim() || 'result.pdf';
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => (
    '%' + character.charCodeAt(0).toString(16).toUpperCase()
  ));
}

export function buildKqtnPdfContentDisposition(
  originalName: unknown,
  disposition: KqtnPdfDisposition = 'inline',
): string {
  const fileName = sanitizeKqtnPdfFileName(originalName);
  const asciiFallback = buildAsciiFilenameFallback(fileName);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}

