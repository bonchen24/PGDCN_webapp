import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PGD_CATALOG,
  PGD_ASSESSMENT_METHOD_OPTIONS,
  PGD_COLLECTIONS,
  PGD_WORKFLOW_STATES,
  createPgdInspectionRequest,
  getPgdCollectionMutationDenial,
  getPgdDossierDeletionDenial,
  getPgdDossierEditDenial,
  getPgdActiveCatalog,
  isPgdCatalogItemAllowed,
  getPgdApprovalDenial,
  getPgdTransitionDenial,
  getPgdSteelTtlt58SamplingPlan,
  validatePgdAssignment,
  validatePgdInspectors,
  snapshotPgdResultTemplate,
  splitPgdSample,
  buildPgdLabRequest,
  buildPgdLabResult,
  validatePgdIntake,
  validatePgdRegistryMetadata,
  mergePgdCatalogDefaults,
  type PgdInspectionRequest,
  type PgdLabRequest,
  type PgdResultTemplate,
} from '../utils/pgdDomain.ts';

const intake = {
  id: 'pgd-request-1',
  requestCode: 'PGD-2026-0001',
  intakeChannel: 'EMAIL' as const,
  requester: { name: 'Công ty A', address: 'Hà Nội', contactPerson: 'Nguyễn Văn A', phone: '0900000000', email: 'a@example.test' },
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' },
  productGroup: 'STEEL_METAL' as const,
  catalogItemId: 'STEEL_LOT_INSPECTION',
  productName: 'Thép tấm',
  productCode: 'SP-01',
  quantity: 100,
  unit: 'tấn',
  weight: 100,
  weightUnit: 'tấn',
  inspectionScope: 'Ngoại quan, kích thước và lấy mẫu phân tích',
  inspectionLocation: 'Kho khách hàng',
  method: 'TT58' as const,
  assessmentMethod: 'METHOD_7' as const,
  lotCode: 'LOT-2026-001',
  standards: ['QCVN 20:2019/BKHCN', 'Sửa đổi 1:2021 QCVN 20:2019/BKHCN', 'ASTM A36'],
  productDetails: {
    productForm: 'Thép cuộn cán nguội',
    grade: '304',
    dimensions: '1.0 x 1219 mm',
    productStandard: 'JIS G4305',
    origin: 'Việt Nam',
    countryOfOrigin: 'Việt Nam',
    manufacturer: 'Nhà máy A',
    manufacturerLotCode: 'MFG-LOT-001',
    importer: 'Công ty A',
    hsCode: '7219.32.00',
    lotDefinition: 'SHIPMENT_LOT' as const,
    customsDocuments: [{ document: 'Tờ khai hải quan', number: 'HQ-001', date: '2026-09-01' }],
  },
};

function requestWith(status: PgdInspectionRequest['status']): PgdInspectionRequest {
  return createPgdInspectionRequest({ ...intake, status });
}

test('PGD catalog owns the stainless-steel inspection scope without a PCN field code', () => {
  assert.ok(DEFAULT_PGD_CATALOG.length >= 3);
  assert.ok(DEFAULT_PGD_CATALOG.some((item) => item.productGroup === 'STEEL_METAL'));
  assert.ok(DEFAULT_PGD_CATALOG.some((item) => item.productGroup === 'MACHINERY_LINE'));
  assert.ok(DEFAULT_PGD_CATALOG.some((item) => item.productGroup === 'COAL'));
  assert.ok(DEFAULT_PGD_CATALOG.some((item) => item.productGroup === 'OTHER'));
  const stainlessSteel = DEFAULT_PGD_CATALOG.find((item) => item.id === 'STEEL_LOT_INSPECTION');
  assert.equal(stainlessSteel?.groupCode, 'QC20');
  assert.equal(stainlessSteel?.code, 'GĐ-THEP-KG');
  assert.equal(PGD_COLLECTIONS.requests, 'pgdInspectionRequests');
  assert.equal(PGD_COLLECTIONS.certificates, 'pgdInspectionCertificates');
  assert.equal(DEFAULT_PGD_CATALOG.find((item) => item.id === 'STEEL_LOT_INSPECTION')?.code, 'GĐ-THEP-KG');
  assert.equal(isPgdCatalogItemAllowed('STEEL_LOT_INSPECTION'), true);
  assert.equal(isPgdCatalogItemAllowed('QC20'), false);
});

