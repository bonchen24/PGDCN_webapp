import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnDraftFormKind, PcnDraftWorkspace, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types.ts';

export function hasPcnDeepContext(input: { dossierId?: string; requirementId?: string; kind?: string }): boolean {
  return Boolean(String(input.dossierId || '').trim());
}
import { getPcnOperationalTemplateForKind } from './pcnOperationalTemplateCatalog.ts';

export interface PcnDraftFieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'textarea';
  required?: boolean;
  section?: PcnDraftFieldSection;
}

export interface PcnDraftFieldSection {
  key: 'identity' | 'customer' | 'product' | 'criteria' | 'sampling' | 'documents' | 'results' | 'approval' | 'signatures';
  label: string;
}

const PCN_DRAFT_FIELD_SECTIONS: Record<PcnDraftFieldSection['key'], string> = {
  identity: 'Nhận diện chứng từ',
  customer: 'Khách hàng / đơn vị đề nghị',
  product: 'Sản phẩm / lô / mẫu',
  criteria: 'Lĩnh vực / tiêu chuẩn',
  sampling: 'Lấy mẫu / địa điểm / thời gian',
  documents: 'PYC / tài liệu / bàn giao',
  results: 'Kết quả / kết luận',
  approval: 'Đánh giá / soát xét / phê duyệt',
  signatures: 'Giao nhận / ký xác nhận',
};

export function getPcnDraftFieldSection(key: string): PcnDraftFieldSection {
  const normalized = String(key || '').trim().toLowerCase();
  const section: PcnDraftFieldSection['key'] =
    /^(so_dang_ky|ma_ho_so|so_bao_cao|so_hop_dong|so_gcn|so_quyet_dinh|ngay_qd|ngay_cap_cn|ngay_cap_gcn)$/i.test(normalized) ? 'identity'
      : /^(ten_cong_ty|ma_so_thue|dia_chi_ct|nguoi_lien_he|dien_thoai|email|dia_chi_don_vi|don_vi_chung_nhan|nguoi_dai_dien)$/.test(normalized) ? 'customer'
        : /^(loai_sp|model|nhan_hieu|nha_san_xuat|dia_chi_nha_san_xuat|ma_lo|seal_stamp|ma_mau|so_luong_mau|thong_so_ky_thuat)$/.test(normalized) ? 'product'
          : /^(field_code|method_label|tieu_chuan)$/.test(normalized) ? 'criteria'
            : /^(dia_chi_kho|dia_diem_lap|ngay_lap|ngay_lay_mau|ngay_kiem_tra|ngay_bat_dau|ngay_ket_thuc|ngay_giao_mau|ngay_kqtn|ngay_cap_gcn|ngay_cap_cn|ngay_hop_dong|ngay_bat_dau_hieu_luc|ngay_het_hieu_luc|ngay_ket_thuc_hop_dong|ngay_giao_khach)$/.test(normalized) ? 'sampling'
              : /^(so_pyc|phong_thu_nghiem|ma_phong_thu_nghiem|so_luong_tai_lieu|phuong_thuc_giao|ten_tai_lieu|ghi_chu_giao_nhan)$/.test(normalized) ? 'documents'
                : /^(ket_qua|ket_luan|ket_luan_chung_nhan|recommendations|ghi_chu)$/.test(normalized) ? 'results'
                  : /^(nguoi_danh_gia|nguoi_tham_xet|nguoi_phe_duyet)$/.test(normalized) ? 'approval'
                    : 'signatures';
  return { key: section, label: PCN_DRAFT_FIELD_SECTIONS[section] };
}

