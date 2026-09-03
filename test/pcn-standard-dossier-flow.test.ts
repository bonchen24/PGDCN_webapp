import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PCN_STANDARD_DOSSIER_FIXTURES,
  buildPcnStandardDossierFlow,
} from '../utils/pcnStandardDossierFlow.ts';

test('standard PCN dossiers cover one complete QC4 flow and one waiver-aware QC9 flow', () => {
  assert.equal(PCN_STANDARD_DOSSIER_FIXTURES.length, 2);
  assert.deepEqual(
    PCN_STANDARD_DOSSIER_FIXTURES.map((fixture) => ({ code: fixture.dossierCode, fieldCode: fixture.fieldCode, method: fixture.method })),
    [
      { code: 'IEMM.26/HQA/0583.2A-SP', fieldCode: 'QC4', method: 'METHOD_7' },
      { code: 'IEMM.26/EMC/0499-SP-19', fieldCode: 'QC9', method: 'METHOD_1' },
    ],
  );

  for (const fixture of PCN_STANDARD_DOSSIER_FIXTURES) {
    const result = buildPcnStandardDossierFlow(fixture);
    assert.deepEqual(result.stageKeys, ['INTAKE', 'SAMPLING_LAB', 'RESULTS', 'TECHNICAL_REVIEW', 'APPROVAL']);
    assert.equal(result.dossier.status, 'ARCHIVED');
    assert.equal(result.issuance.status, 'ARCHIVED');
    assert.equal(result.sampleLot.status, 'CLOSED');
    assert.equal(result.sampleRoutes.every((route) => route.status === 'CLOSED'), true);
    assert.equal(result.returnedResults.every((item) => item.ocrEvidence?.sourceFileName), true);
    assert.equal(result.returnedResults.some((item) => item.isOfficial && item.outcome === 'PASS'), true);
    assert.equal(result.stageGates.every((gate) => gate.complete), true);
  }
});

test('the QC9 source gap is represented by an explicit waiver, never by silently passing the gate', () => {
  const fixture = PCN_STANDARD_DOSSIER_FIXTURES.find((item) => item.fieldCode === 'QC9');
  assert.ok(fixture);
  const result = buildPcnStandardDossierFlow(fixture);
  assert.deepEqual(result.waivedRequirementIds, [
    'QC9-ASSIGNMENT_FORM',
    'QC9-COMMERCIAL',
    'QC9-EVALUATION_PLAN',
    'QC9-FIELD_INSPECTION',
  ]);
  assert.equal(result.waivers['QC9-COMMERCIAL'], fixture.waivers['QC9-COMMERCIAL']);
  assert.equal(result.stageGates[0]?.waivedCount, 4);
});

test('standard dossier fixture keeps the PCN intake term and does not promote DDT source wording', () => {
  for (const fixture of PCN_STANDARD_DOSSIER_FIXTURES) {
    assert.equal(fixture.proposal.status, 'RECEIVED');
    assert.equal(fixture.proposal.channel, 'DIRECT');
    assert.doesNotMatch(fixture.sourceLabel, /DDT|Giám định|Haimy/i);
    assert.equal(fixture.intakeLabel, 'Đề nghị');
    assert.equal(fixture.outboundRequestLabel, 'PYC gửi phòng thử nghiệm');
  }
});

// --- End of pcn-standard-dossier-flow.test.ts ---
