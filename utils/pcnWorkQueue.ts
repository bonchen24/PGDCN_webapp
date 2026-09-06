import type { CertificationDossier, CertificationProposal, PcnDossierDocument, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnDossierStatus } from '../types.ts';
import { getPcnDossierDateDenial, getPcnTimestampDenial } from './pcnDossierDate.ts';
import { buildPcnDossierCompleteness, type PcnDossierMissingDocumentGroup, type PcnPipelineStationKey } from './pcnDossierPipeline.ts';
import { getPcnWorkflowFocusNode } from './pcnWorkflowRuntime.ts';

export const PCN_WORK_QUEUE_DUE_SOON_DAYS = 3;

export type PcnWorkQueuePriority = 'OVERDUE' | 'DUE_SOON' | 'NORMAL';
export type PcnWorkQueueScope = 'ALL' | 'MINE' | 'OVERDUE';
export type PcnWorkQueueSection = 'proposals' | 'fields' | 'samples' | 'labRequests' | 'results' | 'issuance' | 'archive';

export interface PcnWorkQueueRow {
  dossierId: string;
  dossierCode: string;
  proposalCode?: string;
  customerName: string;
  productName: string;
  fieldCodes: string[];
  status: PcnDossierStatus;
  ownerUsername?: string;
  stationKey: PcnPipelineStationKey;
  stationNumber?: number;
  stationTitle: string;
  stationActionLabel: string;
  stepLabel: string;
  ownerLabel: string;
  assigneeUsername?: string;
  assignedToCurrentUser: boolean;
  targetDate?: string;
  priority: PcnWorkQueuePriority;
  targetSection: PcnWorkQueueSection;
  updatedAt?: string;
  completenessScore: number;
  stationScore?: number | null;
  requiredDocumentTotal: number;
  requiredDocumentPresent: number;
  missingRequiredCount: number;
  missingRequiredByStage: PcnDossierMissingDocumentGroup[];
  stationMissingLabels: string[];
  coreFieldTotal: number;
  coreFieldPresent: number;
  missingCoreLabels: string[];
  workflowNodeId?: string;
  workflowNodeLabel?: string;
  workflowNodeStatus?: PcnDossierWorkflowTask['status'];
  workflowTemplateCode?: string;
}

interface WorkQueueInput {
  dossiers: CertificationDossier[];
  proposals?: CertificationProposal[];
  currentUsername?: string | null;
  now?: string;
  documentRequirements?: PcnDocumentRequirement[];
  dossierDocuments?: PcnDossierDocument[];
  workflowTasks?: PcnDossierWorkflowTask[];
}

interface WorkQueueStep {
  label: string;
  owner: string;
  section: PcnWorkQueueSection;
}

