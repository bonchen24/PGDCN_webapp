import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { PcnUserAccount } from '../types';
import PgdDossierStepWorkPanel from '../components/PgdDossierStepWorkPanel';
import { PGD_COLLECTIONS, PGD_DOMAIN, type PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdDossierRequirementForTemplate, getPgdDossierRequirements, type PgdDossierDocument } from '../utils/pgdDossier';

test('step summary counts only required items for the selected step', () => {
  const allRequiredRequirements = getPgdDossierRequirements('OTHER').filter((item) => item.required);
  const [waivedRequirement, invalidWaiverRequirement] = allRequiredRequirements.filter((item) => item.group === 'REQUEST');
  const documentedRequirement = allRequiredRequirements.find((item) => item.code !== waivedRequirement.code && item.code !== invalidWaiverRequirement.code)!;
  const updatedAt = '2026-10-10T00:00:00.000Z';
  const request = {
    id: 'pgd-summary-test',
    domain: PGD_DOMAIN,
    requestCode: 'PYC-TEST',
    productGroup: 'OTHER',
    customerName: 'Khách hàng thử nghiệm',
    customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
    productName: 'Sản phẩm thử nghiệm',
    standards: [],
    status: 'DRAFT',
    dossierChecklist: [
      {
        domain: PGD_DOMAIN,
        requirementCode: waivedRequirement.code,
        group: waivedRequirement.group,
        title: waivedRequirement.title,
        required: true,
        status: 'WAIVED',
        waiverReason: 'Không áp dụng cho hồ sơ này',
        updatedAt,
      },
      {
        domain: PGD_DOMAIN,
        requirementCode: invalidWaiverRequirement.code,
        group: invalidWaiverRequirement.group,
        title: invalidWaiverRequirement.title,
        required: true,
        status: 'WAIVED',
        updatedAt,
      },
    ],
  } as unknown as PgdInspectionRequest;
  const document = (id: string, version: number, fileName: string): PgdDossierDocument => ({
    id,
    domain: PGD_DOMAIN,
    requestId: request.id,
    requirementCode: documentedRequirement.code,
    title: documentedRequirement.title,
    fileName,
    sourceCollection: PGD_COLLECTIONS.dossierDocuments,
    sourceDocumentId: id,
    version,
    checksum: `checksum-${id}`,
    uploadedByUsername: 'reviewer',
    uploadedAt: `2026-10-${String(version).padStart(2, '0')}T00:00:00.000Z`,
  });
  const markup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request,
    currentUser: { username: 'reviewer' } as PcnUserAccount,
    selectedStepId: 'capability',
    dossierRequirements: allRequiredRequirements,
    dossierDocuments: [document('document-v1', 1, 'old.pdf'), document('document-v2', 2, 'current.pdf')],
    samples: [],
    canMutate: false,
  }));

  assert.match(markup, /Soát xét bước này[\s\S]*?1 đã có · 1 được miễn · 2 còn thiếu/);
  assert.match(markup, /min-w-0 break-words/);
  // Before: requiring a bare <tbody> skipped the rendered body because it has a class attribute.
  const tableBody = markup.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] || '';
  assert.match(markup, /<th\b(?=[^>]*scope="col")[^>]*>Trạng thái<\/th>/);
  const tableRows = Array.from(tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g), (match) => match[1]);
  const rowStatuses = tableRows.map((row) => {
    const rowCells = Array.from(row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/g), (match) => match[1]);
    const statusCell = rowCells[2] || '';
    // Missing-item action cells repeat their label; read only the status column.
    return statusCell.match(/<span\b[^>]*>(Đã bỏ qua|Chưa có|Đã có)<\/span>/)?.[1] || '';
  });
  assert.deepEqual(rowStatuses, ['Đã bỏ qua', 'Chưa có', 'Đã có', 'Chưa có']);
  assert.match(tableBody, /current\.pdf · v2/);
  assert.doesNotMatch(tableBody, /old\.pdf · v1/);
});

