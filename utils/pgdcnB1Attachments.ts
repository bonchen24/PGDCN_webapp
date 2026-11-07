import { BASE_PCN_DOCUMENT_REQUIREMENTS } from './pcnDossierDocuments';
import { getPgdDossierRequirements } from './pgdDossier';

export const PGDCN_B1_ATTACHMENT_TYPES = [
  { value: 'REQUEST', label: 'Phiếu / đề nghị' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'INVOICE', label: 'Hóa đơn' },
  { value: 'BILL_OF_LADING', label: 'Vận đơn' },
  { value: 'CUSTOMS_DECLARATION', label: 'Tờ khai' },
  { value: 'TECHNICAL', label: 'Tài liệu kỹ thuật' },
  { value: 'IMAGE', label: 'Hình ảnh' },
  { value: 'OTHER', label: 'Khác' },
] as const;

export type PgdcnB1AttachmentKind = (typeof PGDCN_B1_ATTACHMENT_TYPES)[number]['value'];
export type PgdcnB1UploadStatus = 'READY' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export type PgdcnB1SelectedAttachment = {
  id: string;
  file: File;
  kind: PgdcnB1AttachmentKind;
  status: PgdcnB1UploadStatus;
  error?: string;
  requirementId?: string;
  requirementCode?: string;
  displayName?: string;
  documentKind?: string;
  mappingStatus?: 'MAPPED' | 'PENDING_MAPPING';
};

export interface ResolvedB1AttachmentRequirement {
  domain: 'PCN' | 'PGD';
  templateId?: string;
  templateVersion?: number;
  stageId: string;
  requirementId: string;
  requirementCode: string;
  displayName: string;
  multiplicity: 'SINGLE' | 'MULTIPLE';
  required: boolean;
  sourceProvenance: 'TEMPLATE_DEFINITION' | 'TEMPLATE_NODE_CATALOG' | 'BASELINE';
  documentKind?: string;
}

export interface ResolveB1AttachmentRequirementsInput {
  domain: 'PCN' | 'PGD';
  fieldCode?: string;
  productGroup?: string;
  templateId?: string;
  templateVersion?: number;
  template?: any;
  workflowSnapshot?: any;
  customDefinitions?: any[];
}

