import assert from 'node:assert/strict';
import test from 'node:test';
import AdmZip from 'adm-zip';

import {
  buildPcnPaddleOcrRequest,
  normalizePcnPaddleOcrPage,
  PcnPaddleOcrUnavailableError,
} from '../utils/pcnApprovalReviewOcr.ts';
import { extractPcnDocxEmbeddedImages } from '../utils/pcnDocxOcr.ts';

test('scanned DOCX exposes embedded images for PaddleOCR instead of stopping at empty text extraction', () => {
  const zip = new AdmZip();
  zip.addFile('word/media/image1.png', Buffer.from([0, 1, 2]));
  zip.addFile('word/media/image2.jpg', Buffer.from([3, 4, 5]));
  zip.addFile('word/document.xml', Buffer.from('<w:document />'));

  const images = extractPcnDocxEmbeddedImages(zip.toBuffer());

  assert.deepEqual(images.map((image) => ({ fileName: image.fileName, mimeType: image.mimeType })), [
    { fileName: 'image1.png', mimeType: 'image/png' },
    { fileName: 'image2.jpg', mimeType: 'image/jpeg' },
  ]);
  assert.deepEqual([...images[0].bytes], [0, 1, 2]);
});

test('approval review sends PDF and image pages to PaddleOCR without a dossier-size limit', () => {
  const pdf = buildPcnPaddleOcrRequest('http://127.0.0.1:8100', {
    fileName: 'bo-ho-so.pdf',
    mimeType: 'application/pdf',
    page: 7,
    dpi: 150,
  });
  assert.equal(pdf.url, 'http://127.0.0.1:8100/ocr/pdf/page?page=7&dpi=150');
  assert.equal(pdf.method, 'POST');
  assert.equal(pdf.fileName, 'bo-ho-so.pdf');

  const image = buildPcnPaddleOcrRequest('http://ocr.internal/', {
    fileName: 'anh-tem.jpg',
    mimeType: 'image/jpeg',
    page: 1,
    dpi: 150,
  });
  assert.equal(image.url, 'http://ocr.internal/ocr/image?page=1&dpi=150');
  assert.equal(image.method, 'POST');
});

test('PaddleOCR response keeps page/confidence/evidence and rejects empty or low-confidence text', () => {
  const page = normalizePcnPaddleOcrPage({
    text: 'Mã mẫu M01',
    confidence: 0.91,
    boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
  }, { assetId: 'asset-1', fileName: 'scan.pdf', page: 3 });
  assert.equal(page.text, 'Mã mẫu M01');
  assert.equal(page.page, 3);
  assert.equal(page.confidence, 0.91);
  assert.deepEqual(page.boundingBox, { x: 0.1, y: 0.2, width: 0.3, height: 0.1 });

  const linePayload = normalizePcnPaddleOcrPage({ lines: [{ text: 'M02', confidence: 0.88, bbox: { x: 1, y: 2, width: 3, height: 4 } }] }, { assetId: 'asset-1', fileName: 'scan.pdf', page: 3 });
  assert.equal(linePayload.confidence, 0.88);
  assert.deepEqual(linePayload.boundingBox, { x: 1, y: 2, width: 3, height: 4 });

  assert.throws(
    () => normalizePcnPaddleOcrPage({ text: '', confidence: 0.99 }, { assetId: 'asset-1', fileName: 'scan.pdf', page: 4 }),
    (error: unknown) => error instanceof PcnPaddleOcrUnavailableError && error.code === 'PADDLE_OCR_EMPTY',
  );
  assert.throws(
    () => normalizePcnPaddleOcrPage({ text: 'không rõ', confidence: 0.39 }, { assetId: 'asset-1', fileName: 'scan.pdf', page: 5 }),
    (error: unknown) => error instanceof PcnPaddleOcrUnavailableError && error.code === 'PADDLE_OCR_LOW_CONFIDENCE',
  );
});