test('waived optional documents do not show an upload action', () => {
  const optionalRequirement = getPgdDossierRequirements('OTHER').find((item) => item.code === 'ASSIGNMENT_FORM')!;
  assert.equal(optionalRequirement.required, false);

  const request = {
    id: 'pgd-waived-optional-test',
    domain: PGD_DOMAIN,
    requestCode: 'PYC-WAIVED-OPTIONAL-TEST',
    productGroup: 'OTHER',
    customerName: 'Khách hàng thử nghiệm',
    customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
    productName: 'Sản phẩm thử nghiệm',
    standards: [],
    status: 'DRAFT',
    dossierChecklist: [{
      domain: PGD_DOMAIN,
      requirementCode: optionalRequirement.code,
      group: optionalRequirement.group,
      title: optionalRequirement.title,
      required: false,
      status: 'WAIVED',
      waiverReason: 'Không áp dụng cho hồ sơ này',
      updatedAt: '2026-10-10T00:00:00.000Z',
    }],
  } as unknown as PgdInspectionRequest;
  const markup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request,
    currentUser: { username: 'reviewer' } as PcnUserAccount,
    selectedStepId: 'assignment',
    dossierRequirements: [optionalRequirement],
    dossierDocuments: [],
    samples: [],
    canMutate: true,
    onOpenChecklist: () => undefined,
  }));
  const tableBody = markup.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] || '';
  const waivedRow = Array.from(tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g), (match) => match[1])
    .find((row) => row.includes(optionalRequirement.title));

  assert.ok(waivedRow, 'the waived optional requirement remains visible in its step table');
  assert.doesNotMatch(waivedRow, /<button\b/, 'waived optional evidence must not prompt an upload');
});

test('document actions respect read-only access while preserving available evidence actions', () => {
  const draftRequirement = getPgdDossierRequirementForTemplate('INTAKE_REQUEST', 'OTHER')!;
  const uploadRequirement = getPgdDossierRequirements('OTHER').find((item) => (
    item.group === 'REQUEST' && item.required && item.code !== draftRequirement.code
  ))!;
  assert.ok(uploadRequirement, 'the intake step includes a required document without a drafting template');

  const render = (canMutate: boolean, state: 'missing' | 'present' | 'waived', dossierLoadStatus: 'loaded' | 'error' = 'loaded') => {
    const request = {
      id: 'pgd-document-action-permissions-test',
      domain: PGD_DOMAIN,
      requestCode: 'PYC-DOCUMENT-ACTION-PERMISSIONS',
      productGroup: 'OTHER',
      customerName: 'Khách hàng thử nghiệm',
      customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
      productName: 'Sản phẩm thử nghiệm',
      standards: [],
      status: 'DRAFT',
      dossierChecklist: state === 'waived' ? [{
        domain: PGD_DOMAIN,
        requirementCode: draftRequirement.code,
        group: draftRequirement.group,
        title: draftRequirement.title,
        required: true,
        status: 'WAIVED',
        waiverReason: 'Không áp dụng cho hồ sơ này',
        updatedAt: '2026-10-10T00:00:00.000Z',
      }] : [],
    } as unknown as PgdInspectionRequest;
    const documents: PgdDossierDocument[] = state === 'present' ? [{
      id: 'present-intake-document',
      domain: PGD_DOMAIN,
      requestId: request.id,
      requirementCode: draftRequirement.code,
      title: draftRequirement.title,
      fileName: 'intake.pdf',
      fileAssetId: 'intake-asset',
      sourceCollection: PGD_COLLECTIONS.dossierDocuments,
      sourceDocumentId: 'present-intake-document',
      version: 1,
      checksum: 'intake-checksum',
      uploadedByUsername: 'reviewer',
      uploadedAt: '2026-10-10T00:00:00.000Z',
    }] : [];

    const markup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
      request,
      currentUser: { username: 'reviewer' } as PcnUserAccount,
      selectedStepId: 'intake',
      dossierRequirements: [uploadRequirement],
      dossierDocuments: documents,
      dossierLoadStatus,
      samples: [],
      canMutate,
      onOpenChecklist: () => undefined,
      onOpenDrafting: () => '/pgd/drafting?requestId=pgd-document-action-permissions-test',
    }));
    const rows = Array.from(markup.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g), (match) => match[1]);
    const rowFor = (requirement: { title: string }) => rows.find((row) => row.includes(requirement.title)) || '';
    return { markup, draftRow: rowFor(draftRequirement), uploadRow: rowFor(uploadRequirement) };
  };

  for (const canMutate of [false, true]) {
    const label = canMutate ? 'mutable' : 'read-only';
    const missing = render(canMutate, 'missing');
    assert.ok(missing.draftRow, `${label}: the missing drafting requirement remains visible`);
    assert.ok(missing.uploadRow, `${label}: the missing upload requirement remains visible`);
    if (canMutate) {
      assert.match(missing.draftRow, /aria-label="Soạn thảo tài liệu"/);
      assert.match(missing.uploadRow, /aria-label="Bổ sung tệp"/);
    } else {
      assert.match(missing.draftRow, /Nhờ người có quyền bổ sung/);
      assert.match(missing.uploadRow, /Nhờ người có quyền bổ sung/);
      assert.doesNotMatch(missing.markup, /Soạn thảo tài liệu|aria-label="Bổ sung tệp"/);
    }

    const present = render(canMutate, 'present');
    assert.match(present.draftRow, /aria-label="Mở tài liệu"/);
    assert.match(present.draftRow, /<span[^>]*>Mở tài liệu<\/span>/);
    assert.match(present.draftRow, /download="intake\.pdf"/);
    if (canMutate) assert.match(present.uploadRow, /aria-label="Bổ sung tệp"/);
    else assert.match(present.uploadRow, /Nhờ người có quyền bổ sung/);

    const waived = render(canMutate, 'waived');
    assert.match(waived.draftRow, /Đã bỏ qua/);
    assert.doesNotMatch(waived.draftRow, /<a\b|<button\b/);
    if (canMutate) assert.match(waived.uploadRow, /aria-label="Bổ sung tệp"/);
    else assert.match(waived.uploadRow, /Nhờ người có quyền bổ sung/);

    const loadError = render(canMutate, 'missing', 'error');
    assert.match(loadError.draftRow, /Chưa thể xác định/);
    assert.match(loadError.uploadRow, /Chưa thể xác định/);
    assert.doesNotMatch(loadError.draftRow + loadError.uploadRow, /<a\b|<button\b/);
  }
});

