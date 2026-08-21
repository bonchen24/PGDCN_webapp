// Author: Gemini
// OS support: Web/Node
// Description: PostgreSQL database connection pool and schema initializer

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

export function buildPostgresConnectionString(env: Record<string, string | undefined>): string {
  return env.DATABASE_URL ||
    `postgresql://${env.POSTGRES_USER || 'ddt_admin'}:${env.POSTGRES_PASSWORD || 'ddt_dev_password'}@${env.POSTGRES_HOST || 'localhost'}:${env.POSTGRES_PORT || '15432'}/${env.POSTGRES_DB || 'ddt_lab'}`;
}

const connectionString = buildPostgresConnectionString(process.env);

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function initDbSchema(): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');
    const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
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
