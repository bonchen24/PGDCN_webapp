import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { PcnUserAccount, PcnWorkflowTemplate } from '@/types';
import { PgdWorkflowTemplate } from '@/utils/pgdWorkflowTemplate';
import { getPgdDossierRequirements } from '@/utils/pgdDossier';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { getDocumentPayload } from '@/lib/server/collections';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { buildActivityLog as buildActivityLogBase } from '@/utils/activityLog';
import { validateDossierTemplateRequirementDefinitions } from '@/utils/pgdcnDossierTemplate';

export const PGD_COLLECTIONS = {
  workflowTemplates: 'pgdWorkflowTemplates',
  requests: 'pgdInspectionRequests',
  assignments: 'pgdInspectionAssignments',
  documents: 'pgdDocuments',
  documentTemplates: 'pgdDocumentTemplates',
  dossierDocuments: 'pgdDossierDocuments',
  activityLogs: 'pgdActivityLogs',
  drafts: 'pgdDrafts',
} as const;

export function isSafePcnSampleKey(value: string): boolean {
  return value.length > 0 && value.length <= 120 && /^[a-zA-Z0-9._-]+$/.test(value);
}

export function isPcnWorkflowManager(actor: PcnUserAccount | null): boolean {
  if (!actor) return false;
  return isPcnSystemManager(actor);
}

export function isPgdWorkflowManager(actor: PcnUserAccount | null): boolean {
  if (!actor) return false;
  return (
    isPcnSystemManager(actor) ||
    ['PGD_ADMIN', 'PGD_MANAGER'].includes(String((actor as any).pgdRole || '').trim().toUpperCase())
  );
}

export function canProposePcnWorkflow(actor: PcnUserAccount | null): boolean {
  if (!actor || isPcnWorkflowManager(actor) || actor.active === false || actor.role === 'viewer' || actor.systemRole === 'viewer') return false;
  return (actor.departmentScopes || []).includes('PCN');
}

export function canProposePgdWorkflow(actor: PcnUserAccount | null): boolean {
  if (!actor || isPgdWorkflowManager(actor) || actor.active === false || actor.role === 'viewer' || actor.systemRole === 'viewer') return false;
  return (actor.departmentScopes || []).includes('PGD') && String((actor as any).pgdRole || '').trim().toUpperCase() !== 'PGD_VIEWER';
}

export const buildPcnWorkflowTemplateRecord = (
  raw: any,
  actor: PcnUserAccount,
  now: string,
  base?: PcnWorkflowTemplate
): PcnWorkflowTemplate => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const requirementPolicies = source.requirementPolicies !== undefined ? source.requirementPolicies : base?.requirementPolicies;
  return {
    id: String(source.id || base?.id || `pcn-workflow-${randomUUID()}`).trim(),
    code: String(source.code || base?.code || '').trim().toUpperCase(),
    name: String(source.name || base?.name || '').trim(),
    ...(String(source.description || base?.description || '').trim()
      ? { description: String(source.description || base?.description).trim() }
      : {}),
    appliesTo: {
      fieldCodes: Array.from(
        new Set(
          (Array.isArray(source.appliesTo?.fieldCodes)
            ? source.appliesTo.fieldCodes
            : base?.appliesTo?.fieldCodes || []
          )
            .map((value: unknown) => String(value).trim().toUpperCase())
            .filter(Boolean)
        )
      ),
      ...(Array.isArray(source.appliesTo?.methods) || base?.appliesTo?.methods
        ? {
            methods: Array.from(
              new Set(
                (Array.isArray(source.appliesTo?.methods)
                  ? source.appliesTo.methods
                  : base?.appliesTo?.methods || []
                )
                  .map((value: unknown) => String(value).trim().toUpperCase())
                  .filter(Boolean)
              )
            ) as any,
          }
        : {}),
      ...(String(source.appliesTo?.dossierType || base?.appliesTo?.dossierType || '').trim()
        ? { dossierType: String(source.appliesTo?.dossierType || base?.appliesTo?.dossierType).trim() }
        : {}),
    },
    ...(requirementPolicies !== undefined ? { requirementPolicies } : {}),
    version: Number(source.version || base?.version || 1),
    status: source.status === 'PUBLISHED' || source.status === 'RETIRED' ? source.status : 'DRAFT',
    scope: base?.scope || (source.scope === 'PERSONAL' ? 'PERSONAL' : 'COMMON'),
    ...(Array.isArray(source.stages) || base?.stages ? { stages: Array.isArray(source.stages) ? source.stages : base?.stages } : {}),
    ...(Array.isArray(source.requirementDefinitions) || base?.requirementDefinitions ? { requirementDefinitions: Array.isArray(source.requirementDefinitions) ? source.requirementDefinitions : base?.requirementDefinitions } : {}),
    nodes: Array.isArray(source.nodes) ? source.nodes : base?.nodes || [],
    transitions: Array.isArray(source.transitions) ? source.transitions : base?.transitions || [],
    createdAt: base?.createdAt || now,
    createdBy: base?.createdBy || actor.username,
    ...(base?.publishedAt ? { publishedAt: base.publishedAt } : {}),
    ...(base?.publishedBy ? { publishedBy: base.publishedBy } : {}),
    updatedAt: now,
    updatedBy: actor.username,
  };
};

