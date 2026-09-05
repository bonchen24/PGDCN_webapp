import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildPcnChildEnv } from '../scripts/native-dev-env.cjs';

test('native PCN launcher forwards shared Supabase Storage credentials from the local Docker env', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-native-env-'));
  const projectRoot = path.join(tempRoot, 'PCN_webapp');
  const supabaseEnvPath = path.join(tempRoot, 'TVCI_APP', 'supabase-docker', '.env');

  try {
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(path.dirname(supabaseEnvPath), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.env'), 'POSTGRES_HOST=127.0.0.1\n');
    fs.writeFileSync(supabaseEnvPath, [
      'SUPABASE_STORAGE_URL=http://127.0.0.1:8000/storage/v1',
      'SERVICE_ROLE_KEY=local-service-role-key',
      'SUPABASE_STORAGE_BUCKET=pcn-files',
    ].join('\n'));

    const childEnv = buildPcnChildEnv({ projectRoot, env: {} });

    assert.equal(childEnv.APP_PROFILE, 'pcn');
    assert.equal(childEnv.PORT, '1357');
    assert.equal(childEnv.SUPABASE_STORAGE_URL, 'http://127.0.0.1:8000/storage/v1');
    assert.equal(childEnv.SUPABASE_SERVICE_ROLE_KEY, 'local-service-role-key');
    assert.equal(childEnv.PCN_STORAGE_BUCKET, 'pcn-files');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
