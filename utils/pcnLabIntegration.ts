// Author: Codex
// OS support: Web/Node
// Description: Shared, browser-safe contract helpers for PCN lab integrations

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleItem,
  PcnSampleExecutionSnapshot,
  PcnSampleFlowEventType,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleRouteStatus,
  PcnSampleExecutionOutcome,
} from '../types.ts';

export const PCN_LAB_INTEGRATION_CONTRACT_VERSION = '1';

export const PCN_LAB_STATUS_EVENT_TYPES = [
  'RECEIVED',
  'SCHEDULED',
  'RESCHEDULED',
  'IN_PROGRESS',
  'TEST_COMPLETED',
  'RESULT_UPDATED',
  'RETURNED',
  'ISSUE',
  'CANCELLED',
] as const;

export type PcnLabStatusEventType = typeof PCN_LAB_STATUS_EVENT_TYPES[number];

export interface PcnLabDispatchPayload {
  contractVersion: typeof PCN_LAB_INTEGRATION_CONTRACT_VERSION;
  sourceSystem: 'PCN';
  targetSystem: string;
  messageId: string;
  idempotencyKey: string;
  sentAt: string;
  callback: {
    path: '/api/pcn/integrations/lab-status-events';
    eventTypes: readonly PcnLabStatusEventType[];
  };
  request: {
    pcnLabRequestId: string;
    pcnNumber: string;
    dossierId: string;
    dossierCode: string;
    proposalId?: string;
    proposalCode?: string;
    fieldCode: string;
    pcnRouteId: string;
    requestedAt: string;
    targetDate?: string;
    criteria?: string;
  };
  lot: {
    lotId: string;
    dossierId: string;
    lotCode: string;
    fieldCodes: string[];
  };
  samples: Array<{
    pcnSampleItemId: string;
    sampleCode: string;
    sampleType: string;
    model: string;
    brand?: string;
    quantity: number;
    unit?: string;
    serialNumbers?: string[];
    notes?: string;
  }>;
  route: {
    pcnRouteId: string;
    sampleLotId: string;
    labCode: PcnSampleRoute['labCode'];
    labName: string;
    sequence: number;
  };
  customer?: {
    name?: string;
    address?: string;
    taxId?: string;
    phone?: string;
    email?: string;
    contactPerson?: string;
  };
}

export interface PcnLabDispatchInput {
  request: OutboundLabRequest;
  lot: PcnSampleLot;
  sampleItems?: PcnSampleItem[];
  route: PcnSampleRoute;
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  targetSystemCode: string;
  messageId: string;
  idempotencyKey: string;
  sentAt?: string;
}

export interface PcnLabStatusEventInput {
  sourceSystemCode: string;
  externalEventId: string;
  externalRequestId: string;
  externalRequestCode?: string;
  externalSequence: number;
  pcnRouteId?: string;
  pcnLabRequestId?: string;
  pcnSampleItemIds?: string[];
  eventType: PcnLabStatusEventType;
  occurredAt: string;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: PcnSampleExecutionOutcome;
  externalStatusCode?: string;
  externalReportNumber?: string;
  issueCode?: string;
  note?: string;
}

export interface PcnLabStatusEventMapping {
  eventType: PcnLabStatusEventType;
  routeStatus?: PcnSampleRouteStatus;
  internalEventType: PcnSampleFlowEventType;
  execution: PcnSampleExecutionSnapshot;
  note?: string;
  issueCode?: string;
}

export interface PcnLabHmacSigningInput {
  method: string;
  path: string;
  timestamp: string;
  messageId: string;
  bodySha256: string;
}

export function buildPcnLabHmacSigningInput(input: PcnLabHmacSigningInput): string {
  return [
    required(input.method, 'method').toUpperCase(),
    required(input.path, 'path'),
    required(input.timestamp, 'timestamp'),
    required(input.messageId, 'messageId'),
    required(input.bodySha256, 'bodySha256'),
  ].join('\n');
}

