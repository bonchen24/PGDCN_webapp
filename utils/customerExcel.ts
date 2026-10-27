// Author: Gemini
// OS support: Web/Node
// Description: Utilities for parsing and exporting Customer Excel workbooks

import * as XLSX from 'xlsx';
import type { CustomerRef } from '../types.ts';

export interface CustomerExcelIssue {
  rowNumber?: number;
  message: string;
}

type CustomerField =
  | 'name'
  | 'customerCode'
  | 'address'
  | 'taxId'
  | 'contactPerson'
  | 'phone'
  | 'email';

const HEADER_FIELD_MAP: Record<string, CustomerField> = {
  // Name
  tenkhachhang: 'name',
  tenkh: 'name',
  tencongty: 'name',
  tendonvi: 'name',
  tentochuc: 'name',
  khachhang: 'name',
  customername: 'name',
  customer: 'name',

  // Customer Code
  makh: 'customerCode',
  makhachhang: 'customerCode',
  masokh: 'customerCode',
  madoitac: 'customerCode',
  customercode: 'customerCode',
  code: 'customerCode',

  // Address
  diachi: 'address',
  diachikh: 'address',
  diachikhachhang: 'address',
  diachitruso: 'address',
  address: 'address',

  // Tax ID
  mst: 'taxId',
  masothue: 'taxId',
  mathue: 'taxId',
  taxid: 'taxId',
  taxcode: 'taxId',
  vat: 'taxId',
  masodn: 'taxId',
  madoanhnghiep: 'taxId',

  // Contact Person
  lienhe: 'contactPerson',
  nguoilienhe: 'contactPerson',
  daidien: 'contactPerson',
  nguoidaidien: 'contactPerson',
  contactperson: 'contactPerson',
  contact: 'contactPerson',

  // Phone
  dienthoai: 'phone',
  sodienthoai: 'phone',
  sdt: 'phone',
  sodt: 'phone',
  phone: 'phone',
  tel: 'phone',
  telephone: 'phone',
  mobile: 'phone',

  // Email
  email: 'email',
  thudientu: 'email',
  mail: 'email',
};

function normalizeHeaderName(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function matchHeaderField(headerText: string): CustomerField | null {
  const norm = normalizeHeaderName(headerText);
  if (!norm) return null;

  if (HEADER_FIELD_MAP[norm]) {
    return HEADER_FIELD_MAP[norm];
  }

  if (norm.includes('tenkhachhang') || norm.includes('customername')) {
    return 'name';
  }
  if (norm.includes('makh') || norm.includes('customercode')) {
    return 'customerCode';
  }
  if (norm.includes('masothue') || norm.includes('mst') || norm.includes('taxid')) {
    return 'taxId';
  }
  if (norm.includes('diachi') || norm.includes('address')) {
    return 'address';
  }
  if (norm.includes('nguoilienhe') || norm.includes('lienhe') || norm.includes('contactperson')) {
    return 'contactPerson';
  }
  if (norm.includes('dienthoai') || norm.includes('sdt') || norm.includes('phone')) {
    return 'phone';
  }
  if (norm.includes('email') || norm.includes('thudientu')) {
    return 'email';
  }

  return null;
}

export function normalizeIdentifier(val: string): string {
  return val.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

function isValidExcelContainer(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 4) return false;
  // ZIP / XLSX
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return (
      (bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08)
    );
  }
  // OLE / CFB / XLS
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  ) {
    return true;
  }
  return false;
}

function getCellText(ws: XLSX.WorkSheet, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return '';
  if (cell.w !== undefined) return String(cell.w).trim();
  if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
  return '';
}

