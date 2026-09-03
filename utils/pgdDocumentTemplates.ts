import {
  PGD_DOMAIN,
  type PgdProductGroup,
} from './pgdDomain.ts';

export type PgdDocumentTemplateKind =
  | 'INTAKE_REQUEST'
  | 'ASSIGNMENT'
  | 'INSPECTION_PLAN'
  | 'FIELD_INSPECTION'
  | 'SAMPLE_TAKING'
  | 'LAB_REQUEST'
  | 'INSPECTION_REPORT'
  | 'INSPECTION_CERTIFICATE';

export type PgdDocumentTemplateFormat = 'DOCX' | 'PDF';
export type PgdDocumentTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type PgdCellType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'TABLE';

export interface PgdCellValidation {
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  minRows?: number;
  maxRows?: number;
}

export type PgdCellScalar = string | number | boolean | null;
export type PgdCellTableRow = Record<string, PgdCellScalar>;
export type PgdCellStoredValue = PgdCellScalar | PgdCellTableRow[];

export interface PgdTemplateCell {
  key: string;
  label: string;
  sectionCode: string;
  row: number;
  column: number;
  type: PgdCellType;
  required: boolean;
  active?: boolean;
  unit?: string;
  binding?: string;
  validation?: PgdCellValidation;
  tableColumns?: string[];
}

export type PgdTemplateCellInput = Partial<PgdTemplateCell> & Pick<PgdTemplateCell, 'key' | 'label'>;

export interface PgdDocumentTemplate {
  id: string;
  domain: typeof PGD_DOMAIN;
  kind: PgdDocumentTemplateKind;
  code: string;
  name: string;
  version: string;
  status: PgdDocumentTemplateStatus;
  productGroups: PgdProductGroup[];
  methodCodes?: string[];
  formats: PgdDocumentTemplateFormat[];
  cells: PgdTemplateCell[];
  /** Packaged DOCX form asset; the DOCX layout is the source of truth for rendering. */
  fileName: string;
  /** Placeholder keys discovered from the packaged DOCX asset. */
  placeholderKeys: string[];
  requiredPlaceholderKeys: string[];
  sourceFormLabel: string;
  active: boolean;
}

export interface PgdDocumentTemplateSnapshot extends Omit<PgdDocumentTemplate, 'id' | 'active'> {
  templateId: string;
  capturedAt: string;
}

export interface PgdCellValue {
  key: string;
  value: PgdCellStoredValue;
}

export interface PgdCellValidationIssue {
  key: string;
  code: 'DUPLICATE_KEY' | 'INVALID_KEY' | 'INVALID_POSITION' | 'INVALID_TYPE' | 'REQUIRED' | 'TYPE' | 'RANGE' | 'PATTERN' | 'OPTION' | 'TABLE_ROWS' | 'UNKNOWN_KEY';
  message: string;
}

const ALL_PRODUCT_GROUPS: PgdProductGroup[] = ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'];

function cloneValidation(validation?: PgdCellValidation): PgdCellValidation | undefined {
  if (!validation) return undefined;
  return {
    ...(typeof validation.min === 'number' ? { min: validation.min } : {}),
    ...(typeof validation.max === 'number' ? { max: validation.max } : {}),
    ...(typeof validation.pattern === 'string' ? { pattern: validation.pattern } : {}),
    ...(Array.isArray(validation.options) ? { options: validation.options.map((item) => String(item)) } : {}),
    ...(typeof validation.minRows === 'number' ? { minRows: validation.minRows } : {}),
    ...(typeof validation.maxRows === 'number' ? { maxRows: validation.maxRows } : {}),
  };
}

function cloneCell(cell: PgdTemplateCell): PgdTemplateCell {
  return {
    ...cell,
    ...(cell.validation ? { validation: cloneValidation(cell.validation) } : {}),
    ...(cell.tableColumns ? { tableColumns: [...cell.tableColumns] } : {}),
  };
}

function derivePlaceholderKeys(cells: readonly PgdTemplateCell[], requiredOnly = false): string[] {
  return [...new Set(cells
    .filter((cell) => cell.active !== false && (!requiredOnly || cell.required))
    .map((cell) => cell.key))]
    .sort((left, right) => left.localeCompare(right));
}

