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
  | 'DECISION'
  | 'INSPECTION_CERTIFICATE'
  | 'DOSSIER_COVER'
  | 'CASE_TIMELINE'
  | 'FIELD_ACTIVITY_LOG'
  | 'LAB_RESULT_REVIEW'
  | 'INSPECTION_MINUTES'
  | 'SAMPLE_HANDOVER';

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
  /** Optional group scope; absent means the cell is shared by every PGD group. */
  productGroups?: PgdProductGroup[];
  tableColumns?: string[];
  tableColumnLabels?: Record<string, string>;
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
  /** Read-only server projection of the packaged DOCX source. */
  sourceInspection?: import('./pgdTemplatePack.ts').PgdTemplateSourceInspection;
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
    ...(cell.productGroups ? { productGroups: [...cell.productGroups] } : {}),
    ...(cell.validation ? { validation: cloneValidation(cell.validation) } : {}),
    ...(cell.tableColumns ? { tableColumns: [...cell.tableColumns] } : {}),
    ...(cell.tableColumnLabels ? { tableColumnLabels: { ...cell.tableColumnLabels } } : {}),
  };
}

function derivePlaceholderKeys(cells: readonly PgdTemplateCell[], requiredOnly = false): string[] {
  return [...new Set(cells
    .filter((cell) => cell.active !== false && (!requiredOnly || cell.required))
    .map((cell) => cell.key))]
    .sort((left, right) => left.localeCompare(right));
}

