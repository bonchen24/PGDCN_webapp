// Author: Gemini
// OS support: Web/Node
// Description: Browser helpers for Gemini extraction endpoints

import { useStore } from '../store';
import { resolveGeminiModel } from './geminiSettings';

export function getGeminiHeaders(): Record<string, string> {
  const state = useStore.getState();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const geminiModel = resolveGeminiModel(state);
  if (geminiModel) headers['x-gemini-model'] = geminiModel;
  return headers;
}

function getGeminiErrorMessage(payload: any, fallback: string, status: number): string {
  const rawError = payload?.error;
  if (typeof rawError === 'string' && rawError.trim()) return rawError;
  if (rawError && typeof rawError === 'object') {
    if (rawError.code === 503 || String(rawError.status || '').includes('UNAVAILABLE')) {
      return 'Hệ thống AI (Gemini) hiện đang bị quá tải (503). Vui lòng thử lại sau vài phút.';
    }
    if (rawError.message) return rawError.message;
    return JSON.stringify(rawError);
  }
  if (status === 503) return 'Hệ thống AI (Gemini) hiện đang bị quá tải (503). Vui lòng thử lại sau vài phút.';
  return fallback;
}

export function fileToGenerativePart(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractRequestsFromFile(
  files: unknown[],
  refBrands: unknown[] = [],
  refCustomers: unknown[] = [],
  refProducts: unknown[] = []
): Promise<any> {
  try {
    const response = await fetch('/api/gemini/extract-requests', {
      method: 'POST',
      headers: getGeminiHeaders(),
      body: JSON.stringify({ files, refBrands, refCustomers, refProducts }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(getGeminiErrorMessage(payload, 'Lỗi xử lý yêu cầu trích xuất từ AI', response.status));
    }
    return await response.json();
  } catch (error: any) {
    console.error('Gemini Extraction Error:', error);
    throw new Error(error?.message || 'Lỗi trích xuất AI. Vui lòng kiểm tra lại file hoặc nhập tay.');
  }
}

export async function extractTestResultsFromPDF(
  base64Data: string,
  mimeType = 'application/pdf'
): Promise<any> {
  try {
    const response = await fetch('/api/gemini/extract-results', {
      method: 'POST',
      headers: getGeminiHeaders(),
      body: JSON.stringify({ base64Data, mimeType }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(getGeminiErrorMessage(payload, 'Lỗi trích xuất kết quả từ AI', response.status));
    }
    return await response.json();
  } catch (error: any) {
    console.error('Gemini Result Extraction Error:', error);
    throw new Error(error?.message || 'Lỗi trích xuất kết quả.');
  }
}

// --- End of gemini.ts ---
