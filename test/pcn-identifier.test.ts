import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  formatPcnDossierCode,
  formatPcnProposalCode,
  formatPcnSampleLotCode,
  resequencePcnProposalCodes,
  resequencePcnSampleLotCodes,
} from '../utils/pcnIdentifier.ts';

test('formats PCN proposal codes with a Vietnam date and two-digit daily serial', () => {
  assert.equal(formatPcnProposalCode(1, '2026-09-04T17:00:00.000Z'), 'PCN-260905-01');
  assert.equal(formatPcnProposalCode(99, '2026-09-05T16:59:59.000Z'), 'PCN-260905-99');
});

test('derives a complete dossier code from the server-assigned proposal code', () => {
  assert.equal(formatPcnDossierCode('PCN-260913-01', '2026-09-13T02:00:00.000Z'), 'HS-2026-PCN-260913-01');
  assert.throws(() => formatPcnDossierCode('', '2026-09-13T02:00:00.000Z'), /proposal code/i);
});

test('formats PCN sample-lot codes with a four-digit yearly serial', () => {
  assert.equal(formatPcnSampleLotCode(1, '2026-01-01T00:00:00.000Z'), 'CN 0001-26');
  assert.equal(formatPcnSampleLotCode(9999, '2026-12-31T16:59:59.000Z'), 'CN 9999-26');
});

test('rejects serials outside the published PCN code ranges', () => {
  assert.throws(() => formatPcnProposalCode(0, '2026-09-05T00:00:00.000Z'), /01.*99|serial/i);
  assert.throws(() => formatPcnProposalCode(100, '2026-09-05T00:00:00.000Z'), /01.*99|serial/i);
  assert.throws(() => formatPcnSampleLotCode(0, '2026-09-05T00:00:00.000Z'), /0001.*9999|serial/i);
  assert.throws(() => formatPcnSampleLotCode(10000, '2026-09-05T00:00:00.000Z'), /0001.*9999|serial/i);
});

test('re-sequences existing proposal codes by received date, created date, then id', () => {
  const proposals = [
    { id: 'p-2', receivedAt: '2026-09-05T02:00:00.000Z', createdAt: '2026-09-05T02:00:00.000Z', proposalCode: 'old-2' },
    { id: 'p-3', receivedAt: '2026-09-04T17:00:00.000Z', createdAt: '2026-09-05T01:00:00.000Z', proposalCode: 'old-3' },
    { id: 'p-1', receivedAt: '', createdAt: '2026-09-05T01:00:00.000Z', proposalCode: 'old-1' },
    { id: 'p-4', receivedAt: '2026-09-05T02:00:00.000Z', createdAt: '2026-09-05T02:00:00.000Z', proposalCode: 'old-4' },
  ];

  const result = resequencePcnProposalCodes(proposals);

  assert.deepEqual(result.map((proposal) => [proposal.id, proposal.proposalCode]), [
    ['p-3', 'PCN-260905-01'],
    ['p-1', 'PCN-260905-02'],
    ['p-2', 'PCN-260905-03'],
    ['p-4', 'PCN-260905-04'],
  ]);
  assert.equal(proposals[0].proposalCode, 'old-2');
});

test('re-sequences existing lot codes by creation date and resets each year', () => {
  const lots = [
    { id: 'lot-2', createdAt: '2026-01-01T01:00:00.000Z', lotCode: 'old-2' },
    { id: 'lot-1', createdAt: '2025-12-31T17:00:00.000Z', lotCode: 'old-1' },
    { id: 'lot-3', createdAt: '2026-01-01T01:00:00.000Z', lotCode: 'old-3' },
  ];

  const result = resequencePcnSampleLotCodes(lots);

  assert.deepEqual(result.map((lot) => [lot.id, lot.lotCode]), [
    ['lot-1', 'CN 0001-26'],
    ['lot-2', 'CN 0002-26'],
    ['lot-3', 'CN 0003-26'],
  ]);
  assert.equal(lots[0].lotCode, 'old-2');
});

test('PCN intake allocates proposal codes in a locked daily sequence owned by the server', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const intake = server.slice(server.indexOf("app.post('/api/pcn/intake'"), server.indexOf("app.post('/api/pcn/proposals/:proposalId'"));

  assert.match(intake, /formatPcnProposalCode/);
  assert.match(intake, /formatPcnDossierCode\(proposalCode, proposalReceivedAt\)/);
  assert.match(intake, /getPcnVietnamDateKey/);
  assert.match(intake, /pcn-proposal-sequence/);
  assert.match(intake, /MAX\(CAST\(substring\(data->>'proposalCode'/);
  assert.doesNotMatch(intake, /!proposalId \|\| !dossierId \|\| !proposalCode/);
});

test('PCN sample-lot creation allocates yearly lot codes in a locked server sequence', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const sampleLots = server.slice(server.indexOf("app.post('/api/pcn/samples/lots'"), server.indexOf("app.post('/api/pcn/samples/routes/:routeId/status'"));

  assert.match(sampleLots, /formatPcnSampleLotCode/);
  assert.match(sampleLots, /getPcnVietnamYearKey/);
  assert.match(sampleLots, /pcn-lot-sequence/);
  assert.match(sampleLots, /MAX\(CAST\(substring\(data->>'lotCode'/);
  assert.match(sampleLots, /lotCode: existingLot\.lotCode/);
});

test('identifier migration repairs only incomplete generated dossier codes', async () => {
  const { buildPcnIdentifierMigrationPlan } = await import('../scripts/migratePcnIdentifiers.ts');
  const plan = buildPcnIdentifierMigrationPlan(
    [{ documentId: 'proposal-1', data: { proposalCode: 'PCN-260913-01', receivedAt: '2026-09-13T00:00:00.000Z' } }],
    [],
    [
      { documentId: 'dossier-1', data: { proposalId: 'proposal-1', dossierCode: 'HS-2026-', createdAt: '2026-09-13T00:00:00.000Z' } },
      { documentId: 'dossier-2', data: { proposalId: 'proposal-1', dossierCode: 'QC4-2026-0665', createdAt: '2026-09-13T00:00:00.000Z' } },
    ],
  );
  assert.deepEqual(plan.dossiers, [
    { documentId: 'dossier-1', oldCode: 'HS-2026-', newCode: 'HS-2026-PCN-260913-01' },
    { documentId: 'dossier-2', oldCode: 'QC4-2026-0665', newCode: 'QC4-2026-0665' },
  ]);
});

test('PCN identifier migration is explicit, transactional, and keeps technical ids', () => {
  const migrationPath = new URL('../scripts/migratePcnIdentifiers.ts', import.meta.url);
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migration, /resequencePcnProposalCodes/);
  assert.match(migration, /resequencePcnSampleLotCodes/);
  assert.match(migration, /BEGIN/);
  assert.match(migration, /COMMIT/);
  assert.match(migration, /UPDATE app_documents/);
  assert.match(migration, /certificationDossiers/);
  assert.match(migration, /--apply/);
  assert.match(migration, /--confirm=/);
  assert.doesNotMatch(migration, /DELETE FROM app_documents/);
});
