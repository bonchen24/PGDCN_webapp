import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnSampleItem, PcnSampleLot, PcnSampleRoute } from '../types.ts';
import { buildPcnLabDispatchPayload } from '../utils/pcnLabIntegration.ts';
import { buildSampleRequestBundleDraft, buildSampleRequestBundleMappingPreview, validateSampleRequestBundleDraft } from '../utils/pcnSampleRequestBundle.ts';

const customer = { name: 'Công ty A', address: 'Hà Nội', taxId: '010000001', phone: '0900000001' } as const;

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bundle-1',
    parentPycNumber: 'PYC-TONG-001',
    customerSnapshot: customer,
    sourceRefs: [{ kind: 'PROPOSAL', id: 'proposal-1', label: 'DN-001' }],
    fieldCodes: ['QC4'],
    lines: [{
      sampleItemId: 'item-1',
      sampleLotId: 'lot-1',
      dossierId: 'dossier-1',
      lotCode: 'CN 0001-26',
      sampleCode: 'M-EDITED-01',
      sampleType: 'Tủ lạnh',
      model: 'M1',
      brand: 'Brand A',
      quantity: 2,
      unit: 'cái',
      labCodes: ['PERFORMANCE', 'EMC'],
      routeIdsByLab: { PERFORMANCE: ['route-performance'], EMC: ['route-emc'] },
    }],
    ...overrides,
  };
}

test('rejects a bundle that mixes sample lines from different customers', () => {
  const issues = validateSampleRequestBundleDraft(makeInput({
    lines: [
      makeInput().lines[0],
      { ...makeInput().lines[0], sampleItemId: 'item-2', customerSnapshot: { name: 'Công ty B' } },
    ],
  }) as any, { existingLotCodes: [], existingSampleCodes: [] });

  assert.equal(issues.some((issue: any) => issue.code === 'CUSTOMER_MISMATCH'), true);
});

test('rejects duplicate editable lot or sample codes against persisted PCN codes', () => {
  const issues = validateSampleRequestBundleDraft(makeInput() as any, {
    existingLotCodes: ['CN 0001-26'],
    existingSampleCodes: ['M-EDITED-01'],
  });

  assert.equal(issues.some((issue: any) => issue.code === 'DUPLICATE_LOT_CODE'), true);
  assert.equal(issues.some((issue: any) => issue.code === 'DUPLICATE_SAMPLE_CODE'), true);
});

test('builds one draft bundle with independent dispatches for multiple laboratories', () => {
  const bundle = buildSampleRequestBundleDraft({ ...makeInput(), targetDate: '2026-09-30', criteria: 'QCVN 4:2009/BKHCN' } as any, '2026-09-06T01:00:00.000Z');

  assert.equal(bundle.status, 'DRAFT');
  assert.deepEqual(bundle.sampleItemIds, ['item-1']);
  assert.deepEqual(bundle.sampleLotIds, ['lot-1']);
  assert.deepEqual(bundle.dispatches.map((dispatch: any) => dispatch.labCode), ['PERFORMANCE', 'EMC']);
  assert.deepEqual(bundle.dispatches[0].routeIds, ['route-performance']);
  assert.deepEqual(bundle.dispatches[1].routeIds, ['route-emc']);
  assert.equal(bundle.mappingVersion, 'pcn-lab-map-v1');
  assert.equal(bundle.targetDate, '2026-09-30');
  assert.equal(bundle.criteria, 'QCVN 4:2009/BKHCN');
});

