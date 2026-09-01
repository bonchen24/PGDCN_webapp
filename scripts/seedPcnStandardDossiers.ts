// Author: Codex
// OS support: Windows/Node maintenance command
// Description: Add-only import of the surveyed QC4/QC9 standard dossiers into PCN.

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { pool } from '../utils/db.ts';
import { createSupabaseStorageClient } from '../utils/supabaseStorage.ts';
import {
  PCN_STANDARD_DOSSIER_FIXTURES,
  type PcnStandardDossierFixture,
} from '../utils/pcnStandardDossierFlow.ts';
import {
  buildPcnStandardDossierSeedPlan,
  type PcnStandardDossierSeedPlan,
  type PcnStandardSeedAsset,
  type PcnStandardSeedRecord,
  type PcnStandardSeedSourceFile,
} from '../utils/pcnStandardDossierSeed.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const MAX_FILE_BYTES = Number(process.env.PCN_FILE_MAX_BYTES || 25 * 1024 * 1024);
const MIME_TYPES: Record<string, string> = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.jfif': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

interface SeedOptions {
  sourceRoot: string;
  apply: boolean;
  bucketName: string;
}

interface ApplySummary {
  insertedRecords: number;
  existingRecords: number;
  uploadedAssets: number;
  existingAssets: number;
}

function normalizeFileName(value: string): string {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi-VN');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function assertInside(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Tệp nguồn nằm ngoài thư mục PCN được chọn: ${candidate}`);
  }
  return resolvedCandidate;
}

function collectFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function resolveSourceFile(
  sourceRoot: string,
  fixture: PcnStandardDossierFixture,
  fileName: string,
  allFiles: readonly string[],
): string {
  const expectedName = normalizeFileName(fileName);
  const sourceFolder = assertInside(sourceRoot, path.join(sourceRoot, ...fixture.sourceRelativeFolder.split('/')));
  const inFixtureFolder = allFiles.filter((candidate) => {
    const relative = path.relative(sourceFolder, candidate);
    return !relative.startsWith('..') && !path.isAbsolute(relative) && normalizeFileName(path.basename(candidate)) === expectedName;
  });
  const hintedRelativePath = fixture.sourceFilePathHints?.[fileName];
  const hintedCandidates = hintedRelativePath
    ? allFiles.filter((candidate) => normalizeFileName(path.relative(sourceRoot, candidate).replace(/\\/g, '/')).endsWith(normalizeFileName(hintedRelativePath.replace(/\\/g, '/'))))
    : [];
  const candidates = inFixtureFolder.length > 0
    ? inFixtureFolder
    : hintedCandidates.length > 0
      ? hintedCandidates.filter((candidate) => normalizeFileName(path.basename(candidate)) === expectedName)
      : allFiles.filter((candidate) => normalizeFileName(path.basename(candidate)) === expectedName);
  if (candidates.length !== 1) {
    throw new Error(`Không thể xác định duy nhất tệp ${fileName} của ${fixture.dossierCode}; tìm thấy ${candidates.length}.`);
  }
  return assertInside(sourceRoot, candidates[0]);
}

async function inspectFile(sourceRoot: string, filePath: string): Promise<PcnStandardSeedSourceFile> {
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw new Error(`Nguồn seed không phải tệp: ${filePath}`);
  if (stat.size > MAX_FILE_BYTES) throw new Error(`Tệp ${path.basename(filePath)} vượt giới hạn ${MAX_FILE_BYTES} bytes.`);
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return {
    sourceFileName: path.basename(filePath),
    sourceRelativePath: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
    absolutePath: filePath,
    mimeType: MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    byteSize: stat.size,
    sha256: hash.digest('hex'),
  };
}

async function buildSourceFiles(sourceRoot: string, fixture: PcnStandardDossierFixture, allFiles: readonly string[]): Promise<PcnStandardSeedSourceFile[]> {
  const names = new Set([
    ...Object.values(fixture.sourceFiles).flat(),
    ...fixture.labArtifacts.map((artifact) => artifact.sourceFileName),
  ]);
  const result: PcnStandardSeedSourceFile[] = [];
  for (const fileName of names) {
    result.push(await inspectFile(sourceRoot, resolveSourceFile(sourceRoot, fixture, fileName, allFiles)));
  }
  return result.sort((left, right) => left.sourceFileName.localeCompare(right.sourceFileName));
}

