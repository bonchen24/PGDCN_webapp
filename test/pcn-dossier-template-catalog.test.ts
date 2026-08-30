import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnDossierTemplateProfiles } from '../utils/pcnDossierTemplateCatalog.ts';

test('catalogs blank QC4 and QC9 dossier packs from the controlled checklist', () => {
  const profiles = getPcnDossierTemplateProfiles();

  assert.deepEqual(profiles.map((profile) => profile.fieldCode), ['QC4', 'QC9']);
  for (const profile of profiles) {
    assert.equal(profile.isBlank, true);
    assert.match(profile.sourceBasis, /06.?07\/2026/);
    const expectedCodes = profile.fieldCode === 'QC4'
      ? ['PROPOSAL', 'COMMERCIAL', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'TEST_REPORT', 'CERTIFICATION_RESULT', 'CERTIFICATE', 'DECISION', 'CLIENT_PACKAGE', 'ARCHIVE_SCAN']
      : ['PROPOSAL', 'COMMERCIAL', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'TEST_REPORT', 'EXTENSION_LETTER', 'CORRECTIVE_ACTION_LETTER', 'FAILURE_LETTER', 'CERTIFICATE', 'DECISION', 'CLIENT_PACKAGE', 'ARCHIVE_SCAN'];
    assert.deepEqual(
      profile.stageGroups.flatMap((group) => group.requirements.map((requirement) => requirement.code)),
      expectedCodes,
    );
    const expectedStationCodes = profile.fieldCode === 'QC4'
      ? [
        ['INTAKE', ['PROPOSAL', 'COMMERCIAL']],
        ['DOCUMENTS', ['PROPOSAL', 'COMMERCIAL']],
        ['ASSIGNMENT', ['ASSIGNMENT_FORM']],
        ['EVALUATION', ['EVALUATION_PLAN', 'FIELD_INSPECTION']],
        ['SAMPLING_LAB', ['LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER']],
        ['RESULTS', ['TEST_REPORT']],
        ['TECHNICAL_REVIEW', ['TEST_REPORT', 'CERTIFICATION_RESULT']],
        ['APPROVAL', ['CERTIFICATE', 'DECISION']],
        ['ISSUANCE', ['CERTIFICATE', 'DECISION']],
        ['DELIVERY_ARCHIVE', ['CLIENT_PACKAGE', 'ARCHIVE_SCAN']],
      ]
      : [
        ['INTAKE', ['PROPOSAL', 'COMMERCIAL']],
        ['DOCUMENTS', ['PROPOSAL', 'COMMERCIAL']],
        ['ASSIGNMENT', ['ASSIGNMENT_FORM']],
        ['EVALUATION', ['EVALUATION_PLAN', 'FIELD_INSPECTION']],
        ['SAMPLING_LAB', ['LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN']],
        ['RESULTS', ['TEST_REPORT']],
        ['CORRECTION', ['EXTENSION_LETTER', 'CORRECTIVE_ACTION_LETTER', 'FAILURE_LETTER']],
        ['TECHNICAL_REVIEW', ['TEST_REPORT']],
        ['APPROVAL', ['CERTIFICATE', 'DECISION']],
        ['ISSUANCE', ['CERTIFICATE', 'DECISION']],
        ['DELIVERY_ARCHIVE', ['CLIENT_PACKAGE', 'ARCHIVE_SCAN']],
      ];
    assert.deepEqual(
      profile.stationGroups.map((group) => [group.key, group.requirements.map((requirement) => requirement.code)]),
      expectedStationCodes,
    );
    assert.deepEqual(profile.generatedKinds, profile.fieldCode === 'QC9'
      ? ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'LAB_REQUEST']
      : ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'LAB_REQUEST']);
    assert.deepEqual(profile.officialOutputs, ['CERTIFICATE', 'DECISION']);
    assert.ok(profile.sourceFormReferences.length >= 5);
    assert.match(profile.sourceFormReferences.join(' '), /BM-QT-09-0[2345]/);
  }
});

