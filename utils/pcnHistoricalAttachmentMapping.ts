import type {
  PcnAttachmentMappingStatus,
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnHistoricalFileKind,
} from '../types.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, mergePcnDossierChecklist } from './pcnDossierDocuments.ts';

export const PCN_HISTORICAL_VERSION_NOTE = 'Phiên tài liệu lịch sử đã nhập.';

const SAFE_REQUIREMENT_CODE_BY_FIELD: Record<string, Partial<Record<PcnHistoricalFileKind, string>>> = {
  QC4: {
    PROPOSAL: 'PROPOSAL',
    COMMERCIAL: 'COMMERCIAL',
    SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
    TEST_REPORT: 'TEST_REPORT',
    CERTIFICATE: 'CERTIFICATE',
    DECISION: 'DECISION',
  },
  QC9: {
    PROPOSAL: 'PROPOSAL',
    COMMERCIAL: 'COMMERCIAL',
    SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
    SAMPLE_RETURN: 'SAMPLE_RETURN',
    TEST_REPORT: 'TEST_REPORT',
    CORRECTIVE_ACTION: 'CORRECTIVE_ACTION_LETTER',
    CERTIFICATE: 'CERTIFICATE',
    DECISION: 'DECISION',
  },
};

interface MappingDecision {
  requirementId?: string;
  mappingStatus: PcnAttachmentMappingStatus;
  mappingReason: string;
}

export function mapPcnHistoricalAttachmentManually(_input: {
  attachment: PcnDossierAttachment;
  requirement: PcnDocumentRequirement;
  now?: string;
}): PcnDossierAttachment {
  const fieldCode = String(_input.attachment.fieldCode || '').trim().toUpperCase();
  const requirementFieldCode = String(_input.requirement.fieldCode || '').trim().toUpperCase();
  if (!_input.requirement.active) throw new Error('Không thể nối vào loại tài liệu đã ngừng hoạt động.');
  if (!fieldCode || fieldCode !== requirementFieldCode) throw new Error('Loại tài liệu không thuộc Lĩnh vực của tệp lịch sử.');
  return {
    ..._input.attachment,
    requirementId: _input.requirement.id,
    mappingStatus: 'MANUAL_MAPPED',
    mappingReason: `Nối thủ công vào ${_input.requirement.id}.`,
  };
}

function findRequirement(
  fieldCode: string,
  requirementId: string | undefined,
  requirements: PcnDocumentRequirement[],
): PcnDocumentRequirement | undefined {
  return requirements.find((item) => item.active && item.fieldCode.toUpperCase() === fieldCode && item.id === requirementId);
}

function decideMapping(
  attachment: PcnDossierAttachment,
  requirements: PcnDocumentRequirement[],
): MappingDecision {
  const fieldCode = String(attachment.fieldCode || '').trim().toUpperCase();
  if (attachment.mappingStatus === 'MANUAL_MAPPED' && attachment.requirementId) {
    const requirement = findRequirement(fieldCode, attachment.requirementId, requirements);
    if (requirement) {
      return {
        requirementId: requirement.id,
        mappingStatus: 'MANUAL_MAPPED',
        mappingReason: attachment.mappingReason || `Đã nối thủ công vào ${requirement.id}.`,
      };
    }
  }

  const code = SAFE_REQUIREMENT_CODE_BY_FIELD[fieldCode]?.[attachment.kind];
  if (!code) {
    return {
      mappingStatus: 'UNMAPPED',
      mappingReason: `Nhóm ${attachment.kind} chưa có quy tắc nối checklist chắc chắn cho ${fieldCode || 'Lĩnh vực chưa rõ'}.`,
    };
  }
  const requirement = findRequirement(fieldCode, `${fieldCode}-${code}`, requirements);
  if (!requirement) {
    return {
      mappingStatus: 'UNMAPPED',
      mappingReason: `Không tìm thấy mã yêu cầu hoạt động ${fieldCode}-${code} trong cấu hình hiện tại.`,
    };
  }
  return {
    requirementId: requirement.id,
    mappingStatus: 'AUTO_MAPPED',
    mappingReason: `Tự nối theo nhóm ${attachment.kind} → ${requirement.id}.`,
  };
}

function toHistoricalVersion(attachment: PcnDossierAttachment) {
  return {
    assetId: attachment.assetId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    sha256: attachment.sha256,
    uploadedAt: attachment.importedAt,
    note: PCN_HISTORICAL_VERSION_NOTE,
  };
}

function dedupeVersions(versions: PcnDossierDocument['versions']): PcnDossierDocument['versions'] {
  const seen = new Set<string>();
  return versions.filter((version) => {
    if (!version.assetId || seen.has(version.assetId)) return false;
    seen.add(version.assetId);
    return true;
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => item === undefined ? 'null' : stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function omitUndefined<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

export function reconcilePcnHistoricalAttachmentMapping(input: {
  dossierId: string;
  fieldCodes: PcnCertificationFieldCode[];
  attachments: PcnDossierAttachment[];
  existingDocuments: PcnDossierDocument[];
  requirements?: PcnDocumentRequirement[];
  now?: string;
}): { attachments: PcnDossierAttachment[]; documents: PcnDossierDocument[] } {
  const now = input.now || new Date().toISOString();
  const requirements = input.requirements || DEFAULT_PCN_DOCUMENT_REQUIREMENTS;
  const attachments = input.attachments
    .filter((item) => item.dossierId === input.dossierId)
    .sort((left, right) => left.sourceRelativePath.localeCompare(right.sourceRelativePath) || left.assetId.localeCompare(right.assetId))
    .map((attachment) => {
      const decision = decideMapping(attachment, requirements);
      return {
        ...attachment,
        ...(decision.requirementId ? { requirementId: decision.requirementId } : { requirementId: undefined }),
        mappingStatus: decision.mappingStatus,
        mappingReason: decision.mappingReason,
      };
    });

  const checklist = mergePcnDossierChecklist(
    input.existingDocuments,
    input.dossierId,
    input.fieldCodes,
    requirements,
    now,
  );
  const existingByRequirement = new Map(input.existingDocuments.filter((item) => item.dossierId === input.dossierId).map((item) => [item.requirementId, item]));
  return {
    attachments,
    documents: checklist.map((document) => {
      const previous = existingByRequirement.get(document.requirementId);
      const retainedVersions = (previous?.versions || []).filter((version) => version.note !== PCN_HISTORICAL_VERSION_NOTE);
      const historicalVersions = attachments
        .filter((attachment) => attachment.requirementId === document.requirementId)
        .map(toHistoricalVersion);
      const versions = dedupeVersions([...retainedVersions, ...historicalVersions]);
      const currentVersionId = previous?.currentVersionId && versions.some((version) => version.assetId === previous.currentVersionId)
        ? previous.currentVersionId
        : versions[0]?.assetId;
      const status = versions.length > 0 ? 'PRESENT' as const : 'MISSING' as const;
      const changed = stableJson({
        currentVersionId,
        versions,
        status,
      }) !== stableJson({
        currentVersionId: previous?.currentVersionId,
        versions: previous?.versions || [],
        status: previous?.status || 'MISSING',
      });
      return omitUndefined({
        ...document,
        ...(previous || {}),
        dossierId: input.dossierId,
        requirementId: document.requirementId,
        fieldCode: document.fieldCode,
        ...(currentVersionId ? { currentVersionId } : {}),
        versions,
        status,
        createdAt: previous?.createdAt || document.createdAt || now,
        updatedAt: changed ? now : previous?.updatedAt || now,
      });
    }),
  };
}