test('PGD catalog supplements a legacy persisted catalog with missing source-derived profiles', () => {
  const legacyCatalog = DEFAULT_PGD_CATALOG.filter((item) => item.code === 'GĐ-THEP-KG');
  const merged = mergePgdCatalogDefaults(legacyCatalog);
  assert.deepEqual(
    getPgdActiveCatalog(merged).map((item) => item.code),
    ['GĐ-THEP-KG', 'GĐ-THEP-TT58', 'GĐ-MAY-01', 'GĐ-THAN-01', 'GĐ-NGOAI-01', 'GĐ-HH-01', 'GĐ-SL-KL-01', 'GĐ-TTXX-01', 'GĐ-THEP-CB', 'GĐ-MAY-TN', 'GĐ-NGOAI-CT'],
  );
});

test('PGD accepts non-stainless steel/metal requests through the general TT58 profile', () => {
  const issues = validatePgdIntake({
    ...intake,
    catalogItemId: 'STEEL_TT58_INSPECTION',
    method: 'QT-GĐ-10',
    standards: ['ASTM A36', 'Tiêu chuẩn hợp đồng'],
    productDetails: {
      ...intake.productDetails,
      productForm: 'Phôi thép',
      grade: 'Q235',
      productStandard: 'GB/T 700',
    },
  });
  assert.deepEqual(issues, []);
});

test('PGD method metadata is derived from the researched inspection procedures and rejects free text', () => {
  const steel = DEFAULT_PGD_CATALOG.find((item) => item.id === 'STEEL_LOT_INSPECTION');
  const machinery = DEFAULT_PGD_CATALOG.find((item) => item.id === 'MACHINERY_LINE_INSPECTION');
  const coal = DEFAULT_PGD_CATALOG.find((item) => item.id === 'COAL_LOT_INSPECTION');
  assert.deepEqual(steel?.methodOptions.map((item) => item.code), ['TT58', 'QT-GĐ-02', 'QT-GĐ-03', 'QT-GĐ-04', 'QT-GĐ-06', 'QT-GĐ-10', 'QT-GĐ-14']);
  assert.ok(machinery?.methodOptions.some((item) => item.code === 'QT-GĐ-07'));
  assert.ok(coal?.methodOptions.some((item) => item.code === 'QT-GĐ-08'));
  assert.deepEqual(validatePgdIntake({ ...intake, method: 'phương pháp tự nhập' }).map((issue) => issue.field), ['method']);
  assert.equal(validatePgdIntake({ ...intake, method: 'QT-GĐ-10' }).some((issue) => issue.field === 'method'), true);
  assert.deepEqual(validatePgdIntake({ ...intake, method: 'TT58' }), []);
  assert.deepEqual(PGD_ASSESSMENT_METHOD_OPTIONS.map((item) => item.code), ['METHOD_7']);
  assert.deepEqual(validatePgdIntake({ ...intake, method: 'TT58', assessmentMethod: 'METHOD_7' }), []);
  assert.equal(validatePgdIntake({ ...intake, assessmentMethod: 'METHOD_9' as any }).some((issue) => issue.field === 'assessmentMethod'), true);
  assert.deepEqual(validatePgdIntake({ ...intake, catalogItemId: 'STEEL-LOCAL', method: 'QT-GĐ-14' }, [
    ...DEFAULT_PGD_CATALOG.filter((item) => item.id !== 'STEEL_LOT_INSPECTION'),
    { ...steel!, id: 'STEEL-LOCAL', methodOptions: [{ code: 'QT-GĐ-14', name: 'Phương thức do quản lý xác nhận' }] },
  ]), []);
  const unsafeCatalogItem = { ...steel!, id: 'STEEL-LOCAL-Q', methodOptions: [{ code: 'QC20', name: 'Không được dùng trong PGD' }] };
  assert.equal(isPgdCatalogItemAllowed(unsafeCatalogItem.id, [unsafeCatalogItem]), false);
  assert.match(validatePgdIntake({ ...intake, catalogItemId: unsafeCatalogItem.id, method: 'QC20' }, [unsafeCatalogItem])[0]?.field || '', /catalogItemId/);
});

