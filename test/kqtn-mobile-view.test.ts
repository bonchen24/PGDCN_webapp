// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for keeping KQTN rows visible in the mobile viewport

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const kqtnView = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');

test('keeps the KQTN table body inside a bounded mobile scroll region', () => {
  assert.match(kqtnView, /className="flex flex-col h-full min-h-0 bg-slate-50/);
  assert.match(kqtnView, /className="mobile-scroll-x flex-1 min-w-0 min-h-0 overflow-auto bg-white relative"/);
  assert.match(kqtnView, /className="w-max min-w-full align-middle"/);
  assert.match(kqtnView, /className="w-max min-w-full border-collapse text-xs table-fixed"/);
});

// --- End of kqtn-mobile-view.test.ts ---