function cloneTemplate(template: PgdDocumentTemplate): PgdDocumentTemplate {
  const cells = template.cells.map(cloneCell);
  return {
    ...template,
    productGroups: [...template.productGroups],
    ...(template.methodCodes ? { methodCodes: [...template.methodCodes] } : {}),
    formats: [...template.formats],
    cells,
    fileName: String(template.fileName || `${template.code}.docx`).trim(),
    placeholderKeys: [...(template.placeholderKeys?.length ? template.placeholderKeys : derivePlaceholderKeys(cells))],
    requiredPlaceholderKeys: [...(template.requiredPlaceholderKeys?.length ? template.requiredPlaceholderKeys : derivePlaceholderKeys(cells, true))],
  };
}

export function normalizePgdTemplateCells(cells: readonly PgdTemplateCellInput[]): PgdTemplateCell[] {
  return cells
    .map((input) => ({
      key: String(input.key || '').trim(),
      label: String(input.label || '').trim(),
      sectionCode: String(input.sectionCode || 'general').trim() || 'general',
      row: Number.isInteger(Number(input.row)) ? Number(input.row) : 1,
      column: Number.isInteger(Number(input.column)) ? Number(input.column) : 1,
      type: String(input.type || 'TEXT').toUpperCase() as PgdCellType,
      required: input.required === true,
      active: input.active !== false,
      ...(String(input.unit || '').trim() ? { unit: String(input.unit).trim() } : {}),
      ...(String(input.binding || '').trim() ? { binding: String(input.binding).trim() } : {}),
      ...(input.validation ? { validation: cloneValidation(input.validation) } : {}),
      ...(Array.isArray(input.tableColumns) && input.tableColumns.length > 0
        ? { tableColumns: input.tableColumns.map((item) => String(item).trim()).filter(Boolean) }
        : {}),
    }))
    .sort((left, right) => left.row - right.row || left.column - right.column || left.key.localeCompare(right.key));
}

export function validatePgdTemplateCells(cells: readonly PgdTemplateCellInput[]): PgdCellValidationIssue[] {
  const normalized = normalizePgdTemplateCells(cells);
  const issues: PgdCellValidationIssue[] = [];
  const counts = new Map<string, number>();
  for (const cell of normalized) counts.set(cell.key, (counts.get(cell.key) || 0) + 1);

  for (const cell of normalized) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(cell.key)) {
      issues.push({ key: cell.key, code: 'INVALID_KEY', message: 'Mã cell “' + (cell.key || '(trống)') + '” không hợp lệ.' });
    }
    if ((counts.get(cell.key) || 0) > 1 && !issues.some((issue) => issue.code === 'DUPLICATE_KEY' && issue.key === cell.key)) {
      issues.push({ key: cell.key, code: 'DUPLICATE_KEY', message: 'Mã cell “' + cell.key + '” bị trùng trong template.' });
    }
    if (!cell.label || !cell.sectionCode || !Number.isInteger(cell.row) || cell.row < 1 || !Number.isInteger(cell.column) || cell.column < 1) {
      issues.push({ key: cell.key, code: 'INVALID_POSITION', message: 'Cell “' + (cell.label || cell.key) + '” phải có section, hàng và cột dương.' });
    }
    if (!['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'TABLE'].includes(cell.type)) {
      issues.push({ key: cell.key, code: 'INVALID_TYPE', message: 'Cell “' + (cell.label || cell.key) + '” có kiểu dữ liệu không được hỗ trợ.' });
    }
    if (cell.type === 'TABLE' && (!cell.tableColumns || cell.tableColumns.length === 0)) {
      issues.push({ key: cell.key, code: 'TABLE_ROWS', message: 'Cell bảng “' + (cell.label || cell.key) + '” phải khai báo cột.' });
    }
  }
  const priority: PgdCellValidationIssue['code'][] = ['DUPLICATE_KEY', 'INVALID_KEY', 'INVALID_POSITION', 'INVALID_TYPE', 'TABLE_ROWS'];
  return issues.sort((left, right) => priority.indexOf(left.code) - priority.indexOf(right.code) || left.key.localeCompare(right.key));
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function normalizeTable(value: unknown): PgdCellStoredValue {
  if (!Array.isArray(value)) return normalizeText(value);
  return value.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { value: normalizeText(row) };
    return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, item]) => {
      if (typeof item === 'number' && Number.isFinite(item)) return [String(key), item];
      if (typeof item === 'boolean') return [String(key), item];
      return [String(key), normalizeText(item)];
    }));
  });
}