test('QT-GĐ-14 uses the researched steel lot sampling table without extrapolating', () => {
  const steel = DEFAULT_PGD_CATALOG.find((item) => item.id === 'STEEL_LOT_INSPECTION');
  assert.equal(steel?.methodOptions.some((method) => method.code === 'QT-GĐ-14'), true);
  assert.deepEqual(getPgdSteelTtlt58SamplingPlan(1, false), {
    lotSizeMin: 1,
    lotSizeMax: 25,
    visualLabelSampleCount: 2,
    mechanicalWeightSampleCount: 2,
    chemicalCoatingSampleCount: 1,
    aqlVisualDimensionWeight: 4,
    aqlMechanicalChemicalCoating: 1.5,
    reference: 'QT-GĐ-14 / TTLT 58/2015',
  });
  assert.equal(getPgdSteelTtlt58SamplingPlan(100, true)?.mechanicalWeightSampleCount, 2);
  assert.equal(getPgdSteelTtlt58SamplingPlan(3200, false)?.visualLabelSampleCount, 8);
  assert.equal(getPgdSteelTtlt58SamplingPlan(3201, false), null);
  assert.equal(validatePgdIntake({ ...intake, method: 'QT-GĐ-14', productDetails: { ...intake.productDetails, steelLotSize: 3201 } }).some((issue) => issue.field === 'productDetails.steelManualSamplingPlanNote'), true);
  assert.deepEqual(validatePgdIntake({ ...intake, method: 'QT-GĐ-14', productDetails: { ...intake.productDetails, steelLotSize: 3201, steelManualSamplingPlanNote: 'Áp dụng kế hoạch lấy mẫu được trưởng phòng phê duyệt.' } }), []);
});

test('PGD intake requires customer, lot, scope and location without reusing PCN proposal rules', () => {
  assert.deepEqual(validatePgdIntake(intake), []);
  const issues = validatePgdIntake({ ...intake, productName: '', inspectionLocation: '', standards: [] });
  assert.deepEqual(issues.map((issue) => issue.field), ['productName', 'inspectionLocation', 'standards']);
});

test('PGD registry metadata captures source-derived request and dossier references', () => {
  const request = createPgdInspectionRequest({
    ...intake,
    registryMetadata: {
      registrationNumber: 'SĐK-GĐ-2026-001',
      receivedAt: '2026-09-03',
      documents: [
        { kind: 'CONTRACT', number: 'HD-001', date: '2026-09-01' },
        { kind: 'BILL_OF_LADING', number: 'BL-001', date: '2026-08-30' },
        { kind: 'TECHNICAL_DOSSIER', number: 'HSKT-001' },
      ],
      technicalDossierNote: 'Đã nhận bản vẽ và catalogue thiết bị.',
      deficiencyNote: 'Chờ bổ sung C/O.',
      returnedPackageNote: 'Đã trả bộ hồ sơ thiếu cho khách hàng.',
      courierName: 'Chuyển phát nội bộ',
    },
  }, '2026-09-03T08:00:00.000Z');
  assert.deepEqual(request.registryMetadata, {
    registrationNumber: 'SĐK-GĐ-2026-001',
    receivedAt: '2026-09-03',
    documents: [
      { kind: 'CONTRACT', number: 'HD-001', date: '2026-09-01' },
      { kind: 'BILL_OF_LADING', number: 'BL-001', date: '2026-08-30' },
      { kind: 'TECHNICAL_DOSSIER', number: 'HSKT-001' },
    ],
    technicalDossierNote: 'Đã nhận bản vẽ và catalogue thiết bị.',
    deficiencyNote: 'Chờ bổ sung C/O.',
    returnedPackageNote: 'Đã trả bộ hồ sơ thiếu cho khách hàng.',
    courierName: 'Chuyển phát nội bộ',
  });
  assert.deepEqual(validatePgdRegistryMetadata({ documents: [{ kind: 'QC20' }] }), [{ field: 'registryMetadata.documents[0].kind', message: 'Loại chứng từ sổ đăng ký PGD không hợp lệ.' }]);
});

test('PGD intake validates the request identity and rejects cross-domain document pointers', () => {
  const issues = validatePgdIntake({
    ...intake,
    id: '',
    requestCode: '',
    requester: { name: '' },
    intakeChannel: 'INVALID' as never,
    productGroup: 'MACHINERY_LINE',
    catalogItemId: 'STEEL_LOT_INSPECTION',
    documentPointers: [{
      id: 'pcn-doc',
      domain: 'pgd',
      fileName: 'pcn.pdf',
      sourceCollection: 'dossierDocuments',
      sourceDocumentId: 'pcn-1',
      version: 1,
      checksum: 'a'.repeat(64),
    }],
  });
  assert.deepEqual(issues.map((issue) => issue.field), ['id', 'requestCode', 'requester.name', 'requester.address', 'requester.contactPerson', 'requester.phone', 'intakeChannel', 'productGroup', 'documentPointers']);
  assert.match(validatePgdIntake({ ...intake, catalogItemId: 'QC20' })[0]?.field || '', /catalogItemId/);
});

