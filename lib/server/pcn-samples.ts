import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  OutboundLabRequest,
  PcnLabRequestStatus,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDispatch,
  PcnSampleRoute,
  PcnSampleRouteStatus,
  ReturnedTestResult,
} from '@/types';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  buildPcnLabHmacSigningInput,
  canonicalizePcnLabIntegrationPayload,
  resolvePcnLabTargetSystemCode,
  type PcnLabDispatchPayload,
} from '@/utils/pcnLabIntegration';
import { PCN_SAMPLE_LAB_OPTIONS } from '@/types';

export type { PcnSampleLotDraft, PcnSampleRouteUpdate } from '@/utils/pcnSampleFlow';

export interface PcnLabIntegrationConfig {
  routeCode: string;
  systemCode: string;
  baseUrl: string;
  secretEnv: string;
  requestPath?: string;
  reconcilePath?: string;
}

export function customerKey(value: any): string {
  return ['name', 'taxId', 'address', 'phone', 'email']
    .map((key) => String(value?.[key] || '').trim().toLocaleLowerCase('vi-VN'))
    .join('|');
}

export function normalizePcnSampleList(value: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();
}

export function normalizePcnSampleLabCodes(value: unknown): PcnSampleLabCode[] {
  const allowed = new Set(PCN_SAMPLE_LAB_OPTIONS.map((item) => item.code));
  const codes = Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
  const invalid = codes.filter((code) => !allowed.has(code as PcnSampleLabCode));
  if (invalid.length > 0) {
    throw Object.assign(new Error(`Phòng thử mẫu không hợp lệ: ${invalid.join(', ')}`), { statusCode: 400 });
  }
  return codes as PcnSampleLabCode[];
}

export function samePcnSampleLotCreation(left: PcnSampleLot, right: PcnSampleLot): boolean {
  const leftItemIds = normalizePcnSampleList(left.sampleItemIds);
  const rightItemIds = normalizePcnSampleList(right.sampleItemIds);
  const itemIdsMatch = leftItemIds.length === 0 || JSON.stringify(leftItemIds) === JSON.stringify(rightItemIds);
  return (
    left.dossierId === right.dossierId &&
    left.lotCode.trim().toLocaleLowerCase('vi-VN') === right.lotCode.trim().toLocaleLowerCase('vi-VN') &&
    left.sampleName.trim() === right.sampleName.trim() &&
    String(left.model || '').trim() === String(right.model || '').trim() &&
    String(left.brand || '').trim() === String(right.brand || '').trim() &&
    Number(left.quantity) === Number(right.quantity) &&
    String(left.unit || '').trim() === String(right.unit || '').trim() &&
    String(left.receivedAt || '').trim() === String(right.receivedAt || '').trim() &&
    String(left.notes || '').trim() === String(right.notes || '').trim() &&
    JSON.stringify(normalizePcnSampleList(left.fieldCodes)) ===
      JSON.stringify(normalizePcnSampleList(right.fieldCodes)) &&
    JSON.stringify(normalizePcnSampleList(left.routeIds)) ===
      JSON.stringify(normalizePcnSampleList(right.routeIds)) &&
    itemIdsMatch
  );
}

export function samePcnLabRequestCreation(left: OutboundLabRequest, right: OutboundLabRequest): boolean {
  const lower = (value: unknown) => String(value || '').trim().toLocaleLowerCase('vi-VN');
  return (
    left.id === right.id &&
    lower(left.pycNumber) === lower(right.pycNumber) &&
    left.dossierId === right.dossierId &&
    String(left.fieldCode || '').trim().toUpperCase() === String(right.fieldCode || '').trim().toUpperCase() &&
    lower(left.laboratoryName) === lower(right.laboratoryName) &&
    lower(left.sampleLotId) === lower(right.sampleLotId) &&
    lower(left.sampleRouteId) === lower(right.sampleRouteId) &&
    String(left.targetDate || '').trim() === String(right.targetDate || '').trim() &&
    String(left.criteria || '').trim() === String(right.criteria || '').trim() &&
    String(left.handoverNote || '').trim() === String(right.handoverNote || '').trim() &&
    left.status === right.status
  );
}

