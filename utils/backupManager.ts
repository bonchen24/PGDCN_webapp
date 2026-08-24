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

const execFileAsync = promisify(execFile);

export const BACKUP_DIR = path.join(process.cwd(), 'backups');

const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+\.(?:dump|zip)$/;
const AUTO_PREFIX = 'ddt_lab_auto_';
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

export function buildStorageBackupManifest(rows: FileAssetBackupRow[]): StorageBackupManifestEntry[] {
  return rows.map((row) => ({
    assetId: String(row.id),
    bucketName: String(row.bucket_name),
    objectPath: String(row.object_path),
    mimeType: String(row.mime_type || 'application/octet-stream'),
    byteSize: Number(row.byte_size) || 0,
    sha256: row.sha256 ? String(row.sha256) : null,
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
  try {
    await execFileAsync('pg_dump', ['--version']);
    pgToolAvailableCache = true;
  } catch {
    pgToolAvailableCache = false;
  }
  return pgToolAvailableCache;
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
  const filename = `ddt_lab_${label}_${timestampSlug(new Date())}.zip`;
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
    .filter(f => f.endsWith('.dump') || f.endsWith('.zip'))
    .map(filename => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getBackupPath(filename: string): string {
  assertSafeFilename(filename);
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error('Không tìm thấy file sao lưu.');
  }
  return filePath;
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

export async function restoreBackup(filename: string): Promise<void> {
  const filePath = getBackupPath(filename);
  const connectionString = buildPostgresConnectionString(process.env);

  if (filename.endsWith('.dump')) {
    await execFileAsync('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '-d', connectionString,
      filePath,
    ]);
    return;
  }

  const archive = new AdmZip(filePath);
  const databaseEntry = archive.getEntry(DATABASE_ENTRY_NAME);
  if (!databaseEntry) throw new Error('Bản sao lưu không chứa database.dump.');
  const manifest = readStorageManifest(archive);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-lab-restore-'));
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
        await storage.uploadObject({
          bucketName: entry.bucketName,
          objectPath: entry.objectPath,
          body: objectEntry.getData(),
          mimeType: entry.mimeType,
        });
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// --- End of backupManager.ts ---
