// Author: Codex
// OS support: Browser/Node
// Description: Non-destructive source-label suggestions from the surveyed PCN template pack

const ANNOTATION_SUGGESTIONS: Record<string, Record<string, string>> = {
  'pcn-qc9-proposal-method-1-tdc': {
    loai_sp: 'Tên sản phẩm',
    ten_cong_ty: 'Đơn vị yêu cầu:',
    dia_chi_ct: 'Địa chỉ:',
  },
  'pcn-qc9-certificate-method-1': {
    loai_sp: 'Kiểu loại',
    ten_cong_ty: 'Được nhập khẩu bởi',
    so_dang_ky: 'Số giấy chứng nhận',
    ngay_cap_CN: 'Ngày cấp giấy chứng nhận',
  },
};

export function getPcnTemplateAnnotationSuggestions(template: { id: string }): Record<string, string> {
  return { ...(ANNOTATION_SUGGESTIONS[template.id] || {}) };
}

export function getPcnTemplateAnnotationSuggestionCoverage(
  template: { id: string },
  requiredKeys: string[],
): { requiredKeys: string[]; suggestedKeys: string[]; missingSuggestionKeys: string[] } {
  const normalizedRequiredKeys = [...new Set(requiredKeys.map((key) => String(key || '').trim()).filter(Boolean))];
  const suggestions = getPcnTemplateAnnotationSuggestions(template);
  const suggestedKeys = normalizedRequiredKeys.filter((key) => Boolean(suggestions[key]?.trim()));

  return {
    requiredKeys: normalizedRequiredKeys,
    suggestedKeys,
    missingSuggestionKeys: normalizedRequiredKeys.filter((key) => !suggestedKeys.includes(key)),
  };
}

// --- End of pcnTemplateAnnotationSuggestions.ts ---
