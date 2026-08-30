// Author: Gemini
// OS support: Web/Node
// Description: Server-side complete PostgreSQL and Supabase Storage backup/restore

import AdmZip from 'adm-zip';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pool, buildPostgresConnectionString } from './db';
import { createSupabaseStorageClient } from './supabaseStorage';
import { assertBackupObjectIntegrity } from './backupIntegrity';
import { buildActivityLog } from './activityLog';
import { buildPcnBackupVerification, type PcnBackupVerification } from './pcnBackupVerification';
import type { ActivityLog, UserRole } from '../types';

const execFileAsync = promisify(execFile);

export const BACKUP_DIR = path.join(process.cwd(), 'backups');

const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+\.(?:dump|zip)$/;

export function getBackupProfile(profileValue: unknown = process.env.APP_PROFILE): 'pcn' | 'ddt' {
  return String(profileValue || '').trim().toLowerCase() === 'pcn' ? 'pcn' : 'ddt';
}

export function getBackupPrefix(profileValue: unknown = process.env.APP_PROFILE): string {
  return getBackupProfile(profileValue) === 'pcn' ? 'pcn_certification' : 'ddt_lab';
}

export function getBackupAutoPrefix(profileValue: unknown = process.env.APP_PROFILE): string {
  return `${getBackupPrefix(profileValue)}_auto_`;
}

const backupProfile = getBackupProfile();
const backupPrefix = getBackupPrefix();
const AUTO_PREFIX = getBackupAutoPrefix();
const DATABASE_ENTRY_NAME = 'database.dump';
const STORAGE_MANIFEST_ENTRY_NAME = 'storage/manifest.json';

let pgToolAvailableCache: boolean | null = null;

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface FileAssetBackupRow {
  id: string;
  bucket_name: string;
  object_path: string;
  mime_type: string;
  byte_size: number | string;
  sha256?: string | null;
}

export interface StorageBackupManifestEntry {
  assetId: string;
  bucketName: string;
  objectPath: string;
  mimeType: string;
  byteSize: number;
  sha256: string | null;
  entryName: string;
}

export interface BackupRestoreActor {
  username?: string;
  name?: string;
  role?: UserRole;
}

export type BackupActivityAction = 'CREATED' | 'DELETED' | 'RESTORED';

export function buildBackupActivity(
  action: BackupActivityAction,
  filename: string,
  actor: BackupRestoreActor = {},
  createdAt = new Date().toISOString(),
  source: ActivityLog['source'] = 'SYSTEM',
): ActivityLog {
  const actionLabel = action === 'CREATED' ? 'Tạo' : action === 'DELETED' ? 'Xóa' : 'Khôi phục';
  return buildActivityLog({
    createdAt,
    actorUsername: actor.username,
    actorName: actor.name || 'Hệ thống',
    actorRole: actor.role,
    action,
    entityType: 'SYSTEM',
    entityId: `backup:${filename}`,
    entityLabel: filename,
    summary: `${actionLabel} archive ${filename}`,
    source,
  });
}

export function getBackupActivityPayload(log: ActivityLog): Omit<ActivityLog, 'id'> {
  const payload = { ...log };
  delete payload.id;
  return payload;
}

export function buildBackupRestoreActivity(
  filename: string,
  actor: BackupRestoreActor = {},
  createdAt = new Date().toISOString(),
): ActivityLog {
  return buildBackupActivity('RESTORED', filename, actor, createdAt, 'RESTORE');
}

export function mergeBackupActivityLogsForRestore(
  existingBeforeRestore: ActivityLog[],
  restoredFromArchive: ActivityLog[],
  restoreActivity: ActivityLog,
): ActivityLog[] {
  const merged = new Map<string, ActivityLog>();
  for (const log of restoredFromArchive) {
    merged.set(String(log.id), log);
  }
  for (const log of existingBeforeRestore) {
    const id = String(log.id);
    const restored = merged.get(id);
    if (restored && JSON.stringify(restored) !== JSON.stringify(log)) {
      throw new Error(`Activity log trùng ID với nội dung khác: ${id}`);
    }
    merged.set(id, log);
  }
  if (merged.has(restoreActivity.id)) {
    throw new Error(`Activity log restore bị trùng ID: ${restoreActivity.id}`);
  }
  merged.set(restoreActivity.id, restoreActivity);
  return Array.from(merged.values());
}

