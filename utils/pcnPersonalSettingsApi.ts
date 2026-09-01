export interface PcnPersonalSettings {
  geminiApiKeyConfigured: boolean;
  geminiApiKeyHint?: string;
  geminiModel?: string;
}

export interface PcnPersonalSettingsUpdate {
  geminiApiKey?: string;
  clearGeminiApiKey?: boolean;
  geminiModel?: string;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : (payload as { error?: string; message?: string })?.error || (payload as { message?: string })?.message;
    throw new Error(message || `Thiết lập cá nhân trả về HTTP ${response.status}`);
  }
  return payload;
}

function normalizePcnPersonalSettings(value: unknown): PcnPersonalSettings {
  const settings = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const geminiModel = String(settings.geminiModel || '').trim();
  const geminiApiKeyHint = String(settings.geminiApiKeyHint || '').trim();
  return {
    geminiApiKeyConfigured: settings.geminiApiKeyConfigured === true,
    ...(geminiApiKeyHint ? { geminiApiKeyHint } : {}),
    ...(geminiModel ? { geminiModel } : {}),
  };
}

export async function fetchPcnPersonalSettings(): Promise<PcnPersonalSettings> {
  const response = await fetch('/api/pcn/personal-settings', { credentials: 'same-origin' });
  const payload = await parseResponse(response) as { settings?: unknown };
  return normalizePcnPersonalSettings(payload.settings);
}

export async function updatePcnPersonalSettings(input: PcnPersonalSettingsUpdate): Promise<PcnPersonalSettings> {
  const response = await fetch('/api/pcn/personal-settings', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings: input }),
  });
  const payload = await parseResponse(response) as { settings?: unknown };
  return normalizePcnPersonalSettings(payload.settings);
}

// --- End of pcnPersonalSettingsApi.ts ---
