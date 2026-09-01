import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const personalPanelSource = fs.readFileSync(new URL('../components/PcnPersonalSettingsPanel.tsx', import.meta.url), 'utf8');
const assistantSource = fs.readFileSync(new URL('../components/PcnAssistantView.tsx', import.meta.url), 'utf8');
const ocrSource = fs.readFileSync(new URL('../components/PcnOcrPanel.tsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const personalApiSource = fs.readFileSync(new URL('../utils/pcnPersonalSettingsApi.ts', import.meta.url), 'utf8');
const personalApiPath = new URL('../utils/pcnPersonalSettingsApi.ts', import.meta.url);
const credentialsPath = new URL('../utils/pcnGeminiCredentials.ts', import.meta.url);

test('PCN personal settings encrypt and mask the Gemini API key without returning the secret', async () => {
  assert.equal(fs.existsSync(credentialsPath), true, 'PCN Gemini credential utility is missing');
  const { decryptPcnGeminiApiKey, encryptPcnGeminiApiKey, maskPcnGeminiApiKey } = await import('../utils/pcnGeminiCredentials.ts');
  const key = 'AIzaSyExamplePersonalKey_1234567890';
  const encrypted = encryptPcnGeminiApiKey(key, 'pcn-test-secret');

  assert.notEqual(encrypted, key);
  assert.equal(decryptPcnGeminiApiKey(encrypted, 'pcn-test-secret'), key);
  assert.equal(decryptPcnGeminiApiKey(encrypted, 'wrong-secret'), undefined);
  assert.match(maskPcnGeminiApiKey(key), /••••/);
  assert.doesNotMatch(maskPcnGeminiApiKey(key), new RegExp(key));
});

test('existing PCN personal settings expose Gemini key status, replacement, clearing and connection check', () => {
  assert.equal(fs.existsSync(personalApiPath), true, 'PCN personal settings API client is missing');
  assert.match(personalApiSource, /\/api\/pcn\/personal-settings/);
  assert.match(personalApiSource, /fetchPcnPersonalSettings/);
  assert.match(personalApiSource, /updatePcnPersonalSettings/);
  assert.match(personalApiSource, /credentials:\s*['"]same-origin['"]/);
  assert.match(personalPanelSource, /fetchPcnPersonalSettings|updatePcnPersonalSettings/);
  assert.match(personalPanelSource, /geminiApiKey/);
  assert.match(personalPanelSource, /X-Gemini|key.*đã|Đã cấu hình/i);
  assert.match(personalPanelSource, /clearGeminiApiKey|Xóa.*key/i);
  assert.match(personalPanelSource, /Kiểm tra Google/);
  assert.match(personalPanelSource, /geminiModel/);
});

test('PCN OCR and assistant resolve the personal key on the server session', () => {
  assert.match(serverSource, /app\.(?:get|put)\('\/api\/pcn\/personal-settings'/);
  assert.match(serverSource, /geminiApiKeyEncrypted/);
  assert.match(serverSource, /encryptPcnGeminiApiKey|decryptPcnGeminiApiKey/);
  assert.match(serverSource, /getPcnStoredGeminiApiKey/);
  assert.match(serverSource, /await getPcnStoredGeminiApiKey/);
  assert.match(serverSource, /getPcnStoredGeminiModel/);
  assert.match(serverSource, /await getPcnStoredGeminiModel/);
  assert.doesNotMatch(assistantSource, /X-Gemini-API-Key|geminiApiKey/);
  assert.doesNotMatch(ocrSource, /X-Gemini-API-Key|geminiApiKey/);
});

test('personal Gemini settings never enter PCN audit or API response as raw key', () => {
  assert.match(serverSource, /geminiApiKeyEncrypted/);
  assert.match(serverSource, /geminiApiKeyHint|maskPcnGeminiApiKey/);
  assert.doesNotMatch(serverSource, /changes:\s*\[[\s\S]{0,300}geminiApiKey/i);
});

// --- End of pcn-gemini-personal-settings.test.ts ---