export function resolveB1AttachmentRequirementsLegacy(input: ResolveB1AttachmentRequirementsInput): ResolvedB1AttachmentRequirement[] {
  const domain = input.domain;
  const template = input.template || input.workflowSnapshot;
  const customDefs = [
    ...(template?.requirementDefinitions || []),
    ...(input.customDefinitions || []),
  ];

  if (domain === 'PCN') {
    const fieldCode = (input.fieldCode || 'QC4').toUpperCase();
    if (!template) {
      const baselineCodes = fieldCode === 'QC9'
        ? ['QC9-PROPOSAL', 'QC9-COMMERCIAL']
        : ['QC4-PROPOSAL', 'QC4-COMMERCIAL'];
      return baselineCodes.map((reqId) => {
        const cat = BASE_PCN_DOCUMENT_REQUIREMENTS.find((r) => r.id === reqId || r.code === reqId);
        return {
          domain: 'PCN',
          stageId: 'intake',
          requirementId: reqId,
          requirementCode: reqId,
          displayName: cat?.name || reqId,
          multiplicity: 'SINGLE',
          required: cat?.required ?? true,
          sourceProvenance: 'BASELINE',
        };
      });
    }

    const nodes = Array.isArray(template.nodes) ? template.nodes : [];
    const intakeNodes = nodes.filter((node: any) => {
      const stageKey = `${node.stageId || ''} ${node.id || ''} ${node.label || ''}`.toLowerCase();
      const hasIntakeName = /intake|tiếp nhận|đề nghị|proposal/.test(stageKey);
      const hasIntakeReqs = Array.isArray(node.requirementIds) && node.requirementIds.some((id: string) =>
        id.endsWith('-PROPOSAL') || id.endsWith('-COMMERCIAL') || id.includes('PROPOSAL') || id.includes('COMMERCIAL')
      );
      return (node.active !== false) && (hasIntakeName || hasIntakeReqs || node.stageId === 'intake' || node.stageId === 'intake-documents');
    });

    let rawReqIds: string[] = [];
    for (const node of intakeNodes) {
      if (Array.isArray(node.requirementIds)) {
        for (const id of node.requirementIds) {
          if (!rawReqIds.includes(id)) rawReqIds.push(id);
        }
      }
    }

    if (rawReqIds.length === 0 && Array.isArray(template.stages)) {
      const intakeStage = template.stages.find((s: any) => s.id === 'intake-documents' || s.id === 'intake' || s.sortOrder === 10);
      if (intakeStage && Array.isArray(intakeStage.requirementIds)) {
        rawReqIds = [...new Set<string>(intakeStage.requirementIds)];
      }
    }

    if (rawReqIds.length === 0) {
      const fallbackCodes = fieldCode === 'QC9'
        ? ['QC9-PROPOSAL', 'QC9-COMMERCIAL']
        : ['QC4-PROPOSAL', 'QC4-COMMERCIAL'];
      rawReqIds = fallbackCodes;
    }

    return rawReqIds.map((reqId) => {
      const def = customDefs.find((d: any) => d.id === reqId || d.code === reqId);
      if (def) {
        return {
          domain: 'PCN',
          templateId: template.id,
          templateVersion: template.version,
          stageId: 'intake',
          requirementId: def.id || reqId,
          requirementCode: def.code || reqId,
          displayName: def.name,
          multiplicity: def.multiplicity || 'SINGLE',
          required: def.level === 'REQUIRED',
          sourceProvenance: 'TEMPLATE_DEFINITION',
        };
      }
      const cat = BASE_PCN_DOCUMENT_REQUIREMENTS.find((r) => r.id === reqId || r.code === reqId || `${fieldCode}-${r.code}` === reqId);
      return {
        domain: 'PCN',
        templateId: template.id,
        templateVersion: template.version,
        stageId: 'intake',
        requirementId: reqId,
        requirementCode: cat?.code || reqId,
        displayName: cat?.name || reqId,
        multiplicity: 'SINGLE',
        required: cat?.required ?? true,
        sourceProvenance: 'TEMPLATE_NODE_CATALOG',
      };
    });
  }

  // Domain === 'PGD'
  if (!template) {
    const baselineCodes = ['REQUEST_PYC', 'REQUEST_SUPPORTING'];
    const catalog = getPgdDossierRequirements((input.productGroup as any) || 'OTHER');
    return baselineCodes.map((reqId) => {
      const cat = catalog.find((r) => r.code === reqId);
      return {
        domain: 'PGD',
        stageId: 'intake',
        requirementId: reqId,
        requirementCode: reqId,
        displayName: cat?.title || reqId,
        multiplicity: 'SINGLE',
        required: cat?.required ?? true,
        sourceProvenance: 'BASELINE',
      };
    });
  }

  const nodes = Array.isArray(template.nodes) ? template.nodes : [];
  const requestNodes = nodes.filter((node: any) => {
    const key = `${node.id || ''} ${node.label || ''} ${node.stageId || ''}`.toLowerCase();
    const isCommercial = /commercial|thương mại|hợp đồng|hải quan|customs/.test(key);
    if (isCommercial) return false;
    const isRequest = /request|pyc|tiếp nhận|intake/.test(key);
    const hasRequestCodes = Array.isArray(node.requirementCodes) && node.requirementCodes.some((c: string) => c === 'REQUEST_PYC' || c === 'REQUEST_SUPPORTING');
    return (node.active !== false) && (isRequest || hasRequestCodes);
  });

  let rawCodes: string[] = [];
  for (const node of requestNodes) {
    const codes = node.requirementCodes || node.requirementIds || [];
    for (const c of codes) {
      if (!rawCodes.includes(c)) rawCodes.push(c);
    }
  }

  if (rawCodes.length === 0) {
    rawCodes = ['REQUEST_PYC', 'REQUEST_SUPPORTING'];
  }

  const catalog = getPgdDossierRequirements((input.productGroup as any) || 'OTHER');
  return rawCodes.map((reqId) => {
    const def = customDefs.find((d: any) => d.id === reqId || d.code === reqId);
    if (def) {
      return {
        domain: 'PGD',
        templateId: template.id,
        templateVersion: template.version,
        stageId: 'intake',
        requirementId: def.id || reqId,
        requirementCode: def.code || reqId,
        displayName: def.name,
        multiplicity: def.multiplicity || 'SINGLE',
        required: def.level === 'REQUIRED',
        sourceProvenance: 'TEMPLATE_DEFINITION',
      };
    }
    const cat = catalog.find((r) => r.code === reqId);
    return {
      domain: 'PGD',
      templateId: template.id,
      templateVersion: template.version,
      stageId: 'intake',
      requirementId: reqId,
      requirementCode: reqId,
      displayName: cat?.title || reqId,
      multiplicity: 'SINGLE',
      required: cat?.required ?? true,
      sourceProvenance: 'TEMPLATE_NODE_CATALOG',
    };
  });
}

const B1_STAGE_ALIASES = new Set(['b1', 'intake', 'intake-documents', 'request']);

function isB1Stage(value: unknown): boolean {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  return B1_STAGE_ALIASES.has(normalized);
}

