import type { PcnOcrDraft, PcnOcrEvidence, PcnOcrEvidenceProvider } from '../types.ts';

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg']);
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);
const SUPPORTED_EVIDENCE_PROVIDERS = new Set<PcnOcrEvidenceProvider>(['PADDLEOCR', 'GEMINI']);

export function isPcnOcrFileSupported(mimeType: string, fileName: string): boolean {
  const mime = String(mimeType || '').toLowerCase().trim();
  const extension = String(fileName || '').toLowerCase().split('.').pop() || '';
  return SUPPORTED_MIME_TYPES.has(mime) || SUPPORTED_EXTENSIONS.has(extension);
}

export function normalizePcnOcrDraft(value: unknown): PcnOcrDraft {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const fields = input.fields && typeof input.fields === 'object' && !Array.isArray(input.fields) ? input.fields as Record<string, string> : {};
  const confidence = Number(input.confidence);
  const sourcePage = Number(input.sourcePage);
  const provider = String(input.provider || '').trim().toUpperCase();
  return {
    fields: Object.fromEntries(Object.entries(fields).map(([key, fieldValue]) => [key, String(fieldValue || '').trim()])),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    ...(Number.isInteger(sourcePage) && sourcePage > 0 ? { sourcePage } : {}),
    ...(typeof input.sourceFileName === 'string' ? { sourceFileName: input.sourceFileName } : {}),
    ...(SUPPORTED_EVIDENCE_PROVIDERS.has(provider as PcnOcrEvidenceProvider) ? { provider: provider as PcnOcrEvidenceProvider } : {}),
    ...(input.confirmed === true ? { confirmed: true } : {}),
  };
}

export function normalizePcnOcrEvidence(
  value: unknown,
  stamp: { confirmedAt?: string; confirmedBy?: string } = {},
): PcnOcrEvidence {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const provider = String(input.provider || '').trim().toUpperCase() as PcnOcrEvidenceProvider;
  const sourceFileName = String(input.sourceFileName || '').trim();
  const confidence = Number(input.confidence);
  const sourcePage = Number(input.sourcePage);
  const confirmedAt = String(stamp.confirmedAt || input.confirmedAt || '').trim();
  const confirmedBy = String(stamp.confirmedBy || input.confirmedBy || '').trim();

  if (!SUPPORTED_EVIDENCE_PROVIDERS.has(provider)) throw new Error('Bằng chứng OCR phải có nhà cung cấp OCR hợp lệ.');
  if (!sourceFileName || sourceFileName.length > 255 || /[\\/]/.test(sourceFileName)) throw new Error('Bằng chứng OCR phải có tên file scan hợp lệ.');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Độ tin cậy OCR không hợp lệ.');
  if (!confirmedAt) throw new Error('Bằng chứng OCR phải có thời điểm xác nhận.');

  return {
    provider,
    sourceFileName,
    ...(Number.isInteger(sourcePage) && sourcePage > 0 ? { sourcePage } : {}),
    confidence,
    confirmedAt,
    ...(confirmedBy ? { confirmedBy } : {}),
  };
}

export function requiresPcnOcrConfirmation(draft: PcnOcrDraft): boolean {
  return draft.confirmed !== true;
}

// --- End of pcnOcrPolicy.ts ---