test('PGD request starts at DRAFT and snapshots new-dossier intake data', () => {
  const request = createPgdInspectionRequest(intake, '2026-09-02T01:00:00.000Z');
  assert.equal(request.status, 'DRAFT');
  assert.equal(request.domain, 'pgd');
  assert.equal(request.createdAt, '2026-09-02T01:00:00.000Z');
  assert.notEqual(request.customerSnapshot, intake.customerSnapshot);
  assert.deepEqual(request.standards, ['QCVN 20:2019/BKHCN', 'Sửa đổi 1:2021 QCVN 20:2019/BKHCN', 'ASTM A36']);
});

test('PGD workflow only advances through the ordered lifecycle and gates lab results', () => {
  assert.deepEqual(PGD_WORKFLOW_STATES.slice(0, 3).map((state) => state.code), ['DRAFT', 'CAPABILITY_REVIEW', 'READY_TO_EXECUTE']);
  assert.equal(getPgdTransitionDenial('DRAFT', 'READY_TO_EXECUTE', {}), 'Hồ sơ PGD phải đi qua bước xem xét năng lực.');
  assert.equal(getPgdTransitionDenial('CAPABILITY_REVIEW', 'READY_TO_EXECUTE', { hasApprovedAssignment: true }), null);
  assert.equal(getPgdTransitionDenial('FIELD_INSPECTION', 'WAITING_LAB_RESULTS', { hasFieldInspection: true, hasSampleHandover: false }), 'Cần hoàn tất bàn giao mẫu cho PTN trước khi chờ kết quả.');
  assert.equal(getPgdTransitionDenial('FIELD_INSPECTION', 'WAITING_LAB_RESULTS', { hasFieldInspection: true, hasSampleHandover: true }), null);
  const pendingLab: PgdLabRequest = { id: 'lab-1', domain: 'pgd', requestId: 'pgd-request-1', status: 'SENT', sampleId: 'sample-1', laboratoryName: 'PTN A', testItems: ['Hóa học'] };
  assert.equal(getPgdTransitionDenial('WAITING_LAB_RESULTS', 'RESULTS_REVIEW', { labRequests: [pendingLab] }), 'Chưa nhận đủ kết quả PTN của các yêu cầu đang mở.');
  assert.equal(getPgdTransitionDenial('WAITING_LAB_RESULTS', 'RESULTS_REVIEW', { labRequests: [{ ...pendingLab, status: 'RESULT_RECEIVED' }] }), null);
  assert.equal(getPgdTransitionDenial('TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', { reportReady: false }), 'Chưa hoàn thiện báo cáo giám định để trình phê duyệt.');
  assert.equal(getPgdTransitionDenial('LEADERSHIP_APPROVAL', 'SIGNED', { hasCertificate: false }), 'Chưa có dự thảo chứng thư giám định để trình ký.');
  assert.equal(getPgdTransitionDenial('SIGNED', 'RESULT_RETURNED', { signed: true }), null);
  assert.notEqual(getPgdTransitionDenial('DRAFT', 'ARCHIVED', {}), null);
});

test('PGD sampling creates two traceable portions for laboratory and retention', () => {
  const result = splitPgdSample({ requestId: 'pgd-request-1', sampleCodePrefix: 'PGD-0001', description: 'Thép tấm', quantity: 2, unit: 'mẫu' }, '2026-09-02T02:00:00.000Z');
  assert.equal(result.lab.disposition, 'LAB');
  assert.equal(result.retained.disposition, 'RETAINED');
  assert.equal(result.lab.quantity + result.retained.quantity, 2);
  assert.equal(result.lab.requestId, result.retained.requestId);
  assert.notEqual(result.lab.id, result.retained.id);
});

test('PGD result template is snapshotted immutably with version and schema', () => {
  const template: PgdResultTemplate = {
    id: 'pgd-template-steel',
    code: 'STEEL-REPORT',
    name: 'Báo cáo giám định thép',
    version: '1.0',
    productGroup: 'STEEL_METAL',
    fields: [{ key: 'lotCode', label: 'Số lô', type: 'TEXT', required: true }],
    active: true,
  };
  const snapshot = snapshotPgdResultTemplate(template, '2026-09-02T03:00:00.000Z');
  template.fields[0].label = 'MUTATED';
  assert.equal(snapshot.templateId, template.id);
  assert.equal(snapshot.version, '1.0');
  assert.equal(snapshot.capturedAt, '2026-09-02T03:00:00.000Z');
  assert.equal(snapshot.fields[0].label, 'Số lô');
});