test('an in-progress dossier update is distinct from a step without an available transition', () => {
  const commonProps = {
    request: {
      id: 'pgd-step-loading-test',
      domain: PGD_DOMAIN,
      requestCode: 'PYC-LOADING-TEST',
      productGroup: 'OTHER',
      customerName: 'Khách hàng thử nghiệm',
      customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
      productName: 'Sản phẩm thử nghiệm',
      standards: [],
      status: 'DRAFT',
      dossierChecklist: [],
    } as unknown as PgdInspectionRequest,
    currentUser: { username: 'reviewer' } as PcnUserAccount,
    selectedStepId: 'intake' as const,
    dossierRequirements: [],
    dossierDocuments: [],
    samples: [],
    canMutate: true,
    completeDisabled: true,
  };
  const processingMarkup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    ...commonProps,
    isProcessing: true,
    onCompleteCurrent: () => undefined,
  }));
  const unavailableMarkup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    ...commonProps,
    isProcessing: false,
  }));

  assert.match(processingMarkup, /Việc bạn cần làm: Đang xử lý thay đổi hồ sơ/);
  assert.match(processingMarkup, /Đang xử lý thay đổi hồ sơ; vui lòng chờ hoàn tất/);
  assert.match(processingMarkup, /Dùng mục cần làm ở đầu hồ sơ/);
  assert.doesNotMatch(processingMarkup, /aria-busy="true"|<button[^>]*>(?:Đang xử lý|Hoàn tất việc)/);
  assert.match(unavailableMarkup, /không có thao tác chuyển tiếp trong trạng thái hiện tại/);
  assert.doesNotMatch(unavailableMarkup, /aria-busy="true"|Đang xử lý thay đổi hồ sơ/);
});

