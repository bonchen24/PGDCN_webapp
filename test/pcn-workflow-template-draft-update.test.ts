import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../utils/pcnWorkflowTemplateApi.ts', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');

test('PCN exposes draft update API and store action', () => {
  assert.match(apiSource, /export async function updatePcnWorkflowTemplate/);
  assert.match(apiSource, /'PUT'/);
  assert.match(apiSource, /workflow-templates\/\$\{encodeURIComponent\(templateId\)\}/);
  assert.match(storeSource, /updateWorkflowTemplate/);
});

test('PCN draft update preserves version and rejects published templates server-side', () => {
  assert.match(serverSource, /app\.put\('\/api\/pcn\/workflow-templates\/:templateId'/);
  assert.match(serverSource, /existing\.status === 'PUBLISHED'/);
  assert.match(serverSource, /version[^\n]*existing\.version|existing\.version[^\n]*version/);
  assert.match(serverSource, /updatedAt/);
});
