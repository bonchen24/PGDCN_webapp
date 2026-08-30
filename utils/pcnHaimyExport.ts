// Author: Codex
// OS support: Web
// Description: Safe browser-side CSV export for the PCN Haimy staging snapshot

import type { PcnHaimyStagingRecord } from '../types.ts';

const STATUS_LABELS: Record<PcnHaimyStagingRecord['status'], string> = {
  READY_FOR_REVIEW: 'Sẵn sàng rà soát',
  NEEDS_REVIEW: 'Cần rà soát',
  DUPLICATE_NOOP: 'Trùng, bỏ qua',
  CONFLICT: 'Xung đột',
  PROMOTED: 'Đã tạo hồ sơ PCN',
};

const HEADERS = [
  'Batch ID',
  'Hệ thống nguồn',
  'Mã đăng ký ngoài',
  'Mã lô ngoài',
  'Mã GCN ngoài',
  'Số đăng ký',
  'Khách hàng',
  'Sản phẩm',
  'Model',
  'Thương hiệu',
  'Mã lĩnh vực',
  'Số lượng',
  'Trạng thái',
  'Mã lỗi',
  'Nội dung rà soát',
  'Idempotency key',
  'Fingerprint',
] as const;

function safeCell(value: unknown): string {
  const text = String(value ?? '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

function stagingRow(item: PcnHaimyStagingRecord): unknown[] {
  return [
    item.batchId,
    item.sourceSystem,
    item.externalRegistrationId,
    item.externalBatchId,
    item.externalCertificateId,
    item.registrationCode,
    item.customerName,
    item.productName,
    item.model,
    item.brand,
    item.fieldCode,
    item.quantity,
    STATUS_LABELS[item.status],
    item.issues.map((issue) => issue.code).join(' | '),
    item.issues.map((issue) => issue.message).join(' | '),
    item.idempotencyKey,
    item.sourcePayloadFingerprint,
  ];
}

export function buildPcnHaimyStagingCsv(items: PcnHaimyStagingRecord[]): string {
  return [
    `\uFEFF${HEADERS.map(safeCell).join(',')}`,
    ...items.map((item) => stagingRow(item).map(safeCell).join(',')),
  ].join('\r\n');
}

// --- End of pcnHaimyExport.ts ---
