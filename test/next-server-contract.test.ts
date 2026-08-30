import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('custom server prepares Next and keeps Express as the /api gateway', () => {
  assert.match(source, /from ['"]next['"]/);
  assert.match(source, /const nextApp = next\(/);
  assert.match(source, /await nextApp\.prepare\(\)/);
  assert.match(source, /const nextHandler = nextApp\.getRequestHandler\(\)/);
  assert.match(source, /req\.path\.startsWith\(['"]\/api\//);
  assert.match(source, /nextHandler\(req, res\)/);
  assert.doesNotMatch(source, /createServer: createViteServer/);
});

test('database health exposes the active PCN profile without exposing credentials', () => {
  assert.match(source, /current_database\(\)/);
  assert.match(source, /profile:\s*DATABASE_PROFILE/);
  assert.match(source, /databaseName/);
  assert.doesNotMatch(source, /POSTGRES_PASSWORD.*res\.json/);
});

// --- End of next-server-contract.test.ts ---
