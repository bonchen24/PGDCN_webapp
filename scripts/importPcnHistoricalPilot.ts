import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { PoolClient } from 'pg';

import { initDbSchema, pool } from '../utils/db.ts';
import { buildActivityLog } from '../utils/activityLog.ts';
import { createSupabaseStorageClient } from '../utils/supabaseStorage.ts';
import {
  DEFAULT_PCN_HISTORICAL_PILOT,
  buildPcnHistoricalBatchFingerprint,
  buildPcnHistoricalImportPlan,
  normalizePcnHistoricalIdempotencyPayload,
  type PcnHistoricalFileInput,
  type PcnHistoricalImportPlan,
  type PcnHistoricalPilotSpec,
} from '../utils/pcnHistoricalImport.ts';
import {
  buildPcnHistoricalSpecFromCandidate,
  normalizePcnHistoricalBatchId,
  parsePcnHistoricalCandidateSelectors,
  resolvePcnHistoricalCandidates,
} from '../utils/pcnHistoricalSelection.ts';
import { assertPcnHistoricalSourceBytes } from '../utils/pcnHistoricalSourceIntegrity.ts';
import { discoverPcnHistoricalFolders } from './discoverPcnHistoricalFolders.ts';
import type { PcnHistoricalSourceCandidate } from '../utils/pcnHistoricalSourceDiscovery.ts';
import type { PcnDossierAttachment } from '../types.ts';

dotenv.config();

const BATCH_ID = 'pcn-history-pilot-v1';
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;

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

interface ParsedArguments {
  sourceRoot: string;
  apply: boolean;
  dryRun: boolean;
  candidateSelectors: string[];
  batchId: string;
}

function parseArguments(argv: string[]): ParsedArguments {
  const sourceArgument = argv.find((value) => value.startsWith('--source='));
  const positional = argv.find((value) => !value.startsWith('--')) || '';
  const rawCandidateSelectors = argv.filter((value) => value.startsWith('--candidate=')).map((value) => value.slice('--candidate='.length));
  const candidateSelectors = parsePcnHistoricalCandidateSelectors(rawCandidateSelectors).map((selector) => `${selector.fieldCode}:${selector.businessCode}`);
  const batchArguments = argv.filter((value) => value.startsWith('--batch='));
  if (batchArguments.length > 1) throw new Error('Chỉ chọn một --batch=... cho mỗi lần nhập.');
  const requestedBatchId = batchArguments[0]?.slice('--batch='.length) || '';
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run') || !apply;
  if (apply && argv.includes('--dry-run')) throw new Error('Chỉ chọn một trong --dry-run hoặc --apply.');
  return {
    sourceRoot: sourceArgument?.slice('--source='.length) || positional || String(process.env.PCN_HISTORICAL_SOURCE_ROOT || '').trim(),
    apply,
    dryRun,
    candidateSelectors,
    batchId: normalizePcnHistoricalBatchId(requestedBatchId || (candidateSelectors.length > 0 ? 'pcn-history-selected-v1' : BATCH_ID)),
  };
}

function assertSafeChildPath(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(prefix)) {
    throw new Error(`Đường dẫn hồ sơ nằm ngoài nguồn nhập: ${candidate}`);
  }
  return resolvedCandidate;
}

function collectFiles(directory: string): string[] {
  const output: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(entryPath));
    else if (entry.isFile()) output.push(entryPath);
  }
  return output.sort((left, right) => left.localeCompare(right));
}

async function inspectFile(filePath: string, relativePath: string): Promise<PcnHistoricalFileInput> {
  const hash = createHash('sha256');
  let byteSize = 0;
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buffer);
    byteSize += buffer.byteLength;
  }
  return {
    relativePath: relativePath.replace(/\\/g, '/'),
    fileName: path.basename(filePath),
    mimeType: MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    byteSize,
    sha256: hash.digest('hex'),
  };
}

async function inspectPilotFolder(sourceRoot: string, spec: PcnHistoricalPilotSpec): Promise<PcnHistoricalFileInput[]> {
  const folderPath = assertSafeChildPath(sourceRoot, path.join(sourceRoot, spec.sourceRelativePath));
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new Error(`Không tìm thấy thư mục pilot ${spec.dossierCode}: ${spec.sourceRelativePath}`);
  }
  const sourceFiles = collectFiles(folderPath);
  const result: PcnHistoricalFileInput[] = [];
  for (const filePath of sourceFiles) {
    const relativePath = path.relative(folderPath, filePath);
    result.push(await inspectFile(filePath, relativePath));
  }
  return result;
}

