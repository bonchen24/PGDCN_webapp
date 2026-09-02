import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPcnPaddleOcrRequest,
  normalizePcnPaddleOcrPage,
  PcnPaddleOcrUnavailableError,
} from '../utils/pcnApprovalReviewOcr.ts';

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
