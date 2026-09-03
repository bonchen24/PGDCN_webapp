import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnDossierTemplateAuthoringProfiles, getPcnDossierTemplateProfiles } from '../utils/pcnDossierTemplateCatalog.ts';

test('catalogs blank QC4 and QC9 dossier packs from the controlled checklist', () => {
  const profiles = getPcnDossierTemplateAuthoringProfiles();
  assert.deepEqual(profiles.map((profile) => profile.fieldCode), ['QC4', 'QC9']);
  for (const profile of profiles) {
    assert.equal(profile.isBlank, true);
    assert.match(profile.sourceBasis, /06.?07\/2026/);
    assert.ok(profile.stageGroups.flatMap((group) => group.requirements).length > 0);
    assert.deepEqual(profile.officialOutputs, ['CERTIFICATE', 'DECISION']);
    assert.ok(profile.sourceFormReferences.length >= 5);
    const expectedKinds = profile.fieldCode === 'QC9'
      ? ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'LAB_REQUEST']
      : ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'LAB_REQUEST'];
    assert.deepEqual(profile.generatedKinds, expectedKinds);
  }
});

test('catalog filters runtime checklist requirements to the selected field', () => {
  const profiles = getPcnDossierTemplateProfiles([
    { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'QC4 proposal', stages: ['INTAKE'], required: true, active: true, sortOrder: 10 },
    { id: 'QC9-PROPOSAL', fieldCode: 'QC9', code: 'PROPOSAL', name: 'QC9 proposal', stages: ['INTAKE'], required: true, active: true, sortOrder: 10 },
  ]);
  assert.deepEqual(profiles.map((profile) => profile.fieldCode), ['QC4', 'QC9']);
  assert.deepEqual(profiles.find((profile) => profile.fieldCode === 'QC4')?.stageGroups[0].requirements.map((item) => item.id), ['QC4-PROPOSAL']);
  assert.deepEqual(profiles.find((profile) => profile.fieldCode === 'QC9')?.stageGroups[0].requirements.map((item) => item.id), ['QC9-PROPOSAL']);
});

test('authoring metadata maps every blank-pack requirement to the observed PCN source form', () => {
  const profiles = getPcnDossierTemplateAuthoringProfiles();
  for (const profile of profiles) {
    const requirementCodes = new Set(profile.stageGroups.flatMap((group) => group.requirements.map((requirement) => requirement.code)));
    const mappings = new Map(profile.sourceMappings.map((mapping) => [mapping.requirementCode, mapping]));
    for (const code of requirementCodes) {
      const mapping = mappings.get(code);
      assert.ok(mapping, `${profile.fieldCode}:${code} chưa có nguồn đối chiếu`);
      assert.ok(mapping.references.length > 0, `${profile.fieldCode}:${code} chưa có tên nguồn`);
    }
  }
});

test('PCN settings exposes only the active field packs without importing dossier data', () => {
  const settingsView = fs.readFileSync(new URL('../components/PcnSettingsView.tsx', import.meta.url), 'utf8');
  assert.match(settingsView, /Khung checklist theo QC4\/QC9/);
  assert.match(settingsView, /getPcnDossierTemplateProfiles/);
  assert.match(settingsView, /Mẫu trống/);
  assert.doesNotMatch(settingsView, /QC20|sourceFormReferences|sourceMappings|customerName|taxId|phone/);
  assert.match(settingsView, /không đọc, theo dõi hoặc hiển thị đường dẫn thư mục nghiên cứu/);
});
