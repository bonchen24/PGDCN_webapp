import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  isPasswordCredentialStorageAvailable,
  loadPasswordCredential,
  storePasswordCredential,
} from '../utils/passwordCredential.ts';

const loginSource = fs.readFileSync(new URL('../components/LoginScreen.tsx', import.meta.url), 'utf8');

test('loads a saved browser password credential without using app storage', async () => {
  const calls: unknown[] = [];
  const credential = await loadPasswordCredential({
    get: async (options) => {
      calls.push(options);
      return { id: 'operator', password: 'secret' };
    },
  });

  assert.deepEqual(credential, { username: 'operator', password: 'secret' });
  assert.deepEqual(calls, [{ password: true, mediation: 'silent' }]);
});

test('stores a password only through the browser credential manager', async () => {
  let stored: unknown;
  const result = await storePasswordCredential(
    {
      store: async (credential) => {
        stored = credential;
        return credential;
      },
    },
    class FakePasswordCredential {
      id: string;
      password: string;

      constructor(input: { id: string; password: string }) {
        this.id = input.id;
        this.password = input.password;
      }
    },
    'operator',
    'secret',
  );

  assert.equal(result, true);
  assert.deepEqual(
    { id: (stored as { id: string }).id, password: (stored as { password: string }).password },
    { id: 'operator', password: 'secret' },
  );
});

test('reports whether the browser can store a password credential', () => {
  class FakePasswordCredential {
    constructor(input: { id: string; password: string }) {
      void input;
    }
  }

  assert.equal(
    isPasswordCredentialStorageAvailable(
      { store: async () => undefined },
      FakePasswordCredential,
    ),
    true,
  );
  assert.equal(
    isPasswordCredentialStorageAvailable(
      { get: async () => null },
      FakePasswordCredential,
    ),
    false,
  );
  assert.equal(
    isPasswordCredentialStorageAvailable(
      { store: async () => undefined },
      null,
    ),
    false,
  );
});

test('PCN login renders the remember-password control and opts into credential manager APIs', () => {
  assert.match(loginSource, /id="remember-me"/);
  assert.match(loginSource, /loadPasswordCredential/);
  assert.match(loginSource, /storePasswordCredential/);

  const rememberControl = loginSource.slice(
    loginSource.indexOf('id="remember-me"') - 500,
    loginSource.indexOf('id="remember-me"') + 700,
  );
  assert.doesNotMatch(rememberControl, /mode\s*!==\s*['"]pcn['"]/);
});