const COMMON_FIELDS: PcnDraftFieldDefinition[] = [
  { key: 'so_dang_ky', label: 'Số Đề nghị / đăng ký', required: true },
  { key: 'ma_ho_so', label: 'Số hồ sơ' },
  { key: 'ten_cong_ty', label: 'Tên khách hàng', required: true },
  { key: 'ma_so_thue', label: 'Mã số thuế' },
  { key: 'dia_chi_ct', label: 'Địa chỉ khách hàng' },
  { key: 'nguoi_lien_he', label: 'Người liên hệ' },
  { key: 'dien_thoai', label: 'Điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'loai_sp', label: 'Tên sản phẩm', required: true },
  { key: 'model', label: 'Kiểu loại' },
  { key: 'nhan_hieu', label: 'Nhãn hiệu' },
  { key: 'nha_san_xuat', label: 'Nhà sản xuất' },
  { key: 'dia_chi_nha_san_xuat', label: 'Địa chỉ nhà sản xuất' },
  { key: 'tieu_chuan', label: 'Tiêu chuẩn / quy chuẩn' },
  { key: 'field_code', label: 'Lĩnh vực' },
  { key: 'method_label', label: 'Phương thức chứng nhận' },
  { key: 'ghi_chu', label: 'Ghi chú', type: 'textarea' },
];

const FORM_FIELDS: Record<PcnDraftFormKind, PcnDraftFieldDefinition[]> = {
  PROPOSAL_FORM: [...COMMON_FIELDS, { key: 'dia_chi_kho', label: 'Địa chỉ/kho lấy mẫu' }, { key: 'so_luong_mau', label: 'Số lượng mẫu', required: true }, { key: 'thong_so_ky_thuat', label: 'Thông số kỹ thuật', type: 'textarea', required: true }],
  DOSSIER_COVER: [...COMMON_FIELDS, { key: 'nguoi_danh_gia', label: 'Người phụ trách/đánh giá' }],
  ASSIGNMENT_FORM: [...COMMON_FIELDS, { key: 'dia_chi_kho', label: 'Địa chỉ/kho lấy mẫu' }, { key: 'ngay_lap', label: 'Ngày lập', type: 'date', required: true }, { key: 'ngay_phan_cong', label: 'Ngày phân công', type: 'date', required: true }, { key: 'ngay_lay_mau', label: 'Ngày dự kiến lấy mẫu', type: 'date', required: true }, { key: 'nguoi_giao', label: 'Người phân công/giao' }, { key: 'nguoi_danh_gia', label: 'Người đánh giá', required: true }, { key: 'nguoi_tham_xet', label: 'Người soát xét', required: true }],
  EVALUATION_PLAN: [...COMMON_FIELDS, { key: 'ngay_bat_dau', label: 'Ngày bắt đầu', type: 'date', required: true }, { key: 'ngay_ket_thuc', label: 'Ngày kết thúc', type: 'date', required: true }, { key: 'dia_diem_lap', label: 'Địa điểm đánh giá', required: true }, { key: 'nguoi_danh_gia', label: 'Người đánh giá', required: true }, { key: 'nguoi_tham_xet', label: 'Người soát xét', required: true }],
  FIELD_INSPECTION: [...COMMON_FIELDS, { key: 'dia_chi_kho', label: 'Địa chỉ/kho lấy mẫu' }, { key: 'ngay_lap', label: 'Ngày lập', type: 'date', required: true }, { key: 'ngay_kiem_tra', label: 'Ngày kiểm tra', type: 'date', required: true }, { key: 'ngay_lay_mau', label: 'Ngày lấy mẫu', type: 'date', required: true }, { key: 'dia_diem_lap', label: 'Địa điểm kiểm tra', required: true }, { key: 'nguoi_danh_gia', label: 'Người đánh giá', required: true }, { key: 'nguoi_tham_xet', label: 'Người soát xét', required: true }, { key: 'ket_luan', label: 'Kết luận', type: 'textarea', required: true }],
  SAMPLE_TAKING: [...COMMON_FIELDS, { key: 'dia_chi_kho', label: 'Địa chỉ/kho lấy mẫu' }, { key: 'dia_diem_lap', label: 'Địa điểm lập' }, { key: 'ma_lo', label: 'Mã lô', required: true }, { key: 'seal_stamp', label: 'Mã hóa/tem niêm phong', required: true }, { key: 'ma_mau', label: 'Mã mẫu', required: true }, { key: 'ngay_lay_mau', label: 'Ngày lấy mẫu', type: 'date', required: true }, { key: 'ngay_giao_mau', label: 'Ngày dự kiến giao mẫu', type: 'date' }, { key: 'nguoi_danh_gia', label: 'Người đánh giá' }, { key: 'so_luong_mau', label: 'Số lượng mẫu', required: true }, { key: 'ket_luan', label: 'Kết luận/ghi nhận', type: 'textarea' }],
  SAMPLE_CODING: [...COMMON_FIELDS, { key: 'ma_lo', label: 'Mã lô', required: true }, { key: 'seal_stamp', label: 'Tem niêm phong', required: true }, { key: 'ma_mau', label: 'Danh sách mã mẫu', required: true }, { key: 'so_luong_mau', label: 'Số lượng mẫu', required: true }],
  SAMPLE_HANDOVER: [...COMMON_FIELDS, { key: 'so_pyc', label: 'Số PYC', required: true }, { key: 'phong_thu_nghiem', label: 'Phòng thử nghiệm', required: true }, { key: 'ma_phong_thu_nghiem', label: 'Mã phòng thử nghiệm' }, { key: 'ma_mau', label: 'Mã mẫu', required: true }, { key: 'so_luong_mau', label: 'Số lượng mẫu', required: true }, { key: 'ngay_giao_mau', label: 'Ngày giao mẫu', type: 'date', required: true }, { key: 'nguoi_giao', label: 'Người giao', required: true }, { key: 'nguoi_nhan', label: 'Người nhận', required: true }],
  LAB_REQUEST: [...COMMON_FIELDS, { key: 'dia_chi_kho', label: 'Địa chỉ/kho lấy mẫu' }, { key: 'so_pyc', label: 'Số PYC', required: true }, { key: 'phong_thu_nghiem', label: 'Phòng thử nghiệm', required: true }, { key: 'ma_mau', label: 'Mã mẫu', required: true }, { key: 'so_luong_mau', label: 'Số lượng mẫu' }, { key: 'seal_stamp', label: 'Tem niêm phong' }, { key: 'ngay_giao_mau', label: 'Ngày giao mẫu', type: 'date' }, { key: 'ngay_kqtn', label: 'Ngày nhận KQTN', type: 'date' }],
  EVALUATION_REPORT: [...COMMON_FIELDS, { key: 'so_bao_cao', label: 'Số báo cáo', required: true }, { key: 'ngay_lap', label: 'Ngày lập', type: 'date', required: true }, { key: 'ket_qua', label: 'Kết luận đánh giá', type: 'textarea', required: true }, { key: 'ket_luan', label: 'Kết luận chi tiết', type: 'textarea' }, { key: 'nguoi_danh_gia', label: 'Người đánh giá' }, { key: 'nguoi_tham_xet', label: 'Người soát xét', required: true }],
  CERTIFICATION_RESULT: [...COMMON_FIELDS, { key: 'ma_lo', label: 'Mã lô' }, { key: 'ngay_lap', label: 'Ngày lập', type: 'date' }, { key: 'nguoi_danh_gia', label: 'Người đánh giá' }, { key: 'nguoi_phe_duyet', label: 'Người phê duyệt' }, { key: 'nguoi_tham_xet', label: 'Người soát xét' }, { key: 'ket_qua', label: 'Kết quả', type: 'textarea', required: true }, { key: 'ket_luan_chung_nhan', label: 'Kết luận chứng nhận', type: 'textarea', required: true }],
  COMMERCIAL: [{ key: 'ma_ho_so', label: 'Số hồ sơ' }, { key: 'so_dang_ky', label: 'Số Đề nghị / đăng ký' }, { key: 'so_hop_dong', label: 'Số hợp đồng', required: true }, { key: 'so_ban_hop_dong', label: 'Số bản hợp đồng' }, { key: 'ngay_hop_dong', label: 'Ngày hợp đồng', type: 'date', required: true }, { key: 'ngay_bat_dau', label: 'Ngày bắt đầu hiệu lực', type: 'date' }, { key: 'ngay_het_hieu_luc', label: 'Ngày hết hiệu lực', type: 'date' }, { key: 'ngay_ket_thuc', label: 'Ngày kết thúc', type: 'date' }, { key: 'ten_cong_ty', label: 'Tên khách hàng', required: true }, { key: 'dia_chi_ct', label: 'Địa chỉ khách hàng' }, { key: 'dia_chi_don_vi', label: 'Địa chỉ đơn vị chứng nhận' }, { key: 'don_vi_chung_nhan', label: 'Đơn vị chứng nhận' }, { key: 'nguoi_dai_dien', label: 'Người đại diện' }, { key: 'nguoi_lien_he', label: 'Người liên hệ' }, { key: 'nguoi_ky_ben_a', label: 'Người ký bên A' }, { key: 'nguoi_ky_ben_b', label: 'Người ký bên B' }, { key: 'field_code', label: 'Lĩnh vực' }, { key: 'loai_sp', label: 'Tên sản phẩm' }, { key: 'model', label: 'Kiểu loại' }, { key: 'method_label', label: 'Phương thức chứng nhận' }, { key: 'tieu_chuan', label: 'Tiêu chuẩn / quy chuẩn' }, { key: 'phi_dich_vu', label: 'Phí dịch vụ', required: true }, { key: 'dieu_khoan_thanh_toan', label: 'Điều khoản thanh toán', type: 'textarea', required: true }, { key: 'ghi_chu', label: 'Ghi chú', type: 'textarea' }],
  CLIENT_PACKAGE: [...COMMON_FIELDS, { key: 'ma_ho_so', label: 'Số hồ sơ' }, { key: 'ngay_giao_khach', label: 'Ngày giao khách hàng', type: 'date', required: true }, { key: 'nguoi_giao', label: 'Người giao' }, { key: 'nguoi_nhan', label: 'Người nhận', required: true }, { key: 'phuong_thuc_giao', label: 'Phương thức giao' }, { key: 'so_luong_tai_lieu', label: 'Số lượng tài liệu' }, { key: 'ghi_chu_giao_nhan', label: 'Ghi chú giao nhận', type: 'textarea' }],
};

export function getPcnDraftFieldDefinitions(kind: PcnDraftFormKind): PcnDraftFieldDefinition[] {
  const fields = (FORM_FIELDS[kind] || COMMON_FIELDS).map((field) => ({ ...field }));
  const template = getPcnOperationalTemplateForKind(kind);
  const requiredKeys = new Set(template?.requiredPlaceholderKeys || []);
  const knownKeys = new Set(fields.map((field) => field.key));
  const labelByKey: Record<string, string> = {
    so_dang_ky: 'Số Đề nghị / đăng ký',
    ma_ho_so: 'Số hồ sơ',
    so_gcn: 'Số giấy chứng nhận',
    so_quyet_dinh: 'Số quyết định',
    so_hop_dong: 'Số hợp đồng',
    so_ban_hop_dong: 'Số bản hợp đồng',
    ten_cong_ty: 'Tên khách hàng',
    ma_so_thue: 'Mã số thuế',
    dia_chi_ct: 'Địa chỉ khách hàng',
    dia_chi_kho: 'Địa chỉ/kho lấy mẫu',
    dia_chi_don_vi: 'Địa chỉ đơn vị chứng nhận',
    nguoi_lien_he: 'Người liên hệ',
    dien_thoai: 'Điện thoại',
    email: 'Email',
    loai_sp: 'Tên sản phẩm',
    model: 'Kiểu loại',
    nhan_hieu: 'Nhãn hiệu',
    nha_san_xuat: 'Nhà sản xuất',
    dia_chi_nha_san_xuat: 'Địa chỉ nhà sản xuất',
    thong_so_ky_thuat: 'Thông số kỹ thuật',
    tieu_chuan: 'Tiêu chuẩn / quy chuẩn',
    method_label: 'Phương thức chứng nhận',
    field_code: 'Lĩnh vực',
    ngay_lay_mau: 'Ngày lấy mẫu',
    ngay_giao_mau: 'Ngày giao mẫu',
    ngay_lap: 'Ngày lập',
    ngay_bat_dau: 'Ngày bắt đầu',
    ngay_ket_thuc: 'Ngày kết thúc',
    ngay_kiem_tra: 'Ngày kiểm tra',
    ngay_hop_dong: 'Ngày hợp đồng',
    ngay_bat_dau_hieu_luc: 'Ngày bắt đầu hiệu lực',
    ngay_het_hieu_luc: 'Ngày hết hiệu lực',
    ngay_ket_thuc_hop_dong: 'Ngày kết thúc hợp đồng',
    ngay_giao_khach: 'Ngày giao khách hàng',
    ngay_cap_CN: 'Ngày cấp giấy chứng nhận',
    ngay_cap_gcn: 'Ngày cấp giấy chứng nhận',
    ngay_qd: 'Ngày quyết định',
    ngay_kqtn: 'Ngày nhận KQTN',
    so_pyc: 'Số PYC',
    phong_thu_nghiem: 'Phòng thử nghiệm',
    ma_phong_thu_nghiem: 'Mã phòng thử nghiệm',
    ma_mau: 'Mã mẫu',
    ma_lo: 'Mã lô',
    seal_stamp: 'Mã tem niêm phong',
    so_luong_mau: 'Số lượng mẫu',
    so_bao_cao: 'Số báo cáo',
    ket_qua: 'Kết quả',
    ket_luan: 'Kết luận',
    ket_luan_chung_nhan: 'Kết luận chứng nhận',
    nguoi_giao: 'Người giao',
    nguoi_nhan: 'Người nhận',
    nguoi_danh_gia: 'Người đánh giá',
    nguoi_tham_xet: 'Người soát xét',
    nguoi_phe_duyet: 'Người phê duyệt',
    phi_dich_vu: 'Phí dịch vụ',
    dieu_khoan_thanh_toan: 'Điều khoản thanh toán',
    ghi_chu: 'Ghi chú',
    ghi_chu_giao_nhan: 'Ghi chú giao nhận',
  };
  const typeByKey: Record<string, PcnDraftFieldDefinition['type']> = {
    ngay_lay_mau: 'date',
    ngay_giao_mau: 'date',
    ngay_lap: 'date',
    ngay_bat_dau: 'date',
    ngay_ket_thuc: 'date',
    ngay_kiem_tra: 'date',
    ngay_hop_dong: 'date',
    ngay_bat_dau_hieu_luc: 'date',
    ngay_het_hieu_luc: 'date',
    ngay_ket_thuc_hop_dong: 'date',
    ngay_giao_khach: 'date',
    ngay_cap_CN: 'date',
    ngay_cap_gcn: 'date',
    ngay_qd: 'date',
    ngay_kqtn: 'date',
  };
  for (const field of fields) {
    if (requiredKeys.has(field.key)) field.required = true;
  }
  for (const key of requiredKeys) {
    if (!knownKeys.has(key)) {
      fields.push({ key, label: labelByKey[key] || key.replace(/_/g, ' '), type: typeByKey[key] || (/^ngay_/i.test(key) ? 'date' : 'text'), required: true });
    }
  }
  return fields.map((field) => ({ ...field, section: field.section || getPcnDraftFieldSection(field.key) }));
}

export function validatePcnDraftValues(kind: PcnDraftFormKind, values: Record<string, unknown>): { valid: boolean; missingKeys: string[] } {
  const missingKeys = getPcnDraftFieldDefinitions(kind).filter((field) => field.required && !String(values[field.key] ?? '').trim()).map((field) => field.key);
  return { valid: missingKeys.length === 0, missingKeys };
}

export type PcnDraftAction = 'SAVE' | 'GENERATE';

export function validatePcnDraftAction(kind: PcnDraftFormKind, values: Record<string, unknown>, action: PcnDraftAction): { valid: boolean; missingKeys: string[] } {
  return action === 'SAVE' ? { valid: true, missingKeys: [] } : validatePcnDraftValues(kind, values);
}

export interface PcnDraftRelatedSource {
  sampleLots?: PcnSampleLot[];
  sampleRoutes?: PcnSampleRoute[];
  labRequests?: OutboundLabRequest[];
  returnedResults?: ReturnedTestResult[];
}

function newestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
}

