// Author: Codex
// Description: Regression tests for KQTN Supabase Storage environment aliases.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('KQTN storage accepts SERVICE_ROLE_KEY as the self-hosted Supabase alias', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(
    source,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*process\.env\.SERVICE_ROLE_KEY/,
  );
});
