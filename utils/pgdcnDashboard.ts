import type { CertificationDossier, CertificationProposal, DepartmentScope, PcnDossierWorkflowTask, UserAccount } from '../types.ts';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from './formatter.ts';

export type PgdcnDashboardDomain = 'PCN' | 'PGD';
export type DashboardAttentionReason = 'WORK' | 'OVERDUE';
export type PgdcnStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'critical';
export type DashboardPipelineTone = PgdcnStatusTone;

export interface PgdcnStatusPresentation {
  status: string;
  label: string;
  tone: PgdcnStatusTone;
  description: string;
}

export interface PgdcnDashboardDossier {
  id: string;
  dossierCode?: string;
  status?: string;
  targetDate?: string;
}

export interface PgdcnDashboardRequest {
  id: string;
  requestCode?: string;
  status?: string;
  inspectionScheduledAt?: string;
}

export interface PgdcnDashboardAttentionItem {
  domain: PgdcnDashboardDomain;
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  reason: DashboardAttentionReason;
  dueDate?: string;
  dueLabel?: string;
}

export interface PgdcnDashboardPipelineSegment {
  key: string;
  label: string;
  tone: DashboardPipelineTone;
  count: number;
}

export interface PgdcnDashboardDomainSummary {
  domain: PgdcnDashboardDomain;
  total: number;
  work: number;
  attention: number;
  bottleneckLabel: string;
  bottleneckCount: number;
  segments: PgdcnDashboardPipelineSegment[];
}

export interface PgdcnDashboardUpcomingItem {
  domain: PgdcnDashboardDomain;
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  milestoneLabel: string;
  date: string;
  dateLabel: string;
}

export interface PgdcnDashboardProjection {
  kpis: {
    pcnDossiers: number;
    pgdRequests: number;
    pcnWork: number;
    pgdWork: number;
    aiCandidates: number;
    attention: number;
  };
  attention: PgdcnDashboardAttentionItem[];
  domainSummaries: PgdcnDashboardDomainSummary[];
  upcoming: PgdcnDashboardUpcomingItem[];
}

export interface PgdcnDashboardInput {
  scopes: readonly DepartmentScope[];
  pcnDossiers: readonly PgdcnDashboardDossier[];
  pgdRequests: readonly PgdcnDashboardRequest[];
  now?: Date;
}

const PCN_WORK_STATUSES = new Set([
  'INTAKE_REVIEW',
  'AWAITING_DOCUMENTS',
  'ASSIGNED',
  'PLAN_PENDING_APPROVAL',
  'FIELD_EVALUATION',
  'AWAITING_SAMPLING',
  'SENT_TO_LAB',
  'AWAITING_RESULTS',
  'CORRECTIVE_ACTION',
  'TECHNICAL_REVIEW',
  'WAITING_APPROVAL',
]);

const PGD_WORK_STATUSES = new Set([
  'CAPABILITY_REVIEW',
  'READY_TO_EXECUTE',
  'PREPARING',
  'FIELD_INSPECTION',
  'WAITING_LAB_RESULTS',
  'RESULTS_REVIEW',
  'TECHNICAL_REVIEW',
  'LEADERSHIP_APPROVAL',
]);

