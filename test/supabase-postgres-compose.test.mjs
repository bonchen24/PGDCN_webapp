// Author: Gemini
// OS support: Web/Node
// Description: Contract test for the Supabase-backed production Docker Compose mode

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const composePath = new URL('../docker-compose.supabase.yml', import.meta.url);
const supabaseFullComposePath = new URL('../../TVCI_APP/supabase-docker/docker-compose.full.yml', import.meta.url);

test('Supabase production Compose uses the existing Supabase network and the separate PCN database', () => {
  assert.equal(fs.existsSync(composePath), true);
  const source = fs.readFileSync(composePath, 'utf8');
  assert.match(source, /supabase-db/);
  assert.match(source, /supabase_default/);
  assert.match(source, /APP_PROFILE:\s*pcn/);
  assert.match(source, /PCN_POSTGRES_DB:\s*\$\{PCN_POSTGRES_DB:-pcn_certification\}/);
  assert.match(source, /POSTGRES_DB:\s*\$\{PCN_POSTGRES_DB:-pcn_certification\}/);
  assert.doesNotMatch(source, /POSTGRES_DB:\s*ddt_lab/);
  assert.match(source, /SUPABASE_STORAGE_URL:\s*\$\{SUPABASE_STORAGE_URL:-http:\/\/supabase-storage:5000\}/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{SUPABASE_SERVICE_ROLE_KEY:-\$\{SERVICE_ROLE_KEY:-\}\}/);
  assert.doesNotMatch(source, /^\s+postgres_db:/m);
});

test('Supabase DB exposes a loopback-only direct port for host development', () => {
  const source = fs.readFileSync(supabaseFullComposePath, 'utf8');
  const dbBlock = source.slice(source.indexOf('  db:'), source.indexOf('  vector:'));
  assert.match(dbBlock, /127\.0\.0\.1:15432:5432/);
});

// --- End of supabase-postgres-compose.test.mjs ---