export function samePcnReturnedResult(left: ReturnedTestResult, right: ReturnedTestResult): boolean {
  const normalizeIssue = (issue: ReturnedTestResult['sampleIssue']) =>
    issue
      ? {
          type: issue.type,
          description: String(issue.description || '').trim(),
          reportedAt: String(issue.reportedAt || '').trim(),
          ...(issue.resolvedAt ? { resolvedAt: issue.resolvedAt } : {}),
          ...(issue.resolvedBy ? { resolvedBy: issue.resolvedBy } : {}),
        }
      : undefined;
  const normalizeOcrEvidence = (evidence: ReturnedTestResult['ocrEvidence']) =>
    evidence
      ? {
          provider: evidence.provider,
          sourceFileName: String(evidence.sourceFileName || '').trim(),
          ...(evidence.sourcePage ? { sourcePage: evidence.sourcePage } : {}),
          confidence: Number(evidence.confidence),
        }
      : undefined;
  return (
    left.id === right.id &&
    left.dossierId === right.dossierId &&
    left.labRequestId === right.labRequestId &&
    Number(left.round) === Number(right.round) &&
    left.outcome === right.outcome &&
    String(left.receivedAt || '').trim() === String(right.receivedAt || '').trim() &&
    String(left.reportNumber || '').trim() === String(right.reportNumber || '').trim() &&
    String(left.notes || '').trim() === String(right.notes || '').trim() &&
    JSON.stringify(normalizeIssue(left.sampleIssue)) === JSON.stringify(normalizeIssue(right.sampleIssue)) &&
    JSON.stringify(normalizeOcrEvidence(left.ocrEvidence)) === JSON.stringify(normalizeOcrEvidence(right.ocrEvidence))
  );
}

export function normalizePcnReturnedResultIssue(
  value: unknown,
  now: string
): ReturnedTestResult['sampleIssue'] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Thông tin vấn đề mẫu của KQTN không hợp lệ.'), { statusCode: 400 });
  }
  const issue = value as Record<string, any>;
  const allowedTypes = new Set(['MISMATCH', 'DAMAGED', 'INSUFFICIENT', 'MISSING_DOCUMENT', 'OTHER']);
  const type = String(issue.type || '').trim().toUpperCase();
  const description = String(issue.description || '').trim();
  if (!allowedTypes.has(type) || !description) {
    throw Object.assign(new Error('Thông tin vấn đề mẫu của KQTN không hợp lệ.'), { statusCode: 400 });
  }
  return {
    type: type as NonNullable<ReturnedTestResult['sampleIssue']>['type'],
    description,
    reportedAt: String(issue.reportedAt || '').trim() || now,
    ...(String(issue.resolvedAt || '').trim() ? { resolvedAt: String(issue.resolvedAt).trim() } : {}),
    ...(String(issue.resolvedBy || '').trim() ? { resolvedBy: String(issue.resolvedBy).trim() } : {}),
  };
}

export function getPcnSampleRouteStatusForLabRequest(status: PcnLabRequestStatus): PcnSampleRouteStatus | null {
  if (status === 'DRAFT') return 'PENDING';
  if (status === 'SENT') return 'SENT';
  if (status === 'RECEIVED') return 'RECEIVED';
  if (status === 'RESULT_RETURNED') return 'RESULT_RETURNED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return null;
}

export function getPcnLabRequestStatusForSampleRoute(status: PcnSampleRouteStatus): PcnLabRequestStatus | null {
  if (status === 'PENDING') return 'DRAFT';
  if (status === 'SENT') return 'SENT';
  if (status === 'RECEIVED') return 'RECEIVED';
  if (status === 'RESULT_RETURNED') return 'RESULT_RETURNED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return null;
}

export function isPcnLabRequestStatus(value: string): value is PcnLabRequestStatus {
  return ['DRAFT', 'SENT', 'RECEIVED', 'RESULT_RETURNED', 'CANCELLED'].includes(value);
}

