import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { PcnUserAccount } from '../types';
import PgdDossierStepWorkPanel from '../components/PgdDossierStepWorkPanel';
import { PGD_COLLECTIONS, PGD_DOMAIN, type PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdDossierRequirements, type PgdDossierDocument } from '../utils/pgdDossier';

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
  assert.match(processingMarkup, /aria-busy="true"[^>]*>Đang xử lý/);
  assert.match(processingMarkup, /Đang xử lý thay đổi hồ sơ; vui lòng chờ hoàn tất/);
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
  assert.match(loadingMarkup, /<button(?=[^>]*disabled="")[^>]*>Hoàn tất việc<\/button>/);
  assert.doesNotMatch(loadingMarkup, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc/);
  assert.match(errorMarkup, /Không thể xác định trạng thái chứng từ/);
  assert.match(errorMarkup, /Việc bạn cần làm: Không thể xác định việc cần làm/);
  assert.match(errorMarkup, /<button(?=[^>]*disabled="")[^>]*>Hoàn tất việc<\/button>/);
  assert.doesNotMatch(errorMarkup, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc/);
  assert.match(loadedEmptyMarkup, /0 đã có · 0 được miễn · 2 còn thiếu/);
  assert.match(loadedEmptyMarkup, /Còn thiếu 2 tài liệu bắt buộc ở bước này/);
  assert.match(loadedCompleteMarkup, /2 đã có · 0 được miễn · 0 còn thiếu/);
  assert.match(loadedCompleteMarkup, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc ở bước này/);
});
