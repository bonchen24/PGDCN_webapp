import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as formatter from '../utils/formatter';

const dateApi = formatter as typeof formatter & {
  formatDateDdMmYyyy?: (value: string | Date | null | undefined) => string;
  formatDateTimeDdMmYyyy?: (value: string | Date | null | undefined) => string;
  parseDdMmYyyy?: (value: string) => string;
  parseDdMmYyyyTime?: (value: string) => string;
};

test('date formatter is deterministic and uses dd/mm/yyyy', () => {
  assert.equal(dateApi.formatDateDdMmYyyy?.('2026-09-08'), '08/09/2026');
  assert.equal(dateApi.formatDateDdMmYyyy?.('2026-09-08T17:00:00.000Z'), '09/09/2026');
  assert.equal(dateApi.formatDateTimeDdMmYyyy?.('2026-09-08T17:05:00.000Z'), '09/09/2026 00:05');
});

test('date input parser accepts dd/mm/yyyy and returns the ISO date value', () => {
  assert.equal(dateApi.parseDdMmYyyy?.('08/09/2026'), '2026-09-08');
  assert.equal(dateApi.parseDdMmYyyy?.('31/02/2026'), '');
  assert.equal(dateApi.parseDdMmYyyy?.(''), '');
  assert.equal(dateApi.parseDdMmYyyyTime?.('08/09/2026 07:05'), '2026-09-08T07:05');
  assert.equal(dateApi.parseDdMmYyyyTime?.('08/09/2026 24:00'), '');
});

test('PCN and PGD DOCX generation use the shared date formatter', () => {
  const pcn = fs.readFileSync(new URL('../utils/pcnDocumentGeneration.ts', import.meta.url), 'utf8');
  const pgd = fs.readFileSync(new URL('../utils/pgdDocumentGeneration.ts', import.meta.url), 'utf8');
  const pcnDrafting = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');
  const pgdDrafting = fs.readFileSync(new URL('../components/PgdDocumentGenerationPanel.tsx', import.meta.url), 'utf8');
  assert.match(pcn, /formatDateDdMmYyyy/);
  assert.match(pgd, /formatDateDdMmYyyy/);
  assert.match(pcnDrafting, /PgdcnDateInput/);
  assert.match(pgdDrafting, /PgdcnDateInput/);
});