const WORK_QUEUE_STEPS: Partial<Record<PcnDossierStatus, WorkQueueStep>> = {
  DRAFT: { label: 'Hoàn thiện Đề nghị và mở hồ sơ', owner: 'Tiếp nhận hồ sơ', section: 'proposals' },
  INTAKE_REVIEW: { label: 'Kiểm tra Đề nghị', owner: 'Tiếp nhận hồ sơ', section: 'proposals' },
  AWAITING_DOCUMENTS: { label: 'Theo dõi bổ sung hồ sơ', owner: 'Tiếp nhận hồ sơ', section: 'fields' },
  ASSIGNED: { label: 'Phân công chuyên gia', owner: 'Lãnh đạo phòng', section: 'fields' },
  PLAN_PENDING_APPROVAL: { label: 'Duyệt kế hoạch đánh giá', owner: 'Lãnh đạo phòng', section: 'fields' },
  FIELD_EVALUATION: { label: 'Đánh giá hiện trường', owner: 'Chuyên gia đánh giá', section: 'fields' },
  AWAITING_SAMPLING: { label: 'Mã hóa và lấy mẫu', owner: 'Điều phối mẫu', section: 'samples' },
  SENT_TO_LAB: { label: 'Theo dõi PYC và giao nhận', owner: 'Điều phối PTN', section: 'labRequests' },
  AWAITING_RESULTS: { label: 'Theo dõi KQTN', owner: 'Điều phối PTN', section: 'results' },
  CORRECTIVE_ACTION: { label: 'Xử lý khắc phục/thử lại', owner: 'Chuyên gia đánh giá', section: 'results' },
  TECHNICAL_REVIEW: { label: 'Soát xét kỹ thuật', owner: 'Người soát xét', section: 'issuance' },
  WAITING_APPROVAL: { label: 'Phê duyệt hồ sơ', owner: 'Lãnh đạo phòng', section: 'issuance' },
  APPROVED: { label: 'Chuẩn bị phát hành', owner: 'Văn thư phát hành', section: 'issuance' },
  ISSUED: { label: 'Giao khách hàng', owner: 'Văn thư phát hành', section: 'issuance' },
  DELIVERED: { label: 'Lưu trữ hồ sơ', owner: 'Văn thư lưu trữ', section: 'archive' },
  ON_HOLD: { label: 'Xử lý ngoại lệ hồ sơ', owner: 'Lãnh đạo phòng', section: 'fields' },
  REJECTED: { label: 'Xử lý hồ sơ bị từ chối', owner: 'Lãnh đạo phòng', section: 'proposals' },
};

