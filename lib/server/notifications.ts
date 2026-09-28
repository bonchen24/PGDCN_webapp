import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { mapDocumentRow } from '@/lib/server/collections';
import { isOrganizationLeader } from '@/utils/pcnRbac';
import { getDepartmentScopes } from '@/utils/pcnAuth';

export const PCN_NOTIFICATION_ENTITY_TYPES = [
  'PCN_PROPOSAL',
  'PCN_DOSSIER',
  'PCN_SAMPLE_LOT',
  'PCN_LAB_REQUEST',
  'PCN_RESULT',
  'PCN_APPROVAL',
  'PCN_ISSUANCE',
] as const;

export const PGD_NOTIFICATION_ENTITY_TYPES = [
  'PGD_REQUEST',
  'PGD_ASSIGNMENT',
  'PGD_FIELD_INSPECTION',
  'PGD_SAMPLE',
  'PGD_LAB_REQUEST',
  'PGD_LAB_RESULT',
  'PGD_REPORT',
  'PGD_CERTIFICATE',
  'PGD_APPROVAL',
] as const;

export const PGDCN_NOTIFICATION_ENTITY_TYPES = [
  ...PCN_NOTIFICATION_ENTITY_TYPES,
  ...PGD_NOTIFICATION_ENTITY_TYPES,
] as const;

export type PcnNotificationAudienceUser = NonNullable<ReturnType<typeof getPcnSessionUser>>;

export function buildPcnNotificationVisibilityConditions(
  actor: PcnNotificationAudienceUser,
  params: any[],
): string[] {
  const entityTypesParam = `$${params.push([...PCN_NOTIFICATION_ENTITY_TYPES])}`;
  const conditions = [
    `collection_name = 'notifications'`,
    `data->>'entityType' = ANY(${entityTypesParam}::text[])`,
  ];
  const role = String(actor.systemRole || actor.role || '').trim().toLowerCase();
  if (role !== 'admin') {
    const usernameParam = `$${params.push(String(actor.username || '').trim().toLowerCase())}`;
    const targetUsernames = `CASE
      WHEN jsonb_typeof(COALESCE(data->'targetUsernames', '[]'::jsonb)) = 'array'
        THEN COALESCE(data->'targetUsernames', '[]'::jsonb)
      ELSE '[]'::jsonb
    END`;
    conditions.push(`(
      (
        jsonb_array_length(${targetUsernames}) > 0
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(${targetUsernames}) AS target(username)
          WHERE lower(trim(target.username)) = lower(trim(${usernameParam}))
        )
      )
      OR (
        jsonb_array_length(${targetUsernames}) = 0
        AND COALESCE(data->>'targetRole', '') IN ('staff', 'all')
      )
    )`);
  }
  return conditions;
}

export function buildPgdcnNotificationVisibilityConditions(
  actor: PcnNotificationAudienceUser,
  params: any[],
): string[] {
  const role = String(actor.systemRole || actor.role || '').trim().toLowerCase();
  const configuredScopes = Array.isArray(actor.departmentScopes)
    ? actor.departmentScopes.filter((scope: unknown) => scope === 'PCN' || scope === 'PGD')
    : [];
  const scopes = Array.from(new Set(configuredScopes.length > 0
    ? configuredScopes
    : getDepartmentScopes(actor as unknown as Record<string, unknown>, role === 'admin' ? 'admin' : undefined)));
  const scopeParam = `$${params.push(scopes)}`;
  const entityTypesParam = `$${params.push([...PGDCN_NOTIFICATION_ENTITY_TYPES])}`;
  const conditions = [
    `collection_name = 'notifications'`,
    `COALESCE(data->>'domain', 'PCN') = ANY(${scopeParam}::text[])`,
    `data->>'entityType' = ANY(${entityTypesParam}::text[])`,
  ];
  const isManager = role === 'admin'
    || isOrganizationLeader(actor)
    || String(actor.pgdRole || '').trim().toUpperCase() === 'PGD_MANAGER';
  if (!isManager) {
    const usernameParam = `$${params.push(String(actor.username || '').trim().toLowerCase())}`;
    const targetUsernames = `CASE
      WHEN jsonb_typeof(COALESCE(data->'targetUsernames', '[]'::jsonb)) = 'array'
        THEN COALESCE(data->'targetUsernames', '[]'::jsonb)
      ELSE '[]'::jsonb
    END`;
    conditions.push(`(
      (
        jsonb_array_length(${targetUsernames}) > 0
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(${targetUsernames}) AS target(username)
          WHERE lower(trim(target.username)) = lower(trim(${usernameParam}))
        )
      )
      OR (
        jsonb_array_length(${targetUsernames}) = 0
        AND COALESCE(data->>'targetRole', '') IN ('staff', 'all')
      )
    )`);
  }
  return conditions;
}
