import type { DepartmentScope } from '../types.ts';

export type PgdcnDashboardDomain = 'PCN' | 'PGD';
export type DashboardAttentionReason = 'WORK' | 'OVERDUE';
export type DashboardPipelineTone = 'neutral' | 'info' | 'warning' | 'success' | 'critical';

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

const parseDateTimestamp = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const rawValue = String(value).trim();
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T23:59:59.999Z` : rawValue);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const formatDateLabel = (value: string): string => {
  const rawValue = String(value).trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;

  const date = new Date(rawValue);
  if (!Number.isFinite(date.getTime())) return rawValue;
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
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
