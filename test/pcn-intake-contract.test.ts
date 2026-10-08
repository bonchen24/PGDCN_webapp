import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnIntakeApiError } from '../utils/pcnIntakeApi.ts';

const server = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const dossierDocumentWrite = server.slice(
  server.indexOf("app.post('/api/pcn/dossiers/:dossierId/documents'"),
  server.indexOf('app.post("/api/auth/kqtn-session"'),
);
const dossierDocumentRead = server.slice(
  server.indexOf("app.get('/api/pcn/dossiers/:dossierId/documents'"),
  server.indexOf("app.post('/api/pcn/dossiers/:dossierId/documents'"),
);

test('PCN intake creates one proposal and one dossier atomically and is idempotent', () => {
  const intake = server.slice(server.indexOf("app.post('/api/pcn/intake'"), server.indexOf("app.get('/api/pcn/document-requirements'"));
  assert.match(intake, /withPgTransaction/);
  assert.match(intake, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
  assert.match(intake, /idempotent/);
  assert.match(intake, /status: 'CONVERTED'/);
  assert.match(intake, /status: 'INTAKE_REVIEW'/);
  assert.doesNotMatch(intake, /ownerUsername:\s*String\(getPcnSessionUser\(req\)\?\.username/);
  assert.match(intake, /getPcnSessionUser/);
  assert.match(intake, /pcnDocumentRequirements/);
  assert.match(intake, /dossierDocuments/);
  assert.match(intake, /validatePcnProposalIntake/);
  assert.doesNotMatch(intake, /PcnScheme|branchCodes|branchCode/);

  const addProposalStart = store.indexOf('addProposal: async');
  const addProposalEnd = store.indexOf('\n  },', addProposalStart);
  assert.doesNotMatch(store.slice(addProposalStart, addProposalEnd), /saveDoc\('dossierDocuments'/);
});

test('PCN dossier starts unassigned and survives proposal synchronization', () => {
  const intake = server.slice(server.indexOf("app.post('/api/pcn/intake'"), server.indexOf("app.get('/api/pcn/document-requirements'"));
  const storedDossierStart = intake.indexOf('const storedDossier = {');
  const storedDossierEnd = intake.indexOf('const proposalWrite =', storedDossierStart);
  const storedDossier = intake.slice(storedDossierStart, storedDossierEnd);
  assert.match(storedDossier, /\.\.\.dossier/);
  assert.doesNotMatch(storedDossier, /ownerUsername:\s*String\(getPcnSessionUser\(req\)\?\.username/);

  const addProposalStart = store.indexOf('addProposal: async');
  const addProposalEnd = store.indexOf('\n  },', addProposalStart);
  assert.doesNotMatch(store.slice(addProposalStart, addProposalEnd), /ownerUsername:\s*currentUser/);

  const proposalUpdate = server.slice(server.indexOf("app.post('/api/pcn/proposals/:proposalId'"), server.indexOf("app.post('/api/pcn/dossiers/:dossierId'"));
  const nextDossierStart = proposalUpdate.indexOf('const nextDossier: CertificationDossier = {');
  const nextDossierEnd = proposalUpdate.indexOf('const proposalChanges =', nextDossierStart);
  const nextDossier = proposalUpdate.slice(nextDossierStart, nextDossierEnd);
  assert.match(nextDossier, /\.\.\.dossier/);
  assert.doesNotMatch(nextDossier, /ownerUsername\s*:/);
});

test('PCN dossier document contract keeps version history and no embedded file bytes', () => {
  assert.match(server, /app\.get\('\/api\/pcn\/dossiers\/:dossierId\/documents'/);
  assert.match(dossierDocumentRead, /requirePcnSession/);
  assert.match(dossierDocumentRead, /data->>'dossierId' = \$1/);
  assert.doesNotMatch(dossierDocumentRead, /OR document_id LIKE/);
  assert.match(dossierDocumentWrite, /pcnDocumentRequirements/);
  assert.match(dossierDocumentWrite, /assetRow\.source_json_path !== requirementId/);
  assert.match(dossierDocumentWrite, /versions:\s*\[\.\.\.previousVersions/);
  assert.match(dossierDocumentWrite, /collection_name = 'certificationDossiers'[\s\S]*FOR UPDATE/);
  assert.match(dossierDocumentWrite, /UPDATE app_documents SET data = \$2::jsonb, updated_at = CURRENT_TIMESTAMP[\s\S]*certificationDossiers/);
  assert.match(dossierDocumentWrite, /collection_name = 'dossierAttachments'/);
  assert.match(dossierDocumentWrite, /attachment:/);
  assert.match(dossierDocumentWrite, /dossier: nextDossier/);
  assert.match(dossierDocumentWrite, /idempotent/);
  assert.match(store, /uploadDossierDocument/);
  assert.match(store, /result\.dossier/);
  assert.match(store, /dossierAttachments: \[result\.attachment/);
  assert.match(detail, /Tài liệu hồ sơ/);
  assert.match(detail, /Lịch sử .* phiên/);
  assert.doesNotMatch(detail, /base64|arrayBuffer\(\)|readAsDataURL/i);
});

test('PCN intake API preserves structured server validation issues for field-level feedback', () => {
  const error = buildPcnIntakeApiError({
    code: 'PCN_INTAKE_VALIDATION_FAILED',
    error: 'Dữ liệu tiếp nhận chưa đầy đủ.',
    issues: [
      { field: 'customerSnapshot.name', message: 'Tên khách hàng là bắt buộc.' },
      { field: 'fieldCodes', message: 'Cần chọn ít nhất một Lĩnh vực.' },
    ],
  }, 400);

  assert.equal(error.name, 'PcnIntakeApiError');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'PCN_INTAKE_VALIDATION_FAILED');
  assert.deepEqual(error.issues, [
    { field: 'customerSnapshot.name', message: 'Tên khách hàng là bắt buộc.' },
    { field: 'fieldCodes', message: 'Cần chọn ít nhất một Lĩnh vực.' },
  ]);
});

// --- End of pcn-intake-contract.test.ts ---
