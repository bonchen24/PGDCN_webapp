// Author: Codex
// OS support: Browser/Node
// Description: Read-only blank PCN dossier-pack profiles derived from the controlled checklist

import type {
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDocumentRequirementStage,
  PcnDossierStationKey,
  PcnGeneratedDocumentKind,
  PcnOfficialDocumentKind,
} from '../types.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, getPcnDocumentRequirements } from './pcnDossierDocuments.ts';
import { PCN_PIPELINE_STATIONS } from './pcnDossierPipeline.ts';

export interface PcnDossierTemplateStageGroup {
  stage: PcnDocumentRequirementStage;
  label: string;
  requirements: PcnDocumentRequirement[];
}

export interface PcnDossierTemplateStationGroup {
  key: PcnDossierStationKey;
  number?: number;
  label: string;
  requirements: PcnDocumentRequirement[];
}

export interface PcnDossierTemplateSourceMapping {
  requirementCode: string;
  references: string[];
  note?: string;
}

export interface PcnDossierTemplateProfile {
  id: string;
  fieldCode: PcnCertificationFieldCode;
  title: string;
  description: string;
  isBlank: true;
  stageGroups: PcnDossierTemplateStageGroup[];
  stationGroups: PcnDossierTemplateStationGroup[];
  generatedKinds: PcnGeneratedDocumentKind[];
  officialOutputs: PcnOfficialDocumentKind[];
}

/**
 * Authoring-only extension kept for maintaining the research-derived blank
 * pack. Runtime settings/cards use PcnDossierTemplateProfile and never expose
 * these source names or references.
 */
export interface PcnDossierTemplateAuthoringProfile extends PcnDossierTemplateProfile {
  sourceBasis: string;
  sourceFormReferences: string[];
  sourceMappings: PcnDossierTemplateSourceMapping[];
}

const STAGE_ORDER: readonly PcnDocumentRequirementStage[] = [
  'INTAKE',
  'LAB_ROUTING',
  'TECHNICAL_REVIEW',
  'ISSUANCE',
  'DELIVERY',
  'ARCHIVE',
];

const STAGE_LABELS: Record<PcnDocumentRequirementStage, string> = {
  INTAKE: 'Tiếp nhận & đầu vào',
  LAB_ROUTING: 'Lấy mẫu & gửi PTN',
  TECHNICAL_REVIEW: 'KQTN & soát xét',
  ISSUANCE: 'Phê duyệt & phát hành',
  DELIVERY: 'Giao khách hàng',
  ARCHIVE: 'Lưu hồ sơ',
};

const FALLBACK_STATION_BY_STAGE: Record<PcnDocumentRequirementStage, PcnDossierStationKey> = {
  INTAKE: 'INTAKE',
  LAB_ROUTING: 'SAMPLING_LAB',
  TECHNICAL_REVIEW: 'TECHNICAL_REVIEW',
  ISSUANCE: 'ISSUANCE',
  DELIVERY: 'DELIVERY_ARCHIVE',
  ARCHIVE: 'DELIVERY_ARCHIVE',
};

function requirementBelongsToStation(requirement: PcnDocumentRequirement, stationKey: PcnDossierStationKey): boolean {
  const configured = Array.isArray(requirement.stationKeys) && requirement.stationKeys.length > 0
    ? requirement.stationKeys
    : requirement.stages.map((stage) => FALLBACK_STATION_BY_STAGE[stage]);
  return configured.includes(stationKey);
}

