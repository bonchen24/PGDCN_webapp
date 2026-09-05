// Author: Codex
// OS support: Web/Node
// Description: Shared PaddleOCR-first and Gemini-fallback policy helpers.

export type OcrProvider = 'PADDLEOCR' | 'GEMINI';

export interface OcrCandidate {
  text: string;
  confidence: number;
}

export interface OcrPipelineOptions<T> {
  confidenceThreshold?: number;
  paddle: () => Promise<T>;
  gemini: () => Promise<T>;
  isUsable?: (candidate: T, confidenceThreshold: number) => boolean;
}

export interface OcrPipelineResult<T> {
  provider: OcrProvider;
  value: T;
}

export function isUsableOcrCandidate(candidate: OcrCandidate, confidenceThreshold = 0.75): boolean {
  const text = String(candidate?.text || '').trim();
  const confidence = Number(candidate?.confidence);
  const threshold = Number.isFinite(confidenceThreshold) ? Math.min(1, Math.max(0, confidenceThreshold)) : 0.75;
  return Boolean(text) && Number.isFinite(confidence) && confidence >= threshold;
}

export async function runPaddleFirstWithGeminiFallback<T>(
  options: OcrPipelineOptions<T>,
): Promise<OcrPipelineResult<T>> {
  const confidenceThreshold = Number.isFinite(options.confidenceThreshold)
    ? Math.min(1, Math.max(0, Number(options.confidenceThreshold)))
    : 0.75;
  const isUsable = options.isUsable || ((candidate: T) => {
    if (!candidate || typeof candidate !== 'object') return Boolean(candidate);
    return isUsableOcrCandidate(candidate as unknown as OcrCandidate, confidenceThreshold);
  });

  try {
    const paddleValue = await options.paddle();
    if (isUsable(paddleValue, confidenceThreshold)) {
      return { provider: 'PADDLEOCR', value: paddleValue };
    }
  } catch {
    // Paddle failure is the only condition that permits the Gemini fallback.
  }

  return { provider: 'GEMINI', value: await options.gemini() };
}

// --- End of ocrPipeline.ts ---
