import test from 'node:test';
import assert from 'node:assert/strict';

import { PGD_COLLECTIONS, splitPgdSample, type PgdSample } from '../utils/pgdDomain.ts';

async function loadDossierModule(): Promise<typeof import('../utils/pgdDossier.ts') | null> {
  try {
    return await import('../utils/pgdDossier.ts');
  } catch {
    return null;
  }
}

function completeSample(overrides: Partial<PgdSample> = {}): PgdSample {
  return {
    id: 'sample-retained-1',
    domain: 'pgd',
    requestId: 'request-1',
    sampleCode: 'PGD-0001-R',
    description: 'Thép tấm thử nghiệm',
    quantity: 1,
    unit: 'mẫu',
    disposition: 'RETAINED',
    sealNumber: 'N-0001-R',
    sampleSize: '100 x 100 mm',
    lotQuantity: 100,
    lotUnit: 'tấn',
    sampledAt: '2026-09-02T02:00:00.000Z',
    samplingLocation: 'Kho khách hàng',
    sampledByUsername: 'inspector',
    retainedUntil: '2026-10-02T00:00:00.000Z',
    retentionStatus: 'ACTIVE',
    ...overrides,
  };
}

test('PGD dossier requirements are derived by product group and keep QC20 out of PGD', async () => {
  const dossier = await loadDossierModule();
  assert.ok(dossier, 'utils/pgdDossier.ts must expose the PGD dossier model');
  if (!dossier) return;

  const steel = dossier.getPgdDossierRequirements('STEEL_METAL');
  const steelCodes = steel.map((item) => item.code);
  assert.ok(steelCodes.includes('REQUEST_PYC'));
  assert.ok(steelCodes.includes('COMMERCIAL_INVOICE'));
  assert.ok(steelCodes.includes('PACKING_LIST'));
  assert.ok(steelCodes.includes('BILL_OF_LADING'));
  assert.ok(steelCodes.includes('CUSTOMS_DECLARATION'));
  assert.ok(steelCodes.includes('FIELD_INSPECTION_MINUTES'));
  assert.ok(steelCodes.includes('SAMPLE_HANDOVER_LAB'));
  assert.ok(steelCodes.includes('LAB_RESULT'));
  assert.ok(steelCodes.includes('INSPECTION_CERTIFICATE'));
  assert.equal(steel.some((item) => /QC20/i.test(JSON.stringify(item))), false);

  const machinery = dossier.getPgdDossierRequirements('MACHINERY_LINE');
  assert.ok(machinery.some((item) => item.code === 'MACHINERY_TECHNICAL_DOSSIER'));
  assert.ok(machinery.some((item) => item.code === 'FIELD_INSPECTION_MINUTES'));
  assert.ok(machinery.some((item) => item.code === 'COMMERCIAL_INVOICE'));
  assert.ok(machinery.some((item) => item.code === 'CUSTOMS_DECLARATION'));
  assert.equal(new Set(machinery.map((item) => item.code)).size, machinery.length);
  assert.equal(machinery.every((item) => item.domain === 'pgd'), true);

  const coal = dossier.getPgdDossierRequirements('COAL');
  assert.ok(coal.some((item) => item.code === 'SAMPLE_HANDOVER_LAB'));
  assert.ok(coal.some((item) => item.code === 'LAB_RESULT'));
  assert.equal(new Set(coal.map((item) => item.code)).size, coal.length);
});

test('PGD dossier checklist covers source-derived commercial, plan, report and decision evidence with station gates', async () => {
  const dossier = await loadDossierModule();
  assert.ok(dossier, 'utils/pgdDossier.ts must expose dossier helpers');
  if (!dossier) return;
  const requirements = dossier.getPgdDossierRequirements('MACHINERY_LINE');
  const codes = requirements.map((requirement) => requirement.code);
  for (const code of ['CERTIFICATE_OF_ORIGIN', 'INSPECTION_PLAN', 'INSPECTION_REPORT', 'DECISION']) {
    assert.ok(codes.includes(code), `checklist must include ${code}`);
  }
  assert.equal(dossier.getPgdDossierRequirementStationKey('INSPECTION_PLAN'), 'PREPARATION');
  assert.equal(dossier.getPgdDossierRequirementStationKey('FIELD_INSPECTION_MINUTES'), 'FIELD_SAMPLING');
  assert.equal(dossier.getPgdDossierRequirementStationKey('LAB_RESULT'), 'LAB_RESULTS');
  assert.equal(dossier.getPgdDossierRequirementStationKey('DECISION'), 'REPORT_APPROVAL_RETURN');
});

