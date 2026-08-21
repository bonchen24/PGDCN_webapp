// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for direct internal Supabase Storage routes

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseStorageClient } from '../utils/supabaseStorage.js';

test('Supabase Storage client uses direct service routes without the Kong prefix', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: URL | RequestInfo) => {
    calls.push(String(input));
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const client = createSupabaseStorageClient({
      baseUrl: 'http://supabase-storage:5000',
      serviceRoleKey: 'test-service-role-key',
    });
    await client.ensurePrivateBucket('ddt-files');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls, ['http://supabase-storage:5000/bucket']);
});

test('Supabase Storage client treats the self-host duplicate bucket response as success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  )) as typeof fetch;

  try {
    const client = createSupabaseStorageClient({
      baseUrl: 'http://supabase-storage:5000',
      serviceRoleKey: 'test-service-role-key',
    });
    await client.ensurePrivateBucket('ddt-files');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Supabase Storage client deletes an object through the direct service route', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    const client = createSupabaseStorageClient({
      baseUrl: 'http://supabase-storage:5000',
      serviceRoleKey: 'test-service-role-key',
    });
    await client.deleteObject({ bucketName: 'ddt-files', objectPath: 'kqtnRecords/doc-1/photo.jpg' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls, [{
    url: 'http://supabase-storage:5000/object/ddt-files/kqtnRecords/doc-1/photo.jpg',
    method: 'DELETE',
  }]);
});

// --- End of supabase-storage-client.test.ts ---