test('PGD mutation boundary rejects PCN collections and PCN-only users', () => {
  assert.match(getPgdCollectionMutationDenial('certificationDossiers', 'staff', 'write') || '', /PGD/);
  assert.match(getPgdCollectionMutationDenial(PGD_COLLECTIONS.requests, 'viewer', 'write') || '', /viewer/);
  assert.match(getPgdCollectionMutationDenial(PGD_COLLECTIONS.requests, 'staff', 'write', { departmentScopes: ['PGD'], pgdRole: 'PGD_VIEWER' }) || '', /viewer/);
  assert.equal(getPgdCollectionMutationDenial(PGD_COLLECTIONS.requests, 'staff', 'write', { departmentScopes: ['PGD'] }), null);
  assert.equal(getPgdCollectionMutationDenial(PGD_COLLECTIONS.requests, 'staff', 'delete', { departmentScopes: ['PGD'] }), null);
  assert.match(getPgdCollectionMutationDenial(PGD_COLLECTIONS.requests, 'staff', 'write', { departmentScopes: ['PCN'] }) || '', /phạm vi PGD/);
});

test('PGD dossier deletion is system-manager-only, status-gated and no longer soft-delete', () => {
  const requestWith = (status: PgdInspectionRequest['status']) => ({
    ...createPgdInspectionRequest({
      ...intake,
      requestCode: 'PGD-260905-01',
      catalogItemId: 'STEEL_TT58_INSPECTION',
      method: 'QT-GĐ-10',
      standards: ['ASTM A36'],
    }),
    status,
  });
  assert.equal(getPgdDossierDeletionDenial(requestWith('DRAFT'), { systemRole: 'admin', departmentScopes: ['PGD'] }), null);
  assert.equal(getPgdDossierDeletionDenial(requestWith('DRAFT'), { role: 'admin', departmentScopes: ['PGD'] }), null);
  assert.equal(getPgdDossierDeletionDenial(requestWith('DRAFT'), { systemRole: 'staff', departmentRoleCode: 'LEADERSHIP', departmentScopes: ['PCN'] }), null);
  assert.match(getPgdDossierDeletionDenial(requestWith('DRAFT'), { systemRole: 'staff', departmentScopes: ['PGD'] }) || '', /Admin hoặc Quản lý/);
  assert.match(getPgdDossierDeletionDenial(requestWith('DRAFT'), { systemRole: 'staff', pgdRole: 'PGD_MANAGER', departmentScopes: ['PGD'] }) || '', /Admin hoặc Quản lý/);
  assert.match(getPgdDossierDeletionDenial(requestWith('ARCHIVED'), { systemRole: 'admin', departmentScopes: ['PGD'] }) || '', /không thể xóa|lưu trữ/);
});

test('PGD dossier editing is available to system Admin or leadership manager before signature', () => {
  const requestWith = (status: PgdInspectionRequest['status']) => ({
    ...createPgdInspectionRequest({
      ...intake,
      requestCode: 'PGD-260905-02',
      catalogItemId: 'STEEL_TT58_INSPECTION',
      method: 'QT-GĐ-10',
      standards: ['ASTM A36'],
    }),
    status,
  });

  assert.equal(getPgdDossierEditDenial(requestWith('DRAFT'), { systemRole: 'admin', departmentScopes: ['PGD'] }), null);
  assert.equal(getPgdDossierEditDenial(requestWith('CAPABILITY_REVIEW'), { systemRole: 'staff', departmentRoleCode: 'LEADERSHIP', departmentScopes: ['PGD'] }), null);
  assert.match(getPgdDossierEditDenial(requestWith('DRAFT'), { systemRole: 'staff', pgdRole: 'PGD_MANAGER', departmentScopes: ['PGD'] }) || '', /toàn hệ thống/);
  assert.match(getPgdDossierEditDenial(requestWith('DRAFT'), { systemRole: 'staff', departmentScopes: ['PGD'] }) || '', /Admin hoặc Quản lý/);
  assert.match(getPgdDossierEditDenial(requestWith('SIGNED'), { systemRole: 'admin', departmentScopes: ['PGD'] }) || '', /ký|khóa/);
});

