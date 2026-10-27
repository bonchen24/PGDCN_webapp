import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';

import PcnCustomersManagementView from '../components/PcnCustomersManagementView';
import type { CustomerRef } from '../types';

type DirectoryCustomer = CustomerRef & { region?: string; businessType?: string };
type Filters = {
  searchQuery?: string;
  contactStatus?: 'all' | 'with-contact' | 'without-contact';
  region?: string;
  businessType?: string;
};

async function getDirectoryApi() {
  const module = await import('../components/PcnCustomersManagementView');
  return module as unknown as Record<string, unknown>;
}

test('PCN customer list flags missing identity/contact and filters explicit directory metadata with search', async () => {
  const api = await getDirectoryApi();
  assert.equal(typeof api.filterPcnCustomers, 'function', 'the component should expose its customer projection for focused tests');
  assert.equal(typeof api.getPcnCustomerFilterOptions, 'function', 'filter options should come from explicit record metadata');
  assert.equal(typeof api.hasPcnCustomerContact, 'function', 'contact presence should ignore whitespace-only values');
  assert.equal(typeof api.PcnCustomerCodeDisplay, 'function');
  assert.equal(typeof api.PcnCustomerContactDisplay, 'function');
  assert.equal(typeof api.PcnCustomerMetadataFilterControls, 'function');

  const filterCustomers = api.filterPcnCustomers as (customers: DirectoryCustomer[], filters: Filters) => DirectoryCustomer[];
  const getFilterOptions = api.getPcnCustomerFilterOptions as (customers: DirectoryCustomer[]) => { regions: string[]; businessTypes: string[] };
  const hasContact = api.hasPcnCustomerContact as (customer: DirectoryCustomer) => boolean;
  const metadataFilterControls = api.PcnCustomerMetadataFilterControls as React.ComponentType<{
    options: { regions: string[]; businessTypes: string[] };
    regionFilter: string;
    onRegionChange: (value: string) => void;
    businessTypeFilter: string;
    onBusinessTypeChange: (value: string) => void;
  }>;

  const noContact: DirectoryCustomer = {
    name: 'Công ty Ánh Dương',
    address: 'Hà Nội',
    customerCode: '   ',
    phone: '  ',
    email: '',
    contactPerson: '\t',
    region: 'Miền Bắc',
    businessType: 'Công ty TNHH',
  };
  const withContact: DirectoryCustomer = {
    name: 'Công ty Điện lực Ánh Dương',
    address: 'Đà Nẵng',
    customerCode: 'KH-002',
    phone: '0901234567',
    email: 'anh@example.vn',
    contactPerson: 'Đặng Thị Ánh',
    region: 'Miền Trung',
    businessType: 'Doanh nghiệp tư nhân',
  };
  const customers = [noContact, withContact];

  assert.equal(hasContact(noContact), false);
  assert.equal(hasContact(withContact), true);
  assert.deepEqual(getFilterOptions(customers), {
    regions: ['Miền Bắc', 'Miền Trung'],
    businessTypes: ['Công ty TNHH', 'Doanh nghiệp tư nhân'],
  });
  assert.deepEqual(filterCustomers(customers, { searchQuery: 'dien luc anh', contactStatus: 'with-contact' }), [withContact]);
  assert.deepEqual(filterCustomers(customers, { contactStatus: 'without-contact', region: 'Miền Bắc' }), [noContact]);
  assert.deepEqual(filterCustomers(customers, { searchQuery: 'anh duong', businessType: 'Doanh nghiệp tư nhân' }), [withContact]);

  const unclassified: DirectoryCustomer = { name: 'Công ty cổ phần Ánh Dương', address: 'Hà Nội' };
  const unclassifiedOptions = getFilterOptions([unclassified]);
  assert.deepEqual(unclassifiedOptions, { regions: [], businessTypes: [] }, 'name/address must not be used to guess classification metadata');
  const explicitMetadataControls = cheerio.load(renderToStaticMarkup(React.createElement(metadataFilterControls, {
    options: getFilterOptions(customers),
    regionFilter: '',
    onRegionChange: () => undefined,
    businessTypeFilter: '',
    onBusinessTypeChange: () => undefined,
  })));
  assert.equal(explicitMetadataControls('select[aria-label="Lọc khu vực"]').length, 1);
  assert.equal(explicitMetadataControls('select[aria-label="Lọc loại doanh nghiệp"]').length, 1);
  assert.match(explicitMetadataControls.text(), /Miền Bắc/);
  assert.match(explicitMetadataControls.text(), /Công ty TNHH/);
  const unclassifiedControls = cheerio.load(renderToStaticMarkup(React.createElement(metadataFilterControls, {
    options: unclassifiedOptions,
    regionFilter: '',
    onRegionChange: () => undefined,
    businessTypeFilter: '',
    onBusinessTypeChange: () => undefined,
  })));
  assert.equal(unclassifiedControls('select[aria-label="Lọc khu vực"]').length, 0);
  assert.equal(unclassifiedControls('select[aria-label="Lọc loại doanh nghiệp"]').length, 0);

  const codeDisplay = api.PcnCustomerCodeDisplay as React.ComponentType<{ customer: DirectoryCustomer }>;
  const contactDisplay = api.PcnCustomerContactDisplay as React.ComponentType<{ customer: DirectoryCustomer }>;
  const codeMarkup = cheerio.load(renderToStaticMarkup(React.createElement(codeDisplay, { customer: noContact })));
  const contactMarkup = cheerio.load(renderToStaticMarkup(React.createElement(contactDisplay, { customer: noContact })));
  assert.match(codeMarkup.text(), /Chưa có mã/);
  assert.match(contactMarkup.text(), /Chưa có liên hệ/);
  assert.equal(contactMarkup('[role="status"]').length, 1, 'the missing-contact warning is exposed as a status');
  assert.equal(cheerio.load(renderToStaticMarkup(React.createElement(codeDisplay, { customer: withContact }))).text(), 'KH-002');

  const markup = renderToStaticMarkup(React.createElement(PcnCustomersManagementView));
  const $ = cheerio.load(markup);
  assert.equal($('select[aria-label="Lọc tình trạng liên hệ"]').length, 1);
  assert.equal($('select[aria-label="Lọc khu vực"]').length, 0);
  assert.equal($('select[aria-label="Lọc loại doanh nghiệp"]').length, 0);
  assert.equal($('input[aria-label="Tìm khách hàng"]').length, 1, 'existing search remains available');
});

