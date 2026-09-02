export type PcnPaddleOcrErrorCode =
  | 'PADDLE_OCR_UNAVAILABLE'
  | 'PADDLE_OCR_EMPTY'
  | 'PADDLE_OCR_LOW_CONFIDENCE';

export class PcnPaddleOcrUnavailableError extends Error {
  readonly code: PcnPaddleOcrErrorCode;

  constructor(code: PcnPaddleOcrErrorCode, message: string) {
    super(message);
    this.name = 'PcnPaddleOcrUnavailableError';
    this.code = code;
  }
}

export interface PcnPaddleOcrRequestInput {
  fileName: string;
  mimeType: string;
  page: number;
  dpi?: number;
}

export interface PcnPaddleOcrRequest {
  url: string;
  method: 'POST';
  fileName: string;
  mimeType: string;
  page: number;
  dpi: number;
}

export interface PcnPaddleOcrPage {
  assetId: string;
  fileName: string;
  text: string;
  page: number;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

function isPdf(input: PcnPaddleOcrRequestInput): boolean {
  return input.mimeType.toLowerCase().includes('pdf') || input.fileName.toLowerCase().endsWith('.pdf');
}

function isImage(input: PcnPaddleOcrRequestInput): boolean {
  return input.mimeType.toLowerCase().startsWith('image/') || /\.(?:png|jpe?g|webp|tiff?)$/i.test(input.fileName);
}

export function buildPcnPaddleOcrRequest(baseUrl: string, input: PcnPaddleOcrRequestInput): PcnPaddleOcrRequest {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  if (!normalizedBaseUrl || (!isPdf(input) && !isImage(input))) {
    throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', 'Định dạng hoặc địa chỉ PaddleOCR không hợp lệ.');
  }
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const dpi = Math.max(72, Math.min(300, Math.floor(Number(input.dpi) || 150)));
  const endpoint = isPdf(input) ? '/ocr/pdf/page' : '/ocr/image';
  const url = new URL(`${normalizedBaseUrl}${endpoint}`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('dpi', String(dpi));
  return { url: url.toString(), method: 'POST', fileName: input.fileName, mimeType: input.mimeType, page, dpi };
}

function getText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  const value = payload as Record<string, unknown>;
  const direct = [value.text, value.rawText, value.ocrText, value.result].find((item) => typeof item === 'string' && item.trim());
  if (typeof direct === 'string') return direct;
  const arrays = [value.lines, value.results, value.data].find(Array.isArray);
  if (!Array.isArray(arrays)) return '';
  return arrays.map((item) => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return '';
    const record = item as Record<string, unknown>;
    return typeof record.text === 'string' ? record.text : typeof record.value === 'string' ? record.value : '';
  }).filter(Boolean).join('\n');
}

function getNumber(payload: unknown, keys: string[]): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = payload as Record<string, unknown>;
  for (const key of keys) {
    const number = Number(value[key]);
    if (Number.isFinite(number) && number >= 0 && number <= 1) return number;
  }
  const records = [value.lines, value.results, value.data].filter(Array.isArray).flat();
  const scores = records.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    return keys.map((key) => Number((item as Record<string, unknown>)[key])).filter((number) => Number.isFinite(number) && number >= 0 && number <= 1);
  });
  if (scores.length > 0) return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return undefined;
}

function getBoundingBox(payload: unknown): PcnPaddleOcrPage['boundingBox'] | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = payload as Record<string, unknown>;
  const arrays = [value.lines, value.results, value.data].filter(Array.isArray).flat();
  const candidate = value.boundingBox || value.bbox || arrays.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).boundingBox || (item as Record<string, unknown>).bbox || (item as Record<string, unknown>).box : undefined).find(Boolean);
  if (!candidate || typeof candidate !== 'object') return undefined;
  if (Array.isArray(candidate) && candidate.length >= 4) {
    const values = candidate.slice(0, 4).map(Number);
    if (values.every(Number.isFinite)) return { x: values[0], y: values[1], width: values[2], height: values[3] };
  }
  const box = candidate as Record<string, unknown>;
  const values = ['x', 'y', 'width', 'height'].map((key) => Number(box[key]));
  if (values.every(Number.isFinite)) return { x: values[0], y: values[1], width: values[2], height: values[3] };
  return undefined;
}

export function normalizePcnPaddleOcrPage(
  payload: unknown,
  input: { assetId: string; fileName: string; page: number; confidenceThreshold?: number },
): PcnPaddleOcrPage {
  const text = getText(payload).replace(/\u0000/g, '').trim();
  if (!text) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_EMPTY', `PaddleOCR không đọc được ${input.fileName}, trang ${input.page}.`);
  const confidence = getNumber(payload, ['confidence', 'score', 'meanConfidence']);
  const threshold = input.confidenceThreshold ?? 0.55;
  if (confidence !== undefined && confidence < threshold) {
    throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_LOW_CONFIDENCE', `Độ tin cậy PaddleOCR của ${input.fileName}, trang ${input.page} quá thấp.`);
  }
  return {
    assetId: input.assetId,
    fileName: input.fileName,
    text,
    page: Math.max(1, Math.floor(Number(input.page) || 1)),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(getBoundingBox(payload) ? { boundingBox: getBoundingBox(payload) } : {}),
  };
}