export function buildPcnDraftSourceValues(proposal?: CertificationProposal, dossier?: CertificationDossier, related: PcnDraftRelatedSource = {}): Record<string, unknown> {
  const customer = dossier?.customerSnapshot || proposal?.customerSnapshot;
  const dossierId = dossier?.id;
  const lots = newestFirst((related.sampleLots || []).filter((lot) => Boolean(dossierId) && lot.dossierId === dossierId));
  const lot = lots[0];
  const lotRoutes = lot ? (related.sampleRoutes || []).filter((route) => route.sampleLotId === lot.id) : [];
  const routes = newestFirst(lotRoutes);
  const requests = newestFirst((related.labRequests || []).filter((request) => Boolean(dossierId) && request.dossierId === dossierId));
  const route = routes.find((candidate) => candidate.labRequestId && requests.some((request) => request.id === candidate.labRequestId)) || routes[0];
  const request = route?.labRequestId
    ? requests.find((candidate) => candidate.id === route.labRequestId)
    : requests.find((candidate) => candidate.sampleRouteId === route?.id || candidate.sampleLotId === lot?.id) || requests[0];
  const sampleCodes = request?.handoverDetails?.sampleCodes || [];
  const result = request ? newestFirst((related.returnedResults || []).filter((candidate) => candidate.labRequestId === request.id))[0] : undefined;
  const firstRouteDate = route?.sentAt || route?.createdAt || lot?.receivedAt || '';
  const resultDate = result?.receivedAt || request?.receivedAt || '';
  const evaluator = dossier?.evaluatorUsername || '';
  const reviewer = dossier?.reviewerUsername || '';
  return {
    so_dang_ky: proposal?.proposalCode || '',
    ma_ho_so: dossier?.dossierCode || '',
    ten_cong_ty: customer?.name || '',
    ma_so_thue: customer?.taxId || '',
    dia_chi_ct: customer?.address || '',
    nguoi_lien_he: customer?.contactPerson || '',
    dien_thoai: customer?.phone || '',
    email: customer?.email || '',
    loai_sp: proposal?.productName || '',
    // Prefer the actual sampled lot values below when available.
    nha_san_xuat: proposal?.manufacturer || '',
    dia_chi_nha_san_xuat: proposal?.manufacturerAddress || '',
    dia_chi_kho: proposal?.warehouseAddress || '',
    thong_so_ky_thuat: proposal?.specifications || '',
    field_code: (dossier?.fieldCodes || proposal?.fieldCodes || []).join(', '),
    method_label: dossier?.method ? `Phương thức ${dossier.method.replace('METHOD_', '')}` : '',
    so_luong_mau: lot?.quantity ? String(lot.quantity) : proposal?.quantity ? String(proposal.quantity) : '',
    ngay_lap: dossier?.createdAt || proposal?.receivedAt || '',
    ngay_phan_cong: dossier?.evaluationAt || dossier?.createdAt || '',
    ngay_lay_mau: firstRouteDate,
    ngay_kiem_tra: dossier?.evaluationAt || firstRouteDate,
    ngay_bat_dau: dossier?.evaluationAt || dossier?.targetDate || '',
    ngay_ket_thuc: dossier?.effectiveAt || dossier?.targetDate || '',
    ngay_giao_mau: request?.handoverAt || firstRouteDate,
    ngay_kqtn: resultDate,
    ngay_lap_bao_cao: resultDate,
    dia_diem_lap: proposal?.warehouseAddress || '',
    ket_luan: result?.outcome === 'PASS' ? 'Đạt' : result?.outcome === 'FAIL' ? 'Không đạt' : '',
    nguoi_danh_gia: evaluator,
    nguoi_tham_xet: reviewer,
    nguoi_phe_duyet: '',
    nguoi_giao: request?.handoverDetails?.senderName || '',
    ma_phong_thu_nghiem: route?.labCode || '',
    so_luong_tai_lieu: '',
    phuong_thuc_giao: '',
    ghi_chu_giao_nhan: request?.handoverNote || '',
    dia_chi_don_vi: '',
    don_vi_chung_nhan: 'TVCI',
    nguoi_dai_dien: customer?.contactPerson || '',
    nguoi_ky_ben_a: customer?.contactPerson || '',
    nguoi_ky_ben_b: '',
    phi_dich_vu: '',
    dieu_khoan_thanh_toan: '',
    ngay_bat_dau_hieu_luc: dossier?.effectiveAt || dossier?.evaluationAt || '',
    ngay_het_hieu_luc: '',
    ngay_ket_thuc_hop_dong: '',
    ma_lo: lot?.lotCode || '',
    seal_stamp: lot?.lotCode || '',
    ma_mau: sampleCodes.join(', '),
    so_pyc: request?.pycNumber || '',
    phong_thu_nghiem: request?.laboratoryName || route?.labName || '',
    nguoi_nhan: request?.handoverDetails?.receiverName || '',
    model: lot?.model || proposal?.model || '',
    nhan_hieu: lot?.brand || proposal?.brand || '',
    so_bao_cao: result?.reportNumber || '',
    ket_qua: result?.outcome === 'PASS' ? 'Đạt' : result?.outcome === 'FAIL' ? 'Không đạt' : '',
    ghi_chu: result?.notes || '',
  };
}

