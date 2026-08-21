// Author: Gemini
// OS support: Web/Node
// Description: Gemini credential resolution and configuration messages

export const GEMINI_API_KEY_MISSING_MESSAGE =
  'Chưa cấu hình Gemini API Key. Vui lòng nhập API Key cá nhân trong Cài đặt hoặc cấu hình GEMINI_API_KEY.';

export const GEMINI_API_UPSTREAM_UNAVAILABLE_CODE = 'GEMINI_API_UPSTREAM_UNAVAILABLE';

export const GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE =
  'Không thể kết nối tới Google Gemini. Vui lòng kiểm tra mạng, proxy hoặc thử lại sau.';

export function isGeminiUpstreamUnavailable(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
  return /fetch failed|failed sending request|econnreset|enotfound|etimedout|eai_again|network error/.test(message);
}

function normalizeGeminiApiKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveGeminiApiKey(
  serverApiKey: string | undefined,
  userApiKey: string | string[] | undefined
): string | undefined {
  const normalizedUserKey = typeof userApiKey === 'string' ? normalizeGeminiApiKey(userApiKey) : undefined;
  return normalizedUserKey || normalizeGeminiApiKey(serverApiKey);
}

// --- End of geminiCredentials.ts ---
