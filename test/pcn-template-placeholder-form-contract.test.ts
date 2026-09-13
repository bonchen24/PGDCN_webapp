import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';
import { getPcnOperationalTemplateForKind, PCN_OPERATIONAL_TEMPLATE_CATALOG } from '../utils/pcnOperationalTemplateCatalog.ts';
import { getPcnDraftFieldDefinitions, getPcnDraftFieldSection } from '../utils/pcnDrafting.ts';
import type { PcnDraftFormKind } from '../types.ts';

const templateRoot = path.resolve('templates/pcn');

const formContracts: Array<{ kind: PcnDraftFormKind; keys: string[] }> = [
  { kind: 'PROPOSAL_FORM', keys: ['ma_ho_so', 'field_code', 'method_label', 'nguoi_lien_he', 'dien_thoai', 'email', 'dia_chi_kho', 'ghi_chu'] },
  { kind: 'ASSIGNMENT_FORM', keys: ['ma_ho_so', 'field_code', 'method_label', 'ngay_phan_cong', 'nguoi_giao', 'ghi_chu'] },
  { kind: 'EVALUATION_PLAN', keys: ['ma_ho_so', 'field_code', 'ngay_ket_thuc', 'dia_diem_lap', 'nguoi_lien_he', 'ghi_chu'] },
  { kind: 'FIELD_INSPECTION', keys: ['ma_ho_so', 'field_code', 'ngay_kiem_tra', 'dia_diem_lap', 'ket_luan', 'ghi_chu'] },
  { kind: 'SAMPLE_TAKING', keys: ['ma_ho_so', 'field_code', 'method_label', 'dia_diem_lap', 'ket_luan'] },
  { kind: 'SAMPLE_CODING', keys: ['ma_ho_so', 'field_code', 'method_label', 'ghi_chu'] },
  { kind: 'SAMPLE_HANDOVER', keys: ['ma_ho_so', 'field_code', 'method_label', 'ghi_chu', 'dia_chi_ct'] },
  { kind: 'LAB_REQUEST', keys: ['ma_ho_so', 'method_label', 'dia_chi_kho'] },
  { kind: 'EVALUATION_REPORT', keys: ['ma_ho_so', 'field_code', 'method_label', 'dia_chi_ct', 'nguoi_danh_gia', 'ket_luan', 'ghi_chu'] },
  { kind: 'CERTIFICATION_RESULT', keys: ['ma_ho_so', 'field_code', 'dia_chi_ct', 'ngay_lap', 'ghi_chu'] },
  { kind: 'CLIENT_PACKAGE', keys: ['ma_ho_so', 'field_code', 'loai_sp', 'dia_chi_ct'] },
  { kind: 'COMMERCIAL', keys: ['ma_ho_so', 'so_dang_ky', 'ghi_chu'] },
  { kind: 'DOSSIER_COVER', keys: ['ma_ho_so', 'method_label', 'dia_chi_ct', 'ghi_chu'] },
];

const templateByKind: Record<PcnDraftFormKind, string> = {
  PROPOSAL_FORM: 'PROPOSAL_FORM',
  DOSSIER_COVER: 'DOSSIER_COVER',
  ASSIGNMENT_FORM: 'ASSIGNMENT_FORM',
  EVALUATION_PLAN: 'EVALUATION_PLAN',
  FIELD_INSPECTION: 'FIELD_INSPECTION',
  SAMPLE_TAKING: 'SAMPLE_TAKING',
  SAMPLE_CODING: 'SAMPLE_CODING',
  SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
  LAB_REQUEST: 'LAB_REQUEST',
  EVALUATION_REPORT: 'EVALUATION_REPORT',
  CERTIFICATION_RESULT: 'CERTIFICATION_RESULT',
  COMMERCIAL: 'COMMERCIAL',
  CLIENT_PACKAGE: 'CLIENT_PACKAGE',
};

test('PCN operational placeholders are exposed by the matching input form', () => {
  for (const contract of formContracts) {
    const template = getPcnOperationalTemplateForKind(templateByKind[contract.kind] as never);
    assert.ok(template, `${contract.kind} catalog entry is missing`);
    const keys = new Set(extractPcnTemplatePlaceholderKeys(fs.readFileSync(path.join(templateRoot, template!.fileName))));
    const formKeys = new Set(getPcnDraftFieldDefinitions(contract.kind).map((field) => field.key));
    for (const key of contract.keys) {
      assert.ok(keys.has(key), `${contract.kind} DOCX is missing [[${key}]]`);
      assert.ok(formKeys.has(key), `${contract.kind} input form is missing ${key}`);
    }
  }
});

test('PCN forms expose every required operational placeholder with section metadata', () => {
  const supportedKinds = new Set<PcnDraftFormKind>(formContracts.map((contract) => contract.kind));
  for (const template of PCN_OPERATIONAL_TEMPLATE_CATALOG) {
    if (!supportedKinds.has(template.generationKind as PcnDraftFormKind)) continue;
    const fields = getPcnDraftFieldDefinitions(template.generationKind as PcnDraftFormKind);
    const byKey = new Map(fields.map((field) => [field.key, field]));
    for (const key of template.requiredPlaceholderKeys) {
      const field = byKey.get(key);
      assert.ok(field, `${template.generationKind} input form is missing [[${key}]]`);
      assert.equal(field?.required, true, `${template.generationKind} [[${key}]] must be required`);
      assert.deepEqual(field?.section, getPcnDraftFieldSection(key), `${template.generationKind} [[${key}]] section is not stable`);
    }
  }
  assert.equal(getPcnDraftFieldDefinitions('CERTIFICATION_RESULT').find((field) => field.key === 'ngay_lap')?.type, 'date');
});

test('PCN reference KQTN template receives dossier and model context placeholders', () => {
  const template = getPcnOperationalTemplateForKind('TEST_REPORT');
  assert.ok(template);
  const keys = new Set(extractPcnTemplatePlaceholderKeys(fs.readFileSync(path.join(templateRoot, template!.fileName))));
  for (const key of ['ma_ho_so', 'field_code', 'model', 'ma_mau', 'ghi_chu', 'nguoi_lien_he']) assert.ok(keys.has(key), `TEST_REPORT DOCX is missing [[${key}]]`);
});
