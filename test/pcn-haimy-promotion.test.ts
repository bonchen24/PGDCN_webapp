import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildPcnHaimyImportPlan } from '../utils/pcnIntegration.ts';
import { buildPcnHaimyPromotionDraft, type PcnHaimyPromotionInput } from '../utils/pcnHaimyPromotion.ts';
import { validatePcnProposalIntake } from '../utils/pcnIntakePolicy.ts';
import type { PcnHaimyExportRecord } from '../types.ts';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const view = fs.readFileSync(new URL('../components/PcnHaimyImportView.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

const exportRecord: PcnHaimyExportRecord = {
  sourceSystem: 'HAIMY',
  externalRegistrationId: 'DK-2026-001',
  externalBatchId: 'LOT-001',
  registrationCode: 'REG-001',
  customerName: 'Công ty Ánh Dương',
  productName: 'Nồi chiên không dầu',
  model: 'AD-01',
  brand: 'Ánh Dương',
  fieldCode: 'QC4',
  quantity: 2,
};

const input: PcnHaimyPromotionInput = {
  proposalCode: 'PCN-2026-001',
  channel: 'EMAIL',
  customerAddress: '12 Nguyễn Huệ, Quận 1, TP.HCM',
  contactPerson: 'Nguyễn An',
  phone: '0900000000',
  email: 'an@example.test',
  warehouseAddress: 'Kho Ánh Dương, Bình Dương',
  productType: 'Thiết bị điện gia dụng',
  specifications: '220 V; 1.500 W; dung tích 5 L',
  manufacturer: 'Công ty Ánh Dương',
  manufacturerAddress: 'Bình Dương',
  method: 'METHOD_1',
};

function readyStaging() {
  return buildPcnHaimyImportPlan({ batchId: 'batch-2026-08-29', records: [exportRecord] }).items[0];
}

test('promotion draft completes canonical PCN intake and keeps stable ids/fingerprint', () => {
  const staging = readyStaging();
  const first = buildPcnHaimyPromotionDraft(staging, input, '2026-08-29T01:00:00.000Z');
  const second = buildPcnHaimyPromotionDraft(staging, { ...input }, '2026-08-29T02:00:00.000Z');

  assert.equal(first.valid, true);
  assert.equal(first.issues.length, 0);
  assert.ok(first.proposal);
  assert.ok(first.dossier);
  assert.equal(validatePcnProposalIntake(first.proposal).valid, true);
  assert.equal(first.proposal?.customerSnapshot.name, exportRecord.customerName);
  assert.equal(first.proposal?.productName, exportRecord.productName);
  assert.deepEqual(first.proposal?.fieldCodes, ['QC4']);
  assert.equal(first.proposal?.status, 'CONVERTED');
  assert.equal(first.dossier?.status, 'INTAKE_REVIEW');
  assert.equal(first.proposal?.dossierId, first.dossier?.id);
  assert.equal(first.dossier?.proposalId, first.proposal?.id);
  assert.equal(first.proposal?.haimyOrigin?.stagingIdempotencyKey, staging.idempotencyKey);
  assert.equal(first.dossier?.haimyOrigin?.batchId, staging.batchId);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.proposal?.id, second.proposal?.id);
  assert.equal(first.dossier?.id, second.dossier?.id);
});

test('promotion draft rejects non-ready staging and incomplete operator completion', () => {
  const staging = readyStaging();
  const notReady = buildPcnHaimyPromotionDraft({ ...staging, status: 'NEEDS_REVIEW' }, input);
  assert.equal(notReady.valid, false);
  assert.ok(notReady.issues.some((issue) => issue.field === 'staging.status'));

  const incomplete = buildPcnHaimyPromotionDraft(staging, { ...input, manufacturer: '' });
  assert.equal(incomplete.valid, false);
  assert.ok(incomplete.issues.some((issue) => issue.field === 'manufacturer'));
  assert.equal(incomplete.proposal, undefined);
  assert.equal(incomplete.dossier, undefined);
});

test('promotion boundary is explicit, transactional, and never an upstream write', () => {
  const route = server.slice(
    server.indexOf("app.post('/api/pcn/integrations/haimy/promote'"),
    server.indexOf("app.post('/api/pcn/quality-documents'"),
  );
  assert.match(route, /requirePcnMutation/);
  assert.match(route, /withPgTransaction/);
  assert.match(route, /FOR UPDATE/);
  assert.match(route, /pcnHaimyStaging/);
  assert.match(route, /certificationProposals/);
  assert.match(route, /certificationDossiers/);
  assert.match(route, /dossierDocuments/);
  assert.match(route, /PROMOTED/);
  assert.match(route, /promotionFingerprint/);
  assert.doesNotMatch(route, /fetch\(|axios|upstream|apiEndpoint|uploadObject/);
  assert.match(view, /Tạo Đề nghị \+ hồ sơ PCN/);
  assert.match(view, /Mở hồ sơ PCN/);
  assert.match(view, /READY_FOR_REVIEW/);
  assert.doesNotMatch(view, /password|apiKey|rawPayload/i);
  assert.match(detail, /Nguồn Haimy/);
  assert.match(detail, /externalRegistrationId/);
  assert.doesNotMatch(detail, /rawPayload|credential/i);
});

// --- End of pcn-haimy-promotion.test.ts ---
