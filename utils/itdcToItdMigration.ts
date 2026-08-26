// Author: Codex
// OS support: Web/Node
// Description: Plans the safe movement of legacy ITDC values into the ITD column.

export type ItdcToItdMigrationStatus = 'migrate' | 'already_migrated' | 'conflict' | 'unchanged';

export interface ItdcToItdMigrationInput {
  id: string;
  atdEncodeNumber?: unknown;
  itdEncodeNumber?: unknown;
}

export interface ItdcToItdMigrationPlan {
  id: string;
  status: ItdcToItdMigrationStatus;
  sourceValue?: string;
  targetValue?: string;
  update?: {
    itdEncodeNumber: string;
    atdEncodeNumber: undefined;
  };
}

export interface ItdcToItdRecordMigrationResult {
  status: ItdcToItdMigrationStatus;
  record: Record<string, unknown>;
}

function normalizeValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

export function planItdcToItdMigration(input: ItdcToItdMigrationInput): ItdcToItdMigrationPlan {
  const sourceValue = normalizeValue(input.atdEncodeNumber);
  const targetValue = normalizeValue(input.itdEncodeNumber);

  if (!sourceValue) {
    return {
      id: input.id,
      status: 'unchanged',
      sourceValue,
      targetValue,
      update: undefined,
    };
  }

  if (!targetValue) {
    return {
      id: input.id,
      status: 'migrate',
      sourceValue,
      targetValue: sourceValue,
      update: {
        itdEncodeNumber: sourceValue,
        atdEncodeNumber: undefined,
      },
    };
  }

  if (sourceValue === targetValue) {
    return {
      id: input.id,
      status: 'already_migrated',
      sourceValue,
      targetValue,
      update: undefined,
    };
  }

  return {
    id: input.id,
    status: 'conflict',
    sourceValue,
    targetValue,
    update: undefined,
  };
}

export function migrateItdcToItdRecord(record: Record<string, unknown>): ItdcToItdRecordMigrationResult {
  const plan = planItdcToItdMigration({
    id: String(record.id ?? ''),
    atdEncodeNumber: record.atdEncodeNumber,
    itdEncodeNumber: record.itdEncodeNumber,
  });

  if (plan.status !== 'migrate') {
    return { status: plan.status, record: { ...record } };
  }

  const migratedRecord: Record<string, unknown> = { ...record, itdEncodeNumber: plan.targetValue };
  delete migratedRecord.atdEncodeNumber;
  return { status: plan.status, record: migratedRecord };
}

// --- End of itdcToItdMigration.ts ---