export function resolveB1AttachmentRequirements(input: ResolveB1AttachmentRequirementsInput): ResolvedB1AttachmentRequirement[] {
  const domain = input.domain;
  const template = input.template || input.workflowSnapshot;
  const templateId = input.templateId || template?.templateId || template?.id;
  const templateVersion = input.templateVersion ?? template?.templateVersion ?? template?.version;
  const customDefinitions = [
    ...(template?.requirementDefinitions || []),
    ...(input.customDefinitions || []),
  ].filter((definition: any) => definition?.domain === domain);

  if (template && template.status && template.status !== 'PUBLISHED') return [];
  const snapshotTemplateId = template?.templateId || template?.id;
  const snapshotTemplateVersion = template?.templateVersion ?? template?.version;
  if (input.templateId && snapshotTemplateId && input.templateId !== snapshotTemplateId) return [];
  if (input.templateVersion !== undefined && snapshotTemplateVersion !== undefined && input.templateVersion !== snapshotTemplateVersion) return [];

  if (!template) {
    if (templateId || templateVersion !== undefined) return [];

    if (domain === 'PCN') {
      const fieldCode = (input.fieldCode || 'QC4').toUpperCase();
      const baselineIds = [`${fieldCode}-PROPOSAL`, `${fieldCode}-COMMERCIAL`];
      return baselineIds.map((requirementId) => {
        const catalog = BASE_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === requirementId);
        return {
          domain: 'PCN',
          stageId: 'B1',
          requirementId,
          requirementCode: catalog?.code || requirementId,
          displayName: catalog?.name || requirementId,
          multiplicity: 'SINGLE',
          required: catalog?.required ?? true,
          sourceProvenance: 'BASELINE',
          documentKind: catalog?.code,
        };
      });
    }
    const catalog = getPgdDossierRequirements((input.productGroup as any) || 'OTHER');
    return ['REQUEST_PYC', 'REQUEST_SUPPORTING'].map((requirementId) => {
      const item = catalog.find((entry) => entry.code === requirementId);
      return {
        domain: 'PGD',
        stageId: 'B1',
        requirementId,
        requirementCode: requirementId,
        displayName: item?.title || requirementId,
        multiplicity: 'SINGLE',
        required: item?.required ?? true,
        sourceProvenance: 'BASELINE',
        documentKind: requirementId,
      };
    });
  }

  const nodes = Array.isArray(template.nodes) ? template.nodes : [];
  const stages = Array.isArray(template.stages) ? template.stages : [];
  const b1StageIds = new Set(stages.filter((stage: any) => isB1Stage(stage.id)).map((stage: any) => stage.id));
  const requirementIds = new Set<string>();
  if (domain === 'PCN') {
    const fieldCode = (input.fieldCode || 'QC4').toUpperCase();
    for (const node of nodes) {
      if (node.active === false) continue;
      const ids: string[] = Array.isArray(node.requirementIds) ? node.requirementIds : [];
      const hasKnownB1Requirement = ids.some((id) => id === `${fieldCode}-PROPOSAL` || id === `${fieldCode}-COMMERCIAL`);
      if (isB1Stage(node.stageId) || b1StageIds.has(node.stageId) || isB1Stage(node.id) || hasKnownB1Requirement) {
        ids.forEach((id) => requirementIds.add(id));
      }
    }
  } else {
    for (const node of nodes) {
      if (node.active === false) continue;
      const codes: string[] = Array.isArray(node.requirementCodes)
        ? node.requirementCodes
        : Array.isArray(node.requirementIds) ? node.requirementIds : [];
      const hasKnownB1Requirement = codes.some((code) => ['REQUEST_PYC', 'REQUEST_SUPPORTING'].includes(code));
      if (isB1Stage(node.stageId) || b1StageIds.has(node.stageId) || isB1Stage(node.id) || hasKnownB1Requirement) {
        codes.forEach((code) => requirementIds.add(code));
      }
    }
  }
  for (const stage of stages) {
    if (isB1Stage(stage.id)) (stage.requirementIds || []).forEach((id: string) => requirementIds.add(id));
  }

  if (domain === 'PCN') {
    const fieldCode = (input.fieldCode || 'QC4').toUpperCase();
    return [...requirementIds]
      .filter((id) => !/^QC[49]-/.test(id) || id.startsWith(`${fieldCode}-`))
      .map((requirementId) => {
        const definition = customDefinitions.find((item: any) => item.id === requirementId || item.code === requirementId);
        if (definition) {
          return {
            domain: 'PCN' as const,
            ...(templateId ? { templateId } : {}),
            ...(templateVersion !== undefined ? { templateVersion } : {}),
            stageId: 'B1',
            requirementId: definition.id || requirementId,
            requirementCode: definition.code || requirementId,
            displayName: definition.name,
            multiplicity: definition.multiplicity === 'MULTIPLE' ? 'MULTIPLE' as const : 'SINGLE' as const,
            required: definition.level === 'REQUIRED',
            sourceProvenance: 'TEMPLATE_DEFINITION' as const,
            documentKind: definition.code || requirementId,
          };
        }
        const catalog = BASE_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === requirementId || (item.fieldCode === fieldCode && item.code === requirementId));
        if (catalog && catalog.fieldCode !== fieldCode) return undefined;
        return {
          domain: 'PCN' as const,
          ...(templateId ? { templateId } : {}),
          ...(templateVersion !== undefined ? { templateVersion } : {}),
          stageId: 'B1',
          requirementId,
          requirementCode: catalog?.code || requirementId,
          displayName: catalog?.name || requirementId,
          multiplicity: catalog?.multiplicity === 'MULTIPLE' ? 'MULTIPLE' as const : 'SINGLE' as const,
          required: catalog?.required ?? true,
          sourceProvenance: 'TEMPLATE_NODE_CATALOG' as const,
          documentKind: catalog?.code || requirementId,
        };
      })
      .filter(Boolean) as ResolvedB1AttachmentRequirement[];
  }

  const catalog = getPgdDossierRequirements((input.productGroup as any) || 'OTHER');
  return [...requirementIds].map((requirementId) => {
    const definition = customDefinitions.find((item: any) => item.id === requirementId || item.code === requirementId);
    if (definition) {
      return {
        domain: 'PGD' as const,
        ...(templateId ? { templateId } : {}),
        ...(templateVersion !== undefined ? { templateVersion } : {}),
        stageId: 'B1',
        requirementId: definition.id || requirementId,
        // PGD checklist identity is the stable definition ID; keep it aligned with existing checklist APIs.
        requirementCode: definition.id || requirementId,
        displayName: definition.name,
        multiplicity: definition.multiplicity === 'MULTIPLE' ? 'MULTIPLE' as const : 'SINGLE' as const,
        required: definition.level === 'REQUIRED',
        sourceProvenance: 'TEMPLATE_DEFINITION' as const,
        documentKind: definition.code || requirementId,
      };
    }
    const item = catalog.find((entry) => entry.code === requirementId);
    if (!['REQUEST_PYC', 'REQUEST_SUPPORTING'].includes(requirementId) || !item) return undefined;
    return {
      domain: 'PGD' as const,
      ...(templateId ? { templateId } : {}),
      ...(templateVersion !== undefined ? { templateVersion } : {}),
      stageId: 'B1',
      requirementId,
      requirementCode: requirementId,
      displayName: item.title,
      multiplicity: 'SINGLE' as const,
      required: item.required,
      sourceProvenance: 'TEMPLATE_NODE_CATALOG' as const,
      documentKind: requirementId,
    };
  }).filter(Boolean) as ResolvedB1AttachmentRequirement[];
}