test('catalog filters runtime checklist requirements to the selected field', () => {
  const profiles = getPcnDossierTemplateProfiles([
    { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'QC4 proposal', stages: ['INTAKE'], required: true, active: true, sortOrder: 10 },
    { id: 'QC9-PROPOSAL', fieldCode: 'QC9', code: 'PROPOSAL', name: 'QC9 proposal', stages: ['INTAKE'], required: true, active: true, sortOrder: 10 },
  ]);

  assert.deepEqual(profiles.find((profile) => profile.fieldCode === 'QC4')?.stageGroups[0].requirements.map((item) => item.id), ['QC4-PROPOSAL']);
  assert.deepEqual(profiles.find((profile) => profile.fieldCode === 'QC9')?.stageGroups[0].requirements.map((item) => item.id), ['QC9-PROPOSAL']);
});

test('maps every blank-pack requirement to the observed PCN source form or source folder', () => {
  const profiles = getPcnDossierTemplateProfiles();

  for (const profile of profiles) {
    const requirementCodes = new Set(profile.stageGroups.flatMap((group) => group.requirements.map((requirement) => requirement.code)));
    const mappings = new Map(profile.sourceMappings.map((mapping) => [mapping.requirementCode, mapping]));

    for (const code of requirementCodes) {
      const mapping = mappings.get(code);
      assert.ok(mapping, `${profile.fieldCode}:${code} chưa có nguồn đối chiếu`);
      assert.ok(mapping.references.length > 0, `${profile.fieldCode}:${code} chưa có tên nguồn`);
    }
  }

  const qc4 = profiles.find((profile) => profile.fieldCode === 'QC4')!;
  assert.deepEqual(qc4.sourceMappings.find((mapping) => mapping.requirementCode === 'ASSIGNMENT_FORM')?.references, [
    '1. BM-QT-09-12 PHIẾU PHÂN CÔNG CHUNG NHAN.doc',
  ]);
  assert.match(qc4.sourceMappings.find((mapping) => mapping.requirementCode === 'CERTIFICATE')?.references.join(' ') || '', /BM-QĐ-03-03a/);

  const qc9 = profiles.find((profile) => profile.fieldCode === 'QC9')!;
  assert.match(qc9.sourceMappings.find((mapping) => mapping.requirementCode === 'TEST_REPORT')?.references.join(' ') || '', /BM-QT-09-05/);
  assert.match(qc9.sourceMappings.find((mapping) => mapping.requirementCode === 'SAMPLE_RETURN')?.note || '', /chưa thấy|sinh nội bộ/i);
});

test('exposes the blank packs in the PCN template module without importing dossier data', () => {
  const managementView = fs.readFileSync(new URL('../components/PcnTemplateManagementView.tsx', import.meta.url), 'utf8');

  assert.match(managementView, /Bộ hồ sơ mẫu trống/);
  assert.match(managementView, /getPcnDossierTemplateProfiles/);
  assert.match(managementView, /Mẫu trống/);
  assert.match(managementView, /Kiểm tra toàn bộ nguồn/);
  assert.match(managementView, /Đầu ra chính thức/);
  assert.match(managementView, /Tên biểu mẫu nguồn đã đối chiếu/);
  assert.match(managementView, /sourceFormReferences/);
  assert.match(managementView, /sourceMappings/);
  assert.match(managementView, /PCN nguồn/);
  assert.match(managementView, /stationGroups/);
  assert.match(managementView, /Dùng lại/);
  assert.match(managementView, /không tạo hoặc tải lên tài liệu mới/);
  assert.match(managementView, /usePcnStore\(\(state\) => state\.documentRequirements\)/);
  assert.doesNotMatch(managementView, /customerName|taxId|phone|sourceRoot.*customers/);
});

test('workspace passes the active PCN checklist into the template module', () => {
  const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

  assert.match(workspace, /<PcnTemplateManagementView[\s\S]{0,500}documentRequirements=\{pcn\.documentRequirements\}/);
});
