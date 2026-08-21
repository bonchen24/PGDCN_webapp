// Author: Gemini
// OS support: Web/Node
// Description: Contract tests proving that Google business-data integrations are removed from the runtime

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relativePath), 'utf8');
}

test('server has no GAS proxy route', () => {
  const source = readProjectFile('server.ts');

  assert.doesNotMatch(source, /\/api\/gas|Google Apps Script|GAS Proxy/);
});

test('store has no Google persistence or OAuth runtime', () => {
  const source = readProjectFile('store.ts');

  assert.doesNotMatch(
    source,
    /googleAuth|migrateGASDataToPostgres|\/api\/gas|googleToken|googleUser|saveAllToGoogleSheet|googleTaskId|spreadsheetUrl|scriptUrl/
  );
});

test('diagnostic types and UI have only PostgreSQL/local sources', () => {
  const types = readProjectFile('types.ts');
  const modal = readProjectFile('components/SyncDiagnosticModal.tsx');

  assert.doesNotMatch(types, /foundInGas|gas:\s*\{/);
  assert.doesNotMatch(modal, /tab-gas|Google Apps Script|report\.gas|foundInGas|Google Sheet GAS/);
});

test('removed integration files are absent', () => {
  for (const relativePath of [
    'utils/googleAuth.ts',
    'components/GoogleTasksView.tsx',
    'gas/backend.gs',
    'scripts/migrateFromGAS.ts'
  ]) {
    assert.equal(fs.existsSync(path.resolve(ROOT, relativePath)), false, relativePath);
  }
});

// --- End of google-integration-removal.test.ts ---
