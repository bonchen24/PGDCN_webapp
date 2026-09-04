import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PGD_CATALOG,
  validatePgdIntake,
  type PgdProductGroup,
  type PgdInspectionRequestInput,
} from '../utils/pgdDomain.ts';
import { getPgdDossierRequirementStationKey, getPgdDossierRequirements } from '../utils/pgdDossier.ts';
import * as documentTemplates from '../utils/pgdDocumentTemplates.ts';

const baseInput: PgdInspectionRequestInput = {
  id: 'pgd-specific-1',
  requestCode: 'PGD-2026-SPECIFIC-1',
  intakeChannel: 'EMAIL',
  requester: { name: 'Công ty mẫu' },
  customerSnapshot: { name: 'Công ty mẫu', address: 'Hà Nội' },
  productGroup: 'MACHINERY_LINE',
  catalogItemId: 'MACHINERY_LINE_INSPECTION',
  productName: 'Máy đóng gói',
  quantity: 1,
  unit: 'máy',
  inspectionScope: 'Kiểm tra tình trạng, thông số và tính đồng bộ.',
  inspectionLocation: 'Nhà máy khách hàng',
  standards: ['Hồ sơ kỹ thuật', 'Tiêu chuẩn hợp đồng'],
  method: 'QT-GĐ-07',
};

test('PGD requires machinery-specific identity and condition data for a used-machine request', () => {
  const missing = validatePgdIntake(baseInput);
  assert.deepEqual(missing.map((issue) => issue.field), [
    'productDetails.machinery.machineType',
    'productDetails.machinery.model',
    'productDetails.machinery.serialNumber',
    'productDetails.machinery.manufacturingYear',
    'productDetails.machinery.condition',
    'productDetails.machinery.technicalParameters',
  ]);

  const valid = validatePgdIntake({
    ...baseInput,
    productDetails: {
      machinery: {
        machineType: 'Máy đóng gói tự động',
        model: 'PKG-900',
        serialNumber: 'SN-900-01',
        manufacturingYear: 2022,
        condition: 'Đã qua sử dụng, vận hành thử bình thường',
        technicalParameters: 'Công suất 15 kW; năng suất 900 sản phẩm/giờ',
      },
    },
  });
  assert.deepEqual(valid, []);
});

test('PGD requires synchronization evidence when a machinery request uses the line-synchronization procedure', () => {
  const issues = validatePgdIntake({
    ...baseInput,
    method: 'QT-GĐ-12',
    productDetails: {
      machinery: {
        machineType: 'Dây chuyền đóng gói',
        model: 'LINE-01',
        serialNumber: 'LINE-SN-01',
        manufacturingYear: 2023,
        condition: 'Đang vận hành',
        technicalParameters: 'Năng suất 1.000 sản phẩm/giờ',
      },
    },
  });
  assert.deepEqual(issues.map((issue) => issue.field), ['productDetails.machinery.synchronization']);
});

test('PGD requires coal source and quality data for the coal quality procedure', () => {
  const coal: PgdInspectionRequestInput = {
    ...baseInput,
    id: 'pgd-coal-specific-1',
    requestCode: 'PGD-2026-COAL-1',
    productGroup: 'COAL',
    catalogItemId: 'COAL_LOT_INSPECTION',
    productName: 'Than cục 4b',
    quantity: 1000,
    unit: 'tấn',
    method: 'QT-GĐ-08',
  };
  assert.deepEqual(validatePgdIntake(coal).map((issue) => issue.field), [
    'productDetails.coal.coalType',
    'productDetails.coal.source',
    'productDetails.coal.qualityStandard',
    'productDetails.coal.samplingBasis',
  ]);

  const valid = validatePgdIntake({
    ...coal,
    productDetails: {
      coal: {
        coalType: 'Than cục 4b',
        source: 'Mỏ Mạo Khê - TKV',
        qualityStandard: 'TCVN 8910:2015',
        samplingBasis: 'Lấy mẫu đại diện theo lô và toa xe.',
        sizeRange: '6–25 mm',
      },
    },
  });
  assert.deepEqual(valid, []);
});

test('PGD checklists and document cells expose the correct fields for machinery and coal without steel leakage', () => {
  const machineryCodes = getPgdDossierRequirements('MACHINERY_LINE').map((item) => item.code);
  const coalCodes = getPgdDossierRequirements('COAL').map((item) => item.code);
  assert.ok(machineryCodes.includes('MACHINERY_TECHNICAL_DOSSIER'));
  assert.ok(machineryCodes.includes('MACHINERY_CONDITION_ASSESSMENT'));
  assert.ok(machineryCodes.includes('MACHINERY_SYNCHRONIZATION_ASSESSMENT'));
  assert.equal(getPgdDossierRequirementStationKey('MACHINERY_TECHNICAL_DOSSIER'), 'PREPARATION');
  assert.equal(getPgdDossierRequirementStationKey('MACHINERY_CONDITION_ASSESSMENT'), 'FIELD_SAMPLING');
  assert.ok(coalCodes.includes('COAL_TECHNICAL_OVERVIEW'));
  assert.ok(coalCodes.includes('COAL_QUALITY_SPECIFICATION'));
  assert.equal(getPgdDossierRequirementStationKey('COAL_TECHNICAL_OVERVIEW'), 'PREPARATION');

  const intakeTemplate = documentTemplates.getPgdDocumentTemplate('INTAKE_REQUEST', 'MACHINERY_LINE')!;
  const scopeTemplateCells = (documentTemplates as typeof documentTemplates & {
    getPgdTemplateCellsForProductGroup?: (template: documentTemplates.PgdDocumentTemplate, productGroup: PgdProductGroup) => documentTemplates.PgdTemplateCell[];
  }).getPgdTemplateCellsForProductGroup;
  assert.equal(typeof scopeTemplateCells, 'function');
  const machineryKeys = scopeTemplateCells!(intakeTemplate, 'MACHINERY_LINE').map((cell) => cell.key);
  assert.ok(machineryKeys.includes('machineryModel'));
  assert.ok(machineryKeys.includes('machineryCondition'));
  assert.equal(machineryKeys.includes('coalType'), false);

  const coalTemplate = documentTemplates.getPgdDocumentTemplate('INTAKE_REQUEST', 'COAL')!;
  const coalKeys = scopeTemplateCells!(coalTemplate, 'COAL').map((cell) => cell.key);
  assert.ok(coalKeys.includes('coalType'));
  assert.ok(coalKeys.includes('coalQualityStandard'));
  assert.equal(coalKeys.includes('machineryModel'), false);
  assert.equal(DEFAULT_PGD_CATALOG.find((item) => item.id === 'MACHINERY_LINE_INSPECTION')?.code, 'GĐ-MAY-01');
  assert.equal(DEFAULT_PGD_CATALOG.find((item) => item.id === 'COAL_LOT_INSPECTION')?.code, 'GĐ-THAN-01');
});
