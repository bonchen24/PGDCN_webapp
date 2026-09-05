export type PcnAssistantErrorKind = 'STORAGE_CONFIG' | 'EMPTY_DOCUMENT' | 'OCR_UNAVAILABLE' | 'SERVICE' | 'UNKNOWN';

export type PcnAssistantErrorView = {
  kind: PcnAssistantErrorKind;
  title: string;
  action: string;
  detail?: string;
};

export type PcnAssistantErrorInput = {
  code?: unknown;
  message?: unknown;
};

const asText = (value: unknown): string => String(value || '').trim();

const detailFromMessage = (message: string): string | undefined => {
  const detail = message.replace(/^Dừng phiên AI:\s*/i, '').trim();
  return detail ? detail.slice(0, 320) : undefined;
};

export function classifyPcnAssistantError(input: PcnAssistantErrorInput): PcnAssistantErrorView {
  const code = asText(input.code).toUpperCase();
  const message = asText(input.message);
  const normalized = message.toLocaleLowerCase('vi-VN');

  if (normalized.includes('storage is not configured') || normalized.includes('supabase_service_role_key') || normalized.includes('storage supabase')) {
    return {
      kind: 'STORAGE_CONFIG',
      title: 'Chưa sẵn sàng đọc file private',
      action: 'Quản trị viên cần kiểm tra cấu hình Storage Supabase.',
    };
  }

  if (code === 'PADDLE_OCR_EMPTY' || normalized.includes('không có nội dung để kiểm tra')) {
    return {
      kind: 'EMPTY_DOCUMENT',
      title: 'File chưa có nội dung văn bản để đọc',
      action: 'Mở file bằng chứng để kiểm tra nội dung.',
      detail: detailFromMessage(message),
    };
  }

  if (code === 'PADDLE_OCR_UNAVAILABLE' || normalized.includes('paddleocr') || normalized.includes('không thể đọc')) {
    return {
      kind: 'OCR_UNAVAILABLE',
      title: 'Chưa thể đọc bằng chứng bằng OCR',
      action: 'Kiểm tra dịch vụ OCR hoặc mở file để đối chiếu thủ công.',
      detail: detailFromMessage(message),
    };
  }

  if (code.includes('GEMINI') || normalized.includes('gemini')) {
    return {
      kind: 'SERVICE',
      title: 'Dịch vụ AI chưa sẵn sàng',
      action: 'Kiểm tra cấu hình dịch vụ AI rồi thử lại.',
      detail: detailFromMessage(message),
    };
  }

  return {
    kind: 'UNKNOWN',
    title: 'Phiên hỗ trợ đã dừng',
    action: 'Thử lại phiên hỗ trợ.',
    detail: detailFromMessage(message),
  };
}
