// Author: Codex
// OS support: Web/Node
// Description: Shared validation policy for the PCN certification-proposal intake boundary

export interface PcnIntakeValidationIssue {
  field: string;
  message: string;
}

export interface PcnIntakeValidationResult {
  valid: boolean;
  issues: PcnIntakeValidationIssue[];
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function addRequiredIssue(issues: PcnIntakeValidationIssue[], value: unknown, field: string, message: string): void {
  if (!text(value)) issues.push({ field, message });
}

/**
 * Validate the fields that must be complete before a new PCN proposal/dossier
 * is committed. The function deliberately accepts unknown input so the same
 * policy can protect both the browser form and the server boundary.
 */
export function validatePcnProposalIntake(input: unknown): PcnIntakeValidationResult {
  const proposal = isRecord(input) ? input : {};
  const customer = isRecord(proposal.customerSnapshot) ? proposal.customerSnapshot : {};
  const issues: PcnIntakeValidationIssue[] = [];

  addRequiredIssue(issues, customer.name, 'customerSnapshot.name', 'Tên khách hàng là bắt buộc.');
  addRequiredIssue(issues, customer.address, 'customerSnapshot.address', 'Địa chỉ khách hàng là bắt buộc.');
  if (!text(customer.contactPerson) && !text(customer.taxId)) {
    issues.push({ field: 'customerSnapshot.contactPerson', message: 'Cần người liên hệ hoặc mã số thuế để đối chiếu khách hàng.' });
  }
  addRequiredIssue(issues, proposal.warehouseAddress, 'warehouseAddress', 'Địa chỉ/kho liên quan là bắt buộc.');
  addRequiredIssue(issues, proposal.productName, 'productName', 'Tên sản phẩm là bắt buộc.');
  addRequiredIssue(issues, proposal.productType, 'productType', 'Kiểu/loại sản phẩm là bắt buộc.');
  addRequiredIssue(issues, proposal.model, 'model', 'Model là bắt buộc.');
  addRequiredIssue(issues, proposal.brand, 'brand', 'Nhãn hiệu là bắt buộc.');
  addRequiredIssue(issues, proposal.specifications, 'specifications', 'Thông số kỹ thuật là bắt buộc.');
  addRequiredIssue(issues, proposal.manufacturer, 'manufacturer', 'Nhà sản xuất là bắt buộc.');

  const quantity = typeof proposal.quantity === 'number' || typeof proposal.quantity === 'string'
    ? Number(proposal.quantity)
    : Number.NaN;
  if (!Number.isInteger(quantity) || quantity < 1) {
    issues.push({ field: 'quantity', message: 'Số lượng mẫu phải là số nguyên dương.' });
  }

  if (!Array.isArray(proposal.fieldCodes) || proposal.fieldCodes.length === 0) {
    issues.push({ field: 'fieldCodes', message: 'Cần chọn ít nhất một Lĩnh vực.' });
  } else {
    const fieldCodes = proposal.fieldCodes.map((value) => text(value).toUpperCase());
    if (fieldCodes.some((value) => !value)) {
      issues.push({ field: 'fieldCodes', message: 'Mã Lĩnh vực không được để trống.' });
    }
    if (new Set(fieldCodes).size !== fieldCodes.length) {
      issues.push({ field: 'fieldCodes', message: 'Mỗi Lĩnh vực chỉ được chọn một lần.' });
    }
  }

  validateQc20Scope(proposal, issues);

  return { valid: issues.length === 0, issues };
}

export function formatPcnIntakeValidationIssues(issues: PcnIntakeValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(' ');
}

export function indexPcnIntakeValidationIssues(issues: PcnIntakeValidationIssue[]): Record<string, string> {
  return issues.reduce<Record<string, string>>((messages, issue) => {
    if (!messages[issue.field]) messages[issue.field] = issue.message;
    return messages;
  }, {});
}

function validateQc20Scope(proposal: Record<string, unknown>, issues: PcnIntakeValidationIssue[]): void {
  const fieldCodes = Array.isArray(proposal.fieldCodes)
    ? proposal.fieldCodes.map((value) => text(value).toUpperCase()).filter(Boolean)
    : [];
  if (!fieldCodes.includes('QC20')) return;

  const scope = isRecord(proposal.qc20Scope) ? proposal.qc20Scope : {};
  const requiredFields: Array<[string, string]> = [
    ['productForm', 'Dạng sản phẩm QC20 là bắt buộc.'],
    ['grade', 'Mác thép QC20 là bắt buộc.'],
    ['nominalDimensions', 'Kích thước danh nghĩa QC20 là bắt buộc.'],
    ['hsCode', 'Mã HS QC20 là bắt buộc.'],
    ['appliedStandard', 'Tiêu chuẩn áp dụng QC20 là bắt buộc.'],
    ['lotDefinition', 'Phải xác định QC20 theo lô sản phẩm hoặc lô hàng hóa.'],
  ];
  for (const [field, message] of requiredFields) {
    addRequiredIssue(issues, scope[field], `qc20Scope.${field}`, message);
  }
  if (text(scope.lotDefinition) && !['PRODUCT_LOT', 'SHIPMENT_LOT'].includes(text(scope.lotDefinition).toUpperCase())) {
    issues.push({ field: 'qc20Scope.lotDefinition', message: 'Cách xác định lô QC20 không hợp lệ.' });
  }
}

// --- End of pcnIntakePolicy.ts ---
