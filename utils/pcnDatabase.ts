export type DatabaseProfile = 'ddt' | 'pcn';

export interface DatabaseConfig {
  profile: DatabaseProfile;
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

const DEFAULT_PCN_DATABASE = 'pcn_certification';

function valueOf(env: Record<string, string | undefined>, key: string): string {
  return String(env[key] ?? '').trim();
}

export function resolveDatabaseConfig(env: Record<string, string | undefined>): DatabaseConfig {
  const profile: DatabaseProfile = valueOf(env, 'APP_PROFILE').toLowerCase() === 'pcn' ? 'pcn' : 'ddt';
  const isProduction = valueOf(env, 'NODE_ENV').toLowerCase() === 'production';
  const port = Number(valueOf(env, 'POSTGRES_PORT')) || (isProduction ? 5432 : 15432);

  return {
    profile,
    database: profile === 'pcn'
      ? valueOf(env, 'PCN_POSTGRES_DB') || DEFAULT_PCN_DATABASE
      : valueOf(env, 'POSTGRES_DB') || 'ddt_lab',
    host: valueOf(env, 'POSTGRES_HOST') || (profile === 'pcn' && isProduction ? 'supabase-db' : 'localhost'),
    port,
    user: valueOf(env, 'POSTGRES_USER') || (profile === 'pcn' ? 'postgres' : 'ddt_admin'),
    password: env.POSTGRES_PASSWORD ?? (profile === 'pcn' ? '' : 'ddt_dev_password'),
  };
}

export function buildDatabaseConnectionString(env: Record<string, string | undefined>): string {
  const config = resolveDatabaseConfig(env);
  const explicitUrl = config.profile === 'pcn' ? valueOf(env, 'PCN_DATABASE_URL') : valueOf(env, 'DATABASE_URL');
  if (explicitUrl) return explicitUrl;
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
}