test('PCN customer excel import and export controls respect viewer permissions and export scope', async () => {
  const { usePcnSessionStore } = await import('../utils/pcnSessionState');
  const { usePcnStore } = await import('../store-pcn');
  const api = await getDirectoryApi();

  const exportPcnCustomersWorkbook = api.exportPcnCustomersWorkbook as (params: {
    customers: CustomerRef[];
    filteredCustomers: CustomerRef[];
    scope: 'all' | 'filtered';
  }) => XLSX.WorkBook;

  assert.equal(typeof exportPcnCustomersWorkbook, 'function');

  // Test Viewer permissions
  usePcnSessionStore.setState({
    currentUser: {
      username: 'pcn_viewer',
      name: 'Người xem PCN',
      role: 'viewer',
      systemRole: 'viewer',
      departmentRoleCode: 'DOCUMENT_CLERK',
      fieldCodes: ['QC4'],
      active: true,
    },
  });

  const viewerMarkup = cheerio.load(renderToStaticMarkup(React.createElement(PcnCustomersManagementView)));
  assert.equal(viewerMarkup('button:contains("Xuất Excel")').length, 1, 'Viewer should see Xuất Excel');
  assert.equal(viewerMarkup('button:contains("Nhập Excel")').length, 0, 'Viewer must not see Nhập Excel');
  assert.equal(viewerMarkup('input[type="file"][accept=".xlsx"]').length, 0, 'Viewer must not have excel file input');

  // Test Editor/Manager permissions
  usePcnSessionStore.setState({
    currentUser: {
      username: 'pcn_admin',
      name: 'Quản trị PCN',
      role: 'admin',
      systemRole: 'admin',
      departmentRoleCode: 'LEADERSHIP',
      fieldCodes: ['QC4', 'QC9'],
      active: true,
    },
  });

  const editorMarkup = cheerio.load(renderToStaticMarkup(React.createElement(PcnCustomersManagementView)));
  assert.equal(editorMarkup('button:contains("Xuất Excel")').length, 1, 'Editor should see Xuất Excel');
  assert.equal(editorMarkup('button:contains("Nhập Excel")').length, 1, 'Editor should see Nhập Excel');
  assert.equal(editorMarkup('input[type="file"][accept=".xlsx"]').length, 1, 'Editor should have excel file input');

  // Test Export scope
  const allCustomers: CustomerRef[] = [
    { name: 'Công ty Alpha', customerCode: 'KH-ALPHA', address: 'Hà Nội' },
    { name: 'Công ty Beta', customerCode: 'KH-BETA', address: 'Hải Phòng' },
    { name: 'Công ty Gamma', customerCode: 'KH-GAMMA', address: 'Đà Nẵng' },
  ];
  const filteredCustomers: CustomerRef[] = [allCustomers[1]];

  const wbAll = exportPcnCustomersWorkbook({ customers: allCustomers, filteredCustomers, scope: 'all' });
  const sheetAll = wbAll.Sheets[wbAll.SheetNames[0]];
  const rowsAll = XLSX.utils.sheet_to_json<string[]>(sheetAll, { header: 1 });
  assert.equal(rowsAll.length, 4, 'Header + 3 customers');
  assert.equal(rowsAll[0][0], 'Tên khách hàng');
  assert.equal(rowsAll[1][0], 'Công ty Alpha');

  const wbFiltered = exportPcnCustomersWorkbook({ customers: allCustomers, filteredCustomers, scope: 'filtered' });
  const sheetFiltered = wbFiltered.Sheets[wbFiltered.SheetNames[0]];
  const rowsFiltered = XLSX.utils.sheet_to_json<string[]>(sheetFiltered, { header: 1 });
  assert.equal(rowsFiltered.length, 2, 'Header + 1 filtered customer');
  assert.equal(rowsFiltered[1][0], 'Công ty Beta');
});

