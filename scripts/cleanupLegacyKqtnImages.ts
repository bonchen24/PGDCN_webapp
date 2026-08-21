// Author: Gemini
// OS support: Web/Node
// Description: Removes the explicitly migrated legacy KQTN images from Storage and JSONB payloads

import dotenv from 'dotenv';
import { pool } from '../utils/db.js';
import { stripTransientKqtnImages } from '../utils/transientReportImages.js';
import { extractBase64DataUris } from '../utils/supabaseStorageMigration.js';
import { createSupabaseStorageClient } from '../utils/supabaseStorage.js';

dotenv.config();

const SOURCE_COLLECTION = 'kqtnRecords';
const BUCKET_NAME = 'ddt-files';
const EXPECTED_LEGACY_ASSET_COUNT = 114;

type DocumentRow = {
  document_id: string;
  data: unknown;
};

type AssetRow = {
  bucket_name: string;
  object_path: string;
};

function getRequiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for legacy image cleanup`);
  return value;
}

function assertDocumentObject(data: unknown, documentId: string): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`KQTN document ${documentId} is not a JSON object`);
  }
  return data as Record<string, unknown>;
}

async function cleanupLegacyKqtnImages(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const storage = createSupabaseStorageClient({
    baseUrl: getRequiredEnvironment('SUPABASE_STORAGE_URL'),
    serviceRoleKey: getRequiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
  });

  const documentsResult = await pool.query<DocumentRow>(
    'SELECT document_id, data FROM app_documents WHERE collection_name = $1 ORDER BY document_id',
    [SOURCE_COLLECTION],
  );
  const assetsResult = await pool.query<AssetRow>(
    `SELECT bucket_name, object_path
     FROM file_assets
     WHERE source_collection = $1
     ORDER BY object_path`,
    [SOURCE_COLLECTION],
  );

  const imageCount = documentsResult.rows.reduce((total, row) => (
    total + extractBase64DataUris(row.data).length
  ), 0);
  const changedDocuments = documentsResult.rows.filter((row) => {
    const original = assertDocumentObject(row.data, row.document_id);
    const sanitized = stripTransientKqtnImages(original);
    return JSON.stringify(original) !== JSON.stringify(sanitized);
  });

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      sourceCollection: SOURCE_COLLECTION,
      documents: documentsResult.rowCount,
      imageDataUris: imageCount,
      fileAssets: assetsResult.rowCount,
      changedDocuments: changedDocuments.length,
      expectedLegacyAssetCount: EXPECTED_LEGACY_ASSET_COUNT,
    }, null, 2));
    return;
  }

  if (assetsResult.rowCount !== EXPECTED_LEGACY_ASSET_COUNT || imageCount !== EXPECTED_LEGACY_ASSET_COUNT) {
    throw new Error(
      `Refusing cleanup: expected ${EXPECTED_LEGACY_ASSET_COUNT} assets and image data URIs, `
      + `found ${assetsResult.rowCount} assets and ${imageCount} image data URIs`,
    );
  }
  if (assetsResult.rows.some((asset) => asset.bucket_name !== BUCKET_NAME)) {
    throw new Error(`Refusing cleanup: file_assets contains an unexpected bucket for ${SOURCE_COLLECTION}`);
  }

  for (const asset of assetsResult.rows) {
    await storage.deleteObject({
      bucketName: asset.bucket_name,
      objectPath: asset.object_path,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of changedDocuments) {
      const original = assertDocumentObject(row.data, row.document_id);
      const sanitized = stripTransientKqtnImages(original);
      await client.query(
        `UPDATE app_documents
         SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $2 AND document_id = $3`,
        [JSON.stringify(sanitized), SOURCE_COLLECTION, row.document_id],
      );
    }

    const deletedAssets = await client.query(
      'DELETE FROM file_assets WHERE source_collection = $1 AND bucket_name = $2',
      [SOURCE_COLLECTION, BUCKET_NAME],
    );
    if (deletedAssets.rowCount !== EXPECTED_LEGACY_ASSET_COUNT) {
      throw new Error(`Refusing to commit: deleted ${deletedAssets.rowCount} file_assets rows`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const remainingDocuments = await pool.query<DocumentRow>(
    'SELECT document_id, data FROM app_documents WHERE collection_name = $1 ORDER BY document_id',
    [SOURCE_COLLECTION],
  );
  const remainingImageCount = remainingDocuments.rows.reduce((total, row) => (
    total + extractBase64DataUris(row.data).length
  ), 0);
  const remainingAssets = await pool.query(
    'SELECT count(*)::int AS count FROM file_assets WHERE source_collection = $1',
    [SOURCE_COLLECTION],
  );
  if (remainingImageCount !== 0 || remainingAssets.rows[0].count !== 0) {
    throw new Error(`Cleanup verification failed: ${remainingImageCount} image data URIs and ${remainingAssets.rows[0].count} assets remain`);
  }

  console.log(JSON.stringify({
    mode: 'applied',
    sourceCollection: SOURCE_COLLECTION,
    deletedStorageObjects: assetsResult.rowCount,
    cleanedDocuments: changedDocuments.length,
    deletedFileAssets: EXPECTED_LEGACY_ASSET_COUNT,
    remainingImageDataUris: remainingImageCount,
    remainingFileAssets: remainingAssets.rows[0].count,
  }, null, 2));
}

try {
  await cleanupLegacyKqtnImages();
} finally {
  await pool.end();
}

// --- End of cleanupLegacyKqtnImages.ts ---
