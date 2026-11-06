import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { pool } from '../../lib/server/db.ts';
import { getSessionSecret } from '../../lib/server/auth.ts';
import { createPcnSessionToken } from '../../utils/pcnAuth.ts';

type Document = { document_id: string; data: Record<string, any> };

// Only the external SQL boundary is replaced; routes, authorization, domain
// factories, audit construction and notification persistence execute normally.
export function installDocumentDatabase(t: TestContext) {
  const documents = new Map<string, Document>();
  const statements: string[] = [];
  let transaction: Map<string, Document> | undefined;
  const current = () => transaction || documents;
  const key = (collection: string, id: string) => `${collection}:${id}`;
  const query = async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    statements.push(normalized);
    if (normalized === 'BEGIN') { transaction = new Map(documents); return { rows: [] }; }
    if (normalized === 'COMMIT') {
      documents.clear();
      for (const [id, document] of transaction!) documents.set(id, document);
      transaction = undefined;
      return { rows: [] };
    }
    if (normalized === 'ROLLBACK') { transaction = undefined; return { rows: [] }; }
    if (/^SELECT pg_advisory_xact_lock/.test(normalized)) return { rows: [] };
    if (/^SELECT COALESCE\(MAX/.test(normalized)) return { rows: [{ last_serial: 0 }] };
    const literalCollection = normalized.match(/collection_name = '([^']+)'/)?.[1];
    const collection = literalCollection || params[0];
    if (/^SELECT /.test(normalized)) {
      let rows = [...current().entries()].filter(([id]) => id.startsWith(`${collection}:`)).map(([, doc]) => doc);
      if (collection === 'systemUsers' && params.length > 0) rows = rows.filter((doc) => doc.document_id === params[0] || doc.data.username === params[0]);
      else if (/document_id = \$/.test(normalized)) rows = rows.filter((doc) => doc.document_id === params[literalCollection ? 0 : 1]);
      if (normalized.includes("data->>'domain' = 'pgd'")) rows = rows.filter((doc) => doc.data.domain === 'pgd');
      if (normalized.includes("data->>'status' = 'PUBLISHED'")) rows = rows.filter((doc) => doc.data.status === 'PUBLISHED');
      if (normalized.includes("data->>'dossierId' = $1")) rows = rows.filter((doc) => doc.data.dossierId === params[0]);
      if (normalized.includes("data->>'requestId' = $2")) rows = rows.filter((doc) => doc.data.requestId === params[1]);
      if (normalized.includes("data->>'requestId' = $3")) rows = rows.filter((doc) => doc.data.requestId === params[2]);
      if (normalized.includes("data->>'requestId' = $1")) rows = rows.filter((doc) => doc.data.requestId === params[0]);
      if (normalized.includes("data->>'role' = 'TECHNICAL_REVIEW'")) rows = rows.filter((doc) => doc.data.role === 'TECHNICAL_REVIEW');
      if (normalized.includes("data->>'status' = 'APPROVED'")) rows = rows.filter((doc) => doc.data.status === 'APPROVED');
      if (normalized.includes('lower(trim')) rows = rows.filter((doc) => doc.data.requestCode === params[1]);
      return { rows: structuredClone(rows) };
    }
    if (/^INSERT INTO app_documents/.test(normalized)) {
      const insertedCollection = normalized.match(/VALUES \('([^']+)'/)?.[1];
      const offset = insertedCollection ? 0 : 1;
      const document = { document_id: String(params[offset]), data: JSON.parse(params[offset + 1]) };
      const id = key(insertedCollection || params[0], document.document_id);
      if (current().has(id) && normalized.includes('DO NOTHING')) return { rows: [] };
      current().set(id, document);
      return { rows: [structuredClone(document)] };
    }
    if (/^UPDATE app_documents/.test(normalized)) {
      const id = String(params[literalCollection ? 0 : 2]);
      assert.ok(current().has(key(collection, id)), `Missing update target: ${collection}/${id}`);
      current().set(key(collection, id), { document_id: id, data: JSON.parse(params[1]) });
      return { rows: [] };
    }
    throw new Error(`Unexpected route SQL: ${normalized}`);
  };
  t.mock.method(pool as any, 'connect', async () => ({ query, release() {} }));
  t.mock.method(pool as any, 'query', query);
  return {
    documents, statements,
    seed(collection: string, id: string, data: Record<string, any>) { documents.set(key(collection, id), { document_id: id, data }); },
    list(collection: string) { return [...documents.entries()].filter(([id]) => id.startsWith(`${collection}:`)).map(([, doc]) => doc); },
  };
}

export function routeRequest(url: string, method: string, body: unknown, user?: Record<string, any>) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (user) headers.set('cookie', `pcn_certification_session=${createPcnSessionToken({ active: true, ...user } as any, getSessionSecret())}`);
  return new NextRequest(`http://localhost${url}`, { method, headers, body: JSON.stringify(body) });
}
