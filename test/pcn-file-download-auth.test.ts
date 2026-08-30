import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('PCN private file downloads require the server-side PCN session before resolving an asset', () => {
  const routeStart = server.indexOf('app.get("/api/pcn/files/:assetId"');
  assert.ok(routeStart >= 0, 'PCN file download route must exist');
  const route = server.slice(routeStart, server.indexOf('app.get("/api/health"', routeStart));

  assert.match(route, /app\.get\("\/api\/pcn\/files\/:assetId", requirePcnSessionMiddleware, async/);
  assert.match(route, /getPcnSessionUser\(req\)|requirePcnSessionMiddleware/);
  assert.match(route, /FROM file_assets WHERE id = \$1/);
  assert.match(route, /downloadObject/);
});

// --- End of pcn-file-download-auth.test.ts ---
