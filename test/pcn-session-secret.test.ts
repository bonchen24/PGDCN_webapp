import assert from 'node:assert/strict';
import test from 'node:test';

import { getSessionSecret } from '../lib/server/auth.ts';

function setProcessEnv(name: string, value: string | undefined): void {
  const updated = value === undefined
    ? Reflect.deleteProperty(process.env, name)
    : Reflect.set(process.env, name, value);

  if (!updated) {
    throw new Error(`Unable to update process.env.${name}`);
  }
}

test('production requires a configured session secret while nonproduction keeps a stable fallback', () => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PCN_SESSION_SECRET: process.env.PCN_SESSION_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };

  try {
    setProcessEnv('NODE_ENV', 'production');
    setProcessEnv('PCN_SESSION_SECRET', undefined);
    setProcessEnv('SUPABASE_SERVICE_ROLE_KEY', undefined);
    setProcessEnv('SESSION_SECRET', undefined);

    assert.throws(getSessionSecret, /PCN session secret is not configured/);

    setProcessEnv('PCN_SESSION_SECRET', '  ');
    setProcessEnv('SUPABASE_SERVICE_ROLE_KEY', ' service-role-secret ');
    setProcessEnv('SESSION_SECRET', 'session-secret');
    assert.equal(getSessionSecret(), 'service-role-secret');

    for (const environment of ['development', 'test']) {
      setProcessEnv('NODE_ENV', environment);
      setProcessEnv('PCN_SESSION_SECRET', undefined);
      setProcessEnv('SUPABASE_SERVICE_ROLE_KEY', undefined);
      setProcessEnv('SESSION_SECRET', undefined);
      assert.equal(getSessionSecret(), 'pcn-session-secret-fallback-key');
    }
  } finally {
    for (const [name, value] of Object.entries(previousEnv)) {
      setProcessEnv(name, value);
    }
  }
});