function coercePgdCellValue(cell: PgdTemplateCell, value: unknown): PgdCellStoredValue {
  if (cell.type === 'TEXT') return normalizeText(value);
  if (cell.type === 'NUMBER') {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : String(value).trim();
  }
  if (cell.type === 'DATE') return normalizeDate(value);
  if (cell.type === 'BOOLEAN') {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    if (typeof value === 'boolean') return value;
    const text = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'co', 'có'].includes(text)) return true;
    if (['false', '0', 'no', 'khong', 'không'].includes(text)) return false;
    return String(value).trim();
  }
  return normalizeTable(value);
}

export function normalizePgdCellValues(cells: readonly PgdTemplateCell[], input: Record<string, unknown>): PgdCellValue[] {
  return cells.map((cell) => ({
    key: cell.key,
    value: coercePgdCellValue(cell, Object.prototype.hasOwnProperty.call(input, cell.key) ? input[cell.key] : null),
  }));
}

function isEmptyValue(value: PgdCellStoredValue): boolean {
  return value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function validatePgdCellValues(cells: readonly PgdTemplateCell[], values: readonly PgdCellValue[]): PgdCellValidationIssue[] {
  const issues: PgdCellValidationIssue[] = [];
  const cellsByKey = new Map(cells.map((cell) => [cell.key, cell]));
  const valuesByKey = new Map(values.map((value) => [value.key, value.value]));

  for (const value of values) {
    if (!cellsByKey.has(value.key)) {
      issues.push({ key: value.key, code: 'UNKNOWN_KEY', message: 'Giá trị cell “' + value.key + '” không thuộc template.' });
    }
  }
  for (const cell of cells) {
    if (cell.active === false) continue;
    const value = valuesByKey.get(cell.key);
    if (cell.required && (value === undefined || isEmptyValue(value))) {
      issues.push({ key: cell.key, code: 'REQUIRED', message: 'Thiếu cell bắt buộc “' + cell.label + '”.' });
      continue;
    }
    if (value === undefined || isEmptyValue(value)) continue;
    const validType = cell.type === 'TEXT' || cell.type === 'DATE'
      ? typeof value === 'string'
      : cell.type === 'NUMBER'
        ? typeof value === 'number' && Number.isFinite(value)
        : cell.type === 'BOOLEAN'
          ? typeof value === 'boolean'
          : Array.isArray(value) && value.every((row) => row && typeof row === 'object' && !Array.isArray(row));
    if (!validType) {
      issues.push({ key: cell.key, code: 'TYPE', message: 'Cell “' + cell.label + '” không đúng kiểu ' + cell.type + '.' });
      continue;
    }
    const validation = cell.validation;
    if (!validation) continue;
    if (cell.type === 'NUMBER' && typeof value === 'number' && ((typeof validation.min === 'number' && value < validation.min) || (typeof validation.max === 'number' && value > validation.max))) {
      issues.push({ key: cell.key, code: 'RANGE', message: 'Cell “' + cell.label + '” nằm ngoài giới hạn cho phép.' });
    }
    if (typeof validation.pattern === 'string' && typeof value === 'string') {
      let matched = false;
      try { matched = new RegExp(validation.pattern).test(value); } catch { matched = false; }
      if (!matched) issues.push({ key: cell.key, code: 'PATTERN', message: 'Cell “' + cell.label + '” không khớp định dạng yêu cầu.' });
    }
    if (Array.isArray(validation.options) && typeof value === 'string' && !validation.options.includes(value)) {
      issues.push({ key: cell.key, code: 'OPTION', message: 'Cell “' + cell.label + '” không nằm trong danh sách lựa chọn.' });
    }
    if (Array.isArray(value) && ((typeof validation.minRows === 'number' && value.length < validation.minRows) || (typeof validation.maxRows === 'number' && value.length > validation.maxRows))) {
      issues.push({ key: cell.key, code: 'TABLE_ROWS', message: 'Cell bảng “' + cell.label + '” có số dòng ngoài giới hạn.' });
    }
  }
  return issues;
}

function cell(input: PgdTemplateCellInput): PgdTemplateCell {
  return normalizePgdTemplateCells([input])[0];
}

const sharedCells = {
  requestCode: cell({ key: 'requestCode', label: 'Mã PYC', sectionCode: 'identity', row: 1, column: 1, type: 'TEXT', required: true, binding: 'request.requestCode' }),
  customerName: cell({ key: 'customerName', label: 'Khách hàng', sectionCode: 'customer', row: 1, column: 2, type: 'TEXT', required: true, binding: 'request.customerSnapshot.name' }),
  customerAddress: cell({ key: 'customerAddress', label: 'Địa chỉ', sectionCode: 'customer', row: 2, column: 2, type: 'TEXT', required: true, binding: 'request.customerSnapshot.address' }),
  productName: cell({ key: 'productName', label: 'Tên hàng hóa / thiết bị', sectionCode: 'product', row: 1, column: 3, type: 'TEXT', required: true, binding: 'request.productName' }),
  lotCode: cell({ key: 'lotCode', label: 'Số lô / số nhận dạng', sectionCode: 'product', row: 2, column: 3, type: 'TEXT', required: false, binding: 'request.lotCode' }),
  standards: cell({ key: 'standards', label: 'Tiêu chuẩn áp dụng', sectionCode: 'criteria', row: 1, column: 4, type: 'TABLE', required: true, binding: 'request.standards', tableColumns: ['standard'] }),
  conclusion: cell({ key: 'conclusion', label: 'Kết luận', sectionCode: 'conclusion', row: 1, column: 5, type: 'TEXT', required: true }),
  productDetails: [
    cell({ key: 'grade', label: 'Mác / model / cấp sản phẩm', sectionCode: 'product', row: 4, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.grade' }),
    cell({ key: 'dimensions', label: 'Kích thước / thông số', sectionCode: 'product', row: 5, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.dimensions' }),
    cell({ key: 'productStandard', label: 'Tiêu chuẩn sản phẩm công bố', sectionCode: 'product', row: 6, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.productStandard' }),
    cell({ key: 'origin', label: 'Xuất xứ', sectionCode: 'product', row: 7, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.origin' }),
    cell({ key: 'manufacturer', label: 'Nhà sản xuất', sectionCode: 'product', row: 8, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.manufacturer' }),
    cell({ key: 'importer', label: 'Nhà nhập khẩu', sectionCode: 'product', row: 9, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.importer' }),
    cell({ key: 'customsDocuments', label: 'Chứng từ hải quan / thương mại', sectionCode: 'documents', row: 1, column: 7, type: 'TABLE', required: false, binding: 'request.productDetails.customsDocuments', tableColumns: ['document', 'number', 'date'] }),
  ],
};

const ALL_METHOD_CODES = ['TT58', 'GENERIC'];

function template(
  id: string,
  kind: PgdDocumentTemplateKind,
  code: string,
  name: string,
  cells: PgdTemplateCell[],
  sourceFormLabel: string,
  methodCodes?: string[],
): PgdDocumentTemplate {
  return {
    id,
    domain: PGD_DOMAIN,
    kind,
    code,
    name,
    version: '1.0',
    status: 'PUBLISHED',
    productGroups: [...ALL_PRODUCT_GROUPS],
    ...(methodCodes ? { methodCodes: [...methodCodes] } : {}),
    formats: ['DOCX', 'PDF'],
    cells,
    fileName: `${code}.docx`,
    placeholderKeys: derivePlaceholderKeys(cells),
    requiredPlaceholderKeys: derivePlaceholderKeys(cells, true),
    sourceFormLabel,
    active: true,
  };
}

export const DEFAULT_PGD_DOCUMENT_TEMPLATES: readonly PgdDocumentTemplate[] = [
  template('pgd-template-intake-request', 'INTAKE_REQUEST', 'PGD-BM-01', 'Phiếu tiếp nhận yêu cầu giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress,
    cell({ key: 'intakeChannel', label: 'Kênh tiếp nhận', sectionCode: 'identity', row: 1, column: 2, type: 'TEXT', required: true, binding: 'request.intakeChannel' }),
    sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'quantity', label: 'Số lượng / khối lượng', sectionCode: 'product', row: 3, column: 3, type: 'NUMBER', required: true, unit: 'đơn vị', binding: 'request.quantity' }),
    cell({ key: 'inspectionScope', label: 'Phạm vi giám định', sectionCode: 'criteria', row: 2, column: 4, type: 'TEXT', required: true, binding: 'request.inspectionScope' }),
    cell({ key: 'inspectionLocation', label: 'Địa điểm giám định', sectionCode: 'location', row: 1, column: 6, type: 'TEXT', required: true, binding: 'request.inspectionLocation' }),
    sharedCells.standards,
    ...sharedCells.productDetails,
  ], 'Mẫu tiếp nhận PYC PGD đã chuẩn hóa'),
  template('pgd-template-assignment', 'ASSIGNMENT', 'PGD-BM-02', 'Phiếu phân công giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName,
    cell({ key: 'leadInspector', label: 'Trưởng đoàn / phụ trách', sectionCode: 'assignment', row: 1, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'inspectors', label: 'Danh sách giám định viên', sectionCode: 'assignment', row: 2, column: 2, type: 'TABLE', required: true, tableColumns: ['username', 'role'] }),
    cell({ key: 'technicalReviewer', label: 'Người soát xét kỹ thuật', sectionCode: 'assignment', row: 3, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'scheduledAt', label: 'Ngày giờ thực hiện', sectionCode: 'schedule', row: 1, column: 3, type: 'DATE', required: true }),
    sharedCells.standards,
  ], 'Mẫu phân công PGD đã chuẩn hóa'),
  template('pgd-template-inspection-plan', 'INSPECTION_PLAN', 'PGD-BM-03', 'Kế hoạch giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName,
    cell({ key: 'inspectionDate', label: 'Ngày giám định', sectionCode: 'schedule', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'agenda', label: 'Chương trình thực hiện', sectionCode: 'schedule', row: 2, column: 2, type: 'TABLE', required: true, tableColumns: ['time', 'activity', 'owner'] }),
    cell({ key: 'team', label: 'Thành phần đoàn', sectionCode: 'assignment', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['name', 'role', 'phone'] }),
    sharedCells.standards,
    cell({ key: 'note', label: 'Ghi chú kế hoạch', sectionCode: 'note', row: 1, column: 6, type: 'TEXT', required: false }),
  ], 'Mẫu kế hoạch giám định PGD đã chuẩn hóa'),
  template('pgd-template-field-inspection', 'FIELD_INSPECTION', 'PGD-BM-04', 'Biên bản giám định hiện trường', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'performedAt', label: 'Thời gian hiện trường', sectionCode: 'location', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'location', label: 'Địa điểm', sectionCode: 'location', row: 2, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'lotObservation', label: 'Nhận dạng lô hàng', sectionCode: 'findings', row: 1, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'packaging', label: 'Bao gói / bảo quản', sectionCode: 'findings', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'labeling', label: 'Ghi nhãn', sectionCode: 'findings', row: 3, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'measurements', label: 'Kích thước / đo đạc', sectionCode: 'measurements', row: 1, column: 4, type: 'TABLE', required: false, tableColumns: ['item', 'value', 'unit'] }),
    cell({ key: 'nonconformities', label: 'Điểm không phù hợp', sectionCode: 'findings', row: 4, column: 3, type: 'TABLE', required: false, tableColumns: ['code', 'description', 'action'] }),
    cell({ key: 'sampleRows', label: 'Mẫu đã lấy', sectionCode: 'samples', row: 1, column: 5, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'quantity', 'disposition'] }),
  ], 'Mẫu biên bản hiện trường PGD đã chuẩn hóa'),
  template('pgd-template-sample-taking', 'SAMPLE_TAKING', 'PGD-BM-05', 'Biên bản lấy mẫu', [
    sharedCells.requestCode, sharedCells.productName, sharedCells.lotCode, sharedCells.customerName, sharedCells.customerAddress,
    cell({ key: 'sampledAt', label: 'Ngày lấy mẫu', sectionCode: 'sampling', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'samplingLocation', label: 'Địa điểm lấy mẫu', sectionCode: 'sampling', row: 2, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'sampleRows', label: 'Danh sách mẫu', sectionCode: 'sampling', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'description', 'quantity', 'unit', 'seal'] }),
    cell({ key: 'purpose', label: 'Mục đích lấy mẫu', sectionCode: 'sampling', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'samplingMethod', label: 'Phương pháp lấy mẫu', sectionCode: 'sampling', row: 3, column: 3, type: 'TEXT', required: true }),
  ], 'Mẫu biên bản lấy mẫu PGD đã chuẩn hóa'),
  template('pgd-template-lab-request', 'LAB_REQUEST', 'PGD-BM-06', 'Phiếu giao nhận và yêu cầu PTN', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.productName,
    cell({ key: 'laboratoryName', label: 'Phòng thí nghiệm', sectionCode: 'laboratory', row: 1, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'sentAt', label: 'Thời điểm giao mẫu', sectionCode: 'handover', row: 1, column: 3, type: 'DATE', required: true }),
    cell({ key: 'sender', label: 'Người giao mẫu', sectionCode: 'handover', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'receiver', label: 'Người nhận mẫu', sectionCode: 'handover', row: 3, column: 3, type: 'TEXT', required: false }),
    cell({ key: 'sampleRows', label: 'Mẫu gửi PTN', sectionCode: 'samples', row: 1, column: 4, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'description', 'quantity', 'unit'] }),
    cell({ key: 'testItems', label: 'Chỉ tiêu / phép thử', sectionCode: 'laboratory', row: 2, column: 2, type: 'TABLE', required: true, tableColumns: ['item', 'method'] }),
  ], 'Mẫu PYC PTN và giao nhận mẫu PGD đã chuẩn hóa'),
  template('pgd-template-inspection-report', 'INSPECTION_REPORT', 'PGD-BM-07', 'Báo cáo kết quả giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'reportNumber', label: 'Số báo cáo', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true }),
    sharedCells.standards,
    cell({ key: 'labResults', label: 'Kết quả PTN', sectionCode: 'results', row: 1, column: 3, type: 'TABLE', required: false, tableColumns: ['item', 'value', 'unit', 'method'] }),
    cell({ key: 'fieldFindings', label: 'Kết quả hiện trường', sectionCode: 'results', row: 2, column: 3, type: 'TABLE', required: false, tableColumns: ['item', 'value'] }),
    sharedCells.conclusion,
    cell({ key: 'reportedAt', label: 'Ngày lập báo cáo', sectionCode: 'identity', row: 3, column: 1, type: 'DATE', required: true }),
    ...sharedCells.productDetails,
  ], 'Mẫu báo cáo kết quả PGD đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-inspection-certificate', 'INSPECTION_CERTIFICATE', 'PGD-BM-08', 'Chứng thư giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'documentNumber', label: 'Số chứng thư', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true }),
    cell({ key: 'certificateScope', label: 'Hạng mục giám định', sectionCode: 'criteria', row: 1, column: 2, type: 'TEXT', required: true }),
    sharedCells.standards,
    cell({ key: 'resultRows', label: 'Danh mục kết quả', sectionCode: 'results', row: 1, column: 3, type: 'TABLE', required: false, tableColumns: ['item', 'result', 'unit'] }),
    sharedCells.conclusion,
    cell({ key: 'signedAt', label: 'Ngày ký', sectionCode: 'approval', row: 1, column: 4, type: 'DATE', required: false }),
    ...sharedCells.productDetails,
  ], 'Mẫu chứng thư giám định PGD đã chuẩn hóa', ALL_METHOD_CODES),
];

