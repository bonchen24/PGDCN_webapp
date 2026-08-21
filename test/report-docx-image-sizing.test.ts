// Author: Gemini
// OS support: Web/Node
// Description: Tests fixed-width DOCX graph sizing and aspect-ratio preservation

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCX_GRAPH_WIDTH_PX, getDocxGraphSize } from '../lib/reportDocxImageSizing.ts';

test('uses 624px for a graph and preserves a 16:9 ratio', () => {
  assert.equal(DOCX_GRAPH_WIDTH_PX, 624);
  assert.deepEqual(getDocxGraphSize(1600, 900), [624, 351]);
});

test('preserves a portrait graph ratio after rounding', () => {
  const [width, height] = getDocxGraphSize(1000, 1400);
  assert.equal(width, 624);
  assert.equal(height, 874);
  assert.ok(Math.abs(height / width - 1.4) < 0.002);
});

test('returns a safe graph size for invalid source dimensions', () => {
  assert.deepEqual(getDocxGraphSize(0, 900), [624, 351]);
  assert.deepEqual(getDocxGraphSize(1600, 0), [624, 351]);
});

// --- End of report-docx-image-sizing.test.ts ---
