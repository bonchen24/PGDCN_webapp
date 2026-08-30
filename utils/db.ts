// Author: Gemini
// OS support: Web/Node
// Description: PostgreSQL database connection pool and schema initializer

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { buildDatabaseConnectionString, resolveDatabaseConfig } from './pcnDatabase.ts';

// Keep explicit process environment values authoritative so Docker/CI can
// select the PCN profile and port without being overwritten by .env.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const { Pool } = pg;

export function buildPostgresConnectionString(env: Record<string, string | undefined>): string {
  return buildDatabaseConnectionString(env);
}

const databaseConfig = resolveDatabaseConfig(process.env);
const configuredDatabaseUrl = databaseConfig.profile === 'pcn'
  ? String(process.env.PCN_DATABASE_URL || '').trim()
  : String(process.env.DATABASE_URL || '').trim();

export const pool = new Pool(
  configuredDatabaseUrl
    ? {
        connectionString: configuredDatabaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: databaseConfig.host,
        port: databaseConfig.port,
        user: databaseConfig.user,
        password: databaseConfig.password,
        database: databaseConfig.database,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.warn('PostgreSQL idle client notice/warning:', err?.message || err);
});

export async function initDbSchema(): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');
    const schemaFilename = databaseConfig.profile === 'pcn' ? 'pcn-schema.sql' : 'schema.sql';
    const schemaPath = path.join(process.cwd(), 'sql', schemaFilename);
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(sql);
      console.log('PostgreSQL schema initialized successfully.');
    } else {
      console.warn('schema.sql not found at', schemaPath);
    }
  } catch (err: any) {
    console.error('Error initializing PostgreSQL schema:', err.message);
  } finally {
    if (client) client.release();
  }
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow SQL query executed in ${duration}ms: ${text.slice(0, 100)}`);
  }
  return res;
}

// --- End of db.ts ---