export function getPgdDocumentTemplates(): PgdDocumentTemplate[] {
  return DEFAULT_PGD_DOCUMENT_TEMPLATES.map(cloneTemplate);
}

/** Hydrate metadata for persisted rows created before the DOCX pack was introduced. */
export function normalizePgdDocumentTemplate(template: PgdDocumentTemplate): PgdDocumentTemplate {
  return cloneTemplate(template);
}

export function isPgdDocumentTemplateRecordAllowed(value: unknown): value is PgdDocumentTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const template = value as Partial<PgdDocumentTemplate>;
  if (template.domain !== PGD_DOMAIN || !String(template.id || '').trim() || !String(template.code || '').trim() || !String(template.name || '').trim()) return false;
  if (!['INTAKE_REQUEST', 'ASSIGNMENT', 'INSPECTION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'LAB_REQUEST', 'INSPECTION_REPORT', 'INSPECTION_CERTIFICATE'].includes(String(template.kind || ''))) return false;
  if (!['DRAFT', 'PUBLISHED', 'RETIRED'].includes(String(template.status || ''))) return false;
  if (!Array.isArray(template.productGroups) || template.productGroups.some((item) => !ALL_PRODUCT_GROUPS.includes(item as PgdProductGroup))) return false;
  if (!Array.isArray(template.formats) || template.formats.some((format) => !['DOCX', 'PDF'].includes(String(format)))) return false;
  if (template.fileName !== undefined && (!String(template.fileName || '').trim() || /[\\/]/.test(String(template.fileName)))) return false;
  if (template.placeholderKeys !== undefined && (!Array.isArray(template.placeholderKeys) || template.placeholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) return false;
  if (template.requiredPlaceholderKeys !== undefined && (!Array.isArray(template.requiredPlaceholderKeys) || template.requiredPlaceholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) return false;
  if (!Array.isArray(template.cells) || validatePgdTemplateCells(template.cells).length > 0) return false;
  return !/QC20|TVCI_NAS|Desktop|UNC/i.test(JSON.stringify(value));
}

export function validatePgdDocumentTemplate(template: Partial<PgdDocumentTemplate>): string[] {
  const issues: string[] = [];
  if (template.domain !== PGD_DOMAIN) issues.push('Template phải thuộc miền PGD.');
  if (!String(template.id || '').trim() || !String(template.code || '').trim() || !String(template.name || '').trim()) issues.push('Template cần có mã định danh, mã biểu mẫu và tên.');
  if (!String(template.version || '').trim()) issues.push('Template cần có phiên bản.');
  if (!['INTAKE_REQUEST', 'ASSIGNMENT', 'INSPECTION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'LAB_REQUEST', 'INSPECTION_REPORT', 'INSPECTION_CERTIFICATE'].includes(String(template.kind || ''))) issues.push('Loại template PGD không hợp lệ.');
  if (!Array.isArray(template.productGroups) || template.productGroups.length === 0 || template.productGroups.some((item) => !ALL_PRODUCT_GROUPS.includes(item as PgdProductGroup))) issues.push('Nhóm sản phẩm của template không hợp lệ.');
  if (!Array.isArray(template.formats) || template.formats.length === 0 || template.formats.some((format) => !['DOCX', 'PDF'].includes(String(format)))) issues.push('Định dạng template phải là DOCX hoặc PDF.');
  if (template.fileName !== undefined && (!String(template.fileName || '').trim() || /[\\/]/.test(String(template.fileName)))) issues.push('Template cần có tên file DOCX tương đối, không chứa thư mục.');
  if (template.placeholderKeys !== undefined && (!Array.isArray(template.placeholderKeys) || template.placeholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) issues.push('Danh sách placeholder DOCX không hợp lệ.');
  if (template.requiredPlaceholderKeys !== undefined && (!Array.isArray(template.requiredPlaceholderKeys) || template.requiredPlaceholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) issues.push('Danh sách placeholder bắt buộc DOCX không hợp lệ.');
  if (!String(template.sourceFormLabel || '').trim()) issues.push('Template cần ghi nhận tên biểu mẫu nghiệp vụ đã chuẩn hóa.');
  if (!Array.isArray(template.cells) || template.cells.length === 0) issues.push('Template cần có ít nhất một cell.');
  else issues.push(...validatePgdTemplateCells(template.cells).map((issue) => issue.message));
  if (/QC20|TVCI_NAS|Desktop|UNC/i.test(JSON.stringify(template))) issues.push('Template PGD không được chứa QC20 hoặc đường dẫn nguồn cũ.');
  return issues;
}

export function getPgdDocumentTemplate(kind: PgdDocumentTemplateKind, productGroup?: PgdProductGroup): PgdDocumentTemplate | undefined {
  const template = DEFAULT_PGD_DOCUMENT_TEMPLATES.find((candidate) =>
    candidate.active
    && candidate.kind === kind
    && (!productGroup || candidate.productGroups.includes(productGroup)),
  );
  return template ? cloneTemplate(template) : undefined;
}

export function snapshotPgdDocumentTemplate(template: PgdDocumentTemplate, capturedAt: string): PgdDocumentTemplateSnapshot {
  return {
    templateId: template.id,
    domain: PGD_DOMAIN,
    kind: template.kind,
    code: template.code,
    name: template.name,
    version: template.version,
    status: template.status,
    productGroups: [...template.productGroups],
    ...(template.methodCodes ? { methodCodes: [...template.methodCodes] } : {}),
    formats: [...template.formats],
    cells: template.cells.map(cloneCell),
    fileName: String(template.fileName || `${template.code}.docx`).trim(),
    placeholderKeys: [...(template.placeholderKeys?.length ? template.placeholderKeys : derivePlaceholderKeys(template.cells))],
    requiredPlaceholderKeys: [...(template.requiredPlaceholderKeys?.length ? template.requiredPlaceholderKeys : derivePlaceholderKeys(template.cells, true))],
    sourceFormLabel: template.sourceFormLabel,
    capturedAt,
  };
}

// --- End of pgdDocumentTemplates.ts ---