/** Internal authoring hint for generated forms; HTML inputs intentionally do not render it. */
export function getPgdTemplateCellPlaceholder(cell: Pick<PgdTemplateCell, 'label' | 'type' | 'validation'>): string {
  const label = String(cell.label || 'trường dữ liệu').trim().toLocaleLowerCase('vi-VN');
  if (cell.validation?.options?.length) return `Chọn ${label}`;
  if (cell.type === 'DATE') return `Nhập ${label} (dd/mm/yyyy)`;
  if (cell.type === 'NUMBER') return `Nhập ${label}`;
  if (cell.type === 'BOOLEAN') return `Chọn ${label}`;
  return `Nhập ${label}`;
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

/** Return only active cells shared by, or explicitly scoped to, one PGD group. */
export function getPgdTemplateCellsForProductGroup(
  template: PgdDocumentTemplate,
  productGroup: PgdProductGroup,
): PgdTemplateCell[] {
  return template.cells
    .filter((cell) => cell.active !== false && (!cell.productGroups?.length || cell.productGroups.includes(productGroup)))
    .map(cloneCell);
}

/**
 * Keep the authoring form aligned with the physical DOCX layout.
 * Sections retain their first appearance order, then cells follow row/column
 * coordinates with the original declaration as a stable final tie-breaker.
 */
export function orderPgdTemplateCells<T extends Pick<PgdTemplateCell, 'sectionCode' | 'row' | 'column'>>(
  cells: readonly T[],
): T[] {
  const sectionOrder = new Map<string, number>();
  cells.forEach((cell, index) => {
    const sectionCode = String(cell.sectionCode || 'identity');
    if (!sectionOrder.has(sectionCode)) sectionOrder.set(sectionCode, index);
  });

  return cells
    .map((cell, index) => ({ cell, index }))
    .sort((left, right) => {
      const leftSection = sectionOrder.get(String(left.cell.sectionCode || 'identity')) ?? left.index;
      const rightSection = sectionOrder.get(String(right.cell.sectionCode || 'identity')) ?? right.index;
      return leftSection - rightSection
        || Number(left.cell.row || 0) - Number(right.cell.row || 0)
        || Number(left.cell.column || 0) - Number(right.cell.column || 0)
        || left.index - right.index;
    })
    .map(({ cell }) => cell);
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
      ...(Array.isArray(input.productGroups) && input.productGroups.length > 0
        ? { productGroups: [...new Set(input.productGroups.map((item) => String(item).trim() as PgdProductGroup))] }
        : {}),
      ...(Array.isArray(input.tableColumns) && input.tableColumns.length > 0
        ? { tableColumns: input.tableColumns.map((item) => String(item).trim()).filter(Boolean) }
        : {}),
      ...(input.tableColumnLabels && typeof input.tableColumnLabels === 'object' && !Array.isArray(input.tableColumnLabels)
        ? { tableColumnLabels: Object.fromEntries(Object.entries(input.tableColumnLabels).map(([key, value]) => [String(key).trim(), String(value).trim()]).filter(([key, value]) => Boolean(key && value))) }
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
    if (cell.productGroups?.some((group) => !ALL_PRODUCT_GROUPS.includes(group))) {
      issues.push({ key: cell.key, code: 'INVALID_TYPE', message: 'Cell “' + cell.label + '” có nhóm sản phẩm PGD không hợp lệ.' });
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
  registrationNumber: cell({ key: 'registrationNumber', label: 'Số đăng ký', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: false, binding: 'request.registryMetadata.registrationNumber' }),
  receivedAt: cell({ key: 'receivedAt', label: 'Ngày tiếp nhận', sectionCode: 'identity', row: 3, column: 1, type: 'DATE', required: true, binding: 'request.registryMetadata.receivedAt' }),
  technicalDossierNote: cell({ key: 'technicalDossierNote', label: 'Ghi chú hồ sơ kỹ thuật', sectionCode: 'documents', row: 3, column: 7, type: 'TEXT', required: false, binding: 'request.registryMetadata.technicalDossierNote' }),
  deficiencyNote: cell({ key: 'deficiencyNote', label: 'Thiếu hồ sơ', sectionCode: 'documents', row: 4, column: 7, type: 'TEXT', required: false, binding: 'request.registryMetadata.deficiencyNote' }),
  returnedPackageNote: cell({ key: 'returnedPackageNote', label: 'Hoàn trả', sectionCode: 'documents', row: 5, column: 7, type: 'TEXT', required: false, binding: 'request.registryMetadata.returnedPackageNote' }),
  courierName: cell({ key: 'courierName', label: 'Chuyển phát', sectionCode: 'documents', row: 6, column: 7, type: 'TEXT', required: false, binding: 'request.registryMetadata.courierName' }),
  customerName: cell({ key: 'customerName', label: 'Khách hàng', sectionCode: 'customer', row: 1, column: 2, type: 'TEXT', required: true, binding: 'request.customerSnapshot.name' }),
  customerAddress: cell({ key: 'customerAddress', label: 'Địa chỉ', sectionCode: 'customer', row: 2, column: 2, type: 'TEXT', required: true, binding: 'request.customerSnapshot.address' }),
  productName: cell({ key: 'productName', label: 'Tên hàng hóa / thiết bị', sectionCode: 'product', row: 1, column: 3, type: 'TEXT', required: true, binding: 'request.productName' }),
  lotCode: cell({ key: 'lotCode', label: 'Số lô / số nhận dạng', sectionCode: 'product', row: 2, column: 3, type: 'TEXT', required: false, binding: 'request.lotCode' }),
  standards: cell({ key: 'standards', label: 'Tiêu chuẩn áp dụng', sectionCode: 'criteria', row: 1, column: 4, type: 'TABLE', required: true, binding: 'request.standards', tableColumns: ['standard'], tableColumnLabels: { standard: 'Tiêu chuẩn' } }),
  assessmentMethod: cell({ key: 'assessmentMethod', label: 'Phương thức ĐGSPH', sectionCode: 'criteria', row: 2, column: 4, type: 'TEXT', required: false, binding: 'request.assessmentMethod', validation: { options: ['METHOD_7'] } }),
  conclusion: cell({ key: 'conclusion', label: 'Kết luận', sectionCode: 'conclusion', row: 1, column: 5, type: 'TEXT', required: true }),
  productDetails: [
    cell({ key: 'productForm', label: 'Dạng sản phẩm', sectionCode: 'product', row: 3, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.productForm' }),
    cell({ key: 'grade', label: 'Mác / model / cấp sản phẩm', sectionCode: 'product', row: 4, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.grade' }),
    cell({ key: 'dimensions', label: 'Kích thước / thông số', sectionCode: 'product', row: 5, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.dimensions' }),
    cell({ key: 'productStandard', label: 'Tiêu chuẩn sản phẩm công bố', sectionCode: 'product', row: 6, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.productStandard' }),
    cell({ key: 'origin', label: 'Xuất xứ', sectionCode: 'product', row: 7, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.origin' }),
    cell({ key: 'countryOfOrigin', label: 'Nước xuất xứ', sectionCode: 'product', row: 8, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.countryOfOrigin' }),
    cell({ key: 'manufacturer', label: 'Nhà sản xuất', sectionCode: 'product', row: 9, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.manufacturer' }),
    cell({ key: 'manufacturerLotCode', label: 'Số lô nhà sản xuất / lô hàng', sectionCode: 'product', row: 10, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.manufacturerLotCode' }),
    cell({ key: 'importer', label: 'Nhà nhập khẩu', sectionCode: 'product', row: 11, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.importer' }),
    cell({ key: 'hsCode', label: 'Mã HS', sectionCode: 'product', row: 12, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.hsCode' }),
    cell({ key: 'lotDefinition', label: 'Cách xác định lô', sectionCode: 'product', row: 13, column: 3, type: 'TEXT', required: false, binding: 'request.productDetails.lotDefinition' }),
    cell({ key: 'customsDocuments', label: 'Chứng từ hải quan / thương mại', sectionCode: 'documents', row: 1, column: 7, type: 'TABLE', required: false, binding: 'request.productDetails.customsDocuments', tableColumns: ['document', 'number', 'date'], tableColumnLabels: { document: 'Chứng từ', number: 'Số', date: 'Ngày' } }),
  ],
  steelSampling: [
    cell({ key: 'steelLotSize', label: 'Cỡ lô (bó/kiện/cuộn)', sectionCode: 'sampling', row: 4, column: 2, type: 'NUMBER', required: false, unit: 'bó/kiện/cuộn', binding: 'request.productDetails.steelLotSize', validation: { min: 1 }, productGroups: ['STEEL_METAL'] }),
    cell({ key: 'steelSameGradeMultiProduct', label: 'Cùng mác, nhiều loại sản phẩm', sectionCode: 'sampling', row: 5, column: 2, type: 'BOOLEAN', required: false, binding: 'request.productDetails.steelSameGradeMultiProduct', productGroups: ['STEEL_METAL'] }),
    cell({ key: 'steelManualSamplingPlanNote', label: 'Kế hoạch thủ công / căn cứ', sectionCode: 'sampling', row: 6, column: 2, type: 'TEXT', required: false, binding: 'request.productDetails.steelManualSamplingPlanNote', productGroups: ['STEEL_METAL'] }),
  ],
  machinery: [
    cell({ key: 'machineryType', label: 'Loại máy / thiết bị', sectionCode: 'machinery', row: 1, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.machineType', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machineryModel', label: 'Kiểu loại máy', sectionCode: 'machinery', row: 2, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.model', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machinerySerialNumber', label: 'Số serial / nhận dạng', sectionCode: 'machinery', row: 3, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.serialNumber', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machineryManufacturingYear', label: 'Năm sản xuất', sectionCode: 'machinery', row: 4, column: 8, type: 'NUMBER', required: false, binding: 'request.productDetails.machinery.manufacturingYear', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machineryTechnicalParameters', label: 'Thông số kỹ thuật', sectionCode: 'machinery', row: 5, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.technicalParameters', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machineryCondition', label: 'Tình trạng máy', sectionCode: 'machinery', row: 6, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.condition', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machineryCompleteness', label: 'Mức độ đầy đủ / phụ kiện', sectionCode: 'machinery', row: 7, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.completeness', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machinerySynchronization', label: 'Tính đồng bộ dây chuyền', sectionCode: 'machinery', row: 8, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.synchronization', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machineryInstallationStatus', label: 'Tình trạng lắp đặt', sectionCode: 'machinery', row: 9, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.installationStatus', productGroups: ['MACHINERY_LINE'] }),
    cell({ key: 'machinerySafetyStandard', label: 'Tiêu chuẩn an toàn áp dụng', sectionCode: 'machinery', row: 10, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.machinery.safetyStandard', productGroups: ['MACHINERY_LINE'] }),
  ],
  coal: [
    cell({ key: 'coalType', label: 'Loại than', sectionCode: 'coal', row: 1, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.coal.coalType', productGroups: ['COAL'] }),
    cell({ key: 'coalSource', label: 'Nguồn / mỏ than', sectionCode: 'coal', row: 2, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.coal.source', productGroups: ['COAL'] }),
    cell({ key: 'coalSizeRange', label: 'Cỡ hạt', sectionCode: 'coal', row: 3, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.coal.sizeRange', productGroups: ['COAL'] }),
    cell({ key: 'coalQualityStandard', label: 'Tiêu chuẩn chất lượng than', sectionCode: 'coal', row: 4, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.coal.qualityStandard', productGroups: ['COAL'] }),
    cell({ key: 'coalSamplingBasis', label: 'Căn cứ lấy mẫu than', sectionCode: 'coal', row: 5, column: 8, type: 'TEXT', required: false, binding: 'request.productDetails.coal.samplingBasis', productGroups: ['COAL'] }),
    cell({ key: 'coalMoisture', label: 'Độ ẩm', sectionCode: 'coal', row: 6, column: 8, type: 'NUMBER', required: false, unit: '%', binding: 'request.productDetails.coal.moisture', productGroups: ['COAL'] }),
    cell({ key: 'coalAsh', label: 'Độ tro', sectionCode: 'coal', row: 7, column: 8, type: 'NUMBER', required: false, unit: '%', binding: 'request.productDetails.coal.ash', productGroups: ['COAL'] }),
    cell({ key: 'coalCalorificValue', label: 'Nhiệt trị', sectionCode: 'coal', row: 8, column: 8, type: 'NUMBER', required: false, unit: 'kcal/kg', binding: 'request.productDetails.coal.calorificValue', productGroups: ['COAL'] }),
    cell({ key: 'coalSulfur', label: 'Lưu huỳnh', sectionCode: 'coal', row: 9, column: 8, type: 'NUMBER', required: false, unit: '%', binding: 'request.productDetails.coal.sulfur', productGroups: ['COAL'] }),
  ],
  decision: [
    cell({ key: 'decisionNumber', label: 'Số quyết định', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true }),
    cell({ key: 'decisionDate', label: 'Ngày quyết định', sectionCode: 'identity', row: 3, column: 1, type: 'DATE', required: true }),
    cell({ key: 'decisionBasis', label: 'Căn cứ phê duyệt', sectionCode: 'approval', row: 1, column: 4, type: 'TEXT', required: true }),
    cell({ key: 'decisionText', label: 'Nội dung quyết định', sectionCode: 'approval', row: 2, column: 4, type: 'TEXT', required: true }),
    cell({ key: 'decisionSigner', label: 'Người ký quyết định', sectionCode: 'approval', row: 3, column: 4, type: 'TEXT', required: true }),
  ],
  registryDocuments: cell({ key: 'registryDocuments', label: 'Tham chiếu chứng từ sổ đăng ký', sectionCode: 'documents', row: 2, column: 7, type: 'TABLE', required: false, binding: 'request.registryMetadata.documents', tableColumns: ['kind', 'number', 'date'], tableColumnLabels: { kind: 'Loại', number: 'Số', date: 'Ngày' } }),
};

const ALL_METHOD_CODES = ['TT58', 'QT-GĐ-14', 'GENERIC'];

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
    sharedCells.requestCode, sharedCells.registrationNumber, sharedCells.receivedAt, sharedCells.customerName, sharedCells.customerAddress,
    cell({ key: 'intakeChannel', label: 'Kênh tiếp nhận', sectionCode: 'identity', row: 1, column: 2, type: 'TEXT', required: true, binding: 'request.intakeChannel' }),
    sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'transportName', label: 'Phương tiện vận tải', sectionCode: 'location', row: 3, column: 6, type: 'TEXT', required: false, binding: 'request.transportName' }),
    cell({ key: 'quantity', label: 'Số lượng / khối lượng', sectionCode: 'product', row: 3, column: 3, type: 'NUMBER', required: true, unit: 'đơn vị', binding: 'request.quantity' }),
    cell({ key: 'inspectionScope', label: 'Phạm vi giám định', sectionCode: 'criteria', row: 2, column: 4, type: 'TEXT', required: true, binding: 'request.inspectionScope' }),
    cell({ key: 'inspectionLocation', label: 'Địa điểm giám định', sectionCode: 'location', row: 1, column: 6, type: 'TEXT', required: true, binding: 'request.inspectionLocation' }),
    sharedCells.standards, sharedCells.assessmentMethod,
    ...sharedCells.productDetails, ...sharedCells.steelSampling, ...sharedCells.machinery, ...sharedCells.coal, sharedCells.registryDocuments, sharedCells.technicalDossierNote, sharedCells.deficiencyNote, sharedCells.returnedPackageNote, sharedCells.courierName,
  ], 'Mẫu tiếp nhận PYC PGD đã chuẩn hóa'),
  template('pgd-template-assignment', 'ASSIGNMENT', 'PGD-BM-02', 'Phiếu phân công giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName,
    cell({ key: 'leadInspector', label: 'Trưởng đoàn / phụ trách', sectionCode: 'assignment', row: 1, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'inspectors', label: 'Danh sách giám định viên', sectionCode: 'assignment', row: 2, column: 2, type: 'TABLE', required: true, tableColumns: ['username', 'role'], tableColumnLabels: { username: 'Tài khoản', role: 'Vai trò' } }),
    cell({ key: 'technicalReviewer', label: 'Người soát xét kỹ thuật', sectionCode: 'assignment', row: 3, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'scheduledAt', label: 'Ngày giờ thực hiện', sectionCode: 'schedule', row: 1, column: 3, type: 'DATE', required: true }),
    sharedCells.standards,
  ], 'Mẫu phân công PGD đã chuẩn hóa'),
  template('pgd-template-inspection-plan', 'INSPECTION_PLAN', 'PGD-BM-03', 'Kế hoạch giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName,
    cell({ key: 'inspectionDate', label: 'Ngày giám định', sectionCode: 'schedule', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'agenda', label: 'Chương trình thực hiện', sectionCode: 'schedule', row: 2, column: 2, type: 'TABLE', required: true, tableColumns: ['time', 'activity', 'owner'], tableColumnLabels: { time: 'Thời gian', activity: 'Nội dung', owner: 'Phụ trách' } }),
    cell({ key: 'productLines', label: 'Danh sách sản phẩm đăng ký', sectionCode: 'product', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['productName', 'grade', 'dimensions', 'standard', 'origin', 'manufacturer', 'quantity', 'unit'], tableColumnLabels: { productName: 'Tên hàng', grade: 'Mác thép', dimensions: 'Kích thước', standard: 'Tiêu chuẩn', origin: 'Xuất xứ', manufacturer: 'Nhà sản xuất', quantity: 'Số lượng', unit: 'Đơn vị' }, validation: { minRows: 1 } }),
    cell({ key: 'team', label: 'Thành phần đoàn', sectionCode: 'assignment', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['name', 'role', 'phone'], tableColumnLabels: { name: 'Họ tên', role: 'Vai trò', phone: 'Điện thoại' } }),
    sharedCells.standards, sharedCells.assessmentMethod,
    ...sharedCells.productDetails, ...sharedCells.steelSampling, ...sharedCells.machinery, ...sharedCells.coal,
    cell({ key: 'note', label: 'Ghi chú kế hoạch', sectionCode: 'note', row: 1, column: 6, type: 'TEXT', required: false }),
  ], 'Mẫu kế hoạch giám định PGD đã chuẩn hóa'),
  template('pgd-template-field-inspection', 'FIELD_INSPECTION', 'PGD-BM-04', 'Biên bản giám định hiện trường', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'performedAt', label: 'Thời gian hiện trường', sectionCode: 'location', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'location', label: 'Địa điểm', sectionCode: 'location', row: 2, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'lotObservation', label: 'Nhận dạng lô hàng', sectionCode: 'findings', row: 1, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'packaging', label: 'Bao gói / bảo quản', sectionCode: 'findings', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'labeling', label: 'Ghi nhãn', sectionCode: 'findings', row: 3, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'measurements', label: 'Kích thước / đo đạc', sectionCode: 'measurements', row: 1, column: 4, type: 'TABLE', required: false, tableColumns: ['item', 'value', 'unit'], tableColumnLabels: { item: 'Hạng mục', value: 'Giá trị', unit: 'Đơn vị' } }),
    cell({ key: 'nonconformities', label: 'Điểm không phù hợp', sectionCode: 'findings', row: 4, column: 3, type: 'TABLE', required: false, tableColumns: ['code', 'description', 'action'], tableColumnLabels: { code: 'Mã', description: 'Mô tả', action: 'Xử lý' } }),
    cell({ key: 'sampleRows', label: 'Mẫu đã lấy', sectionCode: 'samples', row: 1, column: 5, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'quantity', 'disposition'], tableColumnLabels: { sampleCode: 'Mã mẫu', quantity: 'Số lượng', disposition: 'Xử lý mẫu' } }),
    ...sharedCells.productDetails, ...sharedCells.machinery, ...sharedCells.coal,
  ], 'Mẫu biên bản hiện trường PGD đã chuẩn hóa'),
  template('pgd-template-sample-taking', 'SAMPLE_TAKING', 'PGD-BM-05', 'Biên bản lấy mẫu', [
    sharedCells.requestCode, sharedCells.productName, sharedCells.lotCode, sharedCells.customerName, sharedCells.customerAddress,
    cell({ key: 'sampledAt', label: 'Ngày lấy mẫu', sectionCode: 'sampling', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'samplingLocation', label: 'Địa điểm lấy mẫu', sectionCode: 'sampling', row: 2, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'sampleRows', label: 'Danh sách mẫu', sectionCode: 'sampling', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'description', 'quantity', 'unit', 'seal'], tableColumnLabels: { sampleCode: 'Mã mẫu', description: 'Mô tả', quantity: 'Số lượng', unit: 'Đơn vị', seal: 'Niêm phong' }, validation: { minRows: 1 } }),
    cell({ key: 'purpose', label: 'Mục đích lấy mẫu', sectionCode: 'sampling', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'samplingMethod', label: 'Phương pháp lấy mẫu', sectionCode: 'sampling', row: 3, column: 3, type: 'TEXT', required: true }),
    sharedCells.assessmentMethod, ...sharedCells.productDetails, ...sharedCells.steelSampling, ...sharedCells.machinery, ...sharedCells.coal,
  ], 'Mẫu biên bản lấy mẫu PGD đã chuẩn hóa'),
  template('pgd-template-lab-request', 'LAB_REQUEST', 'PGD-BM-06', 'Phiếu giao nhận và yêu cầu PTN', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.productName,
    cell({ key: 'laboratoryName', label: 'Phòng thí nghiệm', sectionCode: 'laboratory', row: 1, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'laboratoryCode', label: 'Mã PTN', sectionCode: 'laboratory', row: 2, column: 2, type: 'TEXT', required: false }),
    cell({ key: 'senderUnit', label: 'Đơn vị giao mẫu', sectionCode: 'handover', row: 2, column: 3, type: 'TEXT', required: false }),
    cell({ key: 'sentAt', label: 'Thời điểm giao mẫu', sectionCode: 'handover', row: 1, column: 3, type: 'DATE', required: true }),
    cell({ key: 'sender', label: 'Người giao mẫu', sectionCode: 'handover', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'receiver', label: 'Người nhận mẫu', sectionCode: 'handover', row: 3, column: 3, type: 'TEXT', required: false }),
    cell({ key: 'sampleRows', label: 'Mẫu gửi PTN', sectionCode: 'samples', row: 1, column: 4, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'description', 'quantity', 'unit'], tableColumnLabels: { sampleCode: 'Mã mẫu', description: 'Mô tả', quantity: 'Số lượng', unit: 'Đơn vị' } }),
    cell({ key: 'testItems', label: 'Chỉ tiêu / phép thử', sectionCode: 'laboratory', row: 2, column: 2, type: 'TABLE', required: true, tableColumns: ['item', 'method'], tableColumnLabels: { item: 'Chỉ tiêu', method: 'Phương pháp' }, validation: { minRows: 1 } }),
  ], 'Mẫu PYC PTN và giao nhận mẫu PGD đã chuẩn hóa'),
  template('pgd-template-inspection-report', 'INSPECTION_REPORT', 'PGD-BM-07', 'Báo cáo kết quả giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'reportNumber', label: 'Số báo cáo', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true }),
    sharedCells.standards, sharedCells.assessmentMethod,
    cell({ key: 'labResults', label: 'Kết quả PTN', sectionCode: 'results', row: 1, column: 3, type: 'TABLE', required: false, tableColumns: ['item', 'value', 'unit', 'method'], tableColumnLabels: { item: 'Chỉ tiêu', value: 'Giá trị', unit: 'Đơn vị', method: 'Phương pháp' } }),
    cell({ key: 'fieldFindings', label: 'Kết quả hiện trường', sectionCode: 'results', row: 2, column: 3, type: 'TABLE', required: false, tableColumns: ['item', 'value'], tableColumnLabels: { item: 'Hạng mục', value: 'Kết quả' } }),
    sharedCells.conclusion, ...sharedCells.steelSampling, ...sharedCells.machinery, ...sharedCells.coal,
    cell({ key: 'reportedAt', label: 'Ngày lập báo cáo', sectionCode: 'identity', row: 3, column: 1, type: 'DATE', required: true }),
    ...sharedCells.productDetails,
  ], 'Mẫu báo cáo kết quả PGD đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-decision', 'DECISION', 'PGD-BM-09', 'Quyết định phê duyệt / phát hành kết quả giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    sharedCells.standards, sharedCells.assessmentMethod,
    ...sharedCells.decision,
    ...sharedCells.steelSampling, ...sharedCells.machinery, ...sharedCells.coal,
    ...sharedCells.productDetails,
    sharedCells.conclusion,
  ], 'Mẫu quyết định PGD đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-bm-gd-07-19', 'INSPECTION_CERTIFICATE', 'BM-GĐ-07.19', 'Phiếu kết quả / chứng thư giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'registrationNumber', label: 'Số đăng ký', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true, binding: 'request.registryMetadata.registrationNumber' }),
    cell({ key: 'inspectionScope', label: 'Hạng mục giám định', sectionCode: 'criteria', row: 1, column: 2, type: 'TEXT', required: true, binding: 'request.inspectionScope' }),
    cell({ key: 'inspectionDate', label: 'Thời gian giám định', sectionCode: 'identity', row: 3, column: 1, type: 'DATE', required: true, binding: 'request.inspectionScheduledAt' }),
    cell({ key: 'inspectionLocation', label: 'Địa điểm giám định', sectionCode: 'location', row: 1, column: 6, type: 'TEXT', required: true, binding: 'request.inspectionLocation' }),
    sharedCells.standards,
    sharedCells.assessmentMethod,
    cell({ key: 'sampleCondition', label: 'Tình trạng mẫu', sectionCode: 'sampling', row: 1, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'labResults', label: 'Kết quả PTN', sectionCode: 'results', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['item', 'value', 'unit', 'method'], tableColumnLabels: { item: 'Chỉ tiêu', value: 'Giá trị', unit: 'Đơn vị', method: 'Phương pháp' }, validation: { minRows: 1 } }),
    cell({ key: 'inspectionConclusion', label: 'Kết luận giám định', sectionCode: 'results', row: 2, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'outputVersion', label: 'Phiên bản đầu ra', sectionCode: 'approval', row: 1, column: 4, type: 'TEXT', required: true, validation: { options: ['DRAFT', 'FINAL'] } }),
    cell({ key: 'signedAt', label: 'Ngày ký', sectionCode: 'approval', row: 2, column: 4, type: 'DATE', required: false }),
    ...sharedCells.productDetails, ...sharedCells.machinery, ...sharedCells.coal,
  ], 'Biểu mẫu BM-GĐ-07.19 theo phỏng vấn PGD', ALL_METHOD_CODES),
  template('pgd-template-inspection-certificate', 'INSPECTION_CERTIFICATE', 'PGD-BM-08', 'Chứng thư giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'documentNumber', label: 'Số chứng thư', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true }),
    cell({ key: 'certificateScope', label: 'Hạng mục giám định', sectionCode: 'criteria', row: 1, column: 2, type: 'TEXT', required: true }),
    sharedCells.standards, sharedCells.assessmentMethod,
    cell({ key: 'resultRows', label: 'Danh mục kết quả', sectionCode: 'results', row: 1, column: 3, type: 'TABLE', required: false, tableColumns: ['item', 'result', 'unit'], tableColumnLabels: { item: 'Hạng mục', result: 'Kết quả', unit: 'Đơn vị' } }),
    sharedCells.conclusion,
    cell({ key: 'signedAt', label: 'Ngày ký', sectionCode: 'approval', row: 1, column: 4, type: 'DATE', required: false }),
    ...sharedCells.productDetails, ...sharedCells.machinery, ...sharedCells.coal,
  ], 'Mẫu chứng thư giám định PGD đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-dossier-cover', 'DOSSIER_COVER', 'PGD-BM-10', 'Bìa và mục lục hồ sơ giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName,
    cell({ key: 'inspectionScope', label: 'Hạng mục giám định', sectionCode: 'identity', row: 2, column: 1, type: 'TEXT', required: true, binding: 'request.inspectionScope' }),
    cell({ key: 'performedAt', label: 'Thời gian thực hiện', sectionCode: 'identity', row: 3, column: 1, type: 'DATE', required: false }),
    cell({ key: 'location', label: 'Địa điểm', sectionCode: 'identity', row: 4, column: 1, type: 'TEXT', required: false, binding: 'request.inspectionLocation' }),
    cell({ key: 'dossierEntries', label: 'Mục lục tài liệu', sectionCode: 'index', row: 1, column: 2, type: 'TABLE', required: true, tableColumns: ['requirementCode', 'title', 'status', 'pageCount'], tableColumnLabels: { requirementCode: 'Mã', title: 'Tài liệu', status: 'Trạng thái', pageCount: 'Số trang' }, validation: { minRows: 1 } }),
    cell({ key: 'reviewer', label: 'Người soát xét', sectionCode: 'archive', row: 1, column: 3, type: 'TEXT', required: false }),
    cell({ key: 'archivist', label: 'Nhân viên lưu trữ', sectionCode: 'archive', row: 2, column: 3, type: 'TEXT', required: false }),
    cell({ key: 'archiveReference', label: 'Mã lưu trữ', sectionCode: 'archive', row: 3, column: 3, type: 'TEXT', required: false }),
    ...sharedCells.machinery, ...sharedCells.coal,
  ], 'Bìa hồ sơ và mục lục hồ sơ giám định thép đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-case-timeline', 'CASE_TIMELINE', 'PGD-BM-11', 'Diễn biến vụ giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'eventDate', label: 'Ngày giám định', sectionCode: 'identity', row: 1, column: 1, type: 'DATE', required: true }),
    cell({ key: 'eventRows', label: 'Diễn biến theo thời gian', sectionCode: 'timeline', row: 1, column: 2, type: 'TABLE', required: true, tableColumns: ['time', 'activity', 'actor', 'note'], tableColumnLabels: { time: 'Thời gian', activity: 'Nội dung', actor: 'Người thực hiện', note: 'Ghi chú' }, validation: { minRows: 1 } }),
    cell({ key: 'customerConfirmation', label: 'Xác nhận của khách hàng', sectionCode: 'confirmation', row: 1, column: 3, type: 'TEXT', required: false }),
  ], 'Diễn biến vụ giám định theo mốc thời gian đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-field-activity-log', 'FIELD_ACTIVITY_LOG', 'PGD-BM-12', 'Phiếu ghi chép đánh giá hiện trường', [
    sharedCells.requestCode, sharedCells.customerName,
    cell({ key: 'session', label: 'Buổi ghi chép', sectionCode: 'identity', row: 1, column: 1, type: 'TEXT', required: true, validation: { options: ['MORNING', 'AFTERNOON'] } }),
    cell({ key: 'activityDate', label: 'Ngày', sectionCode: 'identity', row: 2, column: 1, type: 'DATE', required: true }),
    cell({ key: 'auditor', label: 'Chuyên gia / GĐV', sectionCode: 'assignment', row: 1, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'activityRows', label: 'Nội dung ghi chép', sectionCode: 'timeline', row: 1, column: 3, type: 'TABLE', required: true, tableColumns: ['time', 'activity', 'comments'], tableColumnLabels: { time: 'Thời gian', activity: 'Nội dung', comments: 'Nhận xét' }, validation: { minRows: 1 } }),
  ], 'Phiếu ghi chép đánh giá hiện trường buổi sáng/chiều đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-lab-result-review', 'LAB_RESULT_REVIEW', 'PGD-BM-13', 'Bản đánh giá kết quả thử nghiệm', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.productName,
    cell({ key: 'labResultRows', label: 'Phiếu kết quả PTN', sectionCode: 'results', row: 1, column: 2, type: 'TABLE', required: true, tableColumns: ['reportNumber', 'reportDate', 'laboratory'], tableColumnLabels: { reportNumber: 'Số phiếu', reportDate: 'Ngày', laboratory: 'PTN' }, validation: { minRows: 1 } }),
    cell({ key: 'completeness', label: 'Độ đầy đủ kết quả', sectionCode: 'results', row: 2, column: 2, type: 'TEXT', required: true, validation: { options: ['COMPLETE', 'INCOMPLETE'] } }),
    cell({ key: 'conformity', label: 'Đánh giá sự phù hợp', sectionCode: 'results', row: 3, column: 2, type: 'TEXT', required: true, validation: { options: ['CONFORMING', 'NON_CONFORMING'] } }),
    cell({ key: 'missingItems', label: 'Chỉ tiêu còn thiếu', sectionCode: 'results', row: 4, column: 2, type: 'TABLE', required: false, tableColumns: ['item', 'note'], tableColumnLabels: { item: 'Chỉ tiêu', note: 'Ghi chú' } }),
    cell({ key: 'nonconformities', label: 'Điểm không phù hợp', sectionCode: 'results', row: 5, column: 2, type: 'TABLE', required: false, tableColumns: ['item', 'description'], tableColumnLabels: { item: 'Chỉ tiêu', description: 'Mô tả' } }),
    cell({ key: 'recommendation', label: 'Kiến nghị', sectionCode: 'conclusion', row: 1, column: 3, type: 'TEXT', required: false }),
    sharedCells.conclusion,
    cell({ key: 'reviewer', label: 'Người đánh giá', sectionCode: 'approval', row: 1, column: 4, type: 'TEXT', required: false }),
  ], 'Bản đánh giá kết quả thử nghiệm PGD đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-inspection-minutes', 'INSPECTION_MINUTES', 'PGD-BM-14', 'Biên bản vụ giám định', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.customerAddress, sharedCells.productName, sharedCells.lotCode,
    cell({ key: 'quantity', label: 'Số lượng / khối lượng', sectionCode: 'product', row: 1, column: 3, type: 'NUMBER', required: false, unit: 'đơn vị', binding: 'request.quantity' }),
    cell({ key: 'transportName', label: 'Phương tiện vận tải', sectionCode: 'documents', row: 1, column: 7, type: 'TEXT', required: false }),
    cell({ key: 'packingListNumber', label: 'Số giấy đóng gói', sectionCode: 'documents', row: 2, column: 7, type: 'TEXT', required: false }),
    cell({ key: 'invoiceNumber', label: 'Số hóa đơn', sectionCode: 'documents', row: 3, column: 7, type: 'TEXT', required: false }),
    cell({ key: 'contractNumber', label: 'Số hợp đồng', sectionCode: 'documents', row: 4, column: 7, type: 'TEXT', required: false }),
    cell({ key: 'performedAt', label: 'Thời gian giám định', sectionCode: 'identity', row: 1, column: 2, type: 'DATE', required: true }),
    cell({ key: 'location', label: 'Địa điểm giám định', sectionCode: 'location', row: 1, column: 6, type: 'TEXT', required: true, binding: 'request.inspectionLocation' }),
    cell({ key: 'inspectionScope', label: 'Hạng mục giám định', sectionCode: 'criteria', row: 1, column: 4, type: 'TEXT', required: true, binding: 'request.inspectionScope' }),
    cell({ key: 'preInspectionCondition', label: 'Tình trạng trước giám định', sectionCode: 'findings', row: 1, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'inspectionResult', label: 'Kết quả giám định', sectionCode: 'results', row: 2, column: 3, type: 'TEXT', required: true }),
    sharedCells.conclusion,
    cell({ key: 'sampleRows', label: 'Mẫu liên quan', sectionCode: 'samples', row: 1, column: 5, type: 'TABLE', required: false, tableColumns: ['sampleCode', 'description', 'quantity', 'unit', 'disposition'], tableColumnLabels: { sampleCode: 'Mã mẫu', description: 'Mô tả', quantity: 'Số lượng', unit: 'Đơn vị', disposition: 'Xử lý mẫu' } }),
    cell({ key: 'customerConfirmation', label: 'Đại diện khách hàng xác nhận', sectionCode: 'confirmation', row: 1, column: 8, type: 'TEXT', required: false }),
  ], 'BM-GĐ-07.21 Biên bản vụ giám định đã chuẩn hóa', ALL_METHOD_CODES),
  template('pgd-template-sample-handover', 'SAMPLE_HANDOVER', 'PGD-BM-15', 'Biên bản giao mẫu PTN', [
    sharedCells.requestCode, sharedCells.customerName, sharedCells.productName,
    cell({ key: 'laboratoryName', label: 'Phòng thí nghiệm', sectionCode: 'laboratory', row: 1, column: 2, type: 'TEXT', required: true }),
    cell({ key: 'laboratoryCode', label: 'Mã PTN', sectionCode: 'laboratory', row: 2, column: 2, type: 'TEXT', required: false }),
    cell({ key: 'senderUnit', label: 'Bên giao mẫu', sectionCode: 'handover', row: 1, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'sentAt', label: 'Ngày giao mẫu', sectionCode: 'handover', row: 2, column: 3, type: 'DATE', required: true }),
    cell({ key: 'sender', label: 'Người giao mẫu', sectionCode: 'handover', row: 3, column: 3, type: 'TEXT', required: true }),
    cell({ key: 'receiver', label: 'Người nhận mẫu', sectionCode: 'handover', row: 4, column: 3, type: 'TEXT', required: false }),
    cell({ key: 'handoverRows', label: 'Chi tiết giao mẫu', sectionCode: 'samples', row: 1, column: 4, type: 'TABLE', required: true, tableColumns: ['sampleCode', 'description', 'quantity', 'unit', 'testItems', 'methods'], tableColumnLabels: { sampleCode: 'Tên / ký hiệu mẫu', description: 'Mô tả', quantity: 'Số lượng', unit: 'Đơn vị', testItems: 'Chỉ tiêu phân tích', methods: 'Phương pháp thử' }, validation: { minRows: 1 } }),
    cell({ key: 'handoverNote', label: 'Ghi chú giao mẫu', sectionCode: 'handover', row: 5, column: 3, type: 'TEXT', required: false }),
  ], 'BM-QT-09-04 Biên bản giao mẫu đã chuẩn hóa', ALL_METHOD_CODES),
];

export function getPgdDocumentTemplates(): PgdDocumentTemplate[] {
  return DEFAULT_PGD_DOCUMENT_TEMPLATES.map(cloneTemplate);
}

/** Hydrate metadata for persisted rows created before the DOCX pack was introduced. */
export function normalizePgdDocumentTemplate(template: PgdDocumentTemplate): PgdDocumentTemplate {
  const cloned = cloneTemplate(template);
  if (Array.isArray(template.requiredPlaceholderKeys) && template.requiredPlaceholderKeys.length > 0) {
    const requiredKeys = new Set(template.requiredPlaceholderKeys.map((key) => String(key || '').trim()).filter(Boolean));
    cloned.cells = cloned.cells.map((cell) => (requiredKeys.has(cell.key) ? { ...cell, required: true } : cell));
  }
  return cloned;
}

export function isPgdDocumentTemplateRecordAllowed(value: unknown): value is PgdDocumentTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const template = value as Partial<PgdDocumentTemplate>;
  if (template.domain !== PGD_DOMAIN || !String(template.id || '').trim() || !String(template.code || '').trim() || !String(template.name || '').trim()) return false;
  if (!['INTAKE_REQUEST', 'ASSIGNMENT', 'INSPECTION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'LAB_REQUEST', 'INSPECTION_REPORT', 'DECISION', 'INSPECTION_CERTIFICATE', 'DOSSIER_COVER', 'CASE_TIMELINE', 'FIELD_ACTIVITY_LOG', 'LAB_RESULT_REVIEW', 'INSPECTION_MINUTES', 'SAMPLE_HANDOVER'].includes(String(template.kind || ''))) return false;
  if (!['DRAFT', 'PUBLISHED', 'RETIRED'].includes(String(template.status || ''))) return false;
  if (!Array.isArray(template.productGroups) || template.productGroups.some((item) => !ALL_PRODUCT_GROUPS.includes(item as PgdProductGroup))) return false;
  if (!Array.isArray(template.formats) || template.formats.some((format) => !['DOCX', 'PDF'].includes(String(format)))) return false;
  if (template.fileName !== undefined && (!String(template.fileName || '').trim() || /[\\/]/.test(String(template.fileName)))) return false;
  if (template.placeholderKeys !== undefined && (!Array.isArray(template.placeholderKeys) || template.placeholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) return false;
  if (template.requiredPlaceholderKeys !== undefined && (!Array.isArray(template.requiredPlaceholderKeys) || template.requiredPlaceholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) return false;
  if (!Array.isArray(template.cells) || validatePgdTemplateCells(template.cells).length > 0) return false;
  if (Array.isArray(template.requiredPlaceholderKeys) && Array.isArray(template.cells)) {
    const cellKeys = new Set(template.cells.map((c) => c.key));
    if (template.requiredPlaceholderKeys.some((key) => !cellKeys.has(String(key)))) return false;
  }
  return !/QC20|TVCI_NAS|Desktop|UNC/i.test(JSON.stringify(value));
}

export function validatePgdDocumentTemplate(template: Partial<PgdDocumentTemplate>): string[] {
  const issues: string[] = [];
  if (template.domain !== PGD_DOMAIN) issues.push('Template phải thuộc miền PGD.');
  if (!String(template.id || '').trim() || !String(template.code || '').trim() || !String(template.name || '').trim()) issues.push('Template cần có mã định danh, mã biểu mẫu và tên.');
  if (!String(template.version || '').trim()) issues.push('Template cần có phiên bản.');
  if (!['INTAKE_REQUEST', 'ASSIGNMENT', 'INSPECTION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'LAB_REQUEST', 'INSPECTION_REPORT', 'DECISION', 'INSPECTION_CERTIFICATE', 'DOSSIER_COVER', 'CASE_TIMELINE', 'FIELD_ACTIVITY_LOG', 'LAB_RESULT_REVIEW', 'INSPECTION_MINUTES', 'SAMPLE_HANDOVER'].includes(String(template.kind || ''))) issues.push('Loại template PGD không hợp lệ.');
  if (!Array.isArray(template.productGroups) || template.productGroups.length === 0 || template.productGroups.some((item) => !ALL_PRODUCT_GROUPS.includes(item as PgdProductGroup))) issues.push('Nhóm sản phẩm của template không hợp lệ.');
  if (!Array.isArray(template.formats) || template.formats.length === 0 || template.formats.some((format) => !['DOCX', 'PDF'].includes(String(format)))) issues.push('Định dạng template phải là DOCX hoặc PDF.');
  if (template.fileName !== undefined && (!String(template.fileName || '').trim() || /[\\/]/.test(String(template.fileName)))) issues.push('Mẫu cần có tên tệp DOCX tương đối, không chứa thư mục.');
  if (template.placeholderKeys !== undefined && (!Array.isArray(template.placeholderKeys) || template.placeholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) issues.push('Danh sách placeholder DOCX không hợp lệ.');
  if (template.requiredPlaceholderKeys !== undefined && (!Array.isArray(template.requiredPlaceholderKeys) || template.requiredPlaceholderKeys.some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(String(key))))) issues.push('Danh sách placeholder bắt buộc DOCX không hợp lệ.');
  if (!String(template.sourceFormLabel || '').trim()) issues.push('Template cần ghi nhận tên biểu mẫu nghiệp vụ đã chuẩn hóa.');
  if (!Array.isArray(template.cells) || template.cells.length === 0) issues.push('Template cần có ít nhất một cell.');
  else {
    issues.push(...validatePgdTemplateCells(template.cells).map((issue) => issue.message));
    if (Array.isArray(template.requiredPlaceholderKeys)) {
      const cellKeys = new Set(template.cells.map((c) => c.key));
      for (const reqKey of template.requiredPlaceholderKeys) {
        if (!cellKeys.has(String(reqKey))) {
          issues.push('Placeholder bắt buộc “' + reqKey + '” không có cell nhập liệu tương ứng.');
        }
      }
    }
  }
  if (/QC20|TVCI_NAS|Desktop|UNC/i.test(JSON.stringify(template))) issues.push('Template PGD không được chứa QC20 hoặc đường dẫn nguồn cũ.');
  return issues;
}

export function getPgdDocumentTemplate(kind: PgdDocumentTemplateKind, productGroup?: PgdProductGroup, methodCode?: string): PgdDocumentTemplate | undefined {
  const template = DEFAULT_PGD_DOCUMENT_TEMPLATES.find((candidate) =>
    candidate.active
    && candidate.kind === kind
    && (!productGroup || candidate.productGroups.includes(productGroup))
    && (!methodCode || !candidate.methodCodes?.length || candidate.methodCodes.includes(methodCode)),
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
