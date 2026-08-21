// Author: Gemini
// OS support: Web/Node
// Description: Import a DDT Lab JSON backup into PostgreSQL JSONB application documents

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { initDbSchema, pool } from '../utils/db.js';

dotenv.config();

export interface PostgresDocument {
  collectionName: string;
  documentId: string;
  data: Record<string, any>;
}

function addDocument(documents: PostgresDocument[], collectionName: string, documentId: unknown, rawData: any): void {
  const normalizedId = String(documentId ?? '').trim();
  if (!normalizedId) return;
  const data = rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? { ...rawData } : {};
  delete data.id;
  documents.push({ collectionName, documentId: normalizedId, data });
}

export function toPostgresDocuments(backupData: any): PostgresDocument[] {
  const documents: PostgresDocument[] = [];
  const collectionEntries: Array<[string, any[] | undefined]> = [
    ['requests', backupData?.requests],
    ['handoverDocs', backupData?.handoverDocs],
    ['kqtnRecords', backupData?.kqtnRecords],
    ['notifications', backupData?.notifications],
    ['activityLogs', backupData?.activityLogs],
    ['userPreferences', backupData?.userPreferences],
    ['systemUsers', backupData?.systemUsers],
    ['customers', backupData?.customers],
    ['products', backupData?.products]
  ];

  for (const [collectionName, items] of collectionEntries) {
    if (Array.isArray(items)) {
      for (const item of items) {
        const documentId = item?.id || item?.customerCode || item?.name || item?.username || item?.['Tên đăng nhập'] || item?.configKey;
        addDocument(documents, collectionName, documentId, item);
      }
    } else if (collectionName === 'userPreferences' && items && typeof items === 'object') {
      for (const [documentId, data] of Object.entries(items)) addDocument(documents, collectionName, documentId, data);
    }
  }

  for (const brand of Array.isArray(backupData?.brands) ? backupData.brands : []) {
    const name = typeof brand === 'string' ? brand : brand?.name || brand?.id;
    addDocument(documents, 'brands', name, { name });
  }

  if (backupData?.dayConfigs && typeof backupData.dayConfigs === 'object' && !Array.isArray(backupData.dayConfigs)) {
    for (const [date, config] of Object.entries(backupData.dayConfigs)) {
      addDocument(documents, 'dayConfigs', date, { ...(config as Record<string, any>), date });
    }
  }

  if (backupData?.settings && typeof backupData.settings === 'object') {
    addDocument(documents, 'systemConfig', 'appSettings', {
      configKey: 'appSettings',
      configValue: JSON.stringify(backupData.settings)
    });
  }

  const deduplicated = new Map<string, PostgresDocument>();
  for (const document of documents) {
    deduplicated.set(`${document.collectionName}:${document.documentId}`, document);
  }
  return Array.from(deduplicated.values());
}

export async function importBackup(filePath: string): Promise<number> {
  await initDbSchema();
  const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const documents = toPostgresDocuments(backup);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const document of documents) {
      const conflictClause = document.collectionName === 'activityLogs'
        ? 'ON CONFLICT (collection_name, document_id) DO NOTHING'
        : `ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`;
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ${conflictClause}`,
        [document.collectionName, document.documentId, JSON.stringify(document.data)]
      );
    }
    await client.query('COMMIT');
    return documents.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const filePath = path.resolve(process.argv[2] || 'tvci_backup_2026-08-17_1.json');
  if (!fs.existsSync(filePath)) throw new Error(`Không tìm thấy file backup: ${filePath}`);
  const count = await importBackup(filePath);
  console.log(`Đã import ${count} document vào PostgreSQL.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch(error => {
    console.error('Import backup thất bại:', error);
    process.exitCode = 1;
  });
}

// --- End of importBackupToPostgres.ts ---
