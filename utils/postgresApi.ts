// Author: Gemini
// OS support: Web/Node
// Description: Same-origin REST client for PostgreSQL-backed application documents

export interface FetchCollectionResult<T = any> {
  items: T[];
  fromCache: boolean;
  error?: string;
  count: number;
}

export interface PostgresClient {
  fetchCollectionWithMeta<T = any>(collectionPath: string, forceServer?: boolean): Promise<FetchCollectionResult<T>>;
  fetchCollection<T = any>(collectionPath: string, forceServer?: boolean): Promise<T[]>;
  saveDoc(collectionPath: string, docId: string, data: any): Promise<void>;
  deleteDoc(collectionPath: string, docId: string): Promise<void>;
  batchSave(collectionPath: string, items: any[]): Promise<void>;
  batchDelete(collectionPath: string, docIds: string[]): Promise<void>;
  triggerSyncSignal(): Promise<void>;
}

const API_ROOT = '/api/db';
const REQUEST_TIMEOUT_MS = 30000;
const BATCH_SIZE = 250;

function encodePathSegment(value: string): string {
  return encodeURIComponent(String(value));
}

function sanitizeForApi(value: any): any {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeForApi);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeForApi(item)]));
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PostgreSQL API trả về HTTP ${response.status}`);
  }
  return payload;
}

export function createPostgresClient(fetchImpl: typeof fetch = fetch): PostgresClient {
  const request = async (path: string, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${API_ROOT}/${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.headers || {})
        },
        signal: init.signal || controller.signal
      });
      return await parseResponse(response);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Kết nối PostgreSQL quá thời gian sau ${REQUEST_TIMEOUT_MS / 1000} giây`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const client: PostgresClient = {
    async fetchCollectionWithMeta<T = any>(collectionPath: string): Promise<FetchCollectionResult<T>> {
      try {
        const payload = await request(encodePathSegment(collectionPath));
        const items = Array.isArray(payload?.items) ? payload.items : [];
        return { items, fromCache: false, count: items.length };
      } catch (error: any) {
        return { items: [], fromCache: false, error: error?.message || String(error), count: 0 };
      }
    },

    async fetchCollection<T = any>(collectionPath: string): Promise<T[]> {
      const result = await client.fetchCollectionWithMeta<T>(collectionPath);
      return result.items;
    },

    async saveDoc(collectionPath: string, docId: string, data: any): Promise<void> {
      const cleanData = sanitizeForApi({ ...data });
      delete cleanData.id;
      await request(`${encodePathSegment(collectionPath)}/${encodePathSegment(docId)}`, {
        method: 'PUT',
        body: JSON.stringify(cleanData)
      });
    },

    async deleteDoc(collectionPath: string, docId: string): Promise<void> {
      await request(`${encodePathSegment(collectionPath)}/${encodePathSegment(docId)}`, { method: 'DELETE' });
    },

    async batchSave(collectionPath: string, items: any[]): Promise<void> {
      const validItems = (items || []).filter(item => item && item.id !== undefined && item.id !== null && String(item.id).trim() !== '');
      for (let index = 0; index < validItems.length; index += BATCH_SIZE) {
        const chunk = validItems.slice(index, index + BATCH_SIZE).map(item => {
          const cleanData = sanitizeForApi({ ...item });
          const id = String(cleanData.id);
          delete cleanData.id;
          return { id, data: cleanData };
        });
        await request(`${encodePathSegment(collectionPath)}/batch`, {
          method: 'POST',
          body: JSON.stringify({ items: chunk })
        });
      }
    },

    async batchDelete(collectionPath: string, docIds: string[]): Promise<void> {
      const validIds = (docIds || []).filter(id => id !== undefined && id !== null && String(id).trim() !== '').map(String);
      for (let index = 0; index < validIds.length; index += BATCH_SIZE) {
        await request(`${encodePathSegment(collectionPath)}/delete-batch`, {
          method: 'POST',
          body: JSON.stringify({ ids: validIds.slice(index, index + BATCH_SIZE) })
        });
      }
    },

    async triggerSyncSignal(): Promise<void> {
      return Promise.resolve();
    }
  };

  return client;
}

const defaultClient = createPostgresClient();

export const fetchCollectionWithMeta = defaultClient.fetchCollectionWithMeta;
export const fetchCollection = defaultClient.fetchCollection;
export const saveDoc = defaultClient.saveDoc;
export const deleteDoc = defaultClient.deleteDoc;
export const batchSave = defaultClient.batchSave;
export const batchDelete = defaultClient.batchDelete;
export const triggerSyncSignal = defaultClient.triggerSyncSignal;

// --- End of postgresApi.ts ---