function draftValue(values: Record<string, unknown>, key: string): string {
  return String(values[key] ?? '').trim();
}

/**
 * Builds an in-memory source for a free-form draft. The result is never
 * persisted as a proposal or dossier; it only lets the DOCX renderer use the
 * same context pipeline when the operator has entered all required values by
 * hand instead of selecting an existing PCN record.
 */
export function buildPcnDraftManualSource(
  draft: Pick<PcnDraftWorkspace, 'id' | 'fieldCodes' | 'values'>,
  receivedAt: string,
): { proposal: CertificationProposal; dossier: CertificationDossier } {
  const values = draft.values || {};
  const safeId = draft.id.replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 80) || 'draft';
  const fieldCodes = draft.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean);
  const quantityMatch = draftValue(values, 'so_luong_mau').match(/\d+/);
  const proposalId = `pcn-manual-proposal-${safeId}`;
  const proposalCode = draftValue(values, 'so_dang_ky') || `DRAFT-${safeId.slice(-12)}`;
  const dossierCode = draftValue(values, 'ma_ho_so') || `DRAFT-${safeId.slice(-12)}`;
  const proposal: CertificationProposal = {
    id: proposalId,
    proposalCode,
    channel: 'OTHER',
    status: 'DRAFT',
    customerSnapshot: {
      name: draftValue(values, 'ten_cong_ty'),
      address: draftValue(values, 'dia_chi_ct'),
      ...(draftValue(values, 'ma_so_thue') ? { taxId: draftValue(values, 'ma_so_thue') } : {}),
      ...(draftValue(values, 'dien_thoai') ? { phone: draftValue(values, 'dien_thoai') } : {}),
      ...(draftValue(values, 'email') ? { email: draftValue(values, 'email') } : {}),
      ...(draftValue(values, 'nguoi_lien_he') ? { contactPerson: draftValue(values, 'nguoi_lien_he') } : {}),
    },
    productName: draftValue(values, 'loai_sp'),
    ...(draftValue(values, 'model') ? { model: draftValue(values, 'model') } : {}),
    ...(draftValue(values, 'nhan_hieu') ? { brand: draftValue(values, 'nhan_hieu') } : {}),
    ...(draftValue(values, 'nha_san_xuat') ? { manufacturer: draftValue(values, 'nha_san_xuat') } : {}),
    ...(draftValue(values, 'dia_chi_nha_san_xuat') ? { manufacturerAddress: draftValue(values, 'dia_chi_nha_san_xuat') } : {}),
    ...(draftValue(values, 'dia_chi_kho') ? { warehouseAddress: draftValue(values, 'dia_chi_kho') } : {}),
    ...(draftValue(values, 'thong_so_ky_thuat') ? { specifications: draftValue(values, 'thong_so_ky_thuat') } : {}),
    quantity: quantityMatch ? Number(quantityMatch[0]) : 0,
    fieldCodes,
    receivedAt,
  };
  const dossier: CertificationDossier = {
    id: `pcn-manual-dossier-${safeId}`,
    dossierCode,
    proposalId,
    fieldCodes,
    method: 'METHOD_1',
    status: 'DRAFT',
    labRequestIds: [],
    returnedResultIds: [],
  };
  return { proposal, dossier };
}
