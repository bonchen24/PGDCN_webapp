// Author: Gemini
// OS support: Web/Node
// Description: KQTN PDF storage client and helpers

import { createSupabaseStorageClient } from '@/utils/supabaseStorage';
export { buildKqtnPdfContentDisposition } from '@/utils/kqtnPdfHeaders';

export const KQTN_PDF_MAX_BYTES = 50 * 1024 * 1024;

export function getKqtnStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '',
  ).trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('KQTN PDF storage is not configured. Set SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

export function getKqtnStorageBucket(): string {
  return String(process.env.SUPABASE_STORAGE_BUCKET || 'pcn-files').trim() || 'pcn-files';
}

export function sanitizeKqtnPathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'record';
}

export function getKqtnPdfMetadata(data: any): any | null {
  const value = data?.resultPdf;
  return value && typeof value === 'object' && value.objectPath ? value : null;
}
