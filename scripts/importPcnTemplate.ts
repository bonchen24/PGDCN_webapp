import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildActivityLog } from '../utils/activityLog.ts';
import { pool } from '../utils/db.ts';
import { resolveDatabaseConfig } from '../utils/pcnDatabase.ts';
import { inspectPcnTemplateSource } from '../utils/pcnTemplateDiscovery.ts';
import { buildPcnTemplateImportPlan, mergePcnTemplateDefinition } from '../utils/pcnTemplateImport.ts';
import { PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';
import { createSupabaseStorageClient } from '../utils/supabaseStorage.ts';
import type { PcnTemplateDefinition } from '../types.ts';

interface ImportOptions {
  templateId: string;
  sourcePath: string;
  sourceRelativePath: string;
  apply: boolean;
  approve: boolean;
  allowAnnotation: boolean;
}

function parseOptions(argv: string[]): ImportOptions {
  const argument = (name: string): string => argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1).trim() || '';
  const apply = argv.includes('--apply');
  const approve = argv.includes('--approve');
  const allowAnnotation = argv.includes('--allow-annotation');
  return {
    templateId: argument('--template'),
    sourcePath: argument('--source'),
    sourceRelativePath: argument('--relative'),
    apply,
    approve,
    allowAnnotation,
  };
}

function getStorage() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) throw new Error('PCN Storage chưa được cấu hình.');
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

function getStorageBucket(): string {
  return String(process.env.PCN_STORAGE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || 'ddt-files').trim() || 'ddt-files';
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function applyTemplateImport(plan: ReturnType<typeof buildPcnTemplateImportPlan> & { bytes: Buffer }, actorUsername = 'pcn-template-import'): Promise<{ definition: PcnTemplateDefinition; changed: boolean; activityLog?: ReturnType<typeof buildActivityLog> }> {
  const storage = getStorage();
  const bucketName = getStorageBucket();
  let uploaded = false;
  const client = await pool.connect();
  try {
    const existingResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1 LIMIT 1`,
      [plan.definition.id],
    );
    const existingRow = existingResult.rows[0];
    const existing = existingRow?.data
      ? { ...(existingRow.data as PcnTemplateDefinition), id: existingRow.document_id }
      : undefined;
    if (existing?.sourceFingerprint?.sha256 && existing.sourceFingerprint.sha256.toLowerCase() !== plan.definition.sourceFingerprint.sha256?.toLowerCase()) {
      throw new Error('Template cùng mã đã tồn tại với SHA-256 khác. Hãy tạo mã template mới để giữ provenance.');
    }

    const assetResult = await client.query(
      `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
       FROM file_assets WHERE id = $1 LIMIT 1`,
      [plan.assetId],
    );
    const asset = assetResult.rows[0];
    if (asset && (String(asset.bucket_name) !== bucketName
      || String(asset.object_path) !== plan.objectPath
      || asset.source_collection !== 'pcnTemplateDefinitions'
      || asset.source_document_id !== plan.definition.id
      || asset.source_json_path !== 'fileAssetId'
      || asset.mime_type !== plan.mimeType
      || Number(asset.byte_size) !== plan.bytes.length
      || String(asset.sha256).toLowerCase() !== plan.definition.sourceFingerprint.sha256?.toLowerCase())) {
      throw new Error('Asset template trùng mã nhưng metadata không khớp, thao tác bị dừng.');
    }

    await storage.ensurePrivateBucket(bucketName, Number(process.env.PCN_FILE_MAX_BYTES || 25 * 1024 * 1024));
    if (!asset) {
      await storage.uploadObject({ bucketName, objectPath: plan.objectPath, body: plan.bytes, mimeType: plan.mimeType });
      uploaded = true;
    }

    const merged = mergePcnTemplateDefinition(existing, plan.definition);
    const changed = !existing || stableJson(existing) !== stableJson(merged);
    await client.query('BEGIN');
    if (!asset) {
      await client.query(
        `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
         VALUES ($1, $2, $3, 'pcnTemplateDefinitions', $4, 'fileAssetId', $5, $6, $7)`,
        [plan.assetId, bucketName, plan.objectPath, plan.definition.id, plan.mimeType, plan.bytes.length, plan.definition.sourceFingerprint.sha256],
      );
    }
    if (changed) {
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnTemplateDefinitions', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [merged.id, JSON.stringify({ ...merged, id: undefined })],
      );
    }
    let activityLog: ReturnType<typeof buildActivityLog> | undefined;
    if (changed) {
      activityLog = buildActivityLog({
        action: existing ? 'UPDATED' : 'IMPORTED',
        entityType: 'PCN_TEMPLATE',
        entityId: merged.id,
        entityLabel: merged.displayName,
        actorUsername,
        actorName: 'Nhập template PCN',
        summary: `Nhập template ${merged.displayName}`,
        source: 'IMPORT',
        groupId: merged.sourceFingerprint.sha256,
      });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activityLog.id, JSON.stringify({ ...activityLog, id: undefined })],
      );
    }
    await client.query('COMMIT');
    return { definition: merged, changed, ...(activityLog ? { activityLog } : {}) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (uploaded) await storage.deleteObject({ bucketName, objectPath: plan.objectPath }).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function runPcnTemplateImport(argv = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(argv);
  if (resolveDatabaseConfig(process.env).profile !== 'pcn') throw new Error('Nhập template PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  if (options.approve && !options.apply) throw new Error('--approve chỉ được dùng cùng --apply.');
  if (options.approve) throw new Error('Không thể nhập và tự phê duyệt template; hãy Apply trước rồi dùng boundary review với người duyệt khác.');
  const template = PCN_TEMPLATE_CATALOG.find((item) => item.id === options.templateId);
  if (!template) throw new Error(`Không tìm thấy template trong catalog: ${options.templateId}`);
  if (!options.sourcePath || !options.sourceRelativePath) throw new Error('Dùng: npm run import:pcn-template -- --template=<id> --source="<file>" --relative="Hồ sơ chứng nhận QCVN4 2026/.../mau.docx" [--apply] [--allow-annotation]');

  const resolvedSourcePath = path.resolve(options.sourcePath);
  if (!fs.existsSync(resolvedSourcePath)) throw new Error(`Không tìm thấy file mẫu: ${resolvedSourcePath}`);
  const inspection = inspectPcnTemplateSource({
    fileName: path.basename(resolvedSourcePath),
    sourceRelativePath: options.sourceRelativePath,
    bytes: fs.readFileSync(resolvedSourcePath),
  });
  const plan = buildPcnTemplateImportPlan(template, inspection, { approve: options.approve, allowAnnotation: options.allowAnnotation });
  const report = {
    mode: options.apply ? 'APPLY' : 'DRY_RUN',
    approve: options.approve,
    allowAnnotation: options.allowAnnotation,
    templateId: template.id,
    inspection,
    assetId: plan.assetId,
    objectPath: plan.objectPath,
    status: plan.definition.status,
    mimeType: plan.mimeType,
  };
  if (!options.apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const result = await applyTemplateImport({ ...plan, bytes: fs.readFileSync(resolvedSourcePath) });
  console.log(JSON.stringify({ ...report, changed: result.changed, definition: result.definition, activityLogId: result.activityLog?.id || null }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnTemplateImport().catch((error) => {
    console.error('Nhập template PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of importPcnTemplate.ts ---
