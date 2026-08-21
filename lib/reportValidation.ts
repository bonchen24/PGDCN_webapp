// Author: Gemini
// OS support: Web/Node
// Description: Pure validation rules for report dates, metadata, OCR and sample specifications

export type ReportValidationSeverity = 'error' | 'warning';

export interface ReportValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: ReportValidationSeverity;
}

export interface ReportValidationResult {
  issues: ReportValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface ReportDateInput {
  requestDate?: string;
  sampleReceiptDate?: string;
  testDate?: string;
  reportDate?: string;
}

export interface ReportSourceData {
  requestCode?: string;
  model?: string;
  brand?: string;
  codingNumber?: string;
  sealStamp?: string;
  specifications?: string;
  requestDate?: string;
}

export interface ReportMetadataInput {
  requestCode?: string;
  model?: string;
  brand?: string;
  codingNumber?: string;
  sealStamp?: string;
}

export interface ReportOcrInput {
  model?: string;
  brand?: string;
  sealStamp?: string;
  voltage?: string;
  frequency?: string;
  power?: string;
  current?: string;
}

export interface ReportTechnicalInput {
  voltage?: string;
  frequency?: string;
  power?: string;
  current?: string;
}

export interface ReportValidationInput {
  dates: ReportDateInput;
  source?: ReportSourceData;
  report?: ReportMetadataInput;
  ocr?: ReportOcrInput;
  form?: ReportMetadataInput & ReportTechnicalInput;
}

export interface ReportDateRange {
  start?: string;
  end?: string;
  invalid?: boolean;
}

const RANGE_SEPARATOR = /\s+(?:–|—|-)\s+/;
const TECHNICAL_FIELDS: Array<keyof ReportTechnicalInput> = ['voltage', 'frequency', 'power', 'current'];

const REPORT_VALIDATION_FIELD_LABELS: Record<string, string> = {
  requestDate: 'Ngày phiếu yêu cầu',
  sampleReceiptDate: 'Ngày nhận mẫu',
  testDate: 'Ngày thử nghiệm',
  reportDate: 'Ngày báo cáo',
  requestCode: 'Số PYC',
  model: 'Model',
  brand: 'Nhãn hiệu',
  codingNumber: 'Số mã hóa',
  sealStamp: 'Tem niêm phong',
  'form.model': 'Model trong form',
  'form.brand': 'Nhãn hiệu trong form',
  'form.sealStamp': 'Tem niêm phong trong form',
  'form.voltage': 'Điện áp trong form EMC',
  'form.frequency': 'Tần số trong form EMC',
  'form.power': 'Công suất trong form EMC',
  'form.current': 'Dòng điện trong form EMC',
  'ocr.model': 'Model từ OCR',
  'ocr.brand': 'Nhãn hiệu từ OCR',
  'ocr.sealStamp': 'Tem niêm phong từ OCR',
  'ocr.voltage': 'Điện áp từ OCR',
  'ocr.frequency': 'Tần số từ OCR',
  'ocr.power': 'Công suất từ OCR',
  'ocr.current': 'Dòng điện từ OCR',
};

const asText = (value: unknown): string => String(value ?? '').trim();

export const getReportValidationFieldLabel = (field: string): string => REPORT_VALIDATION_FIELD_LABELS[field] || field;

const canonicalDate = (value: string): string | null => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const vnMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const year = isoMatch ? Number(isoMatch[1]) : vnMatch ? Number(vnMatch[3]) : 0;
  const month = isoMatch ? Number(isoMatch[2]) : vnMatch ? Number(vnMatch[2]) : 0;
  const day = isoMatch ? Number(isoMatch[3]) : vnMatch ? Number(vnMatch[1]) : 0;
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const dateValue = (value: string): number => Date.parse(`${value}T00:00:00Z`);

export const parseReportDateRange = (value?: string): ReportDateRange => {
  const trimmed = asText(value);
  if (!trimmed) return {};
  const parts = trimmed.split(RANGE_SEPARATOR).map(part => part.trim());
  if (parts.length > 2 || parts.some(part => !part)) return { invalid: true };
  const start = canonicalDate(parts[0]);
  const end = canonicalDate(parts[1] || parts[0]);
  if (!start || !end || dateValue(start) > dateValue(end)) return { invalid: true };
  return { start, end };
};

export const normalizeComparableValue = (value: unknown): string => asText(value)
  .replace(/[Đđ]/g, 'd')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const normalizeSealStamp = (value: unknown): string => {
  const text = asText(value);
  if (!text) return '';
  const tokens = text.match(/IEMM(?:[\s._/-]*[A-Z0-9]+)+/gi) || [];
  if (!tokens.length) return normalizeComparableValue(text);
  return tokens
    .map(token => normalizeComparableValue(token))
    .filter(Boolean)
    .sort()
    .join('|');
};

const normalizedFieldValue = (field: string, value: unknown): string => field === 'sealStamp'
  ? normalizeSealStamp(value)
  : normalizeComparableValue(value);

const addIssue = (
  issues: ReportValidationIssue[],
  code: string,
  field: string,
  message: string,
  severity: ReportValidationSeverity,
) => {
  if (!issues.some(issue => issue.code === code && issue.field === field && issue.message === message)) {
    issues.push({ code, field, message, severity });
  }
};

const compareMetadata = (
  issues: ReportValidationIssue[],
  field: keyof ReportMetadataInput,
  label: string,
  source: ReportSourceData,
  report: ReportMetadataInput,
) => {
  const sourceValue = asText(source[field]);
  if (!sourceValue) return;
  const reportValue = asText(report[field]);
  if (!reportValue) {
    addIssue(issues, 'METADATA_MISSING', field, `Chưa nhập ${label} để đối chiếu với PYC.`, 'warning');
    return;
  }
  if (normalizedFieldValue(field, sourceValue) !== normalizedFieldValue(field, reportValue)) {
    addIssue(issues, 'METADATA_MISMATCH', field, `${label} trên báo cáo không khớp dữ liệu PYC.`, 'warning');
  }
};

const compareOcrField = (
  issues: ReportValidationIssue[],
  field: 'model' | 'brand' | 'sealStamp',
  label: string,
  ocrValue: string,
  sourceValue: string,
  reportValue: string,
  formValue?: string,
) => {
  if (!ocrValue) return;
  const effectiveReportValue = reportValue || formValue || '';
  if (!effectiveReportValue) {
    addIssue(issues, 'OCR_MISSING_TARGET', `ocr.${field}`, `${label} đã đọc từ OCR nhưng chưa có giá trị đối chiếu trong form.`, 'warning');
  } else if (normalizedFieldValue(field, ocrValue) !== normalizedFieldValue(field, effectiveReportValue)) {
    addIssue(issues, 'OCR_MISMATCH', `ocr.${field}`, `${label} từ OCR không khớp dữ liệu trên form.`, 'warning');
  }
  if (sourceValue && normalizedFieldValue(field, ocrValue) !== normalizedFieldValue(field, sourceValue)) {
    addIssue(issues, 'OCR_SOURCE_MISMATCH', `ocr.${field}`, `${label} từ OCR không khớp dữ liệu PYC.`, 'warning');
  }
};

const compareTechnicalField = (
  issues: ReportValidationIssue[],
  field: keyof ReportTechnicalInput,
  value: string,
  specifications: string,
  sourceLabel: string,
) => {
  if (!value || !specifications) return;
  const normalizedSpecifications = normalizeComparableValue(specifications);
  if (!normalizedSpecifications.includes(normalizeComparableValue(value))) {
    const label = field === 'voltage' ? 'Điện áp' : field === 'frequency' ? 'Tần số' : field === 'power' ? 'Công suất' : 'Dòng điện';
    addIssue(issues, 'TECHNICAL_MISMATCH', sourceLabel, `${label} nhập từ ${sourceLabel.startsWith('ocr.') ? 'OCR' : 'form EMC'} không có trong thông số PYC.`, 'warning');
  }
};

export const validateReportConsistency = (input: ReportValidationInput): ReportValidationResult => {
  const issues: ReportValidationIssue[] = [];
  const dates = input.dates || {};
  const parsedDates: Array<{ field: keyof ReportDateInput; range: ReportDateRange }> = [
    { field: 'requestDate', range: parseReportDateRange(dates.requestDate) },
    { field: 'sampleReceiptDate', range: parseReportDateRange(dates.sampleReceiptDate) },
    { field: 'testDate', range: parseReportDateRange(dates.testDate) },
    { field: 'reportDate', range: parseReportDateRange(dates.reportDate) },
  ];

  parsedDates.forEach(({ field, range }) => {
    if (range.invalid) addIssue(issues, 'DATE_INVALID', field, 'Ngày không đúng định dạng hoặc khoảng ngày không hợp lệ.', 'error');
  });

  const timeline = [
    { field: 'requestDate', value: parsedDates[0].range.start },
    { field: 'sampleReceiptDate', value: parsedDates[1].range.start },
    { field: 'testDate', value: parsedDates[2].range.start },
    { field: 'testDate', value: parsedDates[2].range.end },
    { field: 'reportDate', value: parsedDates[3].range.start },
  ];
  let previous: { field: string; value: string } | null = null;
  timeline.forEach(point => {
    if (!point.value) return;
    if (previous && dateValue(previous.value) > dateValue(point.value)) {
      addIssue(issues, 'DATE_ORDER', point.field, 'Thứ tự ngày phải là Ngày phiếu yêu cầu ≤ Ngày nhận mẫu ≤ Ngày thử nghiệm ≤ Ngày báo cáo.', 'error');
    }
    previous = { field: point.field, value: point.value };
  });

  const source = input.source || {};
  const report = input.report || {};
  (['requestCode', 'model', 'brand', 'codingNumber', 'sealStamp'] as Array<keyof ReportMetadataInput>).forEach(field => {
    const labels: Record<keyof ReportMetadataInput, string> = {
      requestCode: 'Số PYC',
      model: 'Model',
      brand: 'Nhãn hiệu',
      codingNumber: 'Số mã hóa',
      sealStamp: 'Tem niêm phong',
    };
    compareMetadata(issues, field, labels[field], source, report);
  });

  const form = input.form || {};
  (['model', 'brand', 'sealStamp'] as Array<keyof ReportMetadataInput>).forEach(field => {
    const sourceValue = asText(source[field]);
    const formValue = asText(form[field]);
    if (!sourceValue || !formValue) return;
    if (normalizedFieldValue(field, sourceValue) !== normalizedFieldValue(field, formValue)) {
      const label = field === 'model' ? 'Model' : field === 'brand' ? 'Nhãn hiệu' : 'Tem niêm phong';
      addIssue(issues, 'FORM_METADATA_MISMATCH', `form.${field}`, `${label} trong form báo cáo không khớp dữ liệu PYC.`, 'warning');
    }
  });

  const ocr = input.ocr || {};
  compareOcrField(issues, 'model', 'Model', asText(ocr.model), asText(source.model), asText(report.model), asText(form.model));
  compareOcrField(issues, 'brand', 'Nhãn hiệu', asText(ocr.brand), asText(source.brand), asText(report.brand), asText(form.brand));
  compareOcrField(issues, 'sealStamp', 'Tem niêm phong', asText(ocr.sealStamp), asText(source.sealStamp), asText(report.sealStamp), asText(form.sealStamp));

  const specifications = asText(source.specifications);
  TECHNICAL_FIELDS.forEach(field => {
    compareTechnicalField(issues, field, asText(ocr[field]), specifications, `ocr.${field}`);
    compareTechnicalField(issues, field, asText(form[field]), specifications, `form.${field}`);
  });

  const hasErrors = issues.some(issue => issue.severity === 'error');
  return {
    issues,
    hasErrors,
    hasWarnings: issues.some(issue => issue.severity === 'warning'),
  };
};

// --- End of lib/reportValidation.ts ---