export async function buildPcnHistoricalPilotPlans(
  sourceRoot: string,
  importedAt = new Date().toISOString(),
  selectedCandidates: PcnHistoricalSourceCandidate[] = [],
  batchId = BATCH_ID,
): Promise<{ plans: PcnHistoricalImportPlan[]; sourceRoot: string; importedAt: string; selectedCandidates: PcnHistoricalSourceCandidate[] }> {
  const resolvedRoot = path.resolve(sourceRoot);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Không tìm thấy thư mục nguồn hồ sơ lịch sử: ${sourceRoot}`);
  }
  const specs = selectedCandidates.length > 0
    ? selectedCandidates.map((candidate) => buildPcnHistoricalSpecFromCandidate(candidate, candidate.sourceRelativePath.match(/\b(20\d{2})\b/)?.[1] || '2026'))
    : [...DEFAULT_PCN_HISTORICAL_PILOT];
  const plans: PcnHistoricalImportPlan[] = [];
  for (const spec of specs) {
    const files = await inspectPilotFolder(resolvedRoot, spec);
    plans.push(buildPcnHistoricalImportPlan({ spec, batchId, importedAt, files }));
  }
  return { plans, sourceRoot: resolvedRoot, importedAt, selectedCandidates };
}

function sanitizePathSegment(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

export function summarizePcnHistoricalPlans(plans: PcnHistoricalImportPlan[], batchId: string) {
  const byField = { QC4: 0, QC9: 0 };
  const byKind: Record<string, number> = {};
  const unmappedByKind: Record<string, number> = {};
  let importedFiles = 0;
  let skippedFiles = 0;
  let importedBytes = 0;
  let autoMappedFiles = 0;
  let unmappedFiles = 0;
  for (const plan of plans) {
    byField[plan.dossier.historicalImport?.sourceFamily || 'QC4'] += 1;
    importedFiles += plan.attachments.length;
    skippedFiles += plan.skippedFiles.length;
    importedBytes += plan.attachments.reduce((sum, item) => sum + item.byteSize, 0);
    for (const attachment of plan.attachments) {
      byKind[attachment.kind] = (byKind[attachment.kind] || 0) + 1;
      if (attachment.mappingStatus === 'AUTO_MAPPED') autoMappedFiles += 1;
      if (attachment.mappingStatus === 'UNMAPPED') {
        unmappedFiles += 1;
        unmappedByKind[attachment.kind] = (unmappedByKind[attachment.kind] || 0) + 1;
      }
    }
  }
  return {
    batchId,
    dossierCount: plans.length,
    byField,
    importedFiles,
    skippedFiles,
    importedBytes,
    byKind,
    autoMappedFiles,
    unmappedFiles,
    unmappedByKind,
    dossiers: plans.map((plan) => ({
      dossierCode: plan.dossier.dossierCode,
      proposalCode: plan.proposal.proposalCode,
      status: plan.dossier.status,
      files: plan.attachments.length,
      skipped: plan.skippedFiles.length,
      sourceFolderName: plan.dossier.historicalImport?.sourceFolderName,
      sourceRelativePath: plan.dossier.historicalImport?.sourceRelativePath,
      unresolvedFields: plan.dossier.historicalImport?.unresolvedFields || [],
    })),
  };
}

function stripId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const { id: _ignoredId, ...data } = record;
  return data;
}

function stableHistoricalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableHistoricalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableHistoricalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function historicalPayloadMatches(existing: unknown, expected: unknown): boolean {
  return stableHistoricalJson(normalizePcnHistoricalIdempotencyPayload(existing))
    === stableHistoricalJson(normalizePcnHistoricalIdempotencyPayload(expected));
}

async function insertOrVerifyHistoricalDocument<T extends { id: string }>(
  client: PoolClient,
  collectionName: string,
  record: T,
  allowInsert: boolean,
): Promise<void> {
  const expected = stripId(record);
  const existingResult = await client.query(
    `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE`,
    [collectionName, record.id],
  );
  if (existingResult.rows[0]) {
    if (!historicalPayloadMatches(existingResult.rows[0].data, expected)) {
      throw new Error(`Bản ghi lịch sử ${collectionName}/${record.id} đã tồn tại nhưng payload không khớp; dừng để bảo toàn integrity.`);
    }
    return;
  }
  if (!allowInsert) {
    throw new Error(`Batch lịch sử đã commit nhưng thiếu bản ghi ${collectionName}/${record.id}; cần rà soát integrity trước khi retry.`);
  }
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [collectionName, record.id, JSON.stringify(expected)],
  );
  const persistedResult = await client.query(
    `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE`,
    [collectionName, record.id],
  );
  if (!persistedResult.rows[0] || !historicalPayloadMatches(persistedResult.rows[0].data, expected)) {
    throw new Error(`Bản ghi lịch sử ${collectionName}/${record.id} sau insert không khớp payload; dừng để bảo toàn integrity.`);
  }
}

function historicalAssetMatches(
  asset: Record<string, unknown>,
  expected: { objectPath: string; dossierId: string; sourceJsonPath: string; mimeType: string; byteSize: number; sha256: string },
  bucketName: string,
): boolean {
  return String(asset.bucket_name) === bucketName
    && String(asset.object_path) === expected.objectPath
    && String(asset.source_collection) === 'dossierAttachments'
    && String(asset.source_document_id) === expected.dossierId
    && String(asset.source_json_path) === expected.sourceJsonPath
    && String(asset.mime_type) === expected.mimeType
    && Number(asset.byte_size) === expected.byteSize
    && String(asset.sha256).toLowerCase() === expected.sha256.toLowerCase();
}

async function verifyHistoricalAttachmentScope(
  client: PoolClient,
  plan: PcnHistoricalImportPlan,
  existingBatchLog: boolean,
): Promise<void> {
  const expectedByPath = new Map<string, PcnDossierAttachment>();
  for (const attachment of plan.attachments) {
    if (expectedByPath.has(attachment.sourceRelativePath)) {
      throw new Error(`Batch lịch sử có hai tệp trùng sourceRelativePath: ${attachment.sourceRelativePath}`);
    }
    expectedByPath.set(attachment.sourceRelativePath, attachment);
  }
  const existingResult = await client.query(
    `SELECT document_id, data
       FROM app_documents
      WHERE collection_name = 'dossierAttachments'
        AND data->>'dossierId' = $1
        AND document_id LIKE 'pcn-attachment-hist-%'
      ORDER BY document_id
      FOR UPDATE`,
    [plan.dossier.id],
  );
  for (const row of existingResult.rows) {
    const data = row.data || {};
    const sourceRelativePath = String(data.sourceRelativePath || '').trim();
    const expected = expectedByPath.get(sourceRelativePath);
    if (!expected || String(row.document_id) !== expected.id || !historicalPayloadMatches(data, stripId(expected))) {
      throw new Error(`Attachment lịch sử của hồ sơ ${plan.dossier.id} không khớp batch hiện tại; dừng để bảo toàn integrity.`);
    }
  }
  if (existingBatchLog && existingResult.rows.length !== expectedByPath.size) {
    throw new Error(`Batch lịch sử đã commit nhưng tập attachment của hồ sơ ${plan.dossier.id} không đầy đủ; cần rà soát integrity trước khi retry.`);
  }
}

async function ensureHistoricalAsset(
  client: PoolClient,
  storage: ReturnType<typeof createSupabaseStorageClient>,
  plan: PcnHistoricalImportPlan,
  attachment: PcnDossierAttachment,
  bucketName: string,
  sourceRoot: string,
  allowInsert: boolean,
  uploadedObjects: Array<{ bucketName: string; objectPath: string }>,
): Promise<void> {
  const objectPath = `pcnHistorical/${sanitizePathSegment(plan.dossier.id)}/${sanitizePathSegment(attachment.assetId)}-${sanitizePathSegment(attachment.fileName)}`;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-history-asset:${attachment.assetId}`]);
  const assetResult = await client.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
       FROM file_assets
      WHERE id = $1
      LIMIT 1
      FOR UPDATE`,
    [attachment.assetId],
  );
  const asset = assetResult.rows[0] as Record<string, unknown> | undefined;
  const expectedAsset = {
    objectPath,
    dossierId: plan.dossier.id,
    sourceJsonPath: `attachments.${attachment.kind}`,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    sha256: attachment.sha256,
  };
  if (asset) {
    if (!historicalAssetMatches(asset, expectedAsset, bucketName)) {
      throw new Error(`Asset lịch sử ${attachment.assetId} có metadata không khớp; dừng để bảo toàn integrity.`);
    }
    return;
  }
  if (!allowInsert) {
    throw new Error(`Batch lịch sử đã commit nhưng thiếu asset ${attachment.assetId}; cần rà soát integrity trước khi retry.`);
  }
  if (attachment.byteSize > MAX_IMPORT_FILE_BYTES) throw new Error(`Tệp vượt giới hạn 50 MB: ${attachment.sourceRelativePath}`);
  if (!plan.dossier.historicalImport?.sourceRelativePath) throw new Error(`Hồ sơ ${plan.dossier.id} thiếu provenance sourceRelativePath.`);
  const sourcePath = assertSafeChildPath(sourceRoot, path.join(sourceRoot, plan.dossier.historicalImport.sourceRelativePath, attachment.sourceRelativePath));
  const body = await fs.promises.readFile(sourcePath);
  assertPcnHistoricalSourceBytes(attachment, body);
  await storage.uploadObject({ bucketName, objectPath, body, mimeType: attachment.mimeType });
  uploadedObjects.push({ bucketName, objectPath });
  await client.query(
    `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
     VALUES ($1, $2, $3, 'dossierAttachments', $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [attachment.assetId, bucketName, objectPath, plan.dossier.id, `attachments.${attachment.kind}`, attachment.mimeType, attachment.byteSize, attachment.sha256],
  );
  const persistedResult = await client.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
       FROM file_assets
      WHERE id = $1
      LIMIT 1
      FOR UPDATE`,
    [attachment.assetId],
  );
  if (!persistedResult.rows[0] || !historicalAssetMatches(persistedResult.rows[0], expectedAsset, bucketName)) {
    throw new Error(`Asset lịch sử ${attachment.assetId} sau insert không khớp metadata; dừng để bảo toàn integrity.`);
  }
}

export async function applyPcnHistoricalPlans(plans: PcnHistoricalImportPlan[], sourceRoot: string, batchId: string): Promise<boolean> {
  const storageUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
  if (!storageUrl || !serviceRoleKey) throw new Error('Thiếu SUPABASE_STORAGE_URL và SUPABASE_SERVICE_ROLE_KEY để apply file lịch sử.');
  if (!batchId || plans.length === 0) throw new Error('Batch lịch sử phải có batchId và ít nhất một hồ sơ.');
  if (plans.some((plan) => plan.dossier.historicalImport?.batchId !== batchId)) {
    throw new Error('Kế hoạch lịch sử chứa hồ sơ khác batchId; dừng để bảo toàn integrity.');
  }
  if (new Set(plans.map((plan) => plan.dossier.id)).size !== plans.length) {
    throw new Error('Kế hoạch lịch sử chứa dossier trùng; dừng để bảo toàn integrity.');
  }
  const bucketName = String(process.env.PCN_STORAGE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || 'ddt-files').trim() || 'ddt-files';
  const storage = createSupabaseStorageClient({ baseUrl: storageUrl, serviceRoleKey });
  await storage.ensurePrivateBucket(bucketName, MAX_IMPORT_FILE_BYTES);

  const batchFingerprint = buildPcnHistoricalBatchFingerprint(plans);
  const batchLog = buildActivityLog({
    id: `activity-${batchId}`,
    createdAt: plans[0]?.dossier.historicalImport?.importedAt || new Date().toISOString(),
    actorName: 'Nhập hồ sơ lịch sử',
    action: 'IMPORTED',
    entityType: 'SYSTEM',
    entityId: batchId,
    entityLabel: batchId,
    summary: `Nhập batch ${batchId}: ${plans.length} hồ sơ lịch sử QC4/QC9`,
    source: 'IMPORT',
    groupId: batchId,
    idempotencyKey: batchId,
    idempotencyFingerprint: batchFingerprint,
  });
  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-history-apply:${batchId}`]);
    const existingBatchResult = await client.query(
      `SELECT data FROM app_documents WHERE collection_name = 'activityLogs' AND document_id = $1 LIMIT 1 FOR UPDATE`,
      [batchLog.id],
    );
    const existingBatchData = existingBatchResult.rows[0]?.data as Record<string, unknown> | undefined;
    if (existingBatchData) {
      const existingFingerprint = String(existingBatchData.idempotencyFingerprint || '').trim();
      const existingKey = String(existingBatchData.idempotencyKey || '').trim();
      if (existingFingerprint && existingFingerprint !== batchFingerprint) {
        throw new Error(`Batch lịch sử ${batchId} đã tồn tại với fingerprint khác; từ chối retry để bảo toàn integrity.`);
      }
      if (existingKey && existingKey !== batchId) {
        throw new Error(`Activity batch ${batchId} đã tồn tại với idempotencyKey khác; từ chối retry để bảo toàn integrity.`);
      }
      const expectedLegacyBatch = { ...stripId(batchLog) } as Record<string, unknown>;
      const existingLegacyBatch = { ...existingBatchData };
      delete expectedLegacyBatch.idempotencyKey;
      delete expectedLegacyBatch.idempotencyFingerprint;
      delete existingLegacyBatch.idempotencyKey;
      delete existingLegacyBatch.idempotencyFingerprint;
      if (!historicalPayloadMatches(existingLegacyBatch, expectedLegacyBatch)) {
        throw new Error(`Activity batch ${batchId} đã tồn tại nhưng payload không khớp; từ chối retry để bảo toàn integrity.`);
      }
    }
    const existingDossierResult = await client.query(
      `SELECT document_id
         FROM app_documents
        WHERE collection_name = 'certificationDossiers'
          AND data #>> '{historicalImport,batchId}' = $1
        ORDER BY document_id
        FOR UPDATE`,
      [batchId],
    );
    const expectedDossierIds = new Set(plans.map((plan) => plan.dossier.id));
    if (existingDossierResult.rows.some((row) => !expectedDossierIds.has(String(row.document_id)))
      || (existingBatchData && existingDossierResult.rows.length !== expectedDossierIds.size)) {
      throw new Error(`Batch lịch sử ${batchId} đã tồn tại với phạm vi dossier khác; từ chối retry để bảo toàn integrity.`);
    }
    const allowInsert = !existingBatchData;
    for (const plan of plans) {
      await insertOrVerifyHistoricalDocument(client, 'certificationProposals', plan.proposal, allowInsert);
      await insertOrVerifyHistoricalDocument(client, 'certificationDossiers', plan.dossier, allowInsert);
      for (const document of plan.documents) {
        await insertOrVerifyHistoricalDocument(client, 'dossierDocuments', document, allowInsert);
      }

      await verifyHistoricalAttachmentScope(client, plan, Boolean(existingBatchData));
      for (const attachment of plan.attachments) {
        await ensureHistoricalAsset(client, storage, plan, attachment, bucketName, sourceRoot, allowInsert, uploadedObjects);
        await insertOrVerifyHistoricalDocument(client, 'dossierAttachments', attachment, allowInsert);
      }

      await insertOrVerifyHistoricalDocument(client, 'activityLogs', plan.activityLog, allowInsert);
    }
    await insertOrVerifyHistoricalDocument(client, 'activityLogs', batchLog, allowInsert);
    await client.query('COMMIT');
    return Boolean(existingBatchData);
  } catch (error) {
    await client.query('ROLLBACK');
    for (const object of uploadedObjects) await storage.deleteObject(object).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function runPcnHistoricalPilot(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(argv);
  if (String(process.env.APP_PROFILE || '').trim().toLowerCase() !== 'pcn') {
    throw new Error('Nhập hồ sơ lịch sử PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  }
  if (!options.sourceRoot) throw new Error('Thiếu nguồn hồ sơ. Ví dụ: npm run import:pcn-history -- --source="C:\\Users\\HungX\\Desktop\\PCN" --dry-run');
  let selectedCandidates: PcnHistoricalSourceCandidate[] = [];
  if (options.candidateSelectors.length > 0) {
    const discovery = discoverPcnHistoricalFolders(options.sourceRoot);
    selectedCandidates = resolvePcnHistoricalCandidates(discovery.candidates, options.candidateSelectors);
  }
  const result = await buildPcnHistoricalPilotPlans(options.sourceRoot, new Date().toISOString(), selectedCandidates, options.batchId);
  console.log(JSON.stringify({ sourceRoot: result.sourceRoot, importedAt: result.importedAt, selectedCandidates: result.selectedCandidates.map((candidate) => ({ fieldCode: candidate.fieldCode, businessCode: candidate.businessCode, sourceRelativePath: candidate.sourceRelativePath })), ...summarizePcnHistoricalPlans(result.plans, options.batchId) }, null, 2));
  if (options.dryRun) {
    console.log('DRY-RUN: chưa ghi database hoặc Storage. Dùng --apply sau khi rà soát báo cáo.');
    return;
  }
  await initDbSchema();
  await applyPcnHistoricalPlans(result.plans, result.sourceRoot, options.batchId);
  console.log(`Đã nhập ${result.plans.length} hồ sơ lịch sử vào database PCN ${process.env.PCN_POSTGRES_DB || 'pcn_certification'}.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnHistoricalPilot().catch((error) => {
    console.error('Nhập pilot hồ sơ lịch sử PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of importPcnHistoricalPilot.ts ---