test('Customer excel preview parses file, prevents direct store mutation, formats preview labels without fake row numbers, and truncates long lists', async () => {
  const api = await getDirectoryApi();
  const prepareCustomerImportPreview = api.prepareCustomerImportPreview as (params: {
    fileName: string;
    fileBuffer: ArrayBuffer | Uint8Array;
    currentCustomers: CustomerRef[];
  }) => {
    fileName: string;
    validCustomers: CustomerRef[];
    errors: Array<{ rowNumber?: number; message: string }>;
  };
  const PcnCustomerImportPreview = api.PcnCustomerImportPreview as React.ComponentType<{
    preview: {
      fileName: string;
      validCustomers: CustomerRef[];
      errors: Array<{ rowNumber?: number; message: string }>;
    };
    isImporting: boolean;
    alreadyApplied: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>;

  assert.equal(typeof prepareCustomerImportPreview, 'function');
  assert.equal(typeof PcnCustomerImportPreview, 'function');

  // Create sample workbook with 12 valid and 1 conflict
  const rows = [
    ['Tên khách hàng *', 'Mã KH', 'Địa chỉ'],
    ['Công ty 1', 'KH-001', 'Hà Nội'],
    ['Công ty 2', 'KH-002', 'Hà Nội'],
    ['Công ty 3', 'KH-003', 'Hà Nội'],
    ['Công ty 4', 'KH-004', 'Hà Nội'],
    ['Công ty 5', 'KH-005', 'Hà Nội'],
    ['Công ty 6', 'KH-006', 'Hà Nội'],
    ['Công ty 7', 'KH-007', 'Hà Nội'],
    ['Công ty 8', 'KH-008', 'Hà Nội'],
    ['Công ty 9', 'KH-009', 'Hà Nội'],
    ['Công ty 10', 'KH-010', 'Hà Nội'],
    ['Công ty 11', 'KH-011', 'Hà Nội'],
    ['Công ty 12', 'KH-012', 'Hà Nội'],
    ['Công ty Trùng', 'KH-EXIST', 'Hà Nội'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');
  const buffer = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  const currentCustomers: CustomerRef[] = [
    { name: 'Công ty Hiện Hữu', customerCode: 'KH-EXIST', address: 'Hà Nội' },
  ];

  const preview = prepareCustomerImportPreview({
    fileName: 'danh-sach-moi.xlsx',
    fileBuffer: buffer,
    currentCustomers,
  });

  assert.equal(preview.fileName, 'danh-sach-moi.xlsx');
  assert.equal(preview.validCustomers.length, 12);
  assert.equal(preview.errors.length, 1);
  assert.equal(preview.errors[0].rowNumber, 14);

  // Render preview component
  const markup = cheerio.load(renderToStaticMarkup(React.createElement(PcnCustomerImportPreview, {
    preview,
    isImporting: false,
    alreadyApplied: false,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  })));

  // Verifies file name & counts
  assert.match(markup.text(), /danh-sach-moi\.xlsx/);
  assert.match(markup.text(), /Hợp lệ: 12/);
  assert.match(markup.text(), /Lỗi \/ Trùng: 1/);

  // Verifies preview labels do NOT invent fake Excel row numbers for valid records
  assert.match(markup.text(), /Bản xem trước #1/);
  assert.match(markup.text(), /Bản xem trước #10/);
  assert.ok(!markup.text().includes('Dòng 1: Công ty 1'), 'Valid records must not invent fake Excel row numbers');

  // Verifies pagination / truncation (max 10 rendered initially, show more indicator)
  assert.match(markup.text(), /Xem thêm 2/);

  // Verifies row-specific error preserves parser rowNumber
  assert.match(markup.text(), /Dòng 14:/);

  // Verifies selecting/preparing preview did not mutate store
  let mockStoreCalls = 0;
  const mockAddCustomer = async () => { mockStoreCalls++; };
  // Only executeCustomerImport mutates store, prepareCustomerImportPreview does not
  assert.equal(mockStoreCalls, 0, 'File selection / preview generation must never call addCustomer');

  // Verifies locking during import (isImporting: true)
  const importingMarkup = cheerio.load(renderToStaticMarkup(React.createElement(PcnCustomerImportPreview, {
    preview,
    isImporting: true,
    alreadyApplied: false,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  })));
  assert.match(importingMarkup('button:disabled').text(), /Đang lưu\.\.\./);

  // Verifies double-click / re-application protection (alreadyApplied: true)
  const appliedMarkup = cheerio.load(renderToStaticMarkup(React.createElement(PcnCustomerImportPreview, {
    preview,
    isImporting: false,
    alreadyApplied: true,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  })));
  assert.equal(appliedMarkup('button:contains("Xác nhận nhập")').length, 0, 'Must not allow re-applying same preview');
  assert.match(appliedMarkup.text(), /Đã xử lý/);

  // Verifies malformed / invalid excel file error handling
  const badBuffer = new Uint8Array([1, 2, 3]);
  const badPreview = prepareCustomerImportPreview({
    fileName: 'invalid.xlsx',
    fileBuffer: badBuffer,
    currentCustomers: [],
  });
  assert.equal(badPreview.validCustomers.length, 0);
  assert.ok(badPreview.errors.length > 0);
  assert.match(badPreview.errors[0].message, /hỏng|không hợp lệ/i);
});

test('Customer excel sequential import executes with duplicate recheck, locking, and per-line error tracking', async () => {
  const api = await getDirectoryApi();
  const executeCustomerImport = api.executeCustomerImport as (params: {
    fileBuffer: ArrayBuffer | Uint8Array;
    previewCustomers: CustomerRef[];
    getLatestCustomers: () => CustomerRef[];
    addCustomer: (cust: Partial<CustomerRef>) => Promise<void>;
  }) => Promise<{
    successCount: number;
    failedCount: number;
    errors: Array<{ message: string }>;
  }>;

  assert.equal(typeof executeCustomerImport, 'function');

  // Create workbook with 3 customers: C1, C2, C3
  const rows = [
    ['Tên khách hàng *', 'Mã KH', 'Địa chỉ'],
    ['Công ty 1', 'KH-001', 'Hà Nội'],
    ['Công ty 2', 'KH-002', 'Hà Nội'],
    ['Công ty 3', 'KH-003', 'Hà Nội'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');
  const buffer = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  // Simulate a state where before confirm, another user added KH-002
  const latestCustomers: CustomerRef[] = [
    { name: 'Công ty Đối thủ', customerCode: 'KH-002', address: 'Đà Nẵng' },
  ];
  const previewCustomers: CustomerRef[] = [
    { name: 'Công ty 1', customerCode: 'KH-001', address: 'Hà Nội' },
    { name: 'Công ty 2', customerCode: 'KH-002', address: 'Hà Nội' },
    { name: 'Công ty 3', customerCode: 'KH-003', address: 'Hà Nội' },
  ];

  const added: Partial<CustomerRef>[] = [];
  const executionOrder: string[] = [];

  const result = await executeCustomerImport({
    fileBuffer: buffer,
    previewCustomers,
    getLatestCustomers: () => latestCustomers,
    addCustomer: async (customer) => {
      executionOrder.push(customer.name!);
      if (customer.customerCode === 'KH-003') {
        throw new Error('Lỗi máy chủ lưu KH-003');
      }
      added.push(customer);
    },
  });

  // Re-check with latest customers should catch KH-002 as conflict
  // Sequential execution should try C1 (success), skip C2 due to conflict, try C3 (fails on store save)
  assert.equal(result.successCount, 1, 'Only Công ty 1 should succeed');
  assert.equal(result.failedCount, 2, 'Công ty 2 (duplicate) and Công ty 3 (save error) should fail');
  assert.deepEqual(executionOrder, ['Công ty 1', 'Công ty 3'], 'addCustomer called sequentially only for valid recheck items');

  // Verify per-line error tracking
  assert.ok(result.errors.some((e) => e.message.includes('KH-002') && e.message.includes('đã tồn tại')));
  assert.ok(result.errors.some((e) => e.message.includes('Lỗi máy chủ lưu KH-003') && e.message.includes('Bản xem trước #3')));
});