function parseOptions(argv: readonly string[]): SeedOptions {
  const sourceArgument = argv.find((value) => value.startsWith('--source='))?.slice('--source='.length).trim();
  const positional = argv.find((value) => !value.startsWith('--'))?.trim();
  const apply = argv.includes('--apply');
  if (apply && argv.includes('--dry-run')) throw new Error('Chỉ chọn một trong --apply hoặc --dry-run.');
  const sourceRoot = sourceArgument || positional || String(process.env.PCN_STANDARD_SOURCE_ROOT || '').trim();
  if (!sourceRoot) throw new Error('Thiếu thư mục nguồn. Dùng --source="C:\\Users\\HungX\\Desktop\\PCN".');
  return {
    sourceRoot: path.resolve(sourceRoot),
    apply,
    bucketName: String(process.env.PCN_STORAGE_BUCKET || 'pcn-files').trim() || 'pcn-files',
  };
}

function assetMatches(row: Record<string, unknown>, asset: PcnStandardSeedAsset): boolean {
  return String(row.id) === asset.assetId
    && String(row.bucket_name) === asset.bucketName
    && String(row.object_path) === asset.objectPath
    && String(row.source_collection) === asset.sourceCollection
    && String(row.source_document_id) === asset.sourceDocumentId
    && String(row.source_json_path) === asset.sourceJsonPath
    && String(row.mime_type) === asset.mimeType
    && Number(row.byte_size) === asset.byteSize
    && String(row.sha256).toLowerCase() === asset.sha256.toLowerCase();
}

async function insertOrVerifyRecord(client: any, record: PcnStandardSeedRecord): Promise<'inserted' | 'existing'> {
  const existingResult = await client.query(
    'SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE',
    [record.collectionName, record.documentId],
  );
  if (existingResult.rows[0]) {
    if (stableJson(existingResult.rows[0].data || {}) !== stableJson(record.data)) {
      throw new Error(`Bản ghi ${record.collectionName}/${record.documentId} đã tồn tại nhưng payload khác; dừng, không ghi đè.`);
    }
    return 'existing';
  }
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [record.collectionName, record.documentId, JSON.stringify(record.data)],
  );
  const persistedResult = await client.query(
    'SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE',
    [record.collectionName, record.documentId],
  );
  if (!persistedResult.rows[0] || stableJson(persistedResult.rows[0].data || {}) !== stableJson(record.data)) {
    throw new Error(`Bản ghi ${record.collectionName}/${record.documentId} sau insert không khớp; dừng, không ghi đè.`);
  }
  return 'inserted';
}

