import type { PcnCertificationFieldCode, PcnOcrProvider, PcnSampleLabCode, PcnSettings } from '../types.ts';
const FIELD_CODES: PcnCertificationFieldCode[] = ['QC4', 'QC9'];
const LAB_CODES: PcnSampleLabCode[] = ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY'];

export const DEFAULT_PCN_SETTINGS: PcnSettings = {
  id: 'pcn-settings',
  fieldCodes: [...FIELD_CODES],
  labRoutes: {
    QC4: ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY'],
    QC9: ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY'],
  },
  checklist: {
    requireFilesBeforeAdvance: true,
    showCompletenessToManagers: true,
  },
  coding: {
    proposalPrefix: 'DN',
    dossierPrefix: 'HS',
    sampleLotPrefix: 'M',
  },
  ocr: {
    enabled: true,
    provider: 'PADDLEOCR',
    confidenceThreshold: 0.75,
  },
  storage: {
    bucket: 'pcn-files',
    privateOnly: true,
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown, fallback: string, maxLength = 80): string {
  const normalized = String(value ?? '').trim().slice(0, maxLength);
  return normalized || fallback;
}

function cleanFieldCodes(value: unknown): PcnCertificationFieldCode[] {
  const requested = Array.isArray(value) ? value.map((item) => String(item).trim().toUpperCase()) : [];
  const active = FIELD_CODES.filter((code) => requested.includes(code));
  return active.length > 0 ? active : [...FIELD_CODES];
}

function cleanLabRoutes(value: unknown): Record<PcnCertificationFieldCode, PcnSampleLabCode[]> {
  const input = asRecord(value);
  const routes = {} as Record<PcnCertificationFieldCode, PcnSampleLabCode[]>;
  for (const fieldCode of FIELD_CODES) {
    const requested = Array.isArray(input[fieldCode]) ? input[fieldCode].map((item) => String(item).trim().toUpperCase()) : [];
    const valid = LAB_CODES.filter((code) => requested.includes(code));
    routes[fieldCode] = valid.length > 0 ? valid : [...DEFAULT_PCN_SETTINGS.labRoutes[fieldCode]];
  }
  return routes;
}

function cleanProvider(value: unknown): PcnOcrProvider {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'DISABLED' ? normalized : 'PADDLEOCR';
}

export function normalizePcnSettings(value: unknown): PcnSettings {
  const input = asRecord(value);
  const checklist = asRecord(input.checklist);
  const coding = asRecord(input.coding);
  const ocr = asRecord(input.ocr);
  const storage = asRecord(input.storage);
  const threshold = Number(ocr.confidenceThreshold);
  return {
    id: 'pcn-settings',
    fieldCodes: cleanFieldCodes(input.fieldCodes),
    labRoutes: cleanLabRoutes(input.labRoutes),
    checklist: {
      requireFilesBeforeAdvance: checklist.requireFilesBeforeAdvance !== false,
      showCompletenessToManagers: checklist.showCompletenessToManagers !== false,
    },
    coding: {
      proposalPrefix: cleanString(coding.proposalPrefix, DEFAULT_PCN_SETTINGS.coding.proposalPrefix),
      dossierPrefix: cleanString(coding.dossierPrefix, DEFAULT_PCN_SETTINGS.coding.dossierPrefix),
      sampleLotPrefix: cleanString(coding.sampleLotPrefix, DEFAULT_PCN_SETTINGS.coding.sampleLotPrefix),
    },
    ocr: {
      enabled: ocr.enabled !== false,
      provider: cleanProvider(ocr.provider),
      confidenceThreshold: Number.isFinite(threshold) ? Math.min(1, Math.max(0, threshold)) : DEFAULT_PCN_SETTINGS.ocr.confidenceThreshold,
    },
    storage: {
      bucket: cleanString(storage.bucket, DEFAULT_PCN_SETTINGS.storage.bucket),
      privateOnly: true,
    },
    ...(typeof input.updatedAt === 'string' ? { updatedAt: input.updatedAt } : {}),
    ...(typeof input.updatedBy === 'string' ? { updatedBy: input.updatedBy } : {}),
  };
}

// --- End of pcnSettings.ts ---