const PROFILE_META: Array<Omit<PcnDossierTemplateAuthoringProfile, 'stageGroups' | 'stationGroups'>> = [
  {
    id: 'QC4_BLANK_PACK',
    fieldCode: 'QC4',
    title: 'Bộ hồ sơ mẫu Quy chuẩn 4',
    description: 'Cấu trúc mẫu trống cho hồ sơ chứng nhận QC4, từ Đề nghị đến bản lưu.',
    sourceBasis: 'Chuẩn hóa từ các bộ hồ sơ QC4 hoàn tất khoảng 06–07/2026.',
    isBlank: true,
    sourceFormReferences: [
      'BM-QT-06-05a Đề nghị chứng nhận sản phẩm theo phương thức 7',
      'BM-QT-09-12 Phiếu phân công chứng nhận',
      'BM-QT-09-02 Kế hoạch đánh giá CNSP',
      'BM-QT-09-03 Biên bản lấy mẫu',
      'BM-QT-09-13 Biên bản kiểm tra tại hiện trường',
      'BM-QT-09-10 Biên bản mã hóa mẫu',
      'BM-QT-09-04 Biên bản giao mẫu',
      'BM-QT-09-05 Báo cáo kết quả thử nghiệm',
      'BM-QT-09-09/BM-QT-09-09a Báo cáo đánh giá CNSP',
      'BM-QT-09-15 Bìa hồ sơ',
      'BM-QĐ-03-01 Quyết định cấp chứng chỉ sản phẩm',
      'BM-QĐ-03-03a Giấy chứng nhận loại dài/ngắn',
    ],
    sourceMappings: [
      { requirementCode: 'PROPOSAL', references: ['BM-QT-06-05a-Đề nghị chứng nhận sản phẩm theo phương thức 7.doc'] },
      { requirementCode: 'COMMERCIAL', references: ['Báo giá-hợp đồng', 'Xuất Hóa đơn'], note: 'Nhóm hồ sơ thương mại/import, không có một biểu mẫu PCN duy nhất.' },
      { requirementCode: 'ASSIGNMENT_FORM', references: ['1. BM-QT-09-12 PHIẾU PHÂN CÔNG CHUNG NHAN.doc'] },
      { requirementCode: 'EVALUATION_PLAN', references: ['2.BM-QT-09-02 Ke hoach danh gia CNSP.doc'] },
      { requirementCode: 'FIELD_INSPECTION', references: ['4. BM-QT-09-13 BB kiểm tra tại hiện trường.doc'] },
      { requirementCode: 'SAMPLE_TAKING', references: ['3. BM-QT-09-03 BB lấy mẫu.doc'], note: 'Biên bản lấy mẫu dùng cùng lô/tuyến; checklist hiện hành gộp với nhóm lấy/giao mẫu.' },
      { requirementCode: 'LAB_REQUEST', references: ['Phiếu yếu cầu thử nghiệm'] },
      { requirementCode: 'SAMPLE_CODING', references: ['BM-QT-09-10 Biên bản mã hóa mẫu.doc'] },
      { requirementCode: 'SAMPLE_HANDOVER', references: ['5. BM-QT-09-04 Bien ban giao mau.doc', 'Tool QC4/Nhap data/Bien Ban.docx'] },
      { requirementCode: 'TEST_REPORT', references: ['6. BM-QT-09-05 Bao cao ket qua thu nghiem.doc', 'Báo cáo', 'Kết quả QCVN4 2026'] },
      { requirementCode: 'CERTIFICATION_RESULT', references: ['7. BM-QT-09-09 BC đánh giá CNSP.doc', 'BM-QT-09-09a-BC đánh giá CNSP.doc'] },
      { requirementCode: 'CERTIFICATE', references: ['BM-QĐ-03-03a Giấy chứng nhận loại dài.docx', 'BM-QĐ-03-03a Giấy chứng nhận loại ngắn.docx'] },
      { requirementCode: 'DECISION', references: ['BM-QD-03-01 Quyet dinh cap chung chi SP.doc'] },
      { requirementCode: 'CLIENT_PACKAGE', references: ['Bản giao hồ sơ khách hàng', 'HS ký hồ sơ'], note: 'Tên thư mục thực tế thay đổi theo từng hồ sơ; chỉ dùng để nhận diện nhóm tài liệu.' },
      { requirementCode: 'ARCHIVE_SCAN', references: ['Bản Lưu GCN QC4', '2026/Bản SCAN GCN 2026'] },
    ],
    generatedKinds: ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'LAB_REQUEST'],
    officialOutputs: ['CERTIFICATE', 'DECISION'],
  },
  {
    id: 'QC9_BLANK_PACK',
    fieldCode: 'QC9',
    title: 'Bộ hồ sơ mẫu Quy chuẩn 9',
    description: 'Cấu trúc mẫu trống cho hồ sơ chứng nhận QC9, gồm cả nhánh gia hạn/khắc phục khi phát sinh.',
    sourceBasis: 'Chuẩn hóa từ các bộ hồ sơ QC9 hoàn tất khoảng 06–07/2026.',
    isBlank: true,
    sourceFormReferences: [
      'BM-QT-06-05a Đề nghị chứng nhận sản phẩm theo phương thức 1',
      'BM-QT-09-12 Phiếu phân công chứng nhận',
      'BM-QT-09-02 Kế hoạch đánh giá CNSP',
      'BM-QT-09-03 Biên bản lấy mẫu',
      'BM-QT-09-04 Biên bản giao mẫu',
      'BM-QT-09-05 Báo cáo kết quả thử nghiệm',
      'BM-QT-09-10 Biên bản mã hóa mẫu',
      'BM-QT-08-04 Phiếu ghi chép đánh giá',
      'BM-QT-09-09a Báo cáo đánh giá CNSP theo phương thức 1 và 7',
      'BM-QT-03-02a Giấy chứng nhận theo phương thức 1',
      'BM-QĐ-03-01a Quyết định theo phương thức 1',
    ],
    sourceMappings: [
      { requirementCode: 'PROPOSAL', references: ['BM-QT-06-05a De nghi chung nhan san pham theo phuong thuc 1.doc'] },
      { requirementCode: 'COMMERCIAL', references: ['Hợp đồng', 'BIÊN BẢN GIAO GIẤY TỜ'], note: 'Nhóm hồ sơ thương mại và giao giấy tờ theo bộ tham chiếu.' },
      { requirementCode: 'ASSIGNMENT_FORM', references: ['BM-QT-09-12 Phiếu phân công chứng nhận'], note: 'Biểu mẫu dùng chung PCN; nguồn QC9 không tách riêng bản sao.' },
      { requirementCode: 'EVALUATION_PLAN', references: ['BM-QT-09-02 Ke hoach danh gia CNSP.doc'] },
      { requirementCode: 'FIELD_INSPECTION', references: ['BM-QT-08-04 Phieu ghi chep danh gia.doc'], note: 'QC9 dùng phiếu ghi chép đánh giá cho công đoạn đánh giá.' },
      { requirementCode: 'SAMPLE_TAKING', references: ['BM-QT-09-03 Biên bản lấy mẫu'], note: 'Biên bản lấy mẫu được sinh nội bộ theo cùng context lô/tuyến; cần Admin đối chiếu mẫu nguồn trước khi dùng chính thức.' },
      { requirementCode: 'LAB_REQUEST', references: ['mẫu PYC bên TĐC', 'mẫu PYC liên phòng thử nghiệm'] },
      { requirementCode: 'SAMPLE_CODING', references: ['BM-QT-09-10 Biên bản mã hóa mẫu.doc'] },
      { requirementCode: 'SAMPLE_HANDOVER', references: ['BM-QT-09-04 Bien ban giao mau.doc'] },
      { requirementCode: 'SAMPLE_RETURN', references: ['Chưa thấy mẫu độc lập trong nguồn tham chiếu'], note: 'Biểu mẫu SAMPLE_RETURN được sinh nội bộ; cần Admin đối chiếu và phê duyệt mẫu chính thức trước khi sử dụng.' },
      { requirementCode: 'TEST_REPORT', references: ['BM-QT-09-05 Bao cao ket qua thu nghiem.doc', 'kết quả TĐC'] },
      { requirementCode: 'EXTENSION_LETTER', references: ['Mẫu công văn'], note: 'Chỉ phát sinh khi cần gia hạn; không mặc định tạo cho mọi hồ sơ.' },
      { requirementCode: 'CORRECTIVE_ACTION_LETTER', references: ['khắc phục mẫu', 'tụ khắc phục'], note: 'Chỉ phát sinh khi có yêu cầu khắc phục.' },
      { requirementCode: 'FAILURE_LETTER', references: ['Mẫu công văn'], note: 'Chỉ phát sinh khi kết quả không đạt.' },
      { requirementCode: 'CERTIFICATION_RESULT', references: ['BM-QT-09-09a-BC đánh giá CNSP theo pt1 và 7.doc'] },
      { requirementCode: 'CERTIFICATE', references: ['BM-QT-03-02a - GCN (theo phương thức 1).docx'] },
      { requirementCode: 'DECISION', references: ['BM-QĐ-03-01a - Quyet dinh (theo phương thức 1).doc'] },
      { requirementCode: 'CLIENT_PACKAGE', references: ['BIÊN BẢN GIAO GIẤY TỜ'] },
      { requirementCode: 'ARCHIVE_SCAN', references: ['Hồ sơ lưu 2026'] },
    ],
    generatedKinds: ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'LAB_REQUEST'],
    officialOutputs: ['CERTIFICATE', 'DECISION'],
  },
  {
    id: 'QC20_BLANK_PACK',
    fieldCode: 'QC20',
    title: 'Bộ hồ sơ mẫu Quy chuẩn 20',
    description: 'Khung hồ sơ mẫu trống QC20 theo pipeline PCN; phạm vi sản phẩm và biểu mẫu chính thức đang chờ PCN xác nhận.',
    sourceBasis: 'Cấu hình khởi tạo từ QCVN 20:2019/BKHCN và quy trình hồ sơ chung; chưa có bộ hồ sơ QC20 nguồn được duyệt.',
    isBlank: true,
    sourceFormReferences: [
      'Biểu mẫu Đề nghị QC20 — chưa có nguồn chính thức',
      'Phiếu phân công và kế hoạch đánh giá — cấu hình cần xác nhận',
      'Biên bản kiểm tra, mã hóa và giao mẫu — cấu hình cần xác nhận',
      'PYC và KQTN — cấu hình cần xác nhận theo phòng thử nghiệm',
      'GCN và Quyết định QC20 — chưa có mẫu chính thức',
    ],
    sourceMappings: [
      { requirementCode: 'PROPOSAL', references: ['Chưa có nguồn QC20 chính thức'], note: 'Chỉ là vị trí cấu hình, không được dùng để sinh bản chính thức.' },
      { requirementCode: 'COMMERCIAL', references: ['Hồ sơ thương mại theo Đề nghị — cần xác nhận'] },
      { requirementCode: 'SCOPE_EVIDENCE', references: ['Hồ sơ phạm vi, mã HS, tiêu chuẩn công bố và bằng chứng áp dụng — cần xác nhận'] },
      { requirementCode: 'LOT_IDENTITY', references: ['Mác thép, kích thước danh nghĩa, số lô nhà sản xuất/lô hàng — cần xác nhận'] },
      { requirementCode: 'ASSIGNMENT_FORM', references: ['Biểu mẫu dùng chung PCN — cần xác nhận áp dụng QC20'] },
      { requirementCode: 'EVALUATION_PLAN', references: ['Biểu mẫu dùng chung PCN — cần xác nhận áp dụng QC20'] },
      { requirementCode: 'FIELD_INSPECTION', references: ['Chưa có nguồn QC20 chính thức'] },
      { requirementCode: 'LAB_REQUEST', references: ['PYC gửi phòng thử nghiệm — cần xác nhận tuyến QC20'] },
      { requirementCode: 'SAMPLE_CODING', references: ['Biên bản mã hóa mẫu theo lô — cần xác nhận'] },
      { requirementCode: 'SAMPLE_HANDOVER', references: ['Biên bản lấy / giao mẫu — cần xác nhận'] },
      { requirementCode: 'SAMPLE_RETURN', references: ['Chưa có nguồn QC20 chính thức'], note: 'Chỉ tạo khi nghiệp vụ trả mẫu phát sinh và được xác nhận.' },
      { requirementCode: 'TEST_REPORT', references: ['KQTN theo biểu mẫu phòng thử nghiệm — cần xác nhận'] },
      { requirementCode: 'CERTIFICATION_RESULT', references: ['Báo cáo đánh giá QC20 — chưa có nguồn chính thức'] },
      { requirementCode: 'CORRECTIVE_ACTION_LETTER', references: ['Công văn khắc phục — cần xác nhận'] },
      { requirementCode: 'CERTIFICATE', references: ['GCN QC20 — chưa có nguồn chính thức'] },
      { requirementCode: 'DECISION', references: ['Quyết định QC20 — chưa có nguồn chính thức'] },
      { requirementCode: 'CLIENT_PACKAGE', references: ['Bộ giao khách hàng — cần xác nhận'] },
      { requirementCode: 'ARCHIVE_SCAN', references: ['Bộ lưu hồ sơ — cần xác nhận'] },
    ],
    generatedKinds: ['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'LAB_REQUEST'],
    officialOutputs: ['CERTIFICATE', 'DECISION'],
  },
];

