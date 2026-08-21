// Author: Gemini
// OS support: Web/Node
// Description: Copies persisted KQTN Base64 images into private Supabase Storage with metadata

import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { initDbSchema, pool } from '../utils/db.js';
import { buildStorageObjectPath, decodeBase64DataUri, extractBase64DataUris } from '../utils/supabaseStorageMigration.js';
import { createSupabaseStorageClient } from '../utils/supabaseStorage.js';

dotenv.config();

const SOURCE_COLLECTION = 'kqtnRecords';
const DEFAULT_BUCKET = 'ddt-files';

function getRequiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the Supabase Storage migration`);
  return value;
}

function buildAssetId(bucketName: string, objectPath: string): string {
  return `asset-${createHash('sha256').update(`${bucketName}/${objectPath}`).digest('hex')}`;
}

async function migrateKqtnImages(): Promise<void> {
  const storageUrl = getRequiredEnvironment('SUPABASE_STORAGE_URL');
  const serviceRoleKey = getRequiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
  const storage = createSupabaseStorageClient({ baseUrl: storageUrl, serviceRoleKey });

  await initDbSchema();
  await storage.ensurePrivateBucket(bucketName);

  const result = await pool.query<{ document_id: string; data: unknown }>(
    'SELECT document_id, data FROM app_documents WHERE collection_name = $1 ORDER BY document_id',
    [SOURCE_COLLECTION],
  );

  let assetCount = 0;
  let uploadedCount = 0;
  let totalBytes = 0;

  for (const row of result.rows) {
    const assets = extractBase64DataUris(row.data);
    for (const asset of assets) {
      const decoded = decodeBase64DataUri(asset.dataUri);
      const sha256 = createHash('sha256').update(decoded.buffer).digest('hex');
      const objectPath = buildStorageObjectPath({
        collectionName: SOURCE_COLLECTION,
        documentId: row.document_id,
        jsonPath: asset.jsonPath,
        sha256,
        mimeType: decoded.mimeType,
      });

      await storage.uploadObject({
        bucketName,
        objectPath,
        body: decoded.buffer,
        mimeType: decoded.mimeType,
      });

      await pool.query(
        `INSERT INTO file_assets (
          id, bucket_name, object_path, source_collection, source_document_id,
          source_json_path, mime_type, byte_size, sha256
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (bucket_name, object_path) DO UPDATE SET
          source_collection = EXCLUDED.source_collection,
          source_document_id = EXCLUDED.source_document_id,
          source_json_path = EXCLUDED.source_json_path,
          mime_type = EXCLUDED.mime_type,
          byte_size = EXCLUDED.byte_size,
          sha256 = EXCLUDED.sha256,
          updated_at = CURRENT_TIMESTAMP`,
        [
          buildAssetId(bucketName, objectPath),
          bucketName,
          objectPath,
          SOURCE_COLLECTION,
          row.document_id,
          asset.jsonPath,
          decoded.mimeType,
          decoded.buffer.length,
          sha256,
        ],
      );

      assetCount += 1;
      uploadedCount += 1;
      totalBytes += decoded.buffer.length;
    }
  }

  console.log(JSON.stringify({
    bucketName,
    sourceCollection: SOURCE_COLLECTION,
    sourceDocuments: result.rowCount,
    assetsMigrated: assetCount,
    objectsUploaded: uploadedCount,
    totalBytes,
    sourcePayloadsPreserved: true,
  }, null, 2));
}

try {
  await migrateKqtnImages();
} finally {
  await pool.end();
}

// --- End of migrateKqtnImagesToSupabaseStorage.ts ---
