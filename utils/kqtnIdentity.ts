// Author: Gemini
// OS support: Web/Node
// Description: Canonical identity helpers shared by KQTN records and sample heads.

import type { KQTNRecord, TestRequest } from '../types';

type KqtnIdentityInput = Partial<KQTNRecord & TestRequest> & {
  codingNumber?: string;
};

export function normalizeKqtnSampleKey(value: unknown): string {
  return String(value ?? '')
    .replace(new RegExp('['+String.fromCharCode(272)+String.fromCharCode(273)+']','g'),'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function getKqtnSampleCode(input: KqtnIdentityInput | null | undefined): string {
  if (!input) return '';

  const candidates = [
    input.sampleCode,
    input.codingNumber,
    input.atdEncodeNumber,
    input.emcEncodeNumber,
    input.itdEncodeNumber,
    input.encodeNumber,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
}

export function getKqtnSampleKey(input: KqtnIdentityInput | null | undefined): string {
  return normalizeKqtnSampleKey(getKqtnSampleCode(input));
}

// --- End of kqtnIdentity.ts ---