function getWorkQueueStep(dossier: CertificationDossier): WorkQueueStep | undefined {
  const step = WORK_QUEUE_STEPS[dossier.status];
  return step;
}

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function validTimestamp(value: unknown): number | undefined {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function getVietnamCalendarDate(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = new Map(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.get('year') || '0000'}-${values.get('month') || '01'}-${values.get('day') || '01'}`;
}

function getCalendarDate(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return getPcnDossierDateDenial('Hạn xử lý', normalized) ? undefined : normalized;
  }
  if (getPcnTimestampDenial('Hạn xử lý', normalized)) return undefined;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? getVietnamCalendarDate(timestamp) : undefined;
}

function calendarDateTimestamp(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function getPriority(targetDate: string | undefined, nowTimestamp: number): PcnWorkQueuePriority {
  const targetCalendarDate = getCalendarDate(targetDate);
  if (!targetCalendarDate) return 'NORMAL';
  const dayDelta = Math.round((calendarDateTimestamp(targetCalendarDate) - calendarDateTimestamp(getVietnamCalendarDate(nowTimestamp))) / (24 * 60 * 60 * 1000));
  if (dayDelta < 0) return 'OVERDUE';
  if (dayDelta <= PCN_WORK_QUEUE_DUE_SOON_DAYS) return 'DUE_SOON';
  return 'NORMAL';
}

function getAssignee(dossier: CertificationDossier, status: PcnDossierStatus): string | undefined {
  if (status === 'TECHNICAL_REVIEW') return dossier.reviewerUsername;
  if (status === 'ASSIGNED' || status === 'FIELD_EVALUATION' || status === 'CORRECTIVE_ACTION') return dossier.evaluatorUsername;
  return undefined;
}

function priorityRank(priority: PcnWorkQueuePriority): number {
  return priority === 'OVERDUE' ? 0 : priority === 'DUE_SOON' ? 1 : 2;
}

export function buildPcnWorkQueueRows({ dossiers, proposals = [], currentUsername, now = new Date().toISOString(), documentRequirements, dossierDocuments = [], workflowTasks = [] }: WorkQueueInput): PcnWorkQueueRow[] {
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const nowTimestamp = validTimestamp(now) ?? Date.now();
  const normalizedCurrentUsername = normalizeUsername(currentUsername);

  return dossiers.flatMap((dossier) => {
    if (dossier.historicalImport) return [];
    const proposal = proposalsById.get(dossier.proposalId);
    const step = getWorkQueueStep(dossier);
    if (!step) return [];
    const workflowFocus = getPcnWorkflowFocusNode(dossier.workflowSnapshot, workflowTasks.filter((task) => task.dossierId === dossier.id));
    const targetDate = getCalendarDate(dossier.targetDate);
    const targetTimestamp = targetDate === undefined ? undefined : calendarDateTimestamp(targetDate);
    const assigneeUsername = getAssignee(dossier, dossier.status);
    const customerName = dossier.customerSnapshot?.name || proposal?.customerSnapshot?.name || 'Chưa cập nhật';
    const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements: documentRequirements, documents: dossierDocuments });
    return [{
      dossierId: dossier.id,
      dossierCode: dossier.dossierCode,
      proposalCode: proposal?.proposalCode,
      customerName,
      productName: proposal?.productName || 'Chưa cập nhật',
      fieldCodes: [...dossier.fieldCodes],
      status: dossier.status,
      ...(dossier.ownerUsername ? { ownerUsername: dossier.ownerUsername } : {}),
      stationKey: completeness.station.key,
      ...(completeness.station.number ? { stationNumber: completeness.station.number } : {}),
      stationTitle: completeness.station.title,
      stationActionLabel: completeness.station.actionLabel,
      stepLabel: step.label,
      ownerLabel: step.owner,
      ...(assigneeUsername ? { assigneeUsername } : {}),
      assignedToCurrentUser: Boolean(normalizedCurrentUsername && assigneeUsername && normalizeUsername(assigneeUsername) === normalizedCurrentUsername),
      ...(targetDate ? { targetDate } : {}),
      priority: getPriority(targetDate, nowTimestamp),
      targetSection: step.section,
  ...(dossier.updatedAt || dossier.createdAt ? { updatedAt: dossier.updatedAt || dossier.createdAt } : {}),
      completenessScore: completeness.score,
      stationScore: completeness.stationScore,
      requiredDocumentTotal: completeness.requiredDocumentTotal,
      requiredDocumentPresent: completeness.requiredDocumentPresent,
      missingRequiredCount: completeness.requiredDocumentTotal - completeness.requiredDocumentPresent,
      missingRequiredByStage: completeness.missingRequiredByStage,
      stationMissingLabels: completeness.stationMissingLabels,
      coreFieldTotal: completeness.coreFieldTotal,
      coreFieldPresent: completeness.coreFieldPresent,
      missingCoreLabels: completeness.missingCoreLabels,
      ...(workflowFocus ? {
        workflowNodeId: workflowFocus.nodeId,
        workflowNodeLabel: workflowFocus.label,
        workflowNodeStatus: workflowFocus.status,
        workflowTemplateCode: dossier.workflowSnapshot?.templateCode,
      } : {}),
    } satisfies PcnWorkQueueRow];
  }).sort((left, right) => {
    const priorityCompare = priorityRank(left.priority) - priorityRank(right.priority);
    if (priorityCompare !== 0) return priorityCompare;
    const leftTarget = validTimestamp(left.targetDate) ?? Number.POSITIVE_INFINITY;
    const rightTarget = validTimestamp(right.targetDate) ?? Number.POSITIVE_INFINITY;
    if (leftTarget !== rightTarget) return leftTarget - rightTarget;
    const updatedCompare = (validTimestamp(right.updatedAt) ?? 0) - (validTimestamp(left.updatedAt) ?? 0);
    return updatedCompare || left.dossierCode.localeCompare(right.dossierCode, 'vi');
  });
}

export function filterPcnWorkQueueRows(rows: PcnWorkQueueRow[], filter: { scope?: PcnWorkQueueScope } = {}): PcnWorkQueueRow[] {
  const scope = filter.scope || 'ALL';
  if (scope === 'MINE') return rows.filter((row) => row.assignedToCurrentUser);
  if (scope === 'OVERDUE') return rows.filter((row) => row.priority === 'OVERDUE');
  return rows;
}

// --- End of pcnWorkQueue.ts ---
