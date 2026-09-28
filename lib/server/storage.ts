import { createSupabaseStorageClient } from '@/utils/supabaseStorage';

export const PCN_FILE_MAX_BYTES = Number(process.env.PCN_FILE_MAX_BYTES || 25 * 1024 * 1024);

export type OwnedFileAsset = {
  id: string;
  bucket_name?: string | null;
  object_path?: string | null;
};

export type HardDeleteDomain = 'pcn' | 'pgd';

export function isPcnStorageConfigured(): boolean {
  return Boolean(
    String(process.env.SUPABASE_STORAGE_URL || '').trim() &&
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim()
  );
}

export function isPgdStorageConfigured(): boolean {
  return Boolean(
    String(process.env.SUPABASE_STORAGE_URL || '').trim() &&
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim()
  );
}

export function getPcnStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
  ).trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('PCN file storage is not configured. Set SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

export function getPcnStorageBucket(): string {
  return String(process.env.PCN_STORAGE_BUCKET || 'pcn-files').trim() || 'pcn-files';
}

export function getPgdStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
  ).trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('PGD private file storage is not configured.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

export function getPgdStorageBucket(): string {
  return String(process.env.PGD_STORAGE_BUCKET || 'pgd-files').trim() || 'pgd-files';
}

export function sanitizePcnPathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'file';
}

export async function deleteOwnedFileAssets(
  assets: OwnedFileAsset[],
  domain: HardDeleteDomain
): Promise<void> {
  const usableAssets = assets.filter((asset) => asset.bucket_name && asset.object_path);
  if (usableAssets.length === 0) return;
  if (domain === 'pcn' && !isPcnStorageConfigured()) return;
  if (domain === 'pgd' && !isPgdStorageConfigured()) return;
  const storage = domain === 'pcn' ? getPcnStorageClient() : getPgdStorageClient();
  for (const asset of usableAssets) {
    try {
      await storage.deleteObject({
        bucketName: asset.bucket_name!,
        objectPath: asset.object_path!,
      });
    } catch (error) {
      console.error(`Không thể xóa file asset ${asset.id} sau khi xóa hồ sơ ${domain}:`, error);
    }
  }
}
