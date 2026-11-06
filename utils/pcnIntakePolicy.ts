// Author: Codex
// OS support: Web/Node
// Description: Shared validation policy for the PCN certification-proposal intake boundary

import { PCN_CERTIFICATION_FIELD_CODES } from '../types.ts';

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

function isValidRegistrationDate(value: unknown): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isPgdSteelSource(proposal: Record<string, unknown>): boolean {
  const stds = Array.isArray(proposal.standards) ? proposal.standards.map(text).join(' ') : text(proposal.standards);
  const sourceText = [proposal.productName, proposal.productType, proposal.specifications, proposal.model, stds]
    .map(text)
    .join(' ')
    .toLocaleLowerCase('vi-VN');
  return /qcvn\s*20(?:\s*:\s*2019)?|\bqc20\b|th[eế]p\s+kh[oô]ng\s+g[iỉ]|stainless\s+steel|\binox\b/.test(sourceText);
}

/**
 * Validate the fields that must be complete before a new PCN proposal/dossier
 * is committed. The function deliberately accepts unknown input so the same
 * policy can protect both the browser form and the server boundary.
 */
export function validatePcnProposalIntake(input: unknown, options: { requireStandards?: boolean; requireProductGroup?: boolean; requireRegistration?: boolean; requireWarehouseAddress?: boolean } = {}): PcnIntakeValidationResult {
  const proposal = isRecord(input) ? input : {};
  const customer = isRecord(proposal.customerSnapshot) ? proposal.customerSnapshot : {};
  const issues: PcnIntakeValidationIssue[] = [];

  addRequiredIssue(issues, customer.name, 'customerSnapshot.name', 'Tên khách hàng là bắt buộc.');
  addRequiredIssue(issues, customer.address, 'customerSnapshot.address', 'Địa chỉ khách hàng là bắt buộc.');
  if (!text(customer.contactPerson) && !text(customer.taxId)) {
    issues.push({ field: 'customerSnapshot.contactPerson', message: 'Cần người liên hệ hoặc mã số thuế để đối chiếu khách hàng.' });
  }
  if (options.requireWarehouseAddress !== false) {
    addRequiredIssue(issues, proposal.warehouseAddress, 'warehouseAddress', 'Địa chỉ/kho liên quan là bắt buộc.');
  }
  // New B1 intake can add a warehouse or sampling location later in the dossier workflow.
  // Detailed product fields remain optional for minimal intake and legacy records.
  const validGroups = ['ELECTRICAL_ELECTRONIC', 'METAL_MATERIALS', 'CONSTRUCTION_MATERIALS', 'MANAGEMENT_SYSTEM', 'OTHER'];
  if (options.requireProductGroup || proposal.productGroup !== undefined) {
    if (!validGroups.includes(String(proposal.productGroup || ''))) {
      issues.push({ field: 'productGroup', message: proposal.productGroup ? 'Nhóm sản phẩm không hợp lệ.' : 'Cần chọn nhóm sản phẩm.' });
    }
  }
  if (options.requireRegistration) {
    addRequiredIssue(issues, proposal.registrationNumber, 'registrationNumber', 'Số đăng ký là bắt buộc.');
    addRequiredIssue(issues, proposal.registrationDate, 'registrationDate', 'Ngày đăng ký là bắt buộc.');
  }
  if (text(proposal.registrationDate) && !isValidRegistrationDate(proposal.registrationDate)) {
    issues.push({ field: 'registrationDate', message: 'Ngày đăng ký không hợp lệ.' });
  }

  if (options.requireStandards) {
    const standards = Array.isArray(proposal.standards) ? proposal.standards.map(text).filter(Boolean) : [text(proposal.standards)].filter(Boolean);
    if (standards.length === 0) issues.push({ field: 'standards', message: 'Tiêu chuẩn / quy chuẩn là bắt buộc theo biểu mẫu Đề nghị chứng nhận.' });
  }

  if (isPgdSteelSource(proposal)) {
    issues.push({
      field: 'productType',
      message: 'Nguồn mô tả thép không gỉ hoặc QCVN 20 thuộc miền PGD; không được tiếp nhận trong PCN.',
    });
  }

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
    if (fieldCodes.some((value) => !PCN_CERTIFICATION_FIELD_CODES.includes(value as typeof PCN_CERTIFICATION_FIELD_CODES[number]))) {
      issues.push({ field: 'fieldCodes', message: 'PCN chỉ hỗ trợ lĩnh vực QC4 hoặc QC9; hồ sơ thép không gỉ thuộc PGD.' });
    }
    if (new Set(fieldCodes).size !== fieldCodes.length) {
      issues.push({ field: 'fieldCodes', message: 'Mỗi Lĩnh vực chỉ được chọn một lần.' });
    }
  }

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

// --- End of utils/pcnIntakePolicy.ts ---
