import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isUsableOcrCandidate,
  runPaddleFirstWithGeminiFallback,
  type OcrCandidate,
} from '../utils/ocrPipeline.ts';

test('returns PaddleOCR output and does not call Gemini when confidence is usable', async () => {
  const calls: string[] = [];
  const result = await runPaddleFirstWithGeminiFallback<OcrCandidate>({
    confidenceThreshold: 0.75,
    paddle: async () => {
      calls.push('paddle');
      return { text: 'Model ABC-123', confidence: 0.91 };
    },
    gemini: async () => {
      calls.push('gemini');
      return { text: 'Gemini result', confidence: 0.8 };
    },
  });

  assert.deepEqual(calls, ['paddle']);
  assert.equal(result.provider, 'PADDLEOCR');
  assert.equal(result.value.text, 'Model ABC-123');
});

test('falls back to Gemini when PaddleOCR fails or is below the confidence threshold', async () => {
  const calls: string[] = [];
  const result = await runPaddleFirstWithGeminiFallback<OcrCandidate>({
    confidenceThreshold: 0.75,
    paddle: async () => {
      calls.push('paddle');
      return { text: 'mờ', confidence: 0.42 };
    },
    gemini: async () => {
      calls.push('gemini');
      return { text: 'Model CLEAR-456', confidence: 0.78 };
    },
  });

  assert.deepEqual(calls, ['paddle', 'gemini']);
  assert.equal(result.provider, 'GEMINI');
  assert.equal(result.value.text, 'Model CLEAR-456');

  await assert.rejects(
    () => runPaddleFirstWithGeminiFallback<OcrCandidate>({
      paddle: async () => { throw new Error('Paddle unavailable'); },
      gemini: async () => { throw new Error('GEMINI_API_KEY_MISSING'); },
    }),
    /GEMINI_API_KEY_MISSING/,
  );
});

test('treats empty PaddleOCR text as unusable even when the service reports confidence', () => {
  assert.equal(isUsableOcrCandidate({ text: '   ', confidence: 0.99 }, 0.75), false);
  assert.equal(isUsableOcrCandidate({ text: 'đã đọc', confidence: 0.74 }, 0.75), false);
  assert.equal(isUsableOcrCandidate({ text: 'đã đọc', confidence: 0.75 }, 0.75), true);
});

// --- End of ocr-pipeline.test.ts ---