function required(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} là bắt buộc.`);
  return normalized;
}

function optional(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function normalizeSystemCode(value: unknown, label: string): string {
  return required(value, label).toUpperCase();
}

function normalizeSequence(value: unknown): number {
  const sequence = Number(value);
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('Thứ tự tuyến mẫu phải là số nguyên dương.');
  return sequence;
}

/**
 * Build the only payload that may leave the PCN server. It intentionally
 * contains sample/PYC identity and test context, never credentials or files.
 */
export function buildPcnLabDispatchPayload(input: PcnLabDispatchInput): PcnLabDispatchPayload {
  const targetSystem = normalizeSystemCode(input.targetSystemCode, 'Mã app phòng thử');
  const messageId = required(input.messageId, 'messageId');
  const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
  if (input.request.dossierId !== input.dossier.id || input.lot.dossierId !== input.dossier.id || input.route.sampleLotId !== input.lot.id) {
    throw new Error('PYC, hồ sơ, lô mẫu và tuyến mẫu không cùng một quan hệ PCN.');
  }
  if (input.request.sampleRouteId !== input.route.id || input.request.sampleLotId !== input.lot.id) {
    throw new Error('PYC chưa liên kết chính xác với tuyến và lô mẫu cần gửi.');
  }

  const candidateSampleItems = input.sampleItems?.length
    ? input.sampleItems
    : [{
      id: `${input.lot.id}-legacy-item`,
      sampleLotId: input.lot.id,
      sampleCode: input.lot.lotCode,
      sampleType: input.lot.sampleName,
      model: input.lot.model || input.lot.sampleName,
      brand: input.lot.brand,
      quantity: input.lot.quantity,
      unit: input.lot.unit,
    } satisfies PcnSampleItem];
  if (candidateSampleItems.some((item) => item.sampleLotId !== input.lot.id)) throw new Error('Mẫu trong payload không cùng lô PCN.');
  const sampleItems = input.route.sampleItemIds?.length
    ? candidateSampleItems.filter((item) => input.route.sampleItemIds!.includes(item.id))
    : candidateSampleItems;
  if (sampleItems.length === 0) throw new Error('Tuyến PYC chưa có mẫu/model hợp lệ để gửi sang phòng thử.');
  const payload: PcnLabDispatchPayload = {
    contractVersion: PCN_LAB_INTEGRATION_CONTRACT_VERSION,
    sourceSystem: 'PCN',
    targetSystem,
    messageId,
    idempotencyKey,
    sentAt: input.sentAt || new Date().toISOString(),
    callback: {
      path: '/api/pcn/integrations/lab-status-events',
      eventTypes: PCN_LAB_STATUS_EVENT_TYPES,
    },
    request: {
      pcnLabRequestId: required(input.request.id, 'Mã PYC PCN'),
      pcnNumber: required(input.request.pycNumber, 'Số PYC PCN'),
      dossierId: input.dossier.id,
      dossierCode: required(input.dossier.dossierCode, 'Mã hồ sơ PCN'),
      fieldCode: required(input.request.fieldCode, 'Mã lĩnh vực'),
      pcnRouteId: input.route.id,
      requestedAt: required(input.request.requestedAt, 'Thời điểm tạo PYC'),
    },
    lot: {
      lotId: input.lot.id,
      dossierId: input.lot.dossierId,
      lotCode: required(input.lot.lotCode, 'Mã lô mẫu'),
      fieldCodes: input.lot.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean),
    },
    samples: sampleItems.map((item) => ({
      pcnSampleItemId: required(item.id, 'Mã mẫu/model PCN'),
      sampleCode: required(item.sampleCode, 'Mã mẫu'),
      sampleType: required(item.sampleType, 'Loại mẫu'),
      model: required(item.model, 'Model'),
      quantity: item.quantity,
      ...(optional(item.brand) ? { brand: optional(item.brand) } : {}),
      ...(optional(item.unit) ? { unit: optional(item.unit) } : {}),
      ...(item.serialNumbers?.length ? { serialNumbers: item.serialNumbers.map((value) => String(value).trim()).filter(Boolean) } : {}),
      ...(optional(item.notes) ? { notes: optional(item.notes) } : {}),
    })),
    route: {
      pcnRouteId: input.route.id,
      sampleLotId: input.route.sampleLotId,
      labCode: input.route.labCode,
      labName: required(input.route.labName, 'Tên phòng thử'),
      sequence: normalizeSequence(input.route.sequence || 1),
    },
  };

  for (const [key, value] of Object.entries({
    proposalId: input.dossier.proposalId,
    proposalCode: (input.proposal as any)?.proposalCode,
    targetDate: input.request.targetDate,
    criteria: input.request.criteria,
  })) {
    const normalized = optional(value);
    if (normalized) Object.assign(payload.request, { [key]: normalized });
  }
  const customer = input.dossier.customerSnapshot;
  if (customer && Object.values(customer).some((value) => optional(value))) {
    payload.customer = Object.fromEntries(
      Object.entries(customer).flatMap(([key, value]) => {
        const normalized = optional(value);
        return normalized ? [[key, normalized]] : [];
      }),
    ) as PcnLabDispatchPayload['customer'];
  }
  return payload;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function canonicalizePcnLabIntegrationPayload(value: unknown): string {
  return canonicalize(value);
}

export async function buildPcnLabIntegrationFingerprint(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Môi trường không hỗ trợ SHA-256 cho tích hợp phòng thử.');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonicalize(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getPcnLabIntegrationEventId(sourceSystemCode: string, externalEventId: string): string {
  const source = normalizeSystemCode(sourceSystemCode, 'sourceSystemCode').replace(/[^A-Z0-9_-]/g, '_');
  const eventId = required(externalEventId, 'externalEventId').replace(/[^a-zA-Z0-9._:-]/g, '_');
  return `pcn-lab-event-${source}-${eventId}`.slice(0, 180);
}

export function mapPcnLabStatusEvent(input: PcnLabStatusEventInput): PcnLabStatusEventMapping {
  const sourceSystemCode = normalizeSystemCode(input.sourceSystemCode, 'sourceSystemCode');
  const externalEventId = required(input.externalEventId, 'externalEventId');
  const externalRequestId = required(input.externalRequestId, 'externalRequestId');
  const occurredAt = required(input.occurredAt, 'occurredAt');
  const externalSequence = Number(input.externalSequence);
  if (!Number.isInteger(externalSequence) || externalSequence < 1) throw new Error('externalSequence phải là số nguyên dương.');
  if (!PCN_LAB_STATUS_EVENT_TYPES.includes(input.eventType)) throw new Error('eventType phòng thử không được hỗ trợ.');

  const executionBase: PcnSampleExecutionSnapshot = {
    status: 'UNSCHEDULED',
    sourceSystemCode,
    lastExternalEventId: externalEventId,
    lastExternalSequence: externalSequence,
    lastSyncedAt: occurredAt,
    ...(optional(input.externalStatusCode) ? { externalStatusCode: optional(input.externalStatusCode) } : {}),
  };
  const mapping: PcnLabStatusEventMapping = {
    eventType: input.eventType,
    internalEventType: 'UPDATED',
    execution: executionBase,
    ...(optional(input.note) ? { note: optional(input.note) } : {}),
    ...(optional(input.issueCode) ? { issueCode: optional(input.issueCode) } : {}),
  };

  switch (input.eventType) {
    case 'RECEIVED':
      mapping.routeStatus = 'RECEIVED';
      mapping.internalEventType = 'LAB_RECEIVED';
      break;
    case 'SCHEDULED':
    case 'RESCHEDULED':
      mapping.execution = { ...executionBase, status: 'SCHEDULED', scheduledDate: required(input.scheduledDate, 'scheduledDate') };
      break;
    case 'IN_PROGRESS':
      mapping.execution = { ...executionBase, status: 'IN_PROGRESS', ...(optional(input.startedAt) ? { startedAt: optional(input.startedAt) } : {}) };
      break;
    case 'TEST_COMPLETED':
      mapping.execution = { ...executionBase, status: 'COMPLETED', ...(optional(input.completedAt) ? { completedAt: optional(input.completedAt) } : {}) };
      break;
    case 'RESULT_UPDATED': {
      const outcome = input.outcome || 'PENDING';
      if (!['PENDING', 'PASS', 'FAIL'].includes(outcome)) throw new Error('outcome phòng thử không hợp lệ.');
      mapping.execution = {
        ...executionBase,
        status: 'COMPLETED',
        outcome,
        ...(optional(input.scheduledDate) ? { scheduledDate: optional(input.scheduledDate) } : {}),
        ...(optional(input.completedAt) ? { completedAt: optional(input.completedAt) } : {}),
        ...(optional(input.externalReportNumber) ? { externalReportNumber: optional(input.externalReportNumber) } : {}),
      };
      if (outcome !== 'PENDING') mapping.routeStatus = 'RESULT_RETURNED';
      mapping.internalEventType = outcome === 'PENDING' ? 'UPDATED' : 'RESULT_RETURNED';
      break;
    }
    case 'RETURNED':
      mapping.routeStatus = 'RETURNED_TO_PCN';
      mapping.execution = { ...executionBase, status: 'COMPLETED' };
      mapping.internalEventType = 'SAMPLE_RETURNED';
      break;
    case 'ISSUE':
      mapping.routeStatus = 'ISSUE';
      mapping.execution = { ...executionBase, status: 'BLOCKED' };
      mapping.internalEventType = 'ISSUE_RECORDED';
      break;
    case 'CANCELLED':
      mapping.routeStatus = 'CANCELLED';
      mapping.execution = { ...executionBase, status: 'CANCELLED' };
      break;
  }
  void externalRequestId;
  return mapping;
}

// --- End of pcnLabIntegration.ts ---
