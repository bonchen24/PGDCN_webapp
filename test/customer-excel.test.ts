// Author: Gemini
// OS support: Web/Node
// Description: Unit tests for Customer Excel parsing and export utility

import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import type { CustomerRef } from '../types.ts';
import {
  parseCustomerWorkbook,
  exportCustomersToWorkbook,
  type CustomerExcelIssue,
} from '../utils/customerExcel.ts';

function createWorkbookBuffer(rows: Array<Record<string, unknown> | unknown[]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = Array.isArray(rows[0])
    ? XLSX.utils.aoa_to_sheet(rows as unknown[][])
    : XLSX.utils.json_to_sheet(rows as Array<Record<string, unknown>>);
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

test('parseCustomerWorkbook rejects malformed / invalid bytes', () => {
  const invalidBytes = new Uint8Array([1, 2, 3, 4, 5]);
  const result = parseCustomerWorkbook(invalidBytes);

  assert.equal(result.customers.length, 0);
  assert.ok(result.errors.length > 0);
  assert.equal(result.errors[0].rowNumber, undefined);
  assert.match(result.errors[0].message, /(lỗi|hỏng|không hợp lệ|định dạng)/i);
});

test('parseCustomerWorkbook rejects empty or no-data workbook', () => {
  const emptyWb = XLSX.utils.book_new();
  const emptyWs = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(emptyWb, emptyWs, 'Sheet1');
  const emptyBytes = new Uint8Array(XLSX.write(emptyWb, { type: 'buffer', bookType: 'xlsx' }));

  const result = parseCustomerWorkbook(emptyBytes);
  assert.equal(result.customers.length, 0);
  assert.ok(result.errors.length > 0);
  assert.equal(result.errors[0].rowNumber, undefined);
  assert.match(result.errors[0].message, /(trống|không có dữ liệu)/i);
});

test('parseCustomerWorkbook parses Vietnamese headers with variations and maps to CustomerRef', () => {
  const rows = [
    [
      '  Tên KHÁCH HÀNG * ',
      'MÃ KH',
      'ĐỊA CHỈ',
      'Mã Số Thuế',
      'Người Liên Hệ',
      'Số Điện Thoại',
      'Email',
    ],
    [
      'Công ty TNHH Thử Nghiệm Alpha',
      'KH001',
      '123 Đường A, Hà Nội',
      '0101234567',
      'Nguyễn Văn A',
      '0901234567',
      'alpha@example.com',
    ],
  ];

  const bytes = createWorkbookBuffer(rows);
  const result = parseCustomerWorkbook(bytes);

  assert.equal(result.errors.length, 0);
  assert.equal(result.customers.length, 1);
  assert.deepEqual(result.customers[0], {
    name: 'Công ty TNHH Thử Nghiệm Alpha',
    customerCode: 'KH001',
    address: '123 Đường A, Hà Nội',
    taxId: '0101234567',
    contactPerson: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'alpha@example.com',
  });
});

test('parseCustomerWorkbook reports file-level error when required name header is missing', () => {
  const rows = [
    ['Mã KH', 'Địa chỉ', 'MST'],
    ['KH001', 'Hà Nội', '0101234567'],
  ];

  const bytes = createWorkbookBuffer(rows);
  const result = parseCustomerWorkbook(bytes);

  assert.equal(result.customers.length, 0);
  assert.ok(result.errors.length > 0);
  assert.equal(result.errors[0].rowNumber, undefined);
  assert.match(result.errors[0].message, /(tên khách hàng|tiêu đề)/i);
});

test('parseCustomerWorkbook skips wholly blank rows and flags nonblank rows with missing name', () => {
  const rows = [
    ['Tên khách hàng', 'Mã KH', 'Địa chỉ'],
    ['Công ty A', 'KH01', 'Hà Nội'],
    ['', '', ''], // row 3: wholly blank
    ['', 'KH02', 'Đà Nẵng'], // row 4: missing name
    ['Công ty B', 'KH03', 'TP HCM'],
  ];

  const bytes = createWorkbookBuffer(rows);
  const result = parseCustomerWorkbook(bytes);

  assert.equal(result.customers.length, 2);
  assert.equal(result.customers[0].name, 'Công ty A');
  assert.equal(result.customers[1].name, 'Công ty B');

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].rowNumber, 4);
  assert.match(result.errors[0].message, /(tên khách hàng|bắt buộc|thiếu)/i);
});

test('parseCustomerWorkbook detects duplicate customerCode and taxId among incoming rows', () => {
  const rows = [
    ['Tên khách hàng', 'Mã KH', 'Địa chỉ', 'MST'],
    ['Công ty 1', 'KH-001', 'Hà Nội', '0100000001'], // row 2
    ['Công ty 2', ' KH-001 ', 'Đà Nẵng', '0100000002'], // row 3 duplicate customerCode of row 2
    ['Công ty 3', 'KH-003', 'TP HCM', '0100000001-001'], // row 4 distinct
    ['Công ty 4', 'KH-004', 'Cần Thơ', ' 0100000001-001 '], // row 5 duplicate taxId of row 4
  ];

  const bytes = createWorkbookBuffer(rows);
  const result = parseCustomerWorkbook(bytes);

  // Rows 3 and 5 rejected
  assert.equal(result.customers.length, 2);
  assert.equal(result.customers[0].name, 'Công ty 1');
  assert.equal(result.customers[1].name, 'Công ty 3');

  assert.equal(result.errors.length, 2);
  const row3Error = result.errors.find((e) => e.rowNumber === 3);
  const row5Error = result.errors.find((e) => e.rowNumber === 5);

  assert.ok(row3Error);
  assert.match(row3Error.message, /(trùng|mã kh|dòng 2)/i);

  assert.ok(row5Error);
  assert.match(row5Error.message, /(trùng|mã số thuế|mst|dòng 4)/i);
});

