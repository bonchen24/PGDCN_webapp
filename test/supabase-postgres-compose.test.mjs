// Author: Gemini
// OS support: Web/Node
// Description: Contract test for the Supabase-backed production Docker Compose mode

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const composePath = new URL('../docker-compose.supabase.yml', import.meta.url);

test('Supabase production Compose uses the existing Supabase network and DDT database', () => {
  assert.equal(fs.existsSync(composePath), true);
  const source = fs.readFileSync(composePath, 'utf8');
  assert.match(source, /supabase-db/);
  assert.match(source, /supabase_default/);
  assert.match(source, /POSTGRES_DB:\s*ddt_lab/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /^\s+postgres_db:/m);
});

// --- End of supabase-postgres-compose.test.mjs ---