export function buildStorageBackupManifest(rows: FileAssetBackupRow[]): StorageBackupManifestEntry[] {
  return rows.map((row) => ({
    assetId: String(row.id),
    bucketName: String(row.bucket_name),
    objectPath: String(row.object_path),
    mimeType: String(row.mime_type || 'application/octet-stream'),
    byteSize: Number(row.byte_size) || 0,
    sha256: row.sha256 ? String(row.sha256).trim() : null,
    entryName: `storage/objects/${String(row.id)}.bin`,
  }));
}

export function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export async function isPgToolAvailable(): Promise<boolean> {
  if (pgToolAvailableCache !== null) return pgToolAvailableCache;
  const checkTool = async (tool: string): Promise<boolean> => {
    try {
      await execFileAsync(tool, ['--version']);
      return true;
    } catch {
      return false;
    }
  };
  const [dumpAvailable, restoreAvailable] = await Promise.all([checkTool('pg_dump'), checkTool('pg_restore')]);
  pgToolAvailableCache = dumpAvailable && restoreAvailable;
  return pgToolAvailableCache;
}

async function canReadPostgresDump(filePath: string, pgToolAvailable: boolean): Promise<boolean> {
  if (!pgToolAvailable) return false;
  try {
    await execFileAsync('pg_restore', ['--list', filePath], { maxBuffer: 2 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function timestampSlug(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function assertSafeFilename(filename: string): void {
  if (!SAFE_FILENAME_PATTERN.test(filename) || filename.includes('..')) {
    throw new Error('Tên file sao lưu không hợp lệ.');
  }
}

function getStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('Không thể sao lưu file: Supabase Storage chưa được cấu hình.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

async function readFileAssetRows(): Promise<FileAssetBackupRow[]> {
  const result = await pool.query(
    'SELECT id, bucket_name, object_path, mime_type, byte_size, sha256 FROM file_assets ORDER BY id',
  );
  return result.rows as FileAssetBackupRow[];
}

async function createPostgresDump(filePath: string): Promise<void> {
  const connectionString = buildPostgresConnectionString(process.env);
  await execFileAsync('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '-f', filePath,
    connectionString,
  ]);
}

export async function createBackup(label: 'auto' | 'manual'): Promise<BackupInfo> {
  ensureBackupDir();
  const filename = `${backupPrefix}_${label}_${timestampSlug(new Date())}.zip`;
  const archivePath = path.join(BACKUP_DIR, filename);
  const dumpPath = path.join(BACKUP_DIR, `.${filename}.dump`);

  try {
    await createPostgresDump(dumpPath);
    const rows = await readFileAssetRows();
    const manifest = buildStorageBackupManifest(rows);
    const archive = new AdmZip();
    archive.addLocalFile(dumpPath, '', DATABASE_ENTRY_NAME);
    archive.addFile(STORAGE_MANIFEST_ENTRY_NAME, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    if (manifest.length > 0) {
      const storage = getStorageClient();
      for (const entry of manifest) {
        const downloaded = await storage.downloadObject({
          bucketName: entry.bucketName,
          objectPath: entry.objectPath,
        });
        assertBackupObjectIntegrity(entry, downloaded.body);
        archive.addFile(entry.entryName, downloaded.body);
      }
    }

    archive.writeZip(archivePath);
    const stat = fs.statSync(archivePath);
    return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
  } catch (error) {
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    throw error;
  } finally {
    if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
  }
}

export function listBackups(): BackupInfo[] {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => (f.endsWith('.dump') || f.endsWith('.zip')) && f.startsWith(`${backupPrefix}_`))
    .map(filename => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getBackupPath(filename: string): string {
  assertSafeFilename(filename);
  if (!filename.startsWith(`${backupPrefix}_`)) {
    throw new Error('File sao lưu không thuộc database/profile đang chạy.');
  }
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error('Không tìm thấy file sao lưu.');
  }
  return filePath;
}

async function readActivityLogsForRestore(): Promise<ActivityLog[]> {
  const result = await pool.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'activityLogs'
     ORDER BY document_id`,
  );
  return result.rows
    .map((row) => {
      const data = row.data && typeof row.data === 'object' ? row.data : {};
      return {
        ...data,
        id: String(data.id || row.document_id),
      } as ActivityLog;
    })
    .filter((log) => Boolean(log.id));
}

async function appendActivityLogsWithoutOverwrite(logs: ActivityLog[]): Promise<void> {
  if (logs.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const log of logs) {
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [log.id, JSON.stringify(getBackupActivityPayload(log))],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordBackupActivity(
  action: Exclude<BackupActivityAction, 'RESTORED'>,
  filename: string,
  actor: BackupRestoreActor = {},
  source: Extract<ActivityLog['source'], 'UI' | 'SYSTEM'> = actor.username ? 'UI' : 'SYSTEM',
): Promise<ActivityLog> {
  const log = buildBackupActivity(action, filename, actor, new Date().toISOString(), source);
  await appendActivityLogsWithoutOverwrite([log]);
  return log;
}

async function finalizeRestoreActivityLogs(
  existingBeforeRestore: ActivityLog[],
  filename: string,
  actor: BackupRestoreActor,
): Promise<void> {
  const restoredFromArchive = await readActivityLogsForRestore();
  const restoreActivity = buildBackupRestoreActivity(filename, actor);
  const merged = mergeBackupActivityLogsForRestore(existingBeforeRestore, restoredFromArchive, restoreActivity);
  await appendActivityLogsWithoutOverwrite(merged);
}

export function deleteBackup(filename: string): void {
  const filePath = getBackupPath(filename);
  fs.unlinkSync(filePath);
}

export function applyRetention(retentionCount: number): void {
  const autoBackups = listBackups().filter(b => b.filename.startsWith(AUTO_PREFIX));
  const stale = autoBackups.slice(retentionCount);
  for (const b of stale) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.filename));
    } catch (err: any) {
      console.error(`Failed to remove stale backup ${b.filename}:`, err.message);
    }
  }
}

function readStorageManifest(archive: AdmZip): StorageBackupManifestEntry[] {
  const entry = archive.getEntry(STORAGE_MANIFEST_ENTRY_NAME);
  if (!entry) return [];
  const parsed = JSON.parse(entry.getData().toString('utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Manifest file sao lưu không hợp lệ.');
  return parsed.map((item) => {
    const value = item as Partial<StorageBackupManifestEntry>;
    if (!value.assetId || !value.bucketName || !value.objectPath || !value.entryName) {
      throw new Error('Manifest file sao lưu thiếu thông tin object.');
    }
    return {
      assetId: String(value.assetId),
      bucketName: String(value.bucketName),
      objectPath: String(value.objectPath),
      mimeType: String(value.mimeType || 'application/octet-stream'),
      byteSize: Number(value.byteSize) || 0,
      sha256: value.sha256 ? String(value.sha256) : null,
      entryName: String(value.entryName),
    };
  });
}

export async function verifyBackupArchive(filename: string): Promise<PcnBackupVerification> {
  const filePath = getBackupPath(filename);
  const stat = fs.statSync(filePath);
  const format = filename.endsWith('.zip') ? 'zip' : 'dump';
  const additionalErrors: string[] = [];
  let databaseDumpPresent = false;
  let manifestPresent = false;
  let manifestReadable = format === 'dump';
  let manifestObjectCount = 0;
  let objectEntryCount = 0;
  let verifiedObjectCount = 0;
  let missingObjectCount = 0;
  let invalidObjectCount = 0;
  let dumpPath = filePath;
  let tempDir: string | undefined;

  try {
    if (format === 'zip') {
      const archive = new AdmZip(filePath);
      const databaseEntry = archive.getEntry(DATABASE_ENTRY_NAME);
      databaseDumpPresent = Boolean(databaseEntry);
      const manifestEntry = archive.getEntry(STORAGE_MANIFEST_ENTRY_NAME);
      manifestPresent = Boolean(manifestEntry);
      const objectEntryNames = archive.getEntries()
        .map((entry) => entry.entryName)
        .filter((entryName) => entryName.startsWith('storage/objects/') && entryName.endsWith('.bin'));
      objectEntryCount = objectEntryNames.length;

      let manifest: StorageBackupManifestEntry[] = [];
      if (manifestEntry) {
        try {
          manifest = readStorageManifest(archive);
          manifestReadable = true;
          manifestObjectCount = manifest.length;
        } catch {
          manifestReadable = false;
          additionalErrors.push('Manifest Storage không đọc được hoặc sai cấu trúc.');
        }
      }

      for (const entry of manifest) {
        if (!entry.entryName.startsWith('storage/objects/') || !entry.entryName.endsWith('.bin')) {
          invalidObjectCount += 1;
          continue;
        }
        const objectEntry = archive.getEntry(entry.entryName);
        if (!objectEntry) {
          missingObjectCount += 1;
          continue;
        }
        try {
          assertBackupObjectIntegrity(entry, objectEntry.getData());
          verifiedObjectCount += 1;
        } catch {
          invalidObjectCount += 1;
        }
      }

      if (databaseEntry) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${backupPrefix}-verify-`));
        dumpPath = path.join(tempDir, DATABASE_ENTRY_NAME);
        fs.writeFileSync(dumpPath, databaseEntry.getData());
      }
    } else {
      databaseDumpPresent = true;
    }
  } catch {
    additionalErrors.push('Không thể đọc cấu trúc archive.');
  }

  const pgToolAvailable = await isPgToolAvailable();
  const dumpReadable = databaseDumpPresent && await canReadPostgresDump(dumpPath, pgToolAvailable);

  if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  return buildPcnBackupVerification({
    filename,
    format,
    sizeBytes: stat.size,
    databaseDumpPresent,
    manifestPresent,
    manifestReadable,
    manifestObjectCount,
    objectEntryCount,
    verifiedObjectCount,
    missingObjectCount,
    invalidObjectCount,
    pgToolAvailable,
    dumpReadable,
  }, additionalErrors);
}

export async function restoreBackup(filename: string, actor: BackupRestoreActor = {}): Promise<void> {
  const filePath = getBackupPath(filename);
  const verification = await verifyBackupArchive(filename);
  if (!verification.ok) {
    throw new Error(`Không thể khôi phục archive chưa qua kiểm chứng: ${verification.errors.slice(0, 3).join(' ')}`);
  }

  const connectionString = buildPostgresConnectionString(process.env);
  const existingActivityLogs = await readActivityLogsForRestore();

  if (filename.endsWith('.dump')) {
    await execFileAsync('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '-d', connectionString,
      filePath,
    ]);
    await finalizeRestoreActivityLogs(existingActivityLogs, filename, actor);
    return;
  }

  const archive = new AdmZip(filePath);
  const databaseEntry = archive.getEntry(DATABASE_ENTRY_NAME);
  if (!databaseEntry) throw new Error('Bản sao lưu không chứa database.dump.');
  const manifest = readStorageManifest(archive);
  for (const entry of manifest) {
    const objectEntry = archive.getEntry(entry.entryName);
    if (!objectEntry) throw new Error(`Bản sao lưu thiếu object ${entry.objectPath}.`);
    assertBackupObjectIntegrity(entry, objectEntry.getData());
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${backupPrefix}-restore-`));
  const dumpPath = path.join(tempDir, DATABASE_ENTRY_NAME);

  try {
    fs.writeFileSync(dumpPath, databaseEntry.getData());
    await execFileAsync('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '-d', connectionString,
      dumpPath,
    ]);

    if (manifest.length > 0) {
      const storage = getStorageClient();
      for (const entry of manifest) {
        const objectEntry = archive.getEntry(entry.entryName);
        if (!objectEntry) throw new Error(`Bản sao lưu thiếu object ${entry.objectPath}.`);
        const body = objectEntry.getData();
        assertBackupObjectIntegrity(entry, body);
        await storage.uploadObject({
          bucketName: entry.bucketName,
          objectPath: entry.objectPath,
          body,
          mimeType: entry.mimeType,
        });
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  await finalizeRestoreActivityLogs(existingActivityLogs, filename, actor);
}

// --- End of backupManager.ts ---