test('parseCustomerWorkbook detects duplicates against existingCustomers with conservative normalization', () => {
  const existingCustomers: CustomerRef[] = [
    {
      name: 'Existing Company A',
      address: 'Hà Nội',
      customerCode: 'KH-ALPHA',
      taxId: '0109999999',
    },
  ];

  const rows = [
    ['Tên khách hàng', 'Mã KH', 'Địa chỉ', 'MST'],
    ['Incoming Company 1', ' kh-alpha ', 'Hà Nội', '0101111111'], // matches existing KH-ALPHA
    ['Incoming Company 2', 'KH-BETA', 'Hà Nội', ' 0109999999 '], // matches existing taxId
    ['Incoming Company 3', 'KH-GAMMA', 'Hà Nội', '0102222222'], // valid
  ];

  const bytes = createWorkbookBuffer(rows);
  const result = parseCustomerWorkbook(bytes, existingCustomers);

  assert.equal(result.customers.length, 1);
  assert.equal(result.customers[0].name, 'Incoming Company 3');

  assert.equal(result.errors.length, 2);
  const errRow2 = result.errors.find((e) => e.rowNumber === 2);
  const errRow3 = result.errors.find((e) => e.rowNumber === 3);

  assert.ok(errRow2);
  assert.match(errRow2.message, /(đã tồn tại|mã kh)/i);

  assert.ok(errRow3);
  assert.match(errRow3.message, /(đã tồn tại|mã số thuế|mst)/i);

  // Verify existingCustomers was not mutated
  assert.equal(existingCustomers.length, 1);
  assert.equal(existingCustomers[0].customerCode, 'KH-ALPHA');
});

test('parseCustomerWorkbook allows same-name records with distinct identifiers and does not mutate inputs', () => {
  const rows = [
    ['Tên khách hàng', 'Mã KH', 'Địa chỉ', 'MST'],
    ['Chi nhánh Tổng công ty', 'CN-HN', 'Hà Nội', '0100000001'],
    ['Chi nhánh Tổng công ty', 'CN-HCM', 'TP HCM', '0100000002'],
  ];

  const originalInput = createWorkbookBuffer(rows);
  const clonedInput = new Uint8Array(originalInput);

  const result = parseCustomerWorkbook(originalInput);

  assert.equal(result.errors.length, 0);
  assert.equal(result.customers.length, 2);
  assert.equal(result.customers[0].name, 'Chi nhánh Tổng công ty');
  assert.equal(result.customers[1].name, 'Chi nhánh Tổng công ty');
  assert.equal(result.customers[0].customerCode, 'CN-HN');
  assert.equal(result.customers[1].customerCode, 'CN-HCM');

  // Verify input byte array was not mutated
  assert.deepEqual(originalInput, clonedInput);
});

test('parseCustomerWorkbook accepts ArrayBuffer input', () => {
  const rows = [
    ['Tên khách hàng', 'Địa chỉ'],
    ['Công ty ArrayBuffer', 'Hải Phòng'],
  ];
  const uint8 = createWorkbookBuffer(rows);
  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

  const result = parseCustomerWorkbook(arrayBuffer);
  assert.equal(result.errors.length, 0);
  assert.equal(result.customers.length, 1);
  assert.equal(result.customers[0].name, 'Công ty ArrayBuffer');
  assert.equal(result.customers[0].address, 'Hải Phòng');
});


test('exportCustomersToWorkbook exports exact 7 columns in order and sanitizes formula injection', () => {
  const customers: CustomerRef[] = [
    {
      name: '=SUM(1,2)',
      customerCode: '+CMD',
      address: '-Minus Address',
      taxId: '@TaxId',
      contactPerson: '\tTabbed Person',
      phone: '\rReturn Phone',
      email: 'safe@example.com',
      normalizedSearchStr: 'SHOULD NOT BE EXPORTED',
      createdAt: '2026-01-01',
    },
    {
      name: 'Safe Company',
      address: '123 Street',
      phone: '0987654321',
    },
  ];

  const wb = exportCustomersToWorkbook(customers);

  assert.ok(wb.SheetNames.length > 0);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  assert.ok(sheet);

  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  const headers = rawRows[0];
  const expectedHeaders = [
    'Tên khách hàng',
    'Mã KH',
    'Địa chỉ',
    'MST',
    'Liên hệ',
    'Điện thoại',
    'Email',
  ];

  assert.deepEqual(headers, expectedHeaders);

  const row1 = rawRows[1];
  assert.equal(row1[0], "'=SUM(1,2)");
  assert.equal(row1[1], "'+CMD");
  assert.equal(row1[2], "'-Minus Address");
  assert.equal(row1[3], "'@TaxId");
  assert.equal(row1[4], "'\tTabbed Person");
  assert.equal(row1[5], "'\rReturn Phone");
  assert.equal(row1[6], 'safe@example.com');

  // Ensure extra properties like normalizedSearchStr or createdAt are not present in any column
  assert.equal(headers.length, 7);
  for (const row of rawRows.slice(1)) {
    assert.ok(row.length <= 7);
    assert.ok(!row.includes('SHOULD NOT BE EXPORTED'));
    assert.ok(!row.includes('2026-01-01'));
  }
});
