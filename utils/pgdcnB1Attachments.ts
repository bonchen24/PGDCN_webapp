export const PGDCN_B1_ATTACHMENT_TYPES = [
  { value: 'REQUEST', label: 'Phiếu / đề nghị' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'INVOICE', label: 'Hóa đơn' },
  { value: 'BILL_OF_LADING', label: 'Vận đơn' },
  { value: 'CUSTOMS_DECLARATION', label: 'Tờ khai' },
  { value: 'TECHNICAL', label: 'Tài liệu kỹ thuật' },
  { value: 'IMAGE', label: 'Hình ảnh' },
  { value: 'OTHER', label: 'Khác' },
] as const;

export type PgdcnB1AttachmentKind = (typeof PGDCN_B1_ATTACHMENT_TYPES)[number]['value'];
export type PgdcnB1UploadStatus = 'READY' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export type PgdcnB1SelectedAttachment = {
  id: string;
  file: File;
  kind: PgdcnB1AttachmentKind;
  status: PgdcnB1UploadStatus;
  error?: string;
};

export function createPgdcnB1SelectedAttachment(
  file: File,
  kind: PgdcnB1AttachmentKind = 'OTHER',
): PgdcnB1SelectedAttachment {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `b1-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return { id, file, kind, status: 'READY' };
}

export function formatPgdcnFileSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadPendingPgdcnB1Attachments(
  attachments: readonly PgdcnB1SelectedAttachment[],
  upload: (attachment: PgdcnB1SelectedAttachment) => Promise<unknown>,
  update: (id: string, patch: Pick<PgdcnB1SelectedAttachment, 'status'> & Partial<Pick<PgdcnB1SelectedAttachment, 'error'>>) => void,
): Promise<{ attempted: number; failed: number }> {
  let attempted = 0;
  let failed = 0;

  for (const attachment of attachments) {
    if (attachment.status === 'UPLOADED') continue;
    attempted += 1;
    update(attachment.id, { status: 'UPLOADING', error: undefined });
    try {
      await upload(attachment);
      update(attachment.id, { status: 'UPLOADED', error: undefined });
    } catch (error) {
      failed += 1;
      update(attachment.id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error || 'Không tải được tệp.'),
      });
    }
  }

  return { attempted, failed };
}
