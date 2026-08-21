// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for the PostgreSQL REST persistence adapter

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPostgresClient } from '../utils/postgresApi.ts';
import { toPostgresDocuments } from '../scripts/importBackupToPostgres.ts';
import { buildPostgresConnectionString } from '../utils/db.ts';
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
  isGeminiUpstreamUnavailable,
  resolveGeminiApiKey,
} from '../utils/geminiCredentials.ts';

test('uses the Docker PostgreSQL host port for local development defaults', () => {
  assert.equal(
    buildPostgresConnectionString({}),
    'postgresql://ddt_admin:ddt_dev_password@localhost:15432/ddt_lab'
  );
});

test('resolves a user Gemini key and does not fall back to empty credentials', () => {
  assert.equal(resolveGeminiApiKey('server-key', undefined), 'server-key');
  assert.equal(resolveGeminiApiKey('server-key', 'user-key'), 'user-key');
  assert.equal(resolveGeminiApiKey('', '   '), undefined);
  assert.match(GEMINI_API_KEY_MISSING_MESSAGE, /Gemini API Key/);
});

test('classifies Gemini upstream network failures separately from missing credentials', () => {
  assert.equal(isGeminiUpstreamUnavailable(new Error('exception TypeError: fetch failed sending request')), true);
  assert.equal(isGeminiUpstreamUnavailable(new Error(GEMINI_API_KEY_MISSING_MESSAGE)), false);
  assert.equal(GEMINI_API_UPSTREAM_UNAVAILABLE_CODE, 'GEMINI_API_UPSTREAM_UNAVAILABLE');
  assert.match(GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE, /Google Gemini/);
});

test('server maps Gemini upstream failures to a retryable response', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /isGeminiUpstreamUnavailable\(error\)/);
  assert.match(serverSource, /GEMINI_API_UPSTREAM_UNAVAILABLE_CODE/);
});

test('preserves document ids and JSON fields across collection CRUD calls', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const client = createPostgresClient(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = String(init.method || 'GET');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (method === 'GET') {
      return new Response(JSON.stringify({
        items: [{ id: 'req-1', modelName: 'Tủ lạnh', metadata: { source: 'postgres' } }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      id: 'req-1',
      modelName: 'Tủ lạnh',
      metadata: { source: 'postgres' }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const result = await client.fetchCollectionWithMeta('requests', true);
  assert.equal(result.fromCache, false);
  assert.equal(result.count, 1);
  assert.deepEqual(result.items[0], {
    id: 'req-1',
    modelName: 'Tủ lạnh',
    metadata: { source: 'postgres' }
  });

  await client.saveDoc('requests', 'req-1', {
    id: 'req-1',
    modelName: 'Tủ lạnh',
    metadata: { source: 'postgres' }
  });
  await client.deleteDoc('requests', 'req-1');

  assert.deepEqual(calls.map(call => [call.method, call.url]), [
    ['GET', '/api/db/requests'],
    ['PUT', '/api/db/requests/req-1'],
    ['DELETE', '/api/db/requests/req-1']
  ]);
  assert.deepEqual(calls[1].body, {
    modelName: 'Tủ lạnh',
    metadata: { source: 'postgres' }
  });
});

test('normalizes backup collections into JSONB documents with stable ids', () => {
  const documents = toPostgresDocuments({
    requests: [{ id: 'req-1', modelName: 'Tủ lạnh' }],
    brands: ['Panasonic'],
    dayConfigs: { '2026-08-17': { date: '2026-08-17', isPeakDay: true } },
    settings: { workOnSaturday: true }
  });

  assert.deepEqual(documents, [
    { collectionName: 'requests', documentId: 'req-1', data: { modelName: 'Tủ lạnh' } },
    { collectionName: 'brands', documentId: 'Panasonic', data: { name: 'Panasonic' } },
    { collectionName: 'dayConfigs', documentId: '2026-08-17', data: { date: '2026-08-17', isPeakDay: true } },
    { collectionName: 'systemConfig', documentId: 'appSettings', data: { configKey: 'appSettings', configValue: '{"workOnSaturday":true}' } }
  ]);
});

// --- End of postgres-api.test.ts ---