export function getPcnLabIntegrationConfig(systemCode: string): PcnLabIntegrationConfig | null {
  const raw = String(process.env.PCN_LAB_INTEGRATIONS_JSON || '').trim();
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Cấu hình tích hợp phòng thử không hợp lệ.'), { statusCode: 503 });
  }
  const entries = Array.isArray(parsed)
    ? parsed.map((item: any) => ({
        ...(item && typeof item === 'object' ? item : {}),
        routeCode: String(item?.routeCode || item?.systemCode || '').trim().toUpperCase(),
      }))
    : parsed && typeof parsed === 'object'
    ? Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
        ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
        routeCode: String((value as any)?.routeCode || key).trim().toUpperCase(),
      }))
    : [];
  const wanted = String(systemCode || '').trim().toUpperCase();
  const wantedAliases = new Set([wanted, wanted === 'ITD' ? 'ELECTRICAL_SAFETY' : wanted]);
  const entry = entries.find((item) =>
    item && typeof item === 'object' && wantedAliases.has(String((item as any).routeCode || '').trim().toUpperCase())
  ) as any;
  if (!entry) return null;
  const baseUrl = String(entry.baseUrl || '').trim();
  const secretEnv = String(entry.secretEnv || '').trim();
  if (!baseUrl || !secretEnv || !/^https?:\/\//i.test(baseUrl)) {
    throw Object.assign(new Error(`Cấu hình app phòng thử ${wanted} chưa có baseUrl/secretEnv hợp lệ.`), {
      statusCode: 503,
    });
  }
  return {
    routeCode: wanted,
    systemCode: resolvePcnLabTargetSystemCode(entry.systemCode || wanted),
    baseUrl: baseUrl.replace(/\/+$/, ''),
    secretEnv,
    ...(String(entry.requestPath || '').trim() ? { requestPath: String(entry.requestPath).trim() } : {}),
    ...(String(entry.reconcilePath || '').trim() ? { reconcilePath: String(entry.reconcilePath).trim() } : {}),
  };
}

export function getPcnLabIntegrationSecret(config: PcnLabIntegrationConfig): string {
  const secret = String(process.env[config.secretEnv] || '').trim();
  if (!secret) {
    throw Object.assign(new Error(`Thiếu secret server cho app phòng thử ${config.systemCode}.`), { statusCode: 503 });
  }
  return secret;
}

export function buildPcnLabBodySha256(body: unknown): string {
  return createHash('sha256').update(canonicalizePcnLabIntegrationPayload(body)).digest('hex');
}

export function buildPcnLabHmacSignature(input: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  messageId: string;
  bodySha256: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(buildPcnLabHmacSigningInput(input))
    .digest('hex');
}