const PCN_AI_STATUSES = new Set(['TECHNICAL_REVIEW', 'WAITING_APPROVAL']);
const PGD_AI_STATUSES = new Set(['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL']);
const PCN_CLOSED_STATUSES = new Set(['ISSUED', 'DELIVERED', 'ARCHIVED', 'CANCELLED']);
const PGD_CLOSED_STATUSES = new Set(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED']);

const STATUS_LABELS: Record<PgdcnDashboardDomain, Record<string, string>> = {
  PCN: {
    DRAFT: 'Bản nháp',
    INTAKE_REVIEW: 'Xem xét tiếp nhận',
    AWAITING_DOCUMENTS: 'Chờ bổ sung hồ sơ',
    ASSIGNED: 'Đã phân công',
    PLAN_PENDING_APPROVAL: 'Chờ duyệt kế hoạch',
    FIELD_EVALUATION: 'Đánh giá hiện trường',
    AWAITING_SAMPLING: 'Chờ lấy mẫu',
    SENT_TO_LAB: 'Đã gửi PTN',
    AWAITING_RESULTS: 'Chờ KQTN',
    CORRECTIVE_ACTION: 'Khắc phục',
    TECHNICAL_REVIEW: 'Soát xét kỹ thuật',
    WAITING_APPROVAL: 'Chờ phê duyệt',
    APPROVED: 'Đã phê duyệt',
    ISSUED: 'Đã phát hành',
    DELIVERED: 'Đã giao khách hàng',
    ARCHIVED: 'Đã lưu trữ',
    REJECTED: 'Từ chối',
    CANCELLED: 'Đã hủy',
  },
  PGD: {
    DRAFT: 'Bản nháp',
    CAPABILITY_REVIEW: 'Chờ xem xét năng lực',
    READY_TO_EXECUTE: 'Đã chấp nhận thực hiện',
    PREPARING: 'Đang chuẩn bị',
    FIELD_INSPECTION: 'Đang giám định hiện trường',
    WAITING_LAB_RESULTS: 'Chờ kết quả PTN',
    RESULTS_REVIEW: 'Xem xét kết quả',
    TECHNICAL_REVIEW: 'Soát xét kỹ thuật',
    LEADERSHIP_APPROVAL: 'Chờ phê duyệt lãnh đạo',
    SIGNED: 'Đã ký',
    RESULT_RETURNED: 'Đã trả kết quả',
    ARCHIVED: 'Đã lưu trữ',
    REJECTED: 'Từ chối',
    CANCELLED: 'Đã hủy',
  },
};

const PIPELINE_DEFINITIONS: Record<PgdcnDashboardDomain, Array<{ key: string; label: string; tone: DashboardPipelineTone; statuses: string[] }>> = {
  PCN: [
    { key: 'INTAKE', label: 'Tiếp nhận', tone: 'info', statuses: ['DRAFT', 'INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'ASSIGNED'] },
    { key: 'EXECUTION', label: 'Thực hiện', tone: 'info', statuses: ['PLAN_PENDING_APPROVAL', 'FIELD_EVALUATION', 'AWAITING_SAMPLING', 'SENT_TO_LAB'] },
    { key: 'RESULTS', label: 'KQTN & đánh giá', tone: 'warning', statuses: ['AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'TECHNICAL_REVIEW'] },
    { key: 'APPROVAL', label: 'Phê duyệt', tone: 'warning', statuses: ['WAITING_APPROVAL', 'APPROVED'] },
    { key: 'COMPLETED', label: 'Phát hành & lưu trữ', tone: 'success', statuses: ['ISSUED', 'DELIVERED', 'ARCHIVED'] },
    { key: 'EXCEPTIONS', label: 'Ngoại lệ', tone: 'critical', statuses: ['REJECTED', 'CANCELLED'] },
  ],
  PGD: [
    { key: 'INTAKE', label: 'Tiếp nhận', tone: 'info', statuses: ['DRAFT', 'CAPABILITY_REVIEW', 'READY_TO_EXECUTE'] },
    { key: 'FIELD', label: 'Giám định hiện trường', tone: 'info', statuses: ['PREPARING', 'FIELD_INSPECTION'] },
    { key: 'RESULTS', label: 'Kết quả', tone: 'warning', statuses: ['WAITING_LAB_RESULTS', 'RESULTS_REVIEW'] },
    { key: 'APPROVAL', label: 'Phê duyệt', tone: 'warning', statuses: ['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL'] },
    { key: 'COMPLETED', label: 'Ký & trả kết quả', tone: 'success', statuses: ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'] },
    { key: 'EXCEPTIONS', label: 'Ngoại lệ', tone: 'critical', statuses: ['REJECTED', 'CANCELLED'] },
  ],
};

const STATUS_PRIORITY: Record<PgdcnDashboardDomain, string[]> = {
  PCN: ['AWAITING_DOCUMENTS', 'AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'WAITING_APPROVAL', 'TECHNICAL_REVIEW', 'PLAN_PENDING_APPROVAL', 'INTAKE_REVIEW', 'ASSIGNED', 'FIELD_EVALUATION', 'AWAITING_SAMPLING', 'SENT_TO_LAB'],
  PGD: ['CAPABILITY_REVIEW', 'FIELD_INSPECTION', 'WAITING_LAB_RESULTS', 'RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'PREPARING', 'READY_TO_EXECUTE'],
};

const getStatus = (status: string | undefined): string => String(status || 'UNKNOWN');

export function getPgdcnDashboardStatusLabel(domain: PgdcnDashboardDomain, status: string | undefined): string {
  const normalizedStatus = getStatus(status);
  return STATUS_LABELS[domain][normalizedStatus] || 'Chưa xác định';
}

const STATUS_TONE_BY_STATUS: Record<string, PgdcnStatusTone> = {
  DRAFT: 'warning', INTAKE_REVIEW: 'info', AWAITING_DOCUMENTS: 'warning', ASSIGNED: 'info',
  PLAN_PENDING_APPROVAL: 'warning', FIELD_EVALUATION: 'info', AWAITING_SAMPLING: 'warning', SENT_TO_LAB: 'info',
  AWAITING_RESULTS: 'warning', CORRECTIVE_ACTION: 'critical', TECHNICAL_REVIEW: 'info', WAITING_APPROVAL: 'warning',
  APPROVED: 'success', ISSUED: 'success', DELIVERED: 'success', ARCHIVED: 'success', REJECTED: 'critical', CANCELLED: 'critical',
  CAPABILITY_REVIEW: 'info', READY_TO_EXECUTE: 'info', PREPARING: 'info', FIELD_INSPECTION: 'info',
  WAITING_LAB_RESULTS: 'warning', RESULTS_REVIEW: 'info', LEADERSHIP_APPROVAL: 'warning', SIGNED: 'success', RESULT_RETURNED: 'success',
};

const STATUS_TONE_DESCRIPTION: Record<PgdcnStatusTone, string> = {
  neutral: 'Trạng thái chưa xác định hoặc chỉ đọc.',
  info: 'Hồ sơ đang được xử lý.',
  warning: 'Hồ sơ đang chờ hoặc cần chú ý.',
  success: 'Hồ sơ đã hoàn tất hoặc đạt mốc thành công.',
  critical: 'Hồ sơ đang bị chặn, lỗi hoặc cần xử lý ưu tiên.',
};

export function getPgdcnStatusPresentation(domain: PgdcnDashboardDomain, status: string | undefined): PgdcnStatusPresentation {
  const normalizedStatus = getStatus(status);
  const label = getPgdcnDashboardStatusLabel(domain, normalizedStatus);
  const tone = STATUS_TONE_BY_STATUS[normalizedStatus] || 'neutral';
  return { status: normalizedStatus, label, tone, description: label + '. ' + STATUS_TONE_DESCRIPTION[tone] };
}
const parseDateTimestamp = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const rawValue = String(value).trim();
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T23:59:59.999Z` : rawValue);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const formatDateLabel = (value: string): string => {
  const rawValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return formatDateDdMmYyyy(rawValue) || rawValue;
  return formatDateTimeDdMmYyyy(rawValue) || rawValue;
};

const isOverdueDate = (value: string | undefined, now: Date): boolean => {
  const timestamp = parseDateTimestamp(value);
  return timestamp !== undefined && timestamp < now.getTime();
};

const getStatusPriority = (domain: PgdcnDashboardDomain, status: string): number => {
  const priority = STATUS_PRIORITY[domain].indexOf(status);
  return priority === -1 ? Number.MAX_SAFE_INTEGER : priority;
};

const getClosedStatuses = (domain: PgdcnDashboardDomain): Set<string> => domain === 'PCN' ? PCN_CLOSED_STATUSES : PGD_CLOSED_STATUSES;
const getWorkStatuses = (domain: PgdcnDashboardDomain): Set<string> => domain === 'PCN' ? PCN_WORK_STATUSES : PGD_WORK_STATUSES;

const buildSegments = (domain: PgdcnDashboardDomain, statuses: string[]): PgdcnDashboardPipelineSegment[] => {
  const definitions = PIPELINE_DEFINITIONS[domain];
  const counts = new Map<string, number>();
  statuses.forEach((status) => counts.set(status, (counts.get(status) || 0) + 1));

  const segments = definitions
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      tone: definition.tone,
      count: definition.statuses.reduce((sum, status) => sum + (counts.get(status) || 0), 0),
    }))
    .filter((segment) => segment.count > 0);
  const knownStatuses = new Set(definitions.flatMap((definition) => definition.statuses));
  const otherCount = statuses.filter((status) => !knownStatuses.has(status)).length;
  if (otherCount > 0) segments.push({ key: 'OTHER', label: 'Khác', tone: 'neutral', count: otherCount });
  return segments;
};

const buildBottleneck = (domain: PgdcnDashboardDomain, statuses: string[]): Pick<PgdcnDashboardDomainSummary, 'bottleneckLabel' | 'bottleneckCount'> => {
  const counts = new Map<string, number>();
  statuses.forEach((status) => counts.set(status, (counts.get(status) || 0) + 1));
  const status = STATUS_PRIORITY[domain].find((candidate) => (counts.get(candidate) || 0) > 0);
  return status
    ? { bottleneckLabel: getPgdcnDashboardStatusLabel(domain, status), bottleneckCount: counts.get(status) || 0 }
    : { bottleneckLabel: 'Không có điểm nghẽn', bottleneckCount: 0 };
};

const buildDomainSummary = (domain: PgdcnDashboardDomain, statuses: string[], attention: PgdcnDashboardAttentionItem[]): PgdcnDashboardDomainSummary => ({
  domain,
  total: statuses.length,
  work: statuses.filter((status) => getWorkStatuses(domain).has(status)).length,
  attention: attention.filter((item) => item.domain === domain).length,
  ...buildBottleneck(domain, statuses),
  segments: buildSegments(domain, statuses),
});

const buildUpcoming = (domain: PgdcnDashboardDomain, records: Array<{ id: string; label: string; status?: string; date?: string }>, now: Date): PgdcnDashboardUpcomingItem[] => records
  .map((record) => {
    const status = getStatus(record.status);
    const timestamp = parseDateTimestamp(record.date);
    return timestamp !== undefined && timestamp >= now.getTime() && !getClosedStatuses(domain).has(status)
      ? {
        domain,
        id: record.id,
        label: record.label,
        status,
        statusLabel: getPgdcnDashboardStatusLabel(domain, status),
        milestoneLabel: domain === 'PCN' ? 'Hạn xử lý' : 'Lịch giám định',
        date: String(record.date),
        dateLabel: formatDateLabel(String(record.date)),
        timestamp,
      }
      : undefined;
  })
  .filter((item): item is PgdcnDashboardUpcomingItem & { timestamp: number } => Boolean(item))
  .sort((left, right) => left.timestamp - right.timestamp || left.domain.localeCompare(right.domain) || left.id.localeCompare(right.id))
  .map(({ timestamp: _timestamp, ...item }) => item);

export function getPgdcnDashboardProjection(input: PgdcnDashboardInput): PgdcnDashboardProjection {
  const hasPcn = input.scopes.includes('PCN');
  const hasPgd = input.scopes.includes('PGD');
  const pcnDossiers = hasPcn ? [...input.pcnDossiers] : [];
  const pgdRequests = hasPgd ? [...input.pgdRequests] : [];
  const now = input.now || new Date();

  const pcnAttention = pcnDossiers
    .map((item) => {
      const status = getStatus(item.status);
      const overdue = isOverdueDate(item.targetDate, now);
      return !PCN_CLOSED_STATUSES.has(status) && (PCN_WORK_STATUSES.has(status) || overdue)
        ? {
          domain: 'PCN' as const,
          id: item.id,
          label: item.dossierCode || item.id,
          status,
          statusLabel: getPgdcnDashboardStatusLabel('PCN', status),
          reason: overdue ? 'OVERDUE' as const : 'WORK' as const,
          dueDate: item.targetDate,
          dueLabel: item.targetDate ? formatDateLabel(item.targetDate) : undefined,
        }
        : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const pgdAttention = pgdRequests
    .map((item) => {
      const status = getStatus(item.status);
      const overdue = isOverdueDate(item.inspectionScheduledAt, now);
      return !PGD_CLOSED_STATUSES.has(status) && (PGD_WORK_STATUSES.has(status) || overdue)
        ? {
          domain: 'PGD' as const,
          id: item.id,
          label: item.requestCode || item.id,
          status,
          statusLabel: getPgdcnDashboardStatusLabel('PGD', status),
          reason: overdue ? 'OVERDUE' as const : 'WORK' as const,
          dueDate: item.inspectionScheduledAt,
          dueLabel: item.inspectionScheduledAt ? formatDateLabel(item.inspectionScheduledAt) : undefined,
        }
        : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const attention = [...pcnAttention, ...pgdAttention].sort((left, right) => {
    const overdueSort = Number(right.reason === 'OVERDUE') - Number(left.reason === 'OVERDUE');
    return overdueSort
      || getStatusPriority(left.domain, left.status) - getStatusPriority(right.domain, right.status)
      || left.domain.localeCompare(right.domain)
      || left.id.localeCompare(right.id);
  });

  const pcnStatuses = pcnDossiers.map((item) => getStatus(item.status));
  const pgdStatuses = pgdRequests.map((item) => getStatus(item.status));
  const upcoming = [
    ...buildUpcoming('PCN', pcnDossiers.map((item) => ({ id: item.id, label: item.dossierCode || item.id, status: item.status, date: item.targetDate })), now),
    ...buildUpcoming('PGD', pgdRequests.map((item) => ({ id: item.id, label: item.requestCode || item.id, status: item.status, date: item.inspectionScheduledAt })), now),
  ].sort((left, right) => (parseDateTimestamp(left.date) || 0) - (parseDateTimestamp(right.date) || 0) || left.domain.localeCompare(right.domain) || left.id.localeCompare(right.id)).slice(0, 5);

  return {
    kpis: {
      pcnDossiers: pcnDossiers.length,
      pgdRequests: pgdRequests.length,
      pcnWork: pcnStatuses.filter((status) => PCN_WORK_STATUSES.has(status)).length,
      pgdWork: pgdStatuses.filter((status) => PGD_WORK_STATUSES.has(status)).length,
      aiCandidates: pcnStatuses.filter((status) => PCN_AI_STATUSES.has(status)).length
        + pgdStatuses.filter((status) => PGD_AI_STATUSES.has(status)).length,
      attention: attention.length,
    },
    attention,
    domainSummaries: [
      ...(hasPcn ? [buildDomainSummary('PCN', pcnStatuses, attention)] : []),
      ...(hasPgd ? [buildDomainSummary('PGD', pgdStatuses, attention)] : []),
    ],
    upcoming,
  };
}

export type PgdcnWorkBucket = 'OVERDUE' | 'TODAY' | 'MY_TURN' | 'APPROVAL' | 'RECENT' | 'WAITING_OTHERS';
export interface PgdcnNextAction { key: string; label: string; description: string; }
export interface PgdcnMyWorkItem { domain: PgdcnDashboardDomain; id: string; label: string; customerName: string; productName?: string; status: string; statusLabel: string; currentStepLabel: string; nextAction: PgdcnNextAction; bucket: PgdcnWorkBucket; dueDate?: string; dueLabel?: string; ownerLabel: string; updatedAt?: string; isOverdue: boolean; }
export interface PgdcnMyWorkProjection { items: PgdcnMyWorkItem[]; buckets: Record<Exclude<PgdcnWorkBucket, 'WAITING_OTHERS'>, PgdcnMyWorkItem[]>; waitingOthers: PgdcnMyWorkItem[]; }
export interface PgdcnMyWorkInput { scopes: readonly DepartmentScope[]; currentUser: Pick<UserAccount, 'username' | 'role' | 'systemRole' | 'managementRoleCode' | 'departmentRoleCode'>; pcnDossiers: readonly CertificationDossier[]; pcnProposals?: readonly CertificationProposal[]; pcnWorkflowTasks?: readonly PcnDossierWorkflowTask[]; pgdRequests: readonly (PgdcnDashboardRequest & { customerSnapshot?: { name?: string }; productName?: string; ownerUsername?: string; targetDate?: string; updatedAt?: string; createdAt?: string })[]; pgdAssignments?: readonly { requestId: string; leadInspectorUsername?: string; inspectorUsernames?: readonly string[]; technicalReviewerUsername?: string }[]; now?: Date; }
const ACTIVE_TASK_STATUSES = new Set(['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED']);
const actions: Record<PgdcnDashboardDomain, Record<string, [string, string, string]>> = { PCN: { DRAFT: ['SUPPLEMENT', 'Bổ sung hồ sơ', 'Hoàn thiện thông tin và tài liệu đầu vào.'], INTAKE_REVIEW: ['INTAKE', 'Tiếp nhận hồ sơ', 'Kiểm tra điều kiện tiếp nhận và xác nhận hồ sơ.'], AWAITING_DOCUMENTS: ['SUPPLEMENT', 'Bổ sung hồ sơ', 'Hoàn thiện tài liệu bắt buộc trước khi chuyển bước.'], ASSIGNED: ['PLAN', 'Lập kế hoạch', 'Xác lập kế hoạch và phân công xử lý tiếp theo.'], PLAN_PENDING_APPROVAL: ['APPROVE_PLAN', 'Trình phê duyệt kế hoạch', 'Rà soát và trình kế hoạch theo đúng thẩm quyền.'], FIELD_EVALUATION: ['FIELD', 'Nhập kết quả hiện trường', 'Ghi nhận bằng chứng và kết quả đánh giá hiện trường.'], AWAITING_SAMPLING: ['SAMPLE', 'Lấy mẫu', 'Thực hiện lấy mẫu và cập nhật biên bản liên quan.'], SENT_TO_LAB: ['LAB', 'Lập PYC PTN', 'Tạo và bàn giao yêu cầu thử nghiệm cho PTN.'], AWAITING_RESULTS: ['RESULTS', 'Tiếp nhận KQTN', 'Đối chiếu và tiếp nhận kết quả thử nghiệm.'], TECHNICAL_REVIEW: ['REVIEW', 'Soát xét', 'Kiểm tra tính đầy đủ và phù hợp của hồ sơ kỹ thuật.'], WAITING_APPROVAL: ['APPROVE', 'Trình phê duyệt', 'Trình hồ sơ đến cấp phê duyệt tiếp theo.'], APPROVED: ['ISSUE', 'Ký & phát hành', 'Hoàn tất phát hành theo quy trình chứng nhận.'], CORRECTIVE_ACTION: ['SUPPLEMENT', 'Bổ sung hồ sơ', 'Theo dõi và hoàn thiện hành động khắc phục.'] }, PGD: { DRAFT: ['SUPPLEMENT', 'Bổ sung hồ sơ', 'Hoàn thiện thông tin đầu vào của PYC.'], CAPABILITY_REVIEW: ['ASSIGN', 'Phân công', 'Xem xét năng lực và xác nhận người phụ trách.'], READY_TO_EXECUTE: ['PLAN', 'Lập kế hoạch', 'Chuẩn bị kế hoạch và lịch giám định.'], PREPARING: ['PLAN', 'Lập kế hoạch', 'Hoàn tất chuẩn bị trước khi ra hiện trường.'], FIELD_INSPECTION: ['FIELD', 'Nhập kết quả hiện trường', 'Ghi nhận kết quả và bằng chứng tại hiện trường.'], WAITING_LAB_RESULTS: ['RESULTS', 'Tiếp nhận KQTN', 'Đối chiếu và tiếp nhận kết quả từ PTN.'], RESULTS_REVIEW: ['REPORT', 'Soạn báo cáo', 'Tổng hợp kết quả và hoàn thiện báo cáo giám định.'], TECHNICAL_REVIEW: ['REVIEW', 'Soát xét', 'Kiểm tra tính đầy đủ và phù hợp của hồ sơ kỹ thuật.'], LEADERSHIP_APPROVAL: ['APPROVE', 'Trình phê duyệt', 'Trình hồ sơ đến cấp phê duyệt lãnh đạo.'], SIGNED: ['RETURN', 'Trả kết quả', 'Hoàn tất trả kết quả và chứng thư cho khách hàng.'], RESULT_RETURNED: ['ARCHIVE', 'Lưu trữ', 'Đóng hồ sơ và lưu trữ theo quy định.'] } };
const PCN_APPROVAL_STATUSES = new Set(['TECHNICAL_REVIEW', 'WAITING_APPROVAL']);
const PGD_APPROVAL_STATUSES = new Set(['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL']);
const PCN_CLOSED_FOR_WORK = new Set(['ISSUED', 'DELIVERED', 'ARCHIVED', 'CANCELLED']);
const PGD_CLOSED_FOR_WORK = new Set(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED']);
export function getPgdcnNextAction(domain: PgdcnDashboardDomain, status: string | undefined, options: { missingRequiredCount?: number } = {}): PgdcnNextAction { const normalized = getStatus(status); if ((options.missingRequiredCount || 0) > 0 && !['ARCHIVED', 'CANCELLED', 'ISSUED', 'SIGNED'].includes(normalized)) return { key: 'SUPPLEMENT', label: 'Bổ sung hồ sơ', description: 'Hoàn thiện tài liệu bắt buộc trước khi chuyển bước.' }; const value = actions[domain][normalized]; return value ? { key: value[0], label: value[1], description: value[2] } : { key: 'OPEN', label: 'Tiếp tục hồ sơ', description: 'Mở hồ sơ để xem bước hiện tại và thao tác phù hợp.' }; }
const toUsername = (value: string | undefined): string => String(value || '').trim().toLocaleLowerCase('vi-VN');
const toIsoDay = (value: Date | string): string => { const date = value instanceof Date ? value : new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''; };
const getWorkBucket = (dueDate: string | undefined, status: string, domain: PgdcnDashboardDomain, updatedAt: string | undefined, now: Date): PgdcnWorkBucket => { if (isOverdueDate(dueDate, now)) return 'OVERDUE'; if (dueDate && toIsoDay(dueDate) === toIsoDay(now)) return 'TODAY'; if ((domain === 'PCN' ? PCN_APPROVAL_STATUSES : PGD_APPROVAL_STATUSES).has(status)) return 'APPROVAL'; const updated = parseDateTimestamp(updatedAt); return updated !== undefined && now.getTime() - updated <= 14 * 24 * 60 * 60 * 1000 ? 'RECENT' : 'MY_TURN'; };
const sortWorkItems = (items: PgdcnMyWorkItem[]): PgdcnMyWorkItem[] => [...items].sort((left, right) => Number(right.isOverdue) - Number(left.isOverdue) || (parseDateTimestamp(left.dueDate) || Number.MAX_SAFE_INTEGER) - (parseDateTimestamp(right.dueDate) || Number.MAX_SAFE_INTEGER) || left.domain.localeCompare(right.domain) || left.label.localeCompare(right.label, 'vi'));
export function getPgdcnMyWorkProjection(input: PgdcnMyWorkInput): PgdcnMyWorkProjection {
  const now = input.now || new Date(); const username = toUsername(input.currentUser.username); const proposalById = new Map((input.pcnProposals || []).map((proposal) => [proposal.id, proposal])); const tasksByDossier = new Map<string, PcnDossierWorkflowTask[]>();
  for (const task of input.pcnWorkflowTasks || []) { const current = tasksByDossier.get(task.dossierId) || []; current.push(task); tasksByDossier.set(task.dossierId, current); }
  const assignmentsByRequest = new Map((input.pgdAssignments || []).map((assignment) => [assignment.requestId, assignment])); const mine: PgdcnMyWorkItem[] = []; const waitingOthers: PgdcnMyWorkItem[] = [];
  const add = (item: PgdcnMyWorkItem, isMine: boolean) => (isMine ? mine : waitingOthers).push(item);
  for (const dossier of input.scopes.includes('PCN') ? input.pcnDossiers : []) { const status = getStatus(dossier.status); if (PCN_CLOSED_FOR_WORK.has(status)) continue; const tasks = tasksByDossier.get(dossier.id) || []; const activeTask = [...tasks].filter((task) => ACTIVE_TASK_STATUSES.has(task.status)).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]; const proposal = proposalById.get(dossier.proposalId); const dueDate = dossier.targetDate; const item: PgdcnMyWorkItem = { domain: 'PCN', id: dossier.id, label: dossier.dossierCode, customerName: dossier.customerSnapshot?.name || proposal?.customerSnapshot.name || 'Chưa cập nhật', productName: proposal?.productName, status, statusLabel: getPgdcnDashboardStatusLabel('PCN', status), currentStepLabel: activeTask?.nodeId || getPgdcnDashboardStatusLabel('PCN', status), nextAction: getPgdcnNextAction('PCN', status), bucket: getWorkBucket(dueDate, status, 'PCN', dossier.updatedAt || dossier.createdAt, now), dueDate, dueLabel: dueDate ? formatDateLabel(dueDate) : undefined, ownerLabel: dossier.ownerUsername || 'Chưa phân công', updatedAt: dossier.updatedAt || dossier.createdAt, isOverdue: isOverdueDate(dueDate, now) }; add(item, toUsername(dossier.ownerUsername) === username || toUsername(activeTask?.assignedUsername) === username); }
  for (const request of input.scopes.includes('PGD') ? input.pgdRequests : []) { const status = getStatus(request.status); if (PGD_CLOSED_FOR_WORK.has(status)) continue; const assignment = assignmentsByRequest.get(request.id); const assignedUsers = [request.ownerUsername, assignment?.leadInspectorUsername, assignment?.technicalReviewerUsername, ...(assignment?.inspectorUsernames || [])].map(toUsername); const dueDate = request.targetDate || request.inspectionScheduledAt; const item: PgdcnMyWorkItem = { domain: 'PGD', id: request.id, label: request.requestCode || request.id, customerName: request.customerSnapshot?.name || 'Chưa cập nhật', productName: request.productName, status, statusLabel: getPgdcnDashboardStatusLabel('PGD', status), currentStepLabel: getPgdcnDashboardStatusLabel('PGD', status), nextAction: getPgdcnNextAction('PGD', status), bucket: getWorkBucket(dueDate, status, 'PGD', request.updatedAt || request.createdAt, now), dueDate, dueLabel: dueDate ? formatDateLabel(dueDate) : undefined, ownerLabel: request.ownerUsername || assignment?.leadInspectorUsername || 'Chưa phân công', updatedAt: request.updatedAt || request.createdAt, isOverdue: isOverdueDate(dueDate, now) }; add(item, assignedUsers.includes(username)); }
  const buckets = { OVERDUE: sortWorkItems(mine.filter((item) => item.bucket === 'OVERDUE')), TODAY: sortWorkItems(mine.filter((item) => item.bucket === 'TODAY')), MY_TURN: sortWorkItems(mine.filter((item) => item.bucket === 'MY_TURN')), APPROVAL: sortWorkItems(mine.filter((item) => item.bucket === 'APPROVAL')), RECENT: sortWorkItems(mine.filter((item) => item.bucket === 'RECENT')) }; return { items: sortWorkItems(mine), buckets, waitingOthers: sortWorkItems(waitingOthers).slice(0, 6) };
}