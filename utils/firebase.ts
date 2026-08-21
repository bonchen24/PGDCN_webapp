// Author: Gemini
// OS support: Web/Node
// Description: PostgreSQL REST persistence compatibility layer for the existing collection-shaped store API

import {
  batchDelete,
  batchSave,
  createPostgresClient,
  deleteDoc,
  fetchCollection,
  fetchCollectionWithMeta,
  fetchCollectionsMeta,
  saveDoc
} from './postgresApi';

export { fetchCollection, fetchCollectionWithMeta, fetchCollectionsMeta };

export const deleteDocFromPostgres = deleteDoc;
export const batchDeleteFromPostgres = batchDelete;
export const batchSaveToPostgres = batchSave;
export const saveDocToPostgres = saveDoc;

export async function fetchCollectionPaginated<T = any>(
  collectionPath: string,
  pageSize: number = 50,
  lastDoc: { offset?: number } | null = null
): Promise<{ items: T[]; lastVisible: { offset: number } | null; hasMore: boolean }> {
  const items = await fetchCollection<T>(collectionPath);
  const offset = lastDoc?.offset || 0;
  const page = items.slice(offset, offset + pageSize);
  const nextOffset = offset + page.length;
  return {
    items: page,
    lastVisible: nextOffset < items.length ? { offset: nextOffset } : null,
    hasMore: nextOffset < items.length
  };
}

export const postgresClient = createPostgresClient();

// --- End of firebase.ts ---
