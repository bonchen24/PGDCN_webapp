// Author: Gemini
// OS support: Web/Node
// Description: Regression contract for full-name-only user identity rendering

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('identity surfaces do not render username aliases as visible names', () => {
  assert.doesNotMatch(read('App.tsx'), /@\{currentUser\.username\}/);
  assert.doesNotMatch(read('components/ActivityLogView.tsx'), /@\{user\.username\}/);
  assert.doesNotMatch(read('components/ActivityLogView.tsx'), /@\$\{selectedLog\.actorUsername\}/);
  assert.doesNotMatch(read('components/SettingsModal.tsx'), /@\{req\.username\}/);
  assert.doesNotMatch(read('components/SystemManagementViews.tsx'), /@\{req\.username\}/);
  assert.doesNotMatch(read('components/ReportGeneratorView.tsx'), /createdBy:\s*currentUser\?\.username/);
  assert.doesNotMatch(read('components/ReportGeneratorView.tsx'), /updatedBy:\s*currentUser\?\.username/);
});

test('identity builders do not use nickname-only fields as a visible-name fallback', () => {
  assert.doesNotMatch(read('utils/activityLog.ts'), /actor\.name \|\| actor\.username/);
  assert.doesNotMatch(read('utils/notificationEvents.ts'), /user\?\.displayName/);
  assert.doesNotMatch(read('store.ts'), /currentUser\?\.name \|\| currentUser\?\.username/);
});

// --- End of full-name-display-contract.test.ts ---
