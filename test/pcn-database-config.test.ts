import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDatabaseConnectionString,
  resolveDatabaseConfig,
} from '../utils/pcnDatabase.ts';

test('PCN production resolves to its own database on the existing Supabase service', () => {
  const config = resolveDatabaseConfig({ APP_PROFILE: 'pcn', NODE_ENV: 'production' });

  assert.deepEqual(config, {
    profile: 'pcn',
    database: 'pcn_certification',
    host: 'supabase-db',
    port: 5432,
    user: 'postgres',
    password: '',
  });
  assert.equal(buildDatabaseConnectionString({ APP_PROFILE: 'pcn', NODE_ENV: 'production' }), 'postgresql://postgres:@supabase-db:5432/pcn_certification');
});

test('PCN ignores a legacy DDT database value instead of falling back to ddt_lab', () => {
  const config = resolveDatabaseConfig({
    APP_PROFILE: 'pcn',
    POSTGRES_DB: 'ddt_lab',
    PCN_POSTGRES_DB: '',
    POSTGRES_HOST: 'supabase-db',
    POSTGRES_PORT: '5432',
  });

  assert.equal(config.database, 'pcn_certification');
  assert.doesNotMatch(buildDatabaseConnectionString({
    APP_PROFILE: 'pcn',
    POSTGRES_DB: 'ddt_lab',
  }), /ddt_lab/);
});

test('DDT profile keeps the existing local development default', () => {
  assert.equal(
    buildDatabaseConnectionString({}),
    'postgresql://ddt_admin:ddt_dev_password@localhost:15432/ddt_lab',
  );
});

// --- End of pcn-database-config.test.ts ---
