// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for explicit Gemini model discovery in personal settings

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const systemSettingsSource = fs.readFileSync(new URL('../components/SystemManagementViews.tsx', import.meta.url), 'utf8');
const personalSettingsSource = fs.readFileSync(new URL('../components/UserSettingsModal.tsx', import.meta.url), 'utf8');

test('does not query Gemini models automatically and keeps the action in personal settings', () => {
  assert.match(personalSettingsSource, /onClick=\{\(\) => fetchGoogleGeminiModels\(true\)\}/);
  assert.doesNotMatch(personalSettingsSource, /useEffect\(\(\) => \{\s*fetchGoogleGeminiModels\(false\);\s*\}, \[\]\);/);
  assert.doesNotMatch(systemSettingsSource, /fetchGoogleGeminiModels/);
});

// --- End of gemini-settings.test.ts ---
