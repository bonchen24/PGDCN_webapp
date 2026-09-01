import assert from 'node:assert/strict';
import test from 'node:test';

import { PCN_STANDARD_DOSSIER_FIXTURES } from '../utils/pcnStandardDossierFlow.ts';
import {
  PCN_STANDARD_SEED_NAMESPACE,
  buildPcnStandardDossierSeedPlan,
  type PcnStandardSeedSourceFile,
} from '../utils/pcnStandardDossierSeed.ts';

function sourceFilesForFixture(fixture: (typeof PCN_STANDARD_DOSSIER_FIXTURES)[number]): PcnStandardSeedSourceFile[] {
  const names = new Set([
    ...Object.values(fixture.sourceFiles).flat(),
    ...fixture.labArtifacts.map((artifact) => artifact.sourceFileName),
  ]);
  return [...names].map((fileName, index) => ({
    sourceFileName: fileName,
    sourceRelativePath: `source/${index}/${fileName}`,
    absolutePath: `C:\\Users\\HungX\\Desktop\\PCN\\${fileName}`,
    mimeType: fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    byteSize: 100 + index,
    sha256: `${String(index + 1).padStart(64, '0')}`,
  }));
}

test('standard dossier seed is add-only, namespaced and preserves the source files as private pointers', () => {
  for (const fixture of PCN_STANDARD_DOSSIER_FIXTURES) {
    const plan = buildPcnStandardDossierSeedPlan(fixture, sourceFilesForFixture(fixture));
    assert.equal(plan.namespace, PCN_STANDARD_SEED_NAMESPACE);
    assert.ok(plan.records.length > 0);
    assert.ok(plan.assets.length > 0);
    assert.ok(plan.records.every((record) => record.action === 'INSERT_OR_VERIFY'));
    assert.equal(plan.destructiveOperations.length, 0);
    assert.ok(plan.assets.every((asset) => asset.objectPath.startsWith(`${PCN_STANDARD_SEED_NAMESPACE}/`)));
    assert.ok(plan.assets.every((asset) => /^pcn-file-[a-z0-9-]+$/.test(asset.assetId)));
    assert.ok(!JSON.stringify(plan.records).includes('historicalImport'));
    assert.ok(!JSON.stringify(plan.records).includes('Desktop'));
  }
});

test('standard dossier seed leaves visible checkpoints for manual UI flow inspection', () => {
  const qc4 = PCN_STANDARD_DOSSIER_FIXTURES.find((fixture) => fixture.fieldCode === 'QC4');
  const qc9 = PCN_STANDARD_DOSSIER_FIXTURES.find((fixture) => fixture.fieldCode === 'QC9');
  assert.ok(qc4);
  assert.ok(qc9);

  const qc4Plan = buildPcnStandardDossierSeedPlan(qc4, sourceFilesForFixture(qc4));
  const qc9Plan = buildPcnStandardDossierSeedPlan(qc9, sourceFilesForFixture(qc9));
  assert.equal(qc4Plan.dossier.status, 'TECHNICAL_REVIEW');
  assert.equal(qc4Plan.issuance, undefined);
  assert.equal(qc9Plan.dossier.status, 'WAITING_APPROVAL');
  assert.equal(qc9Plan.issuance?.status, 'PENDING_APPROVAL');
  assert.ok(qc9Plan.approvalSteps.every((step) => step.status === 'PENDING'));
  assert.equal(new Set(qc9Plan.labRequests.map((request) => request.pycNumber.toLocaleLowerCase('vi-VN'))).size, qc9Plan.labRequests.length);
  assert.ok(qc9Plan.labRequests.some((request) => request.pycNumber.startsWith('PYC 1739')));
  assert.deepEqual(qc9Plan.waivedRequirementIds, [
    'QC9-ASSIGNMENT_FORM',
    'QC9-COMMERCIAL',
    'QC9-EVALUATION_PLAN',
    'QC9-FIELD_INSPECTION',
  ]);
});

test('standard dossier seed is deterministic so retry can verify rather than overwrite existing records', () => {
  const fixture = PCN_STANDARD_DOSSIER_FIXTURES[0];
  const sourceFiles = sourceFilesForFixture(fixture);
  const first = buildPcnStandardDossierSeedPlan(fixture, sourceFiles);
  const second = buildPcnStandardDossierSeedPlan(fixture, sourceFiles);
  assert.deepEqual(first.records, second.records);
  assert.deepEqual(first.assets, second.assets);
});