export function verifyPcnLabHmacSignature(input: {
  secret: string;
  providedSignature: string;
  method: string;
  path: string;
  timestamp: string;
  messageId: string;
  bodySha256: string;
}): boolean {
  const expected = buildPcnLabHmacSignature(input);
  const provided = String(input.providedSignature || '').trim().replace(/^sha256=/i, '');
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expectedBytes = Buffer.from(expected, 'hex');
  const providedBytes = Buffer.from(provided, 'hex');
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export function getPcnLabIntegrationTimeoutMs(): number {
  const configured = Number(process.env.PCN_LAB_INTEGRATION_TIMEOUT_MS || 10000);
  return Math.min(60000, Math.max(1000, Number.isFinite(configured) ? configured : 10000));
}

export async function updatePcnSampleRequestBundleDispatch(
  client: any,
  requestId: string,
  input: {
    status: 'SENDING' | 'ACKNOWLEDGED' | 'ERROR' | 'RECONCILE_REQUIRED';
    request?: OutboundLabRequest;
    errorCode?: string;
    errorMessage?: string;
    now?: string;
  }
): Promise<PcnSampleRequestBundle | undefined> {
  const bundleResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'pcnSampleRequestBundles'
     ORDER BY updated_at DESC
     FOR UPDATE`
  );
  const now = input.now || new Date().toISOString();
  for (const row of bundleResult.rows) {
    const bundle = mapDocumentRow(row) as PcnSampleRequestBundle;
    const dispatchIndex = (bundle.dispatches || []).findIndex((dispatch) =>
      dispatch.labRequestIds.includes(requestId)
    );
    if (dispatchIndex < 0) continue;
    const currentDispatch = bundle.dispatches[dispatchIndex];
    const nextDispatch: PcnSampleRequestBundleDispatch = {
      ...currentDispatch,
      status: input.status,
      ...(input.request?.integration?.externalRequestId
        ? {
            externalRequestIds: Array.from(
              new Set([...(currentDispatch.externalRequestIds || []), input.request.integration.externalRequestId])
            ),
          }
        : {}),
      ...(input.request?.integration?.externalRequestCode
        ? {
            externalRequestCodes: Array.from(
              new Set([
                ...(currentDispatch.externalRequestCodes || []),
                input.request.integration.externalRequestCode,
              ])
            ),
          }
        : {}),
      ...(input.errorCode ? { lastErrorCode: input.errorCode } : { lastErrorCode: undefined }),
      ...(input.errorMessage ? { lastErrorMessage: input.errorMessage } : { lastErrorMessage: undefined }),
      ...(input.request?.integration?.lastAttemptAt
        ? { lastAttemptAt: input.request.integration.lastAttemptAt }
        : { lastAttemptAt: now }),
      ...(input.request?.integration?.acknowledgedAt
        ? { acknowledgedAt: input.request.integration.acknowledgedAt }
        : {}),
    };
    const dispatches = bundle.dispatches.map((item, index) => (index === dispatchIndex ? nextDispatch : item));
    const acknowledged = dispatches.filter((item) => item.status === 'ACKNOWLEDGED' || item.status === 'SENT').length;
    const failed = dispatches.filter((item) => item.status === 'ERROR' || item.status === 'RECONCILE_REQUIRED').length;
    const pending = dispatches.filter((item) => item.status === 'DRAFT' || item.status === 'SENDING').length;
    const status: PcnSampleRequestBundle['status'] =
      failed > 0
        ? acknowledged > 0
          ? 'PARTIALLY_SENT'
          : 'RECONCILE_REQUIRED'
        : pending > 0
        ? 'SENDING'
        : 'SENT';
    const nextBundle: PcnSampleRequestBundle = { ...bundle, dispatches, status, updatedAt: now };
    await client.query(
      `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1`,
      [bundle.id, JSON.stringify(getDocumentPayload(nextBundle))]
    );
    return nextBundle;
  }
  return undefined;
}

export async function updatePcnSampleRequestBundleResultState(
  client: any,
  requestId: string,
  now = new Date().toISOString()
): Promise<PcnSampleRequestBundle | undefined> {
  const bundleResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'pcnSampleRequestBundles'
     ORDER BY updated_at DESC
     FOR UPDATE`
  );
  for (const row of bundleResult.rows) {
    const bundle = mapDocumentRow(row) as PcnSampleRequestBundle;
    if (!bundle.dispatches.some((dispatch) => dispatch.labRequestIds.includes(requestId))) continue;
    const requestIds = Array.from(new Set(bundle.dispatches.flatMap((dispatch) => dispatch.labRequestIds)));
    const resultQuery = await client.query(
      `SELECT DISTINCT data->>'labRequestId' AS lab_request_id
       FROM app_documents
       WHERE collection_name = 'returnedResults' AND data->>'labRequestId' = ANY($1::text[])`,
      [requestIds]
    );
    const returnedRequestIds = new Set(
      resultQuery.rows.map((item: any) => String(item.lab_request_id || '').trim()).filter(Boolean)
    );
    const nextStatus: PcnSampleRequestBundle['status'] =
      returnedRequestIds.size > 0
        ? returnedRequestIds.size === requestIds.length
          ? 'RESULT_RETURNED'
          : 'PARTIALLY_SENT'
        : bundle.status;
    if (nextStatus === bundle.status) return bundle;
    const nextBundle: PcnSampleRequestBundle = { ...bundle, status: nextStatus, updatedAt: now };
    await client.query(
      `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1`,
      [bundle.id, JSON.stringify(getDocumentPayload(nextBundle))]
    );
    return nextBundle;
  }
  return undefined;
}
