import { createHash } from 'node:crypto';
import { createSupabaseStorageClient } from '@/utils/supabaseStorage';

export function sanitizePcnPathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

export const PCN_FILE_SOURCE_COLLECTIONS = new Set([
  'pcnCertificationFields',
  'certificationProposals',
  'certificationDossiers',
  'pcnDocumentRequirements',
  'pcnTemplateDefinitions',
  'pcnOfficialGeneratedDocuments',
  'dossierDocuments',
  'dossierAttachments',
  'pcnGeneratedDocuments',
  'pcnDraftWorkspaces',
  'labRequests',
  'returnedResults',
  'approvalSteps',
  'issuancePackages',
  'pcnQualityDocuments',
  'customers',
]);

export const PCN_FILE_UPLOAD_SOURCE_COLLECTIONS = new Set([
  'dossierDocuments',
  'pcnQualityDocuments',
  'returnedResults',
  'issuancePackages',
]);

export const PCN_FILE_ASSET_ID_PATTERN = /^pcn-(?:file|template)-[a-z0-9-]+$/;

export function isSafePcnSourceJsonPath(value: string): boolean {
  return Boolean(value) && value.length <= 200 && !value.includes('/') && !value.includes('\\') && !value.includes('..');
}

export function buildPcnFileContentDisposition(originalName: string, disposition: 'inline' | 'attachment' = 'inline'): string {
  const fallback = sanitizePcnPathSegment(originalName || 'pcn-file');
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fallback)}`;
}

export function stablePcnMutationId(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex')}`;
}

export function isPcnStorageConfigured(): boolean {
  return Boolean(
    String(process.env.SUPABASE_STORAGE_URL || '').trim() &&
      String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim(),
  );
}

export function getPcnStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '',
  ).trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('PCN file storage is not configured. Set SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

export function getPcnStorageBucket(): string {
  return String(process.env.PCN_STORAGE_BUCKET || 'pcn-files').trim() || 'pcn-files';
}