test('previews one explicit mapping per laboratory target without mixing DDT branches', () => {
  const preview = buildSampleRequestBundleMappingPreview(makeInput() as any, [
    { id: 'route-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Phòng thử hiệu suất', status: 'PENDING', sequence: 1, sampleItemIds: ['item-1'] },
    { id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 2, sampleItemIds: ['item-1'] },
  ]);

  assert.deepEqual(preview.dispatches.map((dispatch) => [dispatch.labCode, dispatch.targetSystemCode]), [
    ['PERFORMANCE', 'LABFTEE'],
    ['EMC', 'DDT'],
  ]);
  assert.equal(preview.dispatches[0].rows[0].routeStatus, 'Đã gán tuyến');
  assert.equal(preview.dispatches[1].rows[0].values.find((field) => field.key === 'sampleRouteId')?.value, 'route-emc');
  assert.equal(preview.issues.length, 0);
});

test('flags an existing sample line when a selected laboratory has no exact route', () => {
  const preview = buildSampleRequestBundleMappingPreview({
    ...makeInput(),
    lines: [{ ...makeInput().lines[0], routeIdsByLab: { PERFORMANCE: ['route-performance'] } }],
  } as any, [
    { id: 'route-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Phòng thử hiệu suất', status: 'PENDING', sequence: 1, sampleItemIds: ['item-1'] },
  ]);

  assert.equal(preview.issues.some((issue) => issue.code === 'MISSING_ROUTE' && issue.path.includes('EMC')), true);
  assert.equal(preview.dispatches.find((dispatch) => dispatch.labCode === 'EMC')?.rows[0].routeStatus, 'Thiếu tuyến');
});

test('outbound child payload carries bundle and sample identity for exact target mapping', () => {
  const dossier = {
    id: 'dossier-1', dossierCode: 'HS-001', proposalId: 'proposal-1', customerSnapshot: customer,
    fieldCodes: ['QC4'], method: 'METHOD_1', status: 'SENT_TO_LAB', labRequestIds: [], returnedResultIds: [],
  } as CertificationDossier;
  const proposal = { id: 'proposal-1', proposalCode: 'DN-001', customerSnapshot: customer, productName: 'Tủ lạnh', quantity: 2, fieldCodes: ['QC4'], receivedAt: '2026-09-01T00:00:00.000Z', channel: 'DIRECT', status: 'CONVERTED' } as CertificationProposal;
  const lot = { id: 'lot-1', dossierId: 'dossier-1', lotCode: 'CN 0001-26', sampleName: 'Tủ lạnh', quantity: 2, fieldCodes: ['QC4'], routeIds: ['route-emc'], status: 'PREPARED', currentLocation: 'Kho PCN' } as PcnSampleLot;
  const item = { id: 'item-1', sampleLotId: 'lot-1', sampleCode: 'M-EDITED-01', sampleType: 'Tủ lạnh', model: 'M1', quantity: 2 } as PcnSampleItem;
  const route = { id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1, sampleItemIds: ['item-1'] } as PcnSampleRoute;
  const request = { id: 'request-1', pycNumber: 'PYC-TONG-001-EMC', dossierId: 'dossier-1', fieldCode: 'QC4', laboratoryName: 'Phòng thử EMC', sampleLotId: 'lot-1', sampleRouteId: 'route-emc', status: 'DRAFT', requestedAt: '2026-09-06T01:00:00.000Z', bundleId: 'bundle-1', parentPycNumber: 'PYC-TONG-001', mappingVersion: 'pcn-lab-map-v1' } as OutboundLabRequest;

  const payload = buildPcnLabDispatchPayload({ request, lot, sampleItems: [item], route, dossier, proposal, targetSystemCode: 'LABFTEE', messageId: 'message-1', idempotencyKey: 'key-1', initiatedBy: { username: 'admin', name: 'Admin', sourceSystem: 'PCN' } });

  assert.equal(payload.request.bundleId, 'bundle-1');
  assert.equal(payload.request.parentPycNumber, 'PYC-TONG-001');
  assert.equal(payload.request.mappingVersion, 'pcn-lab-map-v1');
  assert.deepEqual(payload.request.pcnSampleItemIds, ['item-1']);
  assert.equal(payload.samples[0].pcnSampleItemId, 'item-1');
  assert.equal(payload.route.pcnRouteId, 'route-emc');
});