test('dossier load state keeps step summary and completion action factual', () => {
  const request = {
    id: 'pgd-dossier-load-state-test',
    domain: PGD_DOMAIN,
    requestCode: 'PYC-LOAD-STATE-TEST',
    productGroup: 'OTHER',
    customerName: 'Khách hàng thử nghiệm',
    customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
    productName: 'Sản phẩm thử nghiệm',
    standards: [],
    status: 'DRAFT',
    dossierChecklist: [],
  } as unknown as PgdInspectionRequest;
  const requirements = getPgdDossierRequirements('OTHER').filter((item) => item.group === 'REQUEST' && item.required);
  const completeDocuments: PgdDossierDocument[] = requirements.map((item, index) => ({
    id: `document-${index}`,
    domain: PGD_DOMAIN,
    requestId: request.id,
    requirementCode: item.code,
    title: item.title,
    fileName: `${item.code}.pdf`,
    sourceCollection: PGD_COLLECTIONS.dossierDocuments,
    sourceDocumentId: `document-${index}`,
    version: 1,
    checksum: `checksum-${index}`,
    uploadedByUsername: 'reviewer',
    uploadedAt: '2026-10-10T00:00:00.000Z',
  }));
  const baseProps = {
    request,
    currentUser: { username: 'reviewer' } as PcnUserAccount,
    selectedStepId: 'intake' as const,
    dossierRequirements: requirements,
    dossierDocuments: [] as PgdDossierDocument[],
    samples: [],
    canMutate: true,
    onCompleteCurrent: () => undefined,
    completeLabel: 'Hoàn tất việc',
  };
  const render = (dossierLoadStatus: 'loading' | 'error' | 'loaded', dossierDocuments = baseProps.dossierDocuments) => renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    ...baseProps,
    dossierLoadStatus,
    dossierDocuments,
  }));
  const loadingMarkup = render('loading');
  const errorMarkup = render('error');
  const loadedEmptyMarkup = render('loaded');
  const loadedCompleteMarkup = render('loaded', completeDocuments);

  assert.match(loadingMarkup, /Đang tải trạng thái chứng từ/);
  assert.match(loadingMarkup, /Việc bạn cần làm: Đang tải trạng thái chứng từ/);
  assert.match(loadingMarkup, /Dùng mục cần làm ở đầu hồ sơ/);
  assert.doesNotMatch(loadingMarkup, /<button[^>]*>(?:Đang xử lý|Hoàn tất việc)/);
  assert.doesNotMatch(loadingMarkup, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc/);
  assert.match(errorMarkup, /Không thể xác định trạng thái chứng từ/);
  assert.match(errorMarkup, /Việc bạn cần làm: Không thể xác định việc cần làm/);
  assert.match(errorMarkup, /Dùng mục cần làm ở đầu hồ sơ/);
  assert.doesNotMatch(errorMarkup, /<button[^>]*>(?:Đang xử lý|Hoàn tất việc)/);
  assert.doesNotMatch(errorMarkup, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc/);
  assert.match(loadedEmptyMarkup, /0 đã có · 0 được miễn · 2 còn thiếu/);
  assert.match(loadedEmptyMarkup, /Còn thiếu 2 tài liệu bắt buộc ở bước này/);
  assert.match(loadedCompleteMarkup, /2 đã có · 0 được miễn · 0 còn thiếu/);
  assert.match(loadedCompleteMarkup, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc ở bước này/);
});

test('labels conditional and supplemental optional requirements distinctly in table', () => {
  const allRequirements = getPgdDossierRequirements('OTHER');
  const requiredItem = allRequirements.find((item) => item.code === 'REQUEST_PYC')!;
  const conditionalContract = allRequirements.find((item) => item.code === 'COMMERCIAL_CONTRACT')!;
  const conditionalInvoice = allRequirements.find((item) => item.code === 'COMMERCIAL_INVOICE')!;
  const supplementalAssignment = allRequirements.find((item) => item.code === 'ASSIGNMENT_FORM')!;

  assert.equal(requiredItem.required, true);
  assert.equal(conditionalContract.required, false);
  assert.equal(conditionalInvoice.required, false);
  assert.equal(supplementalAssignment.required, false);

  const request = {
    id: 'pgd-labels-test',
    domain: PGD_DOMAIN,
    requestCode: 'PYC-LABELS-TEST',
    productGroup: 'OTHER',
    customerName: 'Khách hàng thử nghiệm',
    customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
    productName: 'Sản phẩm thử nghiệm',
    standards: [],
    status: 'DRAFT',
    dossierChecklist: [],
  } as unknown as PgdInspectionRequest;

  const testRequirements = [requiredItem, conditionalContract, conditionalInvoice, supplementalAssignment];

  const markup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request,
    currentUser: { username: 'reviewer' } as PcnUserAccount,
    selectedStepId: 'intake',
    dossierRequirements: testRequirements,
    dossierDocuments: [],
    samples: [],
    canMutate: true,
  }));

  const tableBody = markup.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] || '';
  const rows = Array.from(tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g), (match) => match[1]);

  assert.match(rows.find((r) => r.includes(requiredItem.title)) || '', /Bắt buộc/);
  assert.match(rows.find((r) => r.includes(conditionalContract.title)) || '', /Có điều kiện/);
  assert.match(rows.find((r) => r.includes(conditionalInvoice.title)) || '', /Có điều kiện/);
  assert.match(rows.find((r) => r.includes(supplementalAssignment.title)) || '', /Bổ sung/);

  assert.match(tableBody, new RegExp(conditionalContract.description!));
  assert.match(tableBody, new RegExp(conditionalInvoice.description!));
  assert.match(tableBody, new RegExp(supplementalAssignment.description!));
});


