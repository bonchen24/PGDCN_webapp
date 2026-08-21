// Author: Gemini
// OS support: Web/Node
// Description: Regression contract for one-time guest request modal auto-open per login session

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('opens the guest request modal only once per login session', () => {
  assert.match(app, /const guestRequestModalAutoOpenRef = useRef\(false\);/);
  assert.match(
    app,
    /if \(!currentUser\) \{\s*guestRequestModalAutoOpenRef\.current = false;\s*return;\s*\}/s
  );
  assert.match(
    app,
    /if \(currentUser\.role === 'guest' && !guestRequestModalAutoOpenRef\.current\) \{[\s\S]*?setIsRequestModalOpen\(true\);[\s\S]*?guestRequestModalAutoOpenRef\.current = true;/
  );
  assert.match(app, /\}, \[currentUser\?\.username, currentUser\?\.role\]\);/);
});

// --- End of guest-request-modal.test.ts ---
