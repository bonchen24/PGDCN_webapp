// Author: Gemini
// OS support: Web/Node
// Description: Regression contract for prebundling lazy report dependencies in Vite

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

test('Vite prebundles dependencies used by the lazy report generator', () => {
  assert.match(source, /optimizeDeps\s*:\s*\{[\s\S]*include\s*:\s*\[[\s\S]*['"]emf-converter['"][\s\S]*['"]react-image-crop['"][\s\S]*\]/);
});

// --- End of vite-dependency-optimizer.test.ts ---