test('renders pending confirmation status and contextual link when matching generated document is awaiting confirmation', () => {
  const allRequiredRequirements = getPgdDossierRequirements('OTHER').filter((item) => item.required);
  const intakeRequirement = allRequiredRequirements.find((item) => item.code === 'REQUEST_PYC')!;
  assert.ok(intakeRequirement);

  const request = {
    id: 'pgd-pending-doc-test',
    domain: PGD_DOMAIN,
    requestCode: 'PYC-PENDING-001',
    productGroup: 'OTHER',
    customerName: 'Khách hàng thử nghiệm',
    customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
    productName: 'Sản phẩm thử nghiệm',
    standards: [],
    status: 'DRAFT',
    dossierChecklist: [],
  } as unknown as PgdInspectionRequest;

  const generatedDoc = {
    id: 'gen-doc-1',
    domain: PGD_DOMAIN,
    requestId: request.id,
    requestCode: request.requestCode,
    kind: 'INTAKE_REQUEST',
    templateId: 'tpl-intake',
    templateCode: 'INTAKE-01',
    templateVersion: '1.0',
    fileName: 'PYC-PENDING-001_INTAKE_REQUEST.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    byteSize: 1024,
    sha256: 'a'.repeat(64),
    status: 'DRAFT' as const,
    generatedByUsername: 'officer',
    generatedAt: '2026-11-02T08:00:00.000Z',
    sourceCollection: 'pgdRequests' as const,
    sourceDocumentId: request.id,
    cellValues: {},
    contextHash: 'hash-1',
    format: 'DOCX' as const,
    templateSnapshot: {} as any,
  };

  // Case 1: canMutate = true, generated doc exists but not attached
  const markupMutable = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request,
    currentUser: { username: 'officer' } as PcnUserAccount,
    selectedStepId: 'intake',
    dossierRequirements: [intakeRequirement],
    dossierDocuments: [],
    generatedDocuments: [generatedDoc as any],
    samples: [],
    canMutate: true,
    onOpenDrafting: ({ templateKind, requirementCode }) =>
      `/pgdcn/pgd/drafting?requestId=${request.id}&templateKind=${templateKind}&requirementCode=${requirementCode}`,
  }));

  // Status must be 'Chờ xác nhận'
  assert.match(markupMutable, /Chờ xác nhận/);
  // Unresolved / missing required count still counts it as missing (does not open gate prematurely)
  assert.match(markupMutable, /1 còn thiếu/);
  // Contextual action link to open drafting for confirmation
  assert.match(markupMutable, new RegExp(`/pgdcn/pgd/drafting\\?requestId=${request.id}&amp;templateKind=INTAKE_REQUEST&amp;requirementCode=REQUEST_PYC`));
  assert.match(markupMutable, /Mở output chờ xác nhận/);
  assert.doesNotMatch(markupMutable, />Xác nhận &amp; gắn</);

  // Case 2: canMutate = false (read-only role), maintains permission boundary
  const markupReadOnly = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request,
    currentUser: { username: 'viewer' } as PcnUserAccount,
    selectedStepId: 'intake',
    dossierRequirements: [intakeRequirement],
    dossierDocuments: [],
    generatedDocuments: [generatedDoc as any],
    samples: [],
    canMutate: false,
  }));

  assert.match(markupReadOnly, /Chờ xác nhận/);
  assert.match(markupReadOnly, /1 còn thiếu/);
  // Should NOT render drafting action link for viewer
  assert.doesNotMatch(markupReadOnly, new RegExp(`/pgdcn/pgd/drafting`));

  // Case 3: generated doc has already been attached to dossier -> shows 'Đã có', NOT 'Chờ xác nhận'
  const attachedDossierDoc: PgdDossierDocument = {
    id: 'dossier-doc-1',
    domain: PGD_DOMAIN,
    requestId: request.id,
    requirementCode: intakeRequirement.code,
    title: intakeRequirement.title,
    fileName: generatedDoc.fileName,
    sourceCollection: PGD_COLLECTIONS.dossierDocuments,
    sourceDocumentId: 'dossier-doc-1',
    version: 1,
    checksum: 'b'.repeat(64),
    uploadedByUsername: 'officer',
    uploadedAt: '2026-11-02T08:10:00.000Z',
    originCollection: PGD_COLLECTIONS.documents,
    originDocumentId: generatedDoc.id,
  };

  const markupAttached = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request,
    currentUser: { username: 'officer' } as PcnUserAccount,
    selectedStepId: 'intake',
    dossierRequirements: [intakeRequirement],
    dossierDocuments: [attachedDossierDoc],
    generatedDocuments: [generatedDoc as any],
    samples: [],
    canMutate: true,
  }));

  assert.match(markupAttached, /Đã có/);
  assert.doesNotMatch(markupAttached, /Chờ xác nhận/);
  assert.match(markupAttached, /0 còn thiếu/);
});
