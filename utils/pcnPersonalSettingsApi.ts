export interface PcnPersonalSettings {
  provider?: 'GOOGLE_GEMINI';
  credentialScope?: 'PERSONAL_PROJECT';
  geminiApiKeyConfigured: boolean;
  geminiApiKeyHint?: string;
  geminiModel?: string;
}

export interface PcnPersonalSettingsUpdate {
  geminiApiKey?: string;
  clearGeminiApiKey?: boolean;
  geminiModel?: string;
}

export interface PcnGeminiModel {
  id: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

export interface PcnGeminiModelCheckResult {
  provider: 'GOOGLE_GEMINI';
  credentialScope: 'PERSONAL_PROJECT';
  models: PcnGeminiModel[];
  selectedModel?: string;
  selectedModelAvailable?: boolean;
  checkedAt: string;
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
    ...(settings.provider === 'GOOGLE_GEMINI' ? { provider: 'GOOGLE_GEMINI' as const } : {}),
    ...(settings.credentialScope === 'PERSONAL_PROJECT' ? { credentialScope: 'PERSONAL_PROJECT' as const } : {}),
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

export async function checkPcnGeminiModels(selectedModel?: string): Promise<PcnGeminiModelCheckResult> {
  const normalizedModel = String(selectedModel || '').trim();
  const query = normalizedModel ? `?model=${encodeURIComponent(normalizedModel)}` : '';
  const response = await fetch(`/api/gemini/models${query}`, { credentials: 'same-origin' });
  const payload = await parseResponse(response) as {
    provider?: unknown;
    credentialScope?: unknown;
    models?: unknown;
    selectedModel?: unknown;
    selectedModelAvailable?: unknown;
    checkedAt?: unknown;
  };
  const models = Array.isArray(payload.models)
    ? payload.models.map((model) => {
      const value = model && typeof model === 'object' && !Array.isArray(model) ? model as Record<string, unknown> : {};
      const id = String(value.id || '').trim();
      return {
        id,
        ...(String(value.displayName || '').trim() ? { displayName: String(value.displayName).trim() } : {}),
        ...(String(value.description || '').trim() ? { description: String(value.description).trim() } : {}),
        ...(Number.isFinite(Number(value.inputTokenLimit)) ? { inputTokenLimit: Number(value.inputTokenLimit) } : {}),
        ...(Number.isFinite(Number(value.outputTokenLimit)) ? { outputTokenLimit: Number(value.outputTokenLimit) } : {}),
        ...(Array.isArray(value.supportedGenerationMethods) ? { supportedGenerationMethods: value.supportedGenerationMethods.filter((item): item is string => typeof item === 'string') } : {}),
      } satisfies PcnGeminiModel;
    }).filter((model) => model.id)
    : [];
  return {
    provider: 'GOOGLE_GEMINI',
    credentialScope: 'PERSONAL_PROJECT',
    models,
    ...(String(payload.selectedModel || '').trim() ? { selectedModel: String(payload.selectedModel).trim() } : {}),
    ...(typeof payload.selectedModelAvailable === 'boolean' ? { selectedModelAvailable: payload.selectedModelAvailable } : {}),
    checkedAt: String(payload.checkedAt || new Date().toISOString()),
  };
}

// --- End of pcnPersonalSettingsApi.ts ---
