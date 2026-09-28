// Author: Gemini
// OS support: Web/Node
// Description: Supabase storage helper for PGD private files

import { createSupabaseStorageClient } from '@/utils/supabaseStorage';

export function isPgdStorageConfigured(): boolean {
  return Boolean(
    String(process.env.SUPABASE_STORAGE_URL || '').trim() &&
      String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim(),
  );
}

export function getPgdStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '',
  ).trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('PGD private file storage is not configured.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

export function getPgdStorageBucket(): string {
  return String(process.env.PGD_STORAGE_BUCKET || 'pgd-files').trim() || 'pgd-files';
}
