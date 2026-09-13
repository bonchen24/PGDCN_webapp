// Author: Codex
// Description: Map source-form OCR labels to a reviewable PGD intake draft.

import { foldOcrLabelForMatch, readOcrLabelValue } from './ocrLabelParser.ts';

export type PgdOcrDraft = {
  fields: Record<string, string>;
  confidence: number;
  sourcePage?: number;
  sourceFileName?: string;
  provider?: 'PADDLEOCR' | 'GEMINI';
};

function inferProductGroup(text: string): string {
  const normalized = foldOcrLabelForMatch(text);
  if (/maymoc|thietbi|daychuyen|piston|xilanh/.test(normalized)) return 'MACHINERY_LINE';
  if (/than/.test(normalized)) return 'COAL';
  if (/thep|kimloai|thongtu58|ttlt58/.test(normalized)) return 'STEEL_METAL';
  return '';
}

function inferMethod(text: string): string {
  return /thongtu58|ttlt58|tt58/i.test(foldOcrLabelForMatch(text)) ? 'TT58' : '';
}

export function buildPgdOcrDraftFromText(
  text: string,
  fileName: string,
  sourcePage = 1,
  confidence = 0,
  provider?: PgdOcrDraft['provider'],
): PgdOcrDraft {
  const fields: Record<string, string> = {};
  const put = (key: string, labels: string[]) => {
    const value = readOcrLabelValue(text, labels);
    if (value) fields[key] = value;
  };

  put('registrationNumber', ['mã hồ sơ', 'mã pyc', 'số hồ sơ', 'registration no']);
  put('customerName', ['khách hàng', 'tên khách hàng', 'tên đơn vị', 'customer']);
  put('customerAddress', ['địa chỉ khách hàng', 'địa chỉ đơn vị']);
  put('customerContact', ['người liên hệ khách hàng', 'contact person']);
  put('requesterName', ['người / đơn vị yêu cầu', 'đơn vị yêu cầu', 'đơn vị gửi', 'bên yêu cầu', 'sender unit']);
  put('requesterAddress', ['địa chỉ bên yêu cầu', 'địa chỉ đơn vị gửi']);
  put('requesterContact', ['người liên hệ', 'người đại diện']);
  put('requesterPhone', ['điện thoại bên yêu cầu', 'số điện thoại', 'phone']);
  put('requesterEmail', ['email', 'e-mail']);
  put('productName', ['hạng mục giám định', 'hạng mục chứng nhận', 'đối tượng giám định', 'tên hàng hóa', 'tên sản phẩm', 'product name']);
  put('productCode', ['mã hàng', 'mã sản phẩm', 'model', 'serial']);
  put('brand', ['nhãn hiệu', 'hãng', 'brand']);
  put('productForm', ['dạng sản phẩm', 'product form']);
  put('grade', ['mác thép', 'mác / cấp sản phẩm', 'grade']);
  put('dimensions', ['kích thước', 'dimensions']);
  put('productStandard', ['tiêu chuẩn sản phẩm', 'tiêu chuẩn áp dụng', 'tiêu chuẩn đối chiếu', 'product standard']);
  put('countryOfOrigin', ['nước xuất xứ', 'xuất xứ', 'country of origin']);
  put('manufacturer', ['nhà sản xuất', 'manufacturer']);
  put('lotCode', ['số lô', 'mã lô', 'lot code']);
  put('quantity', ['số lượng', 'quantity']);
  put('unit', ['đơn vị', 'unit']);
  put('weight', ['khối lượng', 'weight']);
  put('inspectionScope', ['phạm vi giám định', 'phạm vi yêu cầu', 'scope']);
  put('inspectionLocation', ['địa điểm giám định', 'địa điểm', 'dia diem', 'dia diěm', 'nơi lấy mẫu', 'inspection location']);
  put('inspectionScheduledAt', ['thời gian thực hiện', 'thoi gian thuc hien', 'thoigian thurc hien', 'ngày thực hiện', 'lịch dự kiến']);
  put('receivedAt', ['ngày tiếp nhận', 'ngày nhận hồ sơ']);
  put('standards', ['tiêu chuẩn / phương pháp', 'tiêu chuẩn đối chiếu', 'tiêu chuẩn áp dụng', 'standard']);
  put('method', ['mã phương thức', 'quy trình', 'method']);
  put('operatorName', ['người thực hiện', 'nguoi thuc hien', 'nguòi thyc hien', 'người giám định', 'inspector']);
  put('sampleCode', ['mã mẫu', 'sample code']);
  put('sampleTypeLabel', ['tên mẫu', 'loại mẫu', 'sample type']);
  put('sampleQuantity', ['số lượng mẫu', 'sample quantity']);
  put('sampleUnit', ['đơn vị mẫu', 'sample unit']);
  put('sealNumber', ['số niêm phong', 'seal number']);

  const productGroup = inferProductGroup(fields.productName || fields.inspectionScope || text);
  const method = fields.method || inferMethod(text);
  if (fields.productName && !fields.inspectionScope) fields.inspectionScope = fields.productName;
  if (productGroup) fields.productGroup = productGroup;
  if (method) fields.method = method;

  return {
    fields,
    confidence: Number.isFinite(Number(confidence)) ? Math.min(1, Math.max(0, Number(confidence))) : 0,
    ...(Number.isInteger(sourcePage) && sourcePage > 0 ? { sourcePage } : {}),
    ...(fileName ? { sourceFileName: fileName } : {}),
    ...(provider ? { provider } : {}),
  };
}

// --- End of pgdOcrParser.ts ---
