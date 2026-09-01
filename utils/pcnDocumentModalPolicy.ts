import type { PcnGeneratedDocumentFormat, PcnGeneratedDocumentKind } from '../types.ts';

export type PcnDocumentModalCategory = 'DOSSIER' | 'PROPOSAL' | 'SAMPLE' | 'LAB' | 'EVALUATION';

export interface PcnDocumentModalDefinition {
  kind: PcnGeneratedDocumentKind;
  label: string;
  description: string;
  category: PcnDocumentModalCategory;
  requiresSampleRoute: boolean;
  requiresLabRequest: boolean;
}

const SAMPLE_ROUTE_KINDS: readonly PcnGeneratedDocumentKind[] = [
  'SAMPLE_TAKING',
  'SAMPLE_CODING',
  'SAMPLE_HANDOVER',
  'SAMPLE_RETURN',
];

export const PCN_DOCUMENT_MODAL_DEFINITIONS: readonly PcnDocumentModalDefinition[] = [
  { kind: 'DOSSIER_COVER', label: 'Bìa và mục lục hồ sơ', description: 'Tổng hợp bộ hồ sơ hiện tại để đóng gói và kiểm tra.', category: 'DOSSIER', requiresSampleRoute: false, requiresLabRequest: false },
  { kind: 'PROPOSAL_SUMMARY', label: 'Phiếu tóm tắt Đề nghị', description: 'Tóm tắt đầu vào đã xác nhận của Đề nghị.', category: 'PROPOSAL', requiresSampleRoute: false, requiresLabRequest: false },
  { kind: 'PROPOSAL_FORM', label: 'Biểu mẫu Đề nghị chứng nhận', description: 'Biểu mẫu nội bộ phục vụ tiếp nhận và mở hồ sơ.', category: 'PROPOSAL', requiresSampleRoute: false, requiresLabRequest: false },
  { kind: 'ASSIGNMENT_FORM', label: 'Phiếu phân công chứng nhận', description: 'Ghi nhận người phụ trách và các mốc xử lý hồ sơ.', category: 'DOSSIER', requiresSampleRoute: false, requiresLabRequest: false },
  { kind: 'EVALUATION_PLAN', label: 'Kế hoạch đánh giá', description: 'Kế hoạch công việc của hồ sơ chứng nhận.', category: 'EVALUATION', requiresSampleRoute: false, requiresLabRequest: false },
  { kind: 'FIELD_INSPECTION', label: 'Biên bản kiểm tra hiện trường', description: 'Biên bản kiểm tra được tạo từ dữ liệu hồ sơ.', category: 'EVALUATION', requiresSampleRoute: false, requiresLabRequest: false },
  { kind: 'SAMPLE_TAKING', label: 'Biên bản lấy mẫu', description: 'Biên bản xác nhận việc lấy và nhận diện mẫu.', category: 'SAMPLE', requiresSampleRoute: true, requiresLabRequest: false },
  { kind: 'SAMPLE_CODING', label: 'Biên bản mã hóa mẫu', description: 'Biên bản mã hóa mẫu theo lô của PCN.', category: 'SAMPLE', requiresSampleRoute: true, requiresLabRequest: false },
  { kind: 'SAMPLE_HANDOVER', label: 'Biên bản giao nhận mẫu', description: 'Biên bản theo dõi mẫu chuyển giữa PCN và phòng thử.', category: 'SAMPLE', requiresSampleRoute: true, requiresLabRequest: false },
  { kind: 'SAMPLE_RETURN', label: 'Biên bản trả mẫu', description: 'Biên bản ghi nhận mẫu được trả về PCN.', category: 'SAMPLE', requiresSampleRoute: true, requiresLabRequest: false },
  { kind: 'LAB_REQUEST', label: 'Phiếu yêu cầu thử nghiệm gửi PTN', description: 'Phiếu phối hợp outbound từ PCN tới phòng thử nghiệm.', category: 'LAB', requiresSampleRoute: false, requiresLabRequest: true },
  { kind: 'EVALUATION_REPORT', label: 'Báo cáo đánh giá', description: 'Báo cáo nội bộ tổng hợp kết quả đánh giá hồ sơ.', category: 'EVALUATION', requiresSampleRoute: false, requiresLabRequest: false },
];

export function getPcnDocumentModalDefinition(kind: PcnGeneratedDocumentKind): PcnDocumentModalDefinition {
  return PCN_DOCUMENT_MODAL_DEFINITIONS.find((definition) => definition.kind === kind)
    || PCN_DOCUMENT_MODAL_DEFINITIONS[0];
}

export function getPcnDocumentOutputFormats(_kind: PcnGeneratedDocumentKind): PcnGeneratedDocumentFormat[] {
  return ['DOCX', 'PDF'];
}

export function pcnDocumentKindRequiresSampleRoute(kind: PcnGeneratedDocumentKind): boolean {
  return SAMPLE_ROUTE_KINDS.includes(kind);
}