function buildPcnDossierTemplateProfile(
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
): PcnDossierTemplateAuthoringProfile[] {
  return PROFILE_META.map((profile) => {
    const selected = getPcnDocumentRequirements([profile.fieldCode], requirements);
    const stageGroups = STAGE_ORDER
      .map((stage) => ({
        stage,
        label: STAGE_LABELS[stage],
        requirements: selected.filter((requirement) => requirement.stages.includes(stage)),
      }))
      .filter((group) => group.requirements.length > 0);
    const stationGroups = PCN_PIPELINE_STATIONS
      .map((station) => ({
        key: station.key,
        number: station.number,
        label: station.title,
        requirements: selected.filter((requirement) => requirementBelongsToStation(requirement, station.key)),
      }))
      .filter((group) => group.requirements.length > 0);
    return { ...profile, stageGroups, stationGroups };
  });
}

/** Runtime-safe blank pack for settings and other operational UI surfaces. */
export function getPcnDossierTemplateProfiles(
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
): PcnDossierTemplateProfile[] {
  return buildPcnDossierTemplateProfile(requirements).map(({ sourceBasis: _sourceBasis, sourceFormReferences: _sourceFormReferences, sourceMappings: _sourceMappings, ...profile }) => profile);
}

/** Authoring/test-only view of the research-derived mapping metadata. */
export function getPcnDossierTemplateAuthoringProfiles(
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
): PcnDossierTemplateAuthoringProfile[] {
  return buildPcnDossierTemplateProfile(requirements);
}