test('PGD assignment validation requires active PGD-scoped personnel and a technical reviewer', () => {
  const users = [
    { username: 'inspector', active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_FIELD_INSPECTOR' },
    { username: 'reviewer', active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_TECHNICAL' },
    { username: 'pcn-only', active: true, departmentScopes: ['PCN'], pgdRole: undefined },
  ];
  assert.deepEqual(validatePgdAssignment({ inspectorUsernames: ['inspector'], technicalReviewerUsername: 'reviewer' }, users), []);
  assert.match(validatePgdAssignment({ inspectorUsernames: ['pcn-only'], technicalReviewerUsername: 'reviewer' }, users)[0]?.message || '', /(?:scope|phạm vi) PGD/);
  assert.match(validatePgdAssignment({ inspectorUsernames: ['inspector'], technicalReviewerUsername: 'pcn-only' }, users)[0]?.message || '', /soát xét kỹ thuật/);
  assert.deepEqual(validatePgdInspectors(['inspector'], users), []);
  assert.match(validatePgdInspectors(['pcn-only'], users)[0]?.message || '', /(?:scope|phạm vi) PGD/);
});

test('PGD document pointers carry domain and immutable provenance metadata', () => {
  const pointer = {
    id: 'doc-1',
    domain: 'pgd' as const,
    fileName: 'bien-ban.pdf',
    sourceCollection: 'pgdDocuments',
    sourceDocumentId: 'doc-1',
    version: 1,
    checksum: 'a'.repeat(64),
    uploadedByUsername: 'inspector',
  };
  assert.equal(pointer.domain, 'pgd');
  assert.equal(pointer.sourceCollection, 'pgdDocuments');
  assert.equal(pointer.version, 1);
  assert.equal(pointer.checksum.length, 64);
});

test('PGD approval chain accepts technical review before manager approval', () => {
  assert.equal(getPgdApprovalDenial('TECHNICAL_REVIEW', 'TECHNICAL_REVIEW', { role: 'staff', pgdRole: 'PGD_TECHNICAL' }), null);
  assert.match(getPgdApprovalDenial('TECHNICAL_REVIEW', 'TECHNICAL_REVIEW', { role: 'staff', pgdRole: 'PGD_DOCUMENT_CLERK' }) || '', /phê duyệt chuyên môn/);
  assert.equal(getPgdApprovalDenial('LEADERSHIP_APPROVAL', 'LEADERSHIP_APPROVAL', { role: 'staff', pgdRole: 'PGD_MANAGER' }), null);
  assert.match(getPgdApprovalDenial('LEADERSHIP_APPROVAL', 'LEADERSHIP_APPROVAL', { role: 'staff', pgdRole: 'PGD_TECHNICAL' }) || '', /lãnh đạo PGD/);
  assert.match(getPgdApprovalDenial('TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', { role: 'admin' }) || '', /trạng thái/);
});

test('PGD lab handover and result facts are canonicalized by the server boundary', () => {
  const labRequest = buildPgdLabRequest({
    id: 'lab-1',
    domain: 'pgd',
    requestId: 'request-1',
    sampleId: 'sample-1',
    status: 'SENT',
    laboratoryName: '  PTN A  ',
    testItems: [' Hóa học ', 'Hóa học'],
    handover: { sentAt: '2000-01-01T00:00:00.000Z', senderUsername: 'spoofed', receiverName: 'PTN A', quantity: 2 },
  }, 'actor-1', '2026-09-02T05:00:00.000Z');
  assert.equal(labRequest.laboratoryName, 'PTN A');
  assert.deepEqual(labRequest.testItems, ['Hóa học']);
  assert.equal(labRequest.handover?.sentAt, '2026-09-02T05:00:00.000Z');
  assert.equal(labRequest.handover?.senderUsername, 'actor-1');
  assert.throws(() => buildPgdLabRequest({ ...labRequest, status: 'RESULT_RECEIVED', resultId: undefined }, 'actor-1', '2026-09-02T05:00:00.000Z'), /kết quả PTN/);

  const result = buildPgdLabResult({
    id: 'result-1',
    domain: 'pgd',
    requestId: 'request-1',
    labRequestId: 'lab-1',
    receivedAt: '2000-01-01T00:00:00.000Z',
    values: [{ key: 'conclusion', label: 'Kết luận', value: 'Phù hợp' }],
  }, 'actor-1', '2026-09-02T05:01:00.000Z');
  assert.equal(result.receivedAt, '2026-09-02T05:01:00.000Z');
  assert.equal(result.acceptedAt, '2026-09-02T05:01:00.000Z');
  assert.equal(result.acceptedByUsername, 'actor-1');
});