async function applyPlans(plans: readonly PcnStandardDossierSeedPlan[], bucketName: string): Promise<ApplySummary> {
  const storageUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
  if (!storageUrl || !serviceRoleKey) throw new Error('Thiếu SUPABASE_STORAGE_URL và SUPABASE_SERVICE_ROLE_KEY để upload bộ hồ sơ test.');
  const storage = createSupabaseStorageClient({ baseUrl: storageUrl, serviceRoleKey });
  await storage.ensurePrivateBucket(bucketName, MAX_FILE_BYTES);

  const client = await pool.connect();
  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];
  const summary: ApplySummary = { insertedRecords: 0, existingRecords: 0, uploadedAssets: 0, existingAssets: 0 };
  try {
    await client.query('BEGIN');
    for (const plan of plans) {
      for (const asset of plan.assets) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-standard-seed-asset:${asset.assetId}`]);
        const existingResult = await client.query(
          `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
             FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
          [asset.assetId],
        );
        const existingAsset = existingResult.rows[0] as Record<string, unknown> | undefined;
        if (existingAsset) {
          if (!assetMatches(existingAsset, asset)) throw new Error(`Asset ${asset.assetId} đã tồn tại nhưng metadata khác; dừng, không ghi đè.`);
          summary.existingAssets += 1;
          continue;
        }
        const body = await fs.promises.readFile(asset.sourcePath);
        const actualSha256 = createHash('sha256').update(body).digest('hex');
        if (body.byteLength !== asset.byteSize || actualSha256 !== asset.sha256) {
          throw new Error(`Tệp nguồn ${asset.sourceRelativePath} thay đổi trong lúc seed; dừng để bảo toàn integrity.`);
        }
        await storage.uploadObject({ bucketName: asset.bucketName, objectPath: asset.objectPath, body, mimeType: asset.mimeType });
        uploadedObjects.push({ bucketName: asset.bucketName, objectPath: asset.objectPath });
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [asset.assetId, asset.bucketName, asset.objectPath, asset.sourceCollection, asset.sourceDocumentId, asset.sourceJsonPath, asset.mimeType, asset.byteSize, asset.sha256],
        );
        const persistedAsset = await client.query(
          `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
             FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
          [asset.assetId],
        );
        if (!persistedAsset.rows[0] || !assetMatches(persistedAsset.rows[0], asset)) {
          throw new Error(`Asset ${asset.assetId} sau insert không khớp; dừng để bảo toàn integrity.`);
        }
        summary.uploadedAssets += 1;
      }
      for (const record of plan.records) {
        const result = await insertOrVerifyRecord(client, record);
        if (result === 'inserted') summary.insertedRecords += 1;
        else summary.existingRecords += 1;
      }
    }
    await client.query('COMMIT');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    // Only objects uploaded by this failed invocation are cleaned up. Existing
    // PCN Storage objects and all existing database rows are never touched.
    for (const object of uploadedObjects) await storage.deleteObject(object).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function printDryRun(plans: readonly PcnStandardDossierSeedPlan[], sourceRoot: string): void {
  console.log(JSON.stringify({
    mode: 'dry-run',
    sourceRoot,
    readOnly: true,
    destructiveOperations: [],
    dossiers: plans.map((plan) => ({
      dossierCode: plan.dossier.dossierCode,
      proposalCode: plan.proposal.proposalCode,
      fieldCode: plan.fixture.fieldCode,
      checkpoint: plan.checkpoint,
      recordCount: plan.records.length,
      assetCount: plan.assets.length,
      waivedRequirementIds: plan.waivedRequirementIds,
    })),
  }, null, 2));
}

export async function runPcnStandardDossierSeed(argv = process.argv.slice(2)): Promise<void> {
  if (String(process.env.APP_PROFILE || '').trim().toLowerCase() !== 'pcn') {
    throw new Error('Lệnh seed hồ sơ chuẩn chỉ được chạy trong APP_PROFILE=pcn.');
  }
  const options = parseOptions(argv);
  if (!fs.existsSync(options.sourceRoot) || !fs.statSync(options.sourceRoot).isDirectory()) {
    throw new Error(`Không tìm thấy thư mục nguồn PCN: ${options.sourceRoot}`);
  }
  const allFiles = collectFiles(options.sourceRoot);
  const plans: PcnStandardDossierSeedPlan[] = [];
  for (const fixture of PCN_STANDARD_DOSSIER_FIXTURES) {
    const sourceFiles = await buildSourceFiles(options.sourceRoot, fixture, allFiles);
    plans.push(buildPcnStandardDossierSeedPlan(fixture, sourceFiles, options.bucketName));
  }
  if (!options.apply) {
    printDryRun(plans, options.sourceRoot);
    return;
  }
  const summary = await applyPlans(plans, options.bucketName);
  console.log(JSON.stringify({ mode: 'apply', sourceRoot: options.sourceRoot, readOnly: false, destructiveOperations: [], ...summary, dossiers: plans.map((plan) => ({ dossierCode: plan.dossier.dossierCode, checkpoint: plan.checkpoint, recordCount: plan.records.length, assetCount: plan.assets.length })) }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runPcnStandardDossierSeed().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }).finally(() => {
    void pool.end();
  });
}

// --- End of seedPcnStandardDossiers.ts ---
