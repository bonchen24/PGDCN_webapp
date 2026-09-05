import AdmZip from 'adm-zip';

export interface PcnDocxEmbeddedImage {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

/** Extracts only image parts from a DOCX for the server-side PaddleOCR path. */
export function extractPcnDocxEmbeddedImages(bytes: Buffer): PcnDocxEmbeddedImage[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(bytes);
  } catch {
    return [];
  }

  return zip.getEntries()
    .filter((entry) => !entry.isDirectory && /^word\/media\//i.test(entry.entryName))
    .map((entry) => {
      const fileName = entry.entryName.split('/').pop() || 'embedded-image';
      const extension = fileName.toLowerCase().split('.').pop() || '';
      const mimeType = MIME_BY_EXTENSION[extension];
      return mimeType ? { fileName, mimeType, bytes: entry.getData() } : undefined;
    })
    .filter((image): image is PcnDocxEmbeddedImage => Boolean(image));
}
