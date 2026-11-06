import type { PgdInspectionCertificate, PgdInspectionRequest } from './pgdDomain';

export type PgdIssuanceAction = 'SIGN' | 'DELIVER' | 'ARCHIVE';

export type PgdIssuanceInput =
  | { action: 'SIGN'; issueDate: string; expiryDate: string; fileName: string; fileSize: number; mimeType: string; pdfHeaderValid: boolean }
  | { action: 'DELIVER'; deliveredTo: string }
  | { action: 'ARCHIVE' };

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validatePgdIssuanceAction(
  request: Pick<PgdInspectionRequest, 'status'>,
  certificate: Pick<PgdInspectionCertificate, 'status' | 'issuanceFileAssetId' | 'deliveredAt' | 'deliveredTo'>,
  input: PgdIssuanceInput,
): string | null {
  if (input.action === 'SIGN') {
    if (request.status !== 'APPROVED_FOR_ISSUANCE' || certificate.status !== 'APPROVED') return 'Chỉ được ký sau khi lãnh đạo phê duyệt tại B6.';
    if (!isCalendarDate(input.issueDate) || !isCalendarDate(input.expiryDate)) return 'Ngày cấp và ngày hết hạn phải là ngày hợp lệ.';
    if (input.expiryDate < input.issueDate) return 'Ngày hết hạn không được trước ngày cấp.';
    if (!input.fileName.toLowerCase().endsWith('.pdf') || !['application/pdf', 'application/x-pdf', ''].includes(input.mimeType.toLowerCase())) return 'Bản ký cuối cùng phải là tệp PDF.';
    if (input.fileSize <= 0 || input.fileSize > 20 * 1024 * 1024) return 'Tệp PDF phải có dung lượng từ 1 byte đến 20 MB.';
    if (!input.pdfHeaderValid) return 'Tệp tải lên không có chữ ký định dạng PDF hợp lệ.';
    return null;
  }
  if (input.action === 'DELIVER') {
    if (request.status !== 'SIGNED' || certificate.status !== 'SIGNED' || !certificate.issuanceFileAssetId) return 'Chỉ bàn giao sau khi đã lưu bản PDF ký đóng dấu.';
    if (!input.deliveredTo.trim()) return 'Cần ghi người nhận kết quả.';
    return null;
  }
  if (request.status !== 'RESULT_RETURNED' || certificate.status !== 'SIGNED' || !certificate.deliveredAt || !certificate.deliveredTo) return 'Chỉ lưu trữ sau khi đã ghi nhận bàn giao kết quả.';
  return null;
}

\n