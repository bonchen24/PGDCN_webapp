// Author: Codex & Antigravity
// OS support: Web/Node
// Description: Unified domain, product group, standard, method, and template intake catalog with explicit confirmation state

export type PgdcnDomain = 'PCN' | 'PGD';

export type PgdcnConfirmationStatus = 'CONFIRMED' | 'PENDING_CONFIRMATION';

export type PgdcnProductGroupCode =
  | 'ELECTRICAL_ELECTRONIC'
  | 'METAL_MATERIALS'
  | 'CONSTRUCTION_MATERIALS'
  | 'MANAGEMENT_SYSTEM'
  | 'OTHER';

export interface PgdcnProductGroup {
  code: PgdcnProductGroupCode;
  name: string;
  description?: string;
}

export const PGDCN_PRODUCT_GROUPS: readonly PgdcnProductGroup[] = [
  {
    code: 'ELECTRICAL_ELECTRONIC',
    name: 'Điện - Điện tử',
    description: 'Thiết bị điện gia dụng, chiếu sáng, điện tử viễn thông (QC4, QC9, ...)',
  },
  {
    code: 'METAL_MATERIALS',
    name: 'Kim loại - Vật liệu',
    description: 'Thép không gỉ, thép xây dựng, hợp kim và kim loại (QCVN 20, TT58, ...)',
  },
  {
    code: 'CONSTRUCTION_MATERIALS',
    name: 'Vật liệu xây dựng',
    description: 'Vật liệu và sản phẩm xây dựng (QCVN 07, QCVN 25, ...)',
  },
  {
    code: 'MANAGEMENT_SYSTEM',
    name: 'Hệ thống quản lý',
    description: 'Chứng nhận hệ thống quản lý ISO 9001, 14001, 22000...',
  },
  {
    code: 'OTHER',
    name: 'Khác',
    description: 'Các sản phẩm và hàng hóa khác ngoài danh mục chuẩn',
  },
] as const;

export interface PgdcnIntakeCatalogItem {
  id: string;
  /** Omitted until the governing domain and group are confirmed. */
  domain?: PgdcnDomain;
  productGroup?: PgdcnProductGroupCode;
  standardCode: string;
  standardName: string;
  confirmationStatus: PgdcnConfirmationStatus;
  methods: string[];
  defaultTemplateId?: string;
  pcnFieldCode?: 'QC4' | 'QC9';
  pgdGroupCode?: 'QC20';
  note?: string;
}

export const PGDCN_INTAKE_CATALOG: readonly PgdcnIntakeCatalogItem[] = [
  // PCN Confirmed: QC4
  {
    id: 'PCN_QC4_QCVN04',
    domain: 'PCN',
    productGroup: 'ELECTRICAL_ELECTRONIC',
    standardCode: 'QCVN 04:2009/BKHCN',
    standardName: 'Quy chuẩn kỹ thuật quốc gia về an toàn đối với thiết bị điện và điện tử',
    confirmationStatus: 'CONFIRMED',
    methods: ['METHOD_1', 'METHOD_5', 'METHOD_7'],
    pcnFieldCode: 'QC4',
  },
  // PCN Confirmed: QC9
  {
    id: 'PCN_QC9_QCVN09',
    domain: 'PCN',
    productGroup: 'ELECTRICAL_ELECTRONIC',
    standardCode: 'QCVN 09:2012/BKHCN',
    standardName: 'Quy chuẩn kỹ thuật quốc gia về tương thích điện từ đối với thiết bị điện và điện tử gia dụng và các mục đích tương tự',
    confirmationStatus: 'CONFIRMED',
    methods: ['METHOD_1', 'METHOD_5', 'METHOD_7'],
    pcnFieldCode: 'QC9',
  },
  // PGD Confirmed: QC20 / QCVN 20
  {
    id: 'PGD_QC20_QCVN20',
    domain: 'PGD',
    productGroup: 'METAL_MATERIALS',
    standardCode: 'QCVN 20:2019/BKHCN',
    standardName: 'Quy chuẩn kỹ thuật quốc gia về thép không gỉ',
    confirmationStatus: 'CONFIRMED',
    methods: ['METHOD_7', 'TT58'],
    pgdGroupCode: 'QC20',
  },
  // PGD Confirmed: TT58 / Thép chung
  {
    id: 'PGD_STEEL_TT58',
    domain: 'PGD',
    productGroup: 'METAL_MATERIALS',
    standardCode: 'TTLT 58/2015',
    standardName: 'Thông tư liên tịch 58/2015 về quản lý chất lượng thép sản xuất trong nước và thép nhập khẩu',
    confirmationStatus: 'CONFIRMED',
    methods: ['TT58', 'QT-GĐ-14'],
  },
  // Pending confirmation: QCVN 07:2019
  {
    id: 'PENDING_QCVN07_2019',
    // Keep scope unassigned until the responsible domain and group are confirmed.
    standardCode: 'QCVN 07:2019',
    standardName: 'QCVN 07:2019 (Chờ xác nhận ranh giới thẩm quyền)',
    confirmationStatus: 'PENDING_CONFIRMATION',
    methods: [],
    note: 'Chưa có văn bản phân định thẩm quyền hoặc mapping template chính thức',
  },
  // Pending confirmation: QCVN 25:2025
  {
    id: 'PENDING_QCVN25_2025',
    // Keep scope unassigned until the responsible domain and group are confirmed.
    standardCode: 'QCVN 25:2025',
    standardName: 'QCVN 25:2025 (Chờ xác nhận hiệu lực và template)',
    confirmationStatus: 'PENDING_CONFIRMATION',
    methods: [],
    note: 'Quy chuẩn mới chờ hướng dẫn áp dụng và thẩm xét',
  },
] as const;

export function normalizeSearchText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function getConfirmedStandardsForDomain(domain: PgdcnDomain): PgdcnIntakeCatalogItem[] {
  return PGDCN_INTAKE_CATALOG.filter(
    (item) => item.domain === domain && item.confirmationStatus === 'CONFIRMED'
  );
}

export interface MatchCatalogQuery {
  domain?: PgdcnDomain;
  productGroup?: PgdcnProductGroupCode;
  standard?: string;
  confirmationStatus?: PgdcnConfirmationStatus;
}

export function matchCatalogItems(query: MatchCatalogQuery): PgdcnIntakeCatalogItem[] {
  return PGDCN_INTAKE_CATALOG.filter((item) => {
    if (query.domain && item.domain && item.domain !== query.domain) return false;
    if (query.productGroup && item.productGroup !== query.productGroup) return false;
    if (query.confirmationStatus && item.confirmationStatus !== query.confirmationStatus) return false;
    if (query.standard) {
      const qNorm = normalizeSearchText(query.standard);
      const sNorm = normalizeSearchText(item.standardCode);
      const nameNorm = normalizeSearchText(item.standardName);
      if (!sNorm.includes(qNorm) && !nameNorm.includes(qNorm) && !qNorm.includes(sNorm)) {
        return false;
      }
    }
    return true;
  });
}

export interface IntakeClassificationValidationInput {
  domain: PgdcnDomain;
  productGroup?: PgdcnProductGroupCode;
  standard: string;
  method?: string;
  fieldCode?: string;
}

export interface IntakeClassificationValidationResult {
  valid: boolean;
  confirmationStatus: PgdcnConfirmationStatus;
  matchedItem?: PgdcnIntakeCatalogItem;
  message: string;
}

export function validateIntakeClassification(
  input: IntakeClassificationValidationInput
): IntakeClassificationValidationResult {
  const normStandard = normalizeSearchText(input.standard);

  // Cross-domain check: QCVN 20 / Thép không gỉ in PCN is forbidden
  if (input.domain === 'PCN' && (normStandard.includes('qcvn 20') || normStandard.includes('qc20') || normStandard.includes('thep khong gi'))) {
    return {
      valid: false,
      confirmationStatus: 'PENDING_CONFIRMATION',
      message: 'Tiêu chuẩn / đối tượng QCVN 20 (thép không gỉ) thuộc miền Giám định (PGD), không hợp lệ trong PCN.',
    };
  }

  // Cross-domain check: QC4 / QC9 in PGD is forbidden
  if (input.domain === 'PGD' && (normStandard.includes('qcvn 04') || normStandard.includes('qc4') || normStandard.includes('qcvn 09') || normStandard.includes('qc9'))) {
    return {
      valid: false,
      confirmationStatus: 'PENDING_CONFIRMATION',
      message: 'Tiêu chuẩn QCVN 04 / QCVN 09 thuộc miền Chứng nhận (PCN), không hợp lệ trong PGD.',
    };
  }

  // Check against known catalog items
  const matches = matchCatalogItems({ domain: input.domain, standard: input.standard });
  if (matches.length > 0) {
    const primary = matches[0];
    const exactScope = primary.domain === input.domain
      && primary.productGroup === input.productGroup
      && (!primary.pcnFieldCode || primary.pcnFieldCode === input.fieldCode);
    const methodConfirmed = !input.method || primary.methods.includes(input.method);
    const confirmationStatus = primary.confirmationStatus === 'CONFIRMED' && exactScope && methodConfirmed
      ? 'CONFIRMED'
      : 'PENDING_CONFIRMATION';
    return {
      valid: true,
      confirmationStatus,
      matchedItem: primary,
      message: confirmationStatus === 'CONFIRMED'
        ? 'Tiêu chuẩn đã được xác nhận trong danh mục.'
        : 'Tiêu chuẩn đang ở trạng thái chờ xác nhận phạm vi / phương thức.',
    };
  }

  // Custom standard not in standard catalog
  return {
    valid: true,
    confirmationStatus: 'PENDING_CONFIRMATION',
    message: 'Tiêu chuẩn tùy chỉnh chưa có trong danh mục chuẩn, sẽ ở trạng thái chờ xác nhận.',
  };
}
