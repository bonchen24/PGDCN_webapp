import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const composePath = new URL('../docker-compose.pcn.yml', import.meta.url);

test('PCN Compose attaches to self-hosted Supabase without creating another PostgreSQL service', () => {
  assert.equal(fs.existsSync(composePath), true);
  const source = fs.readFileSync(composePath, 'utf8');

  assert.match(source, /APP_PROFILE:\s*pcn/);
  assert.match(source, /PORT:\s*2357/);
  assert.match(source, /POSTGRES_HOST:\s*supabase-db/);
  assert.match(source, /POSTGRES_PORT:\s*5432/);
  assert.match(source, /PCN_POSTGRES_DB:\s*\$\{PCN_POSTGRES_DB:-pcn_certification\}/);
  assert.match(source, /POSTGRES_DB:\s*\$\{PCN_POSTGRES_DB:-pcn_certification\}/);
  assert.match(source, /PCN_SESSION_SECRET:\s*\$\{PCN_SESSION_SECRET:\?\s*Set a long random PCN session secret\}/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{SUPABASE_SERVICE_ROLE_KEY:-\$\{SERVICE_ROLE_KEY:\?[^}]+\}\}/);
  assert.match(source, /- ['"]2357:2357['"]/);
  assert.match(source, /supabase_default:/);
  assert.match(source, /external:\s*true/);
  assert.doesNotMatch(source, /^\s+postgres:\s*$/m);
  assert.doesNotMatch(source, /^\s+postgres_db:\s*$/m);
});

// --- End of pcn-compose.test.mjs ---