export const assertPcnWorkflowRequirementReferences = async (
  client: PoolClient | any,
  template: PcnWorkflowTemplate
): Promise<void> => {
  const definitionValidation = validateDossierTemplateRequirementDefinitions(template.requirementDefinitions, 'PCN');
  if (!definitionValidation.valid) throw Object.assign(new Error(definitionValidation.errors.join(' ')), { statusCode: 400 });
  const customIds = new Set((template.requirementDefinitions || []).map((definition) => definition.id));
  const allRequirementIds = Array.from(
    new Set(
      [...template.nodes.flatMap((node) => node.requirementIds || []), ...(template.stages || []).flatMap((stage) => stage.requirementIds || [])]
        .map((id) => String(id).trim())
        .filter(Boolean)
    )
  );
  const invalidCustom = allRequirementIds.filter((id) => (id.startsWith('pcn-custom-') && !customIds.has(id)) || id.startsWith('pgd-custom-'));
  if (invalidCustom.length) throw Object.assign(new Error(`Template PCN tham chiếu requirement custom không tồn tại hoặc sai domain: ${invalidCustom.join(', ')}.`), { statusCode: 400 });
  const customDocxIds = (template.requirementDefinitions || []).filter((definition) => definition.source === 'DRAFT_FROM_DOCX_TEMPLATE').map((definition) => definition.linkedDocxTemplateId!);
  if (customDocxIds.length) {
    const linkedTemplates = await client.query(`SELECT document_id FROM app_documents WHERE collection_name = 'pcnTemplates' AND document_id = ANY($1::text[]) AND data->>'status' = 'APPROVED'`, [customDocxIds]);
    const availableTemplates = new Set(linkedTemplates.rows.map((row: any) => String(row.document_id)));
    const missingTemplates = customDocxIds.filter((id) => !availableTemplates.has(id));
    if (missingTemplates.length) throw Object.assign(new Error(`Requirement PCN liên kết mẫu DOCX không tồn tại hoặc chưa duyệt: ${missingTemplates.join(', ')}.`), { statusCode: 400 });
  }
  const requirementIds = allRequirementIds.filter((id) => !customIds.has(id));
  if (requirementIds.length === 0) return;
  const result = await client.query(
    `SELECT document_id FROM app_documents
     WHERE collection_name = 'pcnDocumentRequirements'
       AND document_id = ANY($1::text[])
       AND COALESCE(data->>'active', 'true') = 'true'`,
    [requirementIds]
  );
  const available = new Set(result.rows.map((row: any) => String(row.document_id)));
  const missing = requirementIds.filter((id) => !available.has(id));
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Template tham chiếu requirement không tồn tại hoặc đã tắt: ${missing.join(', ')}.`),
      { statusCode: 400 }
    );
  }
};

export const writePcnWorkflowActivity = async (
  client: PoolClient | any,
  input: {
    action: any;
    entityId: string;
    entityLabel: string;
    summary: string;
    actor: PcnUserAccount;
    createdAt: string;
  }
) => {
  const log = buildActivityLog({
    action: input.action,
    entityType: input.entityId.includes('--') ? 'PCN_DOSSIER' : 'PCN_TEMPLATE',
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    actorUsername: input.actor.username,
    actorName: input.actor.name,
    actorRole: (input.actor as any).systemRole || input.actor.role,
    summary: input.summary,
    source: 'UI',
    createdAt: input.createdAt,
  });
  const validationError = validateActivityLogPayload(log);
  if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [log.id, JSON.stringify(getDocumentPayload(log))]
  );
  return log;
};

export const buildPgdWorkflowTemplateRecord = (
  raw: any,
  actor: PcnUserAccount,
  now: string,
  base?: PgdWorkflowTemplate
): PgdWorkflowTemplate => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const sourceAppliesTo = source.appliesTo && typeof source.appliesTo === 'object' ? source.appliesTo : {};
  const sourceNodes = Array.isArray(source.nodes) ? source.nodes : base?.nodes || [];
  const sourceTransitions = Array.isArray(source.transitions) ? source.transitions : base?.transitions || [];
  const requirementPolicies = source.requirementPolicies !== undefined ? source.requirementPolicies : base?.requirementPolicies;
  return {
    domain: 'pgd',
    id: String(source.id || base?.id || `pgd-workflow-${randomUUID()}`).trim(),
    code: String(source.code || base?.code || '').trim().toUpperCase(),
    name: String(source.name || base?.name || '').trim(),
    ...(String(source.description || base?.description || '').trim()
      ? { description: String(source.description || base?.description).trim() }
      : {}),
    appliesTo: {
      productGroups: Array.from(
        new Set(
          (Array.isArray(sourceAppliesTo.productGroups)
            ? sourceAppliesTo.productGroups
            : base?.appliesTo?.productGroups || []
          )
            .map((value: unknown) => String(value).trim().toUpperCase())
            .filter(Boolean)
        )
      ) as PgdWorkflowTemplate['appliesTo']['productGroups'],
      ...(Array.isArray(sourceAppliesTo.methodCodes) || base?.appliesTo?.methodCodes
        ? {
            methodCodes: Array.from(
              new Set(
                (Array.isArray(sourceAppliesTo.methodCodes)
                  ? sourceAppliesTo.methodCodes
                  : base?.appliesTo?.methodCodes || []
                )
                  .map((value: unknown) => String(value).trim().toUpperCase())
                  .filter(Boolean)
              )
            ),
          }
        : {}),
    },
    ...(requirementPolicies !== undefined ? { requirementPolicies } : {}),
    version: Number(source.version || base?.version || 1),
    status: source.status === 'PUBLISHED' || source.status === 'RETIRED' ? source.status : 'DRAFT',
    scope: base?.scope || (source.scope === 'PERSONAL' ? 'PERSONAL' : 'COMMON'),
    ...(Array.isArray(source.stages) || base?.stages ? { stages: Array.isArray(source.stages) ? source.stages : base?.stages } : {}),
    ...(Array.isArray(source.requirementDefinitions) || base?.requirementDefinitions ? { requirementDefinitions: Array.isArray(source.requirementDefinitions) ? source.requirementDefinitions : base?.requirementDefinitions } : {}),
    nodes: sourceNodes.map((node: any, index: number) => ({
      ...node,
      id: String(node?.id || `node-${index + 1}`).trim(),
      label: String(node?.label || '').trim(),
      requirementCodes: Array.from(
        new Set(
          (Array.isArray(node?.requirementCodes) ? node.requirementCodes : [])
            .map((value: unknown) => String(value).trim().toUpperCase())
            .filter(Boolean)
        )
      ),
      active: node?.active !== false,
      sortOrder: Number(node?.sortOrder ?? (index + 1) * 10),
      ...(node?.laneId ? { laneId: String(node.laneId).trim() } : {}),
      ...(node?.column !== undefined ? { column: Number(node.column) } : {}),
      ...(node?.stageId ? { stageId: String(node.stageId).trim() } : {}),
    })),
    transitions: sourceTransitions.map((transition: any, index: number) => ({
      ...transition,
      id: String(transition?.id || `edge-${index + 1}`).trim(),
      fromNodeId: String(transition?.fromNodeId || '').trim(),
      toNodeId: String(transition?.toNodeId || '').trim(),
    })),
    createdAt: base?.createdAt || now,
    createdBy: base?.createdBy || actor.username,
    ...(base?.publishedAt ? { publishedAt: base.publishedAt } : {}),
    ...(base?.publishedBy ? { publishedBy: base.publishedBy } : {}),
    updatedAt: now,
    updatedBy: actor.username,
  };
};

export const assertPgdWorkflowRequirementReferences = async (
  client: PoolClient | any,
  template: PgdWorkflowTemplate
): Promise<void> => {
  const definitionValidation = validateDossierTemplateRequirementDefinitions(template.requirementDefinitions, 'PGD');
  if (!definitionValidation.valid) throw Object.assign(new Error(definitionValidation.errors.join(' ')), { statusCode: 400 });
  const customIds = new Set((template.requirementDefinitions || []).map((definition) => definition.id));
  const allRequirementCodes = Array.from(new Set([
    ...template.nodes.flatMap((node) => node.requirementCodes || []),
    ...(template.stages || []).flatMap((stage) => stage.requirementIds || []),
  ].map((code) => String(code).trim()).filter(Boolean)));
  const invalidCustom = allRequirementCodes.filter((code) => (code.startsWith('pgd-custom-') && !customIds.has(code)) || code.startsWith('pcn-custom-'));
  if (invalidCustom.length) throw Object.assign(new Error(`Template PGD tham chiếu requirement custom không tồn tại hoặc sai domain: ${invalidCustom.join(', ')}.`), { statusCode: 400 });
  const customDocxIds = (template.requirementDefinitions || []).filter((definition) => definition.source === 'DRAFT_FROM_DOCX_TEMPLATE').map((definition) => definition.linkedDocxTemplateId!);
  if (customDocxIds.length) {
    const linkedTemplates = await client.query(`SELECT document_id FROM app_documents WHERE collection_name = $1 AND document_id = ANY($2::text[]) AND data->>'domain' = 'pgd' AND COALESCE(data->>'active', 'true') = 'true'`, [PGD_COLLECTIONS.documentTemplates, customDocxIds]);
    const availableTemplates = new Set(linkedTemplates.rows.map((row: any) => String(row.document_id)));
    const missingTemplates = customDocxIds.filter((id) => !availableTemplates.has(id));
    if (missingTemplates.length) throw Object.assign(new Error(`Requirement PGD liên kết mẫu DOCX không tồn tại hoặc đã tắt: ${missingTemplates.join(', ')}.`), { statusCode: 400 });
  }
  const available = new Set(
    ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].flatMap((productGroup) =>
      getPgdDossierRequirements(productGroup as any).map((requirement) => requirement.code)
    )
  );
  const requirementCodes = allRequirementCodes.filter((code) => !customIds.has(code));
  const missing = requirementCodes.filter((code) => !available.has(code));
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Template PGD tham chiếu tài liệu không tồn tại hoặc không hoạt động: ${missing.join(', ')}.`),
      { statusCode: 400 }
    );
  }
};

export async function writePgdActivity(
  client: PoolClient | any,
  actor: any,
  input: {
    action: any;
    entityId: string;
    entityLabel?: string;
    summary: string;
    idSuffix?: string;
    entityType?: string;
    requestCode?: string;
    changes?: any;
  }
) {
  const activityId = `pgd-activity-${input.entityId}-${input.idSuffix || input.action}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const activity = buildActivityLogBase({
    domain: 'PGD',
    id: activityId,
    actorUsername: actor?.username,
    actorName: actor?.name,
    actorRole: actor?.systemRole || actor?.role,
    action: input.action,
    entityType: (input.entityType as any) || 'SYSTEM',
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    requestCode: input.requestCode,
    summary: input.summary,
    changes: input.changes,
    source: 'UI',
    createdAt,
    groupId: input.requestCode || input.entityId,
  });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ('pgdActivityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [activity.id, JSON.stringify(getDocumentPayload(activity))]
  );
  return activity;
}
