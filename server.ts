// Author: Gemini
// OS support: Web/Node
// Description: Lightweight Next.js 15 Express Gateway for PGDCN Webapp
import express from 'express';
import next from 'next';
import compression from 'compression';
import { createServer as createHttpServer } from 'http';
import { initDbSchema, pool } from './utils/db.js';

const dev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT || (process.env.NODE_ENV === 'production' ? 2357 : 1357));
const DATABASE_PROFILE = (process.env.APP_PROFILE || 'pcn').trim().toLowerCase();

async function startServer() {
  const app = express();
  const nextApp = next({
    dev,
    dir: process.cwd(),
  });
  const nextHandler = nextApp.getRequestHandler();

  await nextApp.prepare();

  // Database health endpoint exposing profile without credentials
  app.get('/api/db/health', async (_req, res) => {
    try {
      const result = await pool.query('SELECT current_database() as database_name');
      return res.json({
        status: 'ok',
        database: 'postgresql',
        profile: DATABASE_PROFILE,
        databaseName: result.rows[0]?.database_name || null,
      });
    } catch (e: any) {
      return res.status(503).json({ status: 'error', database: 'postgresql', profile: DATABASE_PROFILE, error: e?.message || String(e) });
    }
  });

  // Express acts as the API gateway forwarding to Next.js App Router
  // Supported modular boundaries: /api/pcn/templates, /api/pgd/document-templates
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return nextHandler(req, res);
    }
    return nextHandler(req, res);
  });

  await initDbSchema();

  const httpServer = createHttpServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
