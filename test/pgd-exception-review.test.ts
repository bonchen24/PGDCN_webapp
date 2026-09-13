import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PGD exception review has a reasoned return path and resumable lifecycle', () => {
  const domain = read('utils/pgdDomain.ts');
  const api = read('utils/pgdApi.ts');
  const server = read('server.ts');
  const flow = read('components/PgdDossierFlow.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const panel = read('components/PgdDossierStepWorkPanel.tsx');

  assert.match(domain, /exceptionReason\?: string/);
  assert.match(domain, /exceptionAt\?: string/);
  assert.match(domain, /exceptionByUsername\?: string/);
  assert.match(api, /reason\?: string/);
  assert.match(server, /REJECTED.*ON_HOLD|ON_HOLD.*REJECTED/);
  assert.match(server, /exceptionReason/);
  assert.match(flow, /status === 'REJECTED' \|\| status === 'ON_HOLD'/);
  assert.match(workspace, /CAPABILITY_REVIEW/);
  assert.match(panel, /Trả bổ sung/);
  assert.match(panel, /Tạm dừng/);
  assert.match(panel, /onRequestException/);
  assert.match(panel, /Lý do/);
});