export function parseCustomerWorkbook(
  input: ArrayBuffer | Uint8Array,
  existingCustomers?: readonly CustomerRef[]
): { customers: CustomerRef[]; errors: CustomerExcelIssue[] } {
  const rawBytes =
    input instanceof Uint8Array
      ? new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength))
      : new Uint8Array(input.slice(0));

  if (!isValidExcelContainer(rawBytes)) {
    return {
      customers: [],
      errors: [{ message: 'File Excel không hợp lệ hoặc bị hỏng định dạng.' }],
    };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(rawBytes, { type: 'array' });
  } catch {
    return {
      customers: [],
      errors: [{ message: 'File Excel không hợp lệ hoặc bị hỏng định dạng.' }],
    };
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return {
      customers: [],
      errors: [{ message: 'File Excel trống, không có trang tính nào.' }],
    };
  }

  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  if (!ws || !ws['!ref']) {
    return {
      customers: [],
      errors: [{ message: 'File Excel trống hoặc không có dữ liệu.' }],
    };
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  if (range.s.r > range.e.r || range.s.c > range.e.c) {
    return {
      customers: [],
      errors: [{ message: 'File Excel trống hoặc không có dữ liệu.' }],
    };
  }

  let headerRowIndex = -1;
  const columnMapping: Partial<Record<CustomerField, number>> = {};

  for (let r = range.s.r; r <= range.e.r; r++) {
    const tempMapping: Partial<Record<CustomerField, number>> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const text = getCellText(ws, r, c);
      if (!text) continue;
      const field = matchHeaderField(text);
      if (field && tempMapping[field] === undefined) {
        tempMapping[field] = c;
      }
    }
    if (tempMapping.name !== undefined) {
      headerRowIndex = r;
      Object.assign(columnMapping, tempMapping);
      break;
    }
  }

  if (headerRowIndex === -1 || columnMapping.name === undefined) {
    return {
      customers: [],
      errors: [{ message: 'File Excel thiếu cột tiêu đề bắt buộc "Tên khách hàng".' }],
    };
  }

  const existingCustomerCodes = new Set<string>();
  const existingTaxIds = new Set<string>();

  if (existingCustomers) {
    for (const c of existingCustomers) {
      if (c.customerCode && c.customerCode.trim()) {
        existingCustomerCodes.add(normalizeIdentifier(c.customerCode));
      }
      if (c.taxId && c.taxId.trim()) {
        existingTaxIds.add(normalizeIdentifier(c.taxId));
      }
    }
  }

  const seenIncomingCodes = new Map<string, number>();
  const seenIncomingTaxIds = new Map<string, number>();

  const customers: CustomerRef[] = [];
  const errors: CustomerExcelIssue[] = [];
  let nonBlankDataRows = 0;

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    let isRowBlank = true;
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (getCellText(ws, r, c)) {
        isRowBlank = false;
        break;
      }
    }

    if (isRowBlank) {
      continue;
    }

    nonBlankDataRows++;
    const rowNumber = r + 1;

    const name = columnMapping.name !== undefined ? getCellText(ws, r, columnMapping.name) : '';
    const customerCode = columnMapping.customerCode !== undefined ? getCellText(ws, r, columnMapping.customerCode) : '';
    const address = columnMapping.address !== undefined ? getCellText(ws, r, columnMapping.address) : '';
    const taxId = columnMapping.taxId !== undefined ? getCellText(ws, r, columnMapping.taxId) : '';
    const contactPerson = columnMapping.contactPerson !== undefined ? getCellText(ws, r, columnMapping.contactPerson) : '';
    const phone = columnMapping.phone !== undefined ? getCellText(ws, r, columnMapping.phone) : '';
    const email = columnMapping.email !== undefined ? getCellText(ws, r, columnMapping.email) : '';

    if (!name) {
      errors.push({
        rowNumber,
        message: `Dòng ${rowNumber}: Thiếu thông tin bắt buộc "Tên khách hàng".`,
      });
      continue;
    }

    let isConflict = false;

    if (customerCode) {
      const normCode = normalizeIdentifier(customerCode);
      if (existingCustomerCodes.has(normCode)) {
        errors.push({
          rowNumber,
          message: `Dòng ${rowNumber}: Mã KH "${customerCode}" đã tồn tại trong hệ thống.`,
        });
        isConflict = true;
      } else if (seenIncomingCodes.has(normCode)) {
        const priorRow = seenIncomingCodes.get(normCode)!;
        errors.push({
          rowNumber,
          message: `Dòng ${rowNumber}: Mã KH "${customerCode}" bị trùng với dòng ${priorRow}.`,
        });
        isConflict = true;
      } else {
        seenIncomingCodes.set(normCode, rowNumber);
      }
    }

    if (taxId) {
      const normTax = normalizeIdentifier(taxId);
      if (existingTaxIds.has(normTax)) {
        errors.push({
          rowNumber,
          message: `Dòng ${rowNumber}: Mã số thuế "${taxId}" đã tồn tại trong hệ thống.`,
        });
        isConflict = true;
      } else if (seenIncomingTaxIds.has(normTax)) {
        const priorRow = seenIncomingTaxIds.get(normTax)!;
        errors.push({
          rowNumber,
          message: `Dòng ${rowNumber}: Mã số thuế "${taxId}" bị trùng với dòng ${priorRow}.`,
        });
        isConflict = true;
      } else {
        seenIncomingTaxIds.set(normTax, rowNumber);
      }
    }

    if (!isConflict) {
      const customer: CustomerRef = {
        name,
        address,
      };
      if (customerCode) customer.customerCode = customerCode;
      if (taxId) customer.taxId = taxId;
      if (contactPerson) customer.contactPerson = contactPerson;
      if (phone) customer.phone = phone;
      if (email) customer.email = email;

      customers.push(customer);
    }
  }

  if (nonBlankDataRows === 0) {
    return {
      customers: [],
      errors: [{ message: 'File Excel không có dữ liệu khách hàng.' }],
    };
  }

  return { customers, errors };
}

function sanitizeExportValue(val: unknown): string {
  if (val === undefined || val === null) {
    return '';
  }
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function exportCustomersToWorkbook(
  customers: readonly CustomerRef[]
): XLSX.WorkBook {
  const EXPORT_HEADERS = [
    'Tên khách hàng',
    'Mã KH',
    'Địa chỉ',
    'MST',
    'Liên hệ',
    'Điện thoại',
    'Email',
  ];

  const dataRows = (customers || []).map((c) => [
    sanitizeExportValue(c.name),
    sanitizeExportValue(c.customerCode),
    sanitizeExportValue(c.address),
    sanitizeExportValue(c.taxId),
    sanitizeExportValue(c.contactPerson),
    sanitizeExportValue(c.phone),
    sanitizeExportValue(c.email),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');
  return wb;
}
