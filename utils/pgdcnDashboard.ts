import type { DepartmentScope } from '../types.ts';

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
  domain: DepartmentScope;
  id: string;
  label: string;
  status: string;
  reason: 'WORK' | 'OVERDUE';
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
}

export interface PgdcnDashboardInput {
  scopes: readonly DepartmentScope[];
  pcnDossiers: readonly PgdcnDashboardDossier[];
  pgdRequests: readonly PgdcnDashboardRequest[];
  now?: Date;
}

const PCN_WORK_STATUSES = new Set(['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'ASSIGNED', 'PLAN_PENDING_APPROVAL', 'FIELD_EVALUATION', 'AWAITING_SAMPLING', 'SENT_TO_LAB', 'AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'TECHNICAL_REVIEW', 'WAITING_APPROVAL']);
const PGD_WORK_STATUSES = new Set(['CAPABILITY_REVIEW', 'READY_TO_EXECUTE', 'PREPARING', 'FIELD_INSPECTION', 'WAITING_LAB_RESULTS', 'RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL']);
const PCN_AI_STATUSES = new Set(['TECHNICAL_REVIEW', 'WAITING_APPROVAL']);
const PGD_AI_STATUSES = new Set(['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL']);
const PCN_CLOSED_STATUSES = new Set(['ISSUED', 'DELIVERED', 'ARCHIVED', 'CANCELLED']);
const PGD_CLOSED_STATUSES = new Set(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED']);

const isOverdueDate = (value: string | undefined, now: Date): boolean => {
  if (!value) return false;
  const timestamp = Date.parse(value.length === 10 ? `${value}T23:59:59.999Z` : value);
  return Number.isFinite(timestamp) && timestamp < now.getTime();
};

export function getPgdcnDashboardProjection(input: PgdcnDashboardInput): PgdcnDashboardProjection {
  const hasPcn = input.scopes.includes('PCN');
  const hasPgd = input.scopes.includes('PGD');
  const pcnDossiers = hasPcn ? [...input.pcnDossiers] : [];
  const pgdRequests = hasPgd ? [...input.pgdRequests] : [];
  const now = input.now || new Date();
  const pcnAttention = pcnDossiers
    .filter((item) => !PCN_CLOSED_STATUSES.has(String(item.status || ''))
      && (PCN_WORK_STATUSES.has(String(item.status || '')) || isOverdueDate(item.targetDate, now)))
    .map((item) => ({
      domain: 'PCN' as const,
      id: item.id,
      label: item.dossierCode || item.id,
      status: String(item.status || 'UNKNOWN'),
      reason: isOverdueDate(item.targetDate, now) ? 'OVERDUE' as const : 'WORK' as const,
    }));
  const pgdAttention = pgdRequests
    .filter((item) => !PGD_CLOSED_STATUSES.has(String(item.status || ''))
      && (PGD_WORK_STATUSES.has(String(item.status || '')) || isOverdueDate(item.inspectionScheduledAt, now)))
    .map((item) => ({
      domain: 'PGD' as const,
      id: item.id,
      label: item.requestCode || item.id,
      status: String(item.status || 'UNKNOWN'),
      reason: isOverdueDate(item.inspectionScheduledAt, now) ? 'OVERDUE' as const : 'WORK' as const,
    }));
  const attention = [...pcnAttention, ...pgdAttention];
  return {
    kpis: {
      pcnDossiers: pcnDossiers.length,
      pgdRequests: pgdRequests.length,
      pcnWork: pcnDossiers.filter((item) => PCN_WORK_STATUSES.has(String(item.status || ''))).length,
      pgdWork: pgdRequests.filter((item) => PGD_WORK_STATUSES.has(String(item.status || ''))).length,
      aiCandidates: pcnDossiers.filter((item) => PCN_AI_STATUSES.has(String(item.status || ''))).length
        + pgdRequests.filter((item) => PGD_AI_STATUSES.has(String(item.status || ''))).length,
      attention: attention.length,
    },
    attention,
  };
}
