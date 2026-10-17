import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChatWithRetryAndFallback,
  generateContentWithRetryAndFallback,
} from '../lib/server/gemini.ts';

test('Gemini retry and fallback logs contain only bounded metadata', async () => {
  const apiKey = 'AIzaSyPrivateTestKey_123456789';
  const customerDetails = 'Customer: Nguyen An, phone 0901234567';
  const promptExcerpt = 'private prompt excerpt: contract number ABC-2026-991';
  const output: unknown[][] = [];
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalSetTimeout = globalThis.setTimeout;
  console.warn = (...args: unknown[]) => output.push(args);
  console.log = (...args: unknown[]) => output.push(args);
  globalThis.setTimeout = ((callback: (...args: unknown[]) => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const scenarios = [
      {
        error: new Error(`Quota exceeded: ${customerDetails}; key=${apiKey}; ${promptExcerpt}`),
        models: ['gemini-flash-latest', 'gemini-3.6-flash'],
        expected: [
          { model: 'gemini-flash-latest', errorCode: '429', retry: false, fallback: true },
          { model: 'gemini-3.6-flash', errorCode: '429', retry: false, fallback: false },
        ],
      },
      {
        error: new Error(`404 NOT_FOUND: ${customerDetails}; key=${apiKey}; ${promptExcerpt}`),
        models: ['gemini-3.1-flash-lite'],
        expected: [
          { model: 'gemini-3.1-flash-lite', errorCode: '404', retry: false, fallback: false },
        ],
      },
      {
        error: new Error(`503 UNAVAILABLE: ${customerDetails}; key=${apiKey}; ${promptExcerpt}`),
        models: ['gemini-flash-latest'],
        expected: [
          { model: 'gemini-flash-latest', errorCode: '503', retry: true, fallback: false },
        ],
        succeedsAfterRetry: true,
      },
      {
        error: new Error(`Upstream failure: ${customerDetails}; key=${apiKey}; ${promptExcerpt}`),
        models: [`customer-model-for-${customerDetails}`],
        expected: [
          { model: 'unknown', errorCode: 'other', retry: false, fallback: false },
        ],
      },
    ];

    for (const scenario of scenarios) {
      let attempts = 0;
      const activeAi = {
        models: {
          generateContent: async () => {
            attempts++;
            if (scenario.succeedsAfterRetry && attempts > 1) return { ok: true };
            throw scenario.error;
          },
        },
      } as any;
      let thrown: unknown;
      try {
        await generateContentWithRetryAndFallback(
          activeAi,
          { contents: promptExcerpt },
          undefined,
          { modelNames: scenario.models, attemptsPerModel: scenario.succeedsAfterRetry ? 2 : 1 },
        );
      } catch (error) {
        thrown = error;
      }

      if (scenario.succeedsAfterRetry) {
        assert.equal(thrown, undefined);
        assert.equal(attempts, 2);
      } else {
        assert.equal(thrown === scenario.error, true);
      }
    }

    const chatError = new Error(`Chat failed: ${customerDetails}; key=${apiKey}; ${promptExcerpt}`);
    const chatAi = {
      chats: {
        create: () => ({ sendMessage: async () => { throw chatError; } }),
      },
    } as any;
    let chatThrown: unknown;
    try {
      await createChatWithRetryAndFallback(chatAi, {}, promptExcerpt);
    } catch (error) {
      chatThrown = error;
    }
    assert.equal(chatThrown === chatError, true);

    const serializedOutput = JSON.stringify(output);
    assert.equal(serializedOutput.includes(apiKey), false);
    assert.equal(serializedOutput.includes(customerDetails), false);
    assert.equal(serializedOutput.includes(promptExcerpt), false);
    for (const scenario of scenarios) {
      assert.equal(serializedOutput.includes(scenario.error.message), false);
      assert.equal(serializedOutput.includes(scenario.error.stack || ''), false);
    }
    assert.equal(serializedOutput.includes(chatError.message), false);
    assert.equal(serializedOutput.includes(chatError.stack || ''), false);

    const warningMetadata = output
      .filter(([message]) => message === 'Gemini request failed')
      .map(([, metadata]) => metadata);
    assert.deepEqual(warningMetadata, [
      ...scenarios.flatMap((scenario) => scenario.expected),
      { model: 'gemini-flash-latest', errorCode: 'other', retry: false, fallback: true },
      { model: 'gemini-3.6-flash', errorCode: 'other', retry: false, fallback: true },
      { model: 'gemini-3.1-flash-lite', errorCode: 'other', retry: false, fallback: false },
    ]);
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
    globalThis.setTimeout = originalSetTimeout;
  }
});
