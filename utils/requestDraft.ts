// Author: Gemini
// OS support: Web/Node
// Description: IndexedDB persistence helpers for the new-request modal draft

import { del, get, set } from 'idb-keyval';

export type RequestDraftRecord = Record<string, unknown>;

export interface RequestModalDraftPayload {
  generalInfo: RequestDraftRecord;
  sampleList: RequestDraftRecord[];
  currentSample: RequestDraftRecord;
  useCustomerInfoForInvoice: boolean;
}

export interface RequestModalDraft {
  version: 1;
  savedAt: string;
  payload: RequestModalDraftPayload;
}

const REQUEST_MODAL_DRAFT_PREFIX = 'ddt-request-modal-draft:';

const normalizeDraftIdentity = (identity: string | null | undefined): string => {
  const normalized = String(identity || 'guest')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');

  return normalized.replace(/^-+|-+$/g, '') || 'guest';
};

export const getRequestDraftKey = (identity: string | null | undefined): string => (
  `${REQUEST_MODAL_DRAFT_PREFIX}${normalizeDraftIdentity(identity)}`
);

export const buildRequestModalDraft = (
  payload: RequestModalDraftPayload,
  savedAt = new Date().toISOString()
): RequestModalDraft => ({
  version: 1,
  savedAt,
  payload: {
    generalInfo: payload.generalInfo,
    sampleList: payload.sampleList,
    currentSample: payload.currentSample,
    useCustomerInfoForInvoice: payload.useCustomerInfoForInvoice
  }
});

const isRecord = (value: unknown): value is RequestDraftRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isRequestModalDraft = (value: unknown): value is RequestModalDraft => {
  if (!isRecord(value) || value.version !== 1 || typeof value.savedAt !== 'string') return false;
  const payload = value.payload;
  if (!isRecord(payload)) return false;

  return isRecord(payload.generalInfo)
    && Array.isArray(payload.sampleList)
    && payload.sampleList.every(isRecord)
    && isRecord(payload.currentSample)
    && typeof payload.useCustomerInfoForInvoice === 'boolean';
};

export const loadRequestModalDraft = async (key: string): Promise<RequestModalDraft | null> => {
  const stored = await get<unknown>(key);
  return isRequestModalDraft(stored) ? stored : null;
};

export const saveRequestModalDraft = async (
  key: string,
  payload: RequestModalDraftPayload
): Promise<RequestModalDraft> => {
  const draft = buildRequestModalDraft(payload);
  await set(key, draft);
  return draft;
};

export const deleteRequestModalDraft = async (key: string): Promise<void> => {
  await del(key);
};

// --- End of requestDraft.ts ---