test('PGD dossier document records require PGD provenance and immutable version metadata', async () => {
  const dossier = await loadDossierModule();
  assert.ok(dossier, 'utils/pgdDossier.ts must expose the PGD dossier model');
  if (!dossier) return;

  const valid = dossier.buildPgdDossierDocument({
    id: 'pgd-dossier-doc-1',
    requestId: 'request-1',
    requirementCode: 'REQUEST_PYC',
    title: 'Phiếu yêu cầu giám định',
    fileName: 'pyc.pdf',
    version: 1,
    checksum: 'a'.repeat(64),
    uploadedByUsername: 'inspector',
    documentNumber: 'INV-01',
    documentDate: '2026-09-01',
    note: 'Bản scan do khách hàng cung cấp',
  } as any, '2026-09-02T03:00:00.000Z');
  assert.equal(valid.domain, 'pgd');
  assert.equal(valid.sourceCollection, PGD_COLLECTIONS.dossierDocuments);
  assert.equal(valid.sourceDocumentId, valid.id);
  assert.equal(valid.version, 1);
  const documentMetadata = valid as typeof valid & { documentNumber?: string; documentDate?: string; note?: string };
  assert.equal(documentMetadata.documentNumber, 'INV-01');
  assert.equal(documentMetadata.documentDate, '2026-09-01');
  assert.equal(documentMetadata.note, 'Bản scan do khách hàng cung cấp');
  assert.throws(() => dossier.buildPgdDossierDocument({
    ...valid,
    id: 'pcn-doc',
    sourceCollection: 'dossierDocuments',
    sourceDocumentId: 'pcn-doc',
  } as any), /PGD|provenance|collection/i);
});

test('PGD sample register separates lab and retained samples and validates seals and quantities', async () => {
  const dossier = await loadDossierModule();
  assert.ok(dossier, 'utils/pgdDossier.ts must expose sample lifecycle helpers');
  if (!dossier) return;

  const split = splitPgdSample({ requestId: 'request-1', sampleCodePrefix: 'PGD-0001', description: 'Thép tấm', quantity: 4, unit: 'mẫu' }, '2026-09-02T02:00:00.000Z');
  assert.equal(split.lab.sealNumber?.length ? true : false, true);
  assert.equal(split.retained.sealNumber?.length ? true : false, true);
  assert.deepEqual(dossier.buildPgdSampleRegister([split.lab, split.retained]).counts, { lab: 1, retained: 1, destroyed: 0 });
  assert.deepEqual(dossier.validatePgdSample(completeSample()), []);
  assert.match(dossier.validatePgdSample(completeSample({ sealNumber: '', quantity: 0 })).map((issue) => issue.message).join(' '), /niêm phong|số lượng/i);
});

test('PGD retained sample destruction is explicit, date-gated and never a hard delete', async () => {
  const dossier = await loadDossierModule();
  assert.ok(dossier, 'utils/pgdDossier.ts must expose sample lifecycle helpers');
  if (!dossier) return;

  const sample = completeSample();
  assert.throws(() => dossier.markPgdSampleDestroyed(sample, 'manager', 'Hủy mẫu', '2026-09-15T00:00:00.000Z'), /hạn lưu/i);
  const destroyed = dossier.markPgdSampleDestroyed(sample, 'manager', 'Đã hết thời hạn lưu', '2026-10-03T00:00:00.000Z');
  assert.equal(destroyed.retentionStatus, 'DESTROYED');
  assert.equal(destroyed.destroyedByUsername, 'manager');
  assert.equal(destroyed.destructionNote, 'Đã hết thời hạn lưu');
  assert.equal(destroyed.id, sample.id);
  assert.throws(() => dossier.markPgdSampleDestroyed({ ...sample, disposition: 'LAB' }, 'manager', 'Hủy', '2026-10-03T00:00:00.000Z'), /mẫu lưu/i);
  assert.throws(() => dossier.markPgdSampleDestroyed(destroyed, 'manager', 'Hủy lần hai', '2026-10-04T00:00:00.000Z'), /đã hủy/i);
});