export function createPgdcnB1SelectedAttachment(
  file: File,
  kind: PgdcnB1AttachmentKind = 'OTHER',
  initialRequirement?: Partial<Pick<PgdcnB1SelectedAttachment, 'requirementId' | 'requirementCode' | 'displayName' | 'documentKind' | 'mappingStatus'>>,
): PgdcnB1SelectedAttachment {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `b1-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    file,
    kind,
    status: 'READY',
    requirementId: initialRequirement?.requirementId,
    requirementCode: initialRequirement?.requirementCode,
    displayName: initialRequirement?.displayName,
    documentKind: initialRequirement?.documentKind,
    mappingStatus: initialRequirement?.mappingStatus || (initialRequirement?.requirementId === 'PENDING_MAPPING' ? 'PENDING_MAPPING' : initialRequirement?.requirementId ? 'MAPPED' : undefined),
  };
}

export function formatPgdcnFileSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadPendingPgdcnB1Attachments(
  attachments: readonly PgdcnB1SelectedAttachment[],
  upload: (attachment: PgdcnB1SelectedAttachment) => Promise<unknown>,
  update: (id: string, patch: Pick<PgdcnB1SelectedAttachment, 'status'> & Partial<Pick<PgdcnB1SelectedAttachment, 'error'>>) => void,
): Promise<{ attempted: number; failed: number }> {
  let attempted = 0;
  let failed = 0;

  for (const attachment of attachments) {
    if (attachment.status === 'UPLOADED') continue;
    attempted += 1;
    update(attachment.id, { status: 'UPLOADING', error: undefined });
    try {
      await upload(attachment);
      update(attachment.id, { status: 'UPLOADED', error: undefined });
    } catch (error) {
      failed += 1;
      update(attachment.id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error || 'Không tải được tệp.'),
      });
    }
  }

  return { attempted, failed };
}
