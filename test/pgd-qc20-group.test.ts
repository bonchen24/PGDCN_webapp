import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PGD_CATALOG,
  PGD_GROUP_LABELS,
  PGD_QC20_GROUP_CODE,
  createPgdInspectionRequest,
  getPgdGroupCodeForCatalogItem,
  mergePgdCatalogDefaults,
} from '../utils/pgdDomain.ts';

const intake = {
  id: 'pgd-qc20-request',
  requestCode: 'PGD-260913-20',
  intakeChannel: 'DIRECT' as const,
  requester: { name: 'Công ty A', address: 'Hà Nội', contactPerson: 'Nguyễn Văn A', phone: '0900000000' },
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' },
  productGroup: 'STEEL_METAL' as const,
  catalogItemId: 'STEEL_LOT_INSPECTION',
  productName: 'Thép không gỉ',
  quantity: 1,
  unit: 'lô',
  lotCode: 'LOT-QC20-01',
  inspectionScope: 'Đối chiếu QCVN 20 và lấy mẫu đánh giá.',
  inspectionLocation: 'Kho khách hàng',
  standards: ['QCVN 20:2019/BKHCN', 'Sửa đổi 1:2021 QCVN 20:2019/BKHCN'],
  method: 'QT-GĐ-14',
  assessmentMethod: 'METHOD_7' as const,
  productDetails: {
    productForm: 'Thép cuộn',
    grade: '304',
    dimensions: '1.0 mm',
    productStandard: 'JIS G4305',
    countryOfOrigin: 'Việt Nam',
    manufacturer: 'Nhà máy A',
    importer: 'Công ty A',
    hsCode: '7219.32.00',
    manufacturerLotCode: 'MFG-01',
    lotDefinition: 'PRODUCT_LOT' as const,
    customsDocuments: [{ document: 'Tờ khai hải quan' }],
  },
};

test('QC20 is a PGD group while the routing profile remains GĐ-THEP-KG', () => {
  const steel = DEFAULT_PGD_CATALOG.find((item) => item.id === 'STEEL_LOT_INSPECTION');
  assert.equal(PGD_QC20_GROUP_CODE, 'QC20');
  assert.equal(PGD_GROUP_LABELS[PGD_QC20_GROUP_CODE], 'QC20 · Thép không gỉ / QCVN 20');
  assert.equal(steel?.groupCode, PGD_QC20_GROUP_CODE);
  assert.equal(steel?.code, 'GĐ-THEP-KG');
});

test('PGD request snapshots QC20 separately from the catalog routing profile', () => {
  const request = createPgdInspectionRequest({ ...intake, pgdGroupCode: PGD_QC20_GROUP_CODE });
  assert.equal(request.pgdGroupCode, 'QC20');
  assert.equal(request.catalogItemId, 'STEEL_LOT_INSPECTION');
});

test('legacy PGD catalog rows inherit the QC20 group label from the current baseline', () => {
  const steel = DEFAULT_PGD_CATALOG.find((item) => item.id === 'STEEL_LOT_INSPECTION');
  const legacy = { ...steel };
  delete legacy.groupCode;
  const merged = mergePgdCatalogDefaults([legacy]);
  assert.equal(merged.find((item) => item.id === 'STEEL_LOT_INSPECTION')?.groupCode, 'QC20');
});

test('PGD projections derive QC20 for legacy steel requests that predate the group snapshot', () => {
  assert.equal(getPgdGroupCodeForCatalogItem('STEEL_LOT_INSPECTION'), 'QC20');
  assert.equal(getPgdGroupCodeForCatalogItem('MACHINERY_LINE_INSPECTION'), undefined);
});
