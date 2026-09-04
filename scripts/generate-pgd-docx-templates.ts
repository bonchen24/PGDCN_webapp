import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

import { getPgdDocumentTemplates, type PgdDocumentTemplate, type PgdTemplateCell } from '../utils/pgdDocumentTemplates.ts';

const root = process.cwd();
const outputRoot = path.join(root, 'templates', 'pgd');

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function run(text: string, options: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}): string {
  const properties = [
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
    options.color ? `<w:color w:val="${options.color}"/>` : '',
  ].join('');
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(text = '', options: { bold?: boolean; italic?: boolean; size?: number; alignment?: 'left' | 'center' | 'right'; color?: string; before?: number; after?: number } = {}): string {
  return `<w:p><w:pPr><w:jc w:val="${options.alignment || 'left'}"/><w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 100}"/></w:pPr>${run(text, options)}</w:p>`;
}

function cell(text: string, width: number, options: { bold?: boolean; italic?: boolean; alignment?: 'left' | 'center' | 'right'; fill?: string; size?: number } = {}): string {
  const shading = options.fill ? `<w:shd w:fill="${options.fill}"/>` : '';
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>${paragraph(text, { bold: options.bold, italic: options.italic, size: options.size || 20, alignment: options.alignment || 'left', after: 0 })}</w:tc>`;
}

function table(rows: string[][], widths: number[], header = true): string {
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="64748B"/><w:left w:val="single" w:sz="6" w:color="64748B"/><w:bottom w:val="single" w:sz="6" w:color="64748B"/><w:right w:val="single" w:sz="6" w:color="64748B"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders>';
  const body = rows.map((row, rowIndex) => `<w:tr>${row.map((value, columnIndex) => cell(value, widths[columnIndex] || widths[widths.length - 1] || 1800, { bold: header && rowIndex === 0, alignment: header && rowIndex === 0 ? 'center' : 'left', fill: header && rowIndex === 0 ? 'E8EEF7' : undefined })).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((sum, value) => sum + value, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}</w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${body}</w:tbl>`;
}

function heading(text: string): string {
  return paragraph(text, { bold: true, size: 24, color: '17365D', before: 140, after: 100 });
}

function field(label: string, key: string, used: Set<string>): string {
  used.add(key);
  return paragraph(`${label}: [[${key}]]`, { size: 21, after: 80 });
}

function fieldPair(leftLabel: string, leftKey: string, rightLabel: string, rightKey: string, used: Set<string>): string {
  used.add(leftKey);
  used.add(rightKey);
  return table([[`${leftLabel}: [[${leftKey}]]`, `${rightLabel}: [[${rightKey}]]`]], [4500, 4500], false);
}

function tableField(template: PgdDocumentTemplate, key: string, used: Set<string>): string {
  const templateCell = template.cells.find((item) => item.key === key);
  if (!templateCell) return '';
  used.add(key);
  const columns = templateCell.tableColumns || ['value'];
  const labels = columns.map((column) => templateCell.tableColumnLabels?.[column] || column);
  const widths = columns.map(() => Math.max(850, Math.floor(9000 / columns.length)));
  const row = [`[[${key}]]`, ...columns.slice(1).map(() => '................................')];
  return paragraph(templateCell.label, { bold: true, size: 21, after: 60 }) + table([labels, row], widths);
}

function getCell(template: PgdDocumentTemplate, key: string): PgdTemplateCell | undefined {
  return template.cells.find((item) => item.key === key);
}

function optionalFields(template: PgdDocumentTemplate, used: Set<string>): string {
  const remaining = template.cells.filter((item) => item.active !== false && !used.has(item.key));
  if (remaining.length === 0) return '';
  const rows = [['Trường bổ sung theo hồ sơ', 'Giá trị nhập liệu'], ...remaining.map((item) => {
    used.add(item.key);
    return [item.label, `[[${item.key}]]`];
  })];
  return heading('THÔNG TIN BỔ SUNG THEO PHẠM VI HỒ SƠ') + table(rows, [4300, 4700]);
}

function header(template: PgdDocumentTemplate, title: string): string {
  return table([
    ['IEMM • TVCI', title, `Mã biểu mẫu: ${template.code}\nPhiên bản: ${template.version}`],
  ], [1900, 5200, 1900], false) + paragraph('PHÒNG GIÁM ĐỊNH - CHỨNG NHẬN', { bold: true, size: 20, alignment: 'center', color: '17365D', after: 60 }) + paragraph('Biểu mẫu số hóa cho một bộ hồ sơ PYC PGD', { italic: true, size: 18, alignment: 'center', color: '64748B', after: 140 });
}

function bodyFor(template: PgdDocumentTemplate, used: Set<string>): string {
  const f = (label: string, key: string) => getCell(template, key) ? field(label, key, used) : '';
  const t = (key: string) => tableField(template, key, used);
  switch (template.kind) {
    case 'INTAKE_REQUEST':
      return heading('HỒ SƠ GIÁM ĐỊNH') + paragraph('PHIẾU TIẾP NHẬN YÊU CẦU GIÁM ĐỊNH', { bold: true, size: 27, alignment: 'center', after: 140 })
        + table([['Mã PYC', '[[requestCode]]', 'Số đăng ký', '[[registrationNumber]]'], ['Ngày tiếp nhận', '[[receivedAt]]', 'Kênh tiếp nhận', '[[intakeChannel]]']], [1800, 2700, 1800, 2700])
        + heading('1. ĐƠN VỊ YÊU CẦU / KHÁCH HÀNG') + f('Khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress')
        + heading('2. HÀNG HÓA / PHẠM VI GIÁM ĐỊNH') + f('Tên hàng hóa / thiết bị', 'productName') + fieldPair('Số lô / số nhận dạng', 'lotCode', 'Số lượng / khối lượng', 'quantity', used) + f('Phạm vi giám định', 'inspectionScope') + fieldPair('Địa điểm', 'inspectionLocation', 'Phương thức ĐGSPH', 'assessmentMethod', used) + t('standards')
        + heading('3. THÔNG TIN LÔ / SẢN PHẨM') + f('Dạng sản phẩm', 'productForm') + f('Mác / model / cấp sản phẩm', 'grade') + f('Kích thước / thông số', 'dimensions') + f('Tiêu chuẩn sản phẩm công bố', 'productStandard') + f('Xuất xứ / nước xuất xứ', 'origin') + f('Nhà sản xuất', 'manufacturer') + f('Nhà nhập khẩu', 'importer') + f('Mã HS', 'hsCode') + f('Cách xác định lô', 'lotDefinition') + f('Cỡ lô bó/kiện/cuộn', 'steelLotSize') + f('Cùng mác, nhiều loại sản phẩm', 'steelSameGradeMultiProduct') + f('Kế hoạch lấy mẫu thủ công / căn cứ', 'steelManualSamplingPlanNote')
        + heading('3A. THÔNG TIN MÁY MÓC / DÂY CHUYỀN') + f('Loại máy / thiết bị', 'machineryType') + f('Model máy', 'machineryModel') + f('Số serial / nhận dạng', 'machinerySerialNumber') + f('Năm sản xuất', 'machineryManufacturingYear') + f('Thông số kỹ thuật', 'machineryTechnicalParameters') + f('Tình trạng máy', 'machineryCondition') + f('Mức độ đầy đủ / phụ kiện', 'machineryCompleteness') + f('Tính đồng bộ dây chuyền', 'machinerySynchronization') + f('Tình trạng lắp đặt', 'machineryInstallationStatus') + f('Tiêu chuẩn an toàn áp dụng', 'machinerySafetyStandard')
        + heading('3B. THÔNG TIN LÔ THAN') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + f('Cỡ hạt', 'coalSizeRange') + f('Tiêu chuẩn chất lượng than', 'coalQualityStandard') + f('Căn cứ lấy mẫu than', 'coalSamplingBasis') + f('Độ ẩm (%)', 'coalMoisture') + f('Độ tro (%)', 'coalAsh') + f('Nhiệt trị (kcal/kg)', 'coalCalorificValue') + f('Lưu huỳnh (%)', 'coalSulfur')
        + heading('4. CHỨNG TỪ VÀ MỤC LỤC HỒ SƠ') + paragraph('MỤC LỤC HỒ SƠ', { bold: true, size: 22, after: 60 }) + t('registryDocuments') + f('Hồ sơ kỹ thuật', 'technicalDossierNote') + f('Thiếu hồ sơ', 'deficiencyNote') + f('Hoàn trả / chuyển phát', 'returnedPackageNote') + f('Đơn vị chuyển phát', 'courierName');
    case 'ASSIGNMENT':
      return paragraph('PHIẾU PHÂN CÔNG', { bold: true, size: 28, alignment: 'center', after: 140 }) + f('Số Job / mã PYC', 'requestCode') + f('Đơn vị yêu cầu', 'customerName') + f('Địa chỉ', 'customerAddress') + f('Sản phẩm / lô', 'productName') + f('Ngày giờ thực hiện', 'scheduledAt') + heading('I. PHÂN CÔNG') + f('Trưởng đoàn / phụ trách', 'leadInspector') + t('inspectors') + f('Người soát xét kỹ thuật', 'technicalReviewer') + heading('II. NỘI DUNG VÀ CĂN CỨ') + t('standards') + f('CAM KẾT KHÁCH QUAN', 'leadInspector') + paragraph('Trưởng đoàn và chuyên gia được phân công cam kết không có mối quan hệ ảnh hưởng đến tính khách quan với khách hàng.', { italic: true, size: 20 }) + paragraph('Ký xác nhận: Trưởng đoàn · Chuyên gia kỹ thuật · Người phân công', { bold: true, after: 100 });
    case 'INSPECTION_PLAN':
      return paragraph('KẾ HOẠCH GIÁM ĐỊNH', { bold: true, size: 28, alignment: 'center', after: 140 }) + f('Mã hồ sơ', 'requestCode') + f('Tên khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress') + f('Ngày giám định', 'inspectionDate') + f('Phương thức ĐGSPH', 'assessmentMethod') + t('standards') + heading('1. THÀNH PHẦN ĐOÀN') + t('team') + heading('2. SẢN PHẨM / LÔ ĐĂNG KÝ') + t('productLines') + heading('2A. THÔNG TIN MÁY MÓC / DÂY CHUYỀN') + f('Model máy', 'machineryModel') + f('Thông số kỹ thuật', 'machineryTechnicalParameters') + f('Tình trạng máy', 'machineryCondition') + f('Tính đồng bộ dây chuyền', 'machinerySynchronization') + heading('2B. THÔNG TIN LÔ THAN') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + f('Tiêu chuẩn chất lượng than', 'coalQualityStandard') + f('Căn cứ lấy mẫu than', 'coalSamplingBasis') + heading('3. CHƯƠNG TRÌNH THỰC HIỆN') + t('agenda') + f('Ghi chú kế hoạch', 'note') + paragraph('Kế hoạch có thể được điều chỉnh tại hiện trường; mọi thay đổi phải được ghi nhận trong diễn biến vụ giám định.', { italic: true, size: 19 });
    case 'FIELD_INSPECTION':
      return paragraph('BIÊN BẢN KIỂM TRA TẠI HIỆN TRƯỜNG', { bold: true, size: 25, alignment: 'center', after: 140 }) + f('Mã hồ sơ', 'requestCode') + f('Tên khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress') + fieldPair('Thời gian', 'performedAt', 'Địa điểm', 'location', used) + f('Sản phẩm / lô', 'productName') + f('Mã lô', 'lotCode') + heading('1. NHẬN DẠNG VÀ TÌNH TRẠNG LÔ HÀNG') + f('Nhận dạng lô hàng', 'lotObservation') + f('Model máy', 'machineryModel') + f('Tình trạng máy', 'machineryCondition') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + heading('2. TÌNH TRẠNG BAO GÓI, BẢO QUẢN VÀ GHI NHÃN') + f('TÌNH TRẠNG BAO GÓI / BẢO QUẢN', 'packaging') + f('Ghi nhãn', 'labeling') + t('measurements') + t('nonconformities') + heading('3. MẪU ĐÃ LẤY') + t('sampleRows') + paragraph('Đại diện khách hàng xác nhận nội dung kiểm tra và mẫu đã lấy.', { italic: true, size: 20 });
    case 'SAMPLE_TAKING':
      return paragraph('BIÊN BẢN LẤY MẪU', { bold: true, size: 28, alignment: 'center', after: 140 }) + fieldPair('Số / mã PYC', 'requestCode', 'Ngày lấy mẫu', 'sampledAt', used) + f('Khách hàng', 'customerName') + f('Địa điểm lấy mẫu', 'samplingLocation') + f('Tên sản phẩm / lô', 'productName') + f('Mục đích lấy mẫu', 'purpose') + f('Phương pháp lấy mẫu', 'samplingMethod') + f('Phương thức ĐGSPH', 'assessmentMethod') + f('Dạng sản phẩm', 'productForm') + f('Mác / cấp sản phẩm', 'grade') + f('Kích thước / thông số', 'dimensions') + f('Tiêu chuẩn sản phẩm', 'productStandard') + f('Xuất xứ / nhà sản xuất', 'origin') + f('Model máy', 'machineryModel') + f('Số serial / nhận dạng', 'machinerySerialNumber') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + f('Căn cứ lấy mẫu than', 'coalSamplingBasis') + heading('THÔNG TIN VỀ MẪU') + t('sampleRows') + paragraph('Người lấy mẫu · Đại diện tổ chức / khách hàng ký xác nhận.', { bold: true, alignment: 'center', after: 100 });
    case 'LAB_REQUEST':
      return paragraph('PHIẾU YÊU CẦU VÀ TIẾP NHẬN MẪU THỬ NGHIỆM', { bold: true, size: 24, alignment: 'center', after: 140 }) + f('Số hồ sơ / PYC', 'requestCode') + f('Khách hàng', 'customerName') + f('Sản phẩm', 'productName') + f('Phòng thí nghiệm', 'laboratoryName') + f('Mã PTN', 'laboratoryCode') + fieldPair('Đơn vị giao mẫu', 'senderUnit', 'Thời điểm giao', 'sentAt', used) + f('Người giao mẫu', 'sender') + f('Người nhận mẫu', 'receiver') + heading('YÊU CẦU THỬ NGHIỆM') + t('sampleRows') + paragraph('CHỈ TIÊU THỬ NGHIỆM / PHƯƠNG PHÁP THỬ', { bold: true, size: 21, after: 60 }) + t('testItems') + paragraph('Mẫu sau thử nghiệm: ghi nhận theo chính sách mẫu lưu của PTN. Không nhập phí hoặc thanh toán trong hồ sơ PGD.', { italic: true, size: 19 });
    case 'INSPECTION_REPORT':
      return paragraph('BÁO CÁO KẾT QUẢ GIÁM ĐỊNH', { bold: true, size: 28, alignment: 'center', after: 140 }) + fieldPair('Số báo cáo', 'reportNumber', 'Ngày lập', 'reportedAt', used) + f('Khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress') + f('Sản phẩm / lô', 'productName') + f('Mã lô', 'lotCode') + f('Tiêu chuẩn áp dụng', 'standards') + f('Phương thức ĐGSPH', 'assessmentMethod') + heading('1. ĐỐI TƯỢNG VÀ THÔNG SỐ ĐẶC THÙ') + f('Model máy', 'machineryModel') + f('Số serial / nhận dạng', 'machinerySerialNumber') + f('Tình trạng máy', 'machineryCondition') + f('Tính đồng bộ dây chuyền', 'machinerySynchronization') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + f('Tiêu chuẩn chất lượng than', 'coalQualityStandard') + f('Độ ẩm (%)', 'coalMoisture') + f('Độ tro (%)', 'coalAsh') + f('Nhiệt trị (kcal/kg)', 'coalCalorificValue') + f('Lưu huỳnh (%)', 'coalSulfur') + heading('2. KẾT QUẢ HIỆN TRƯỜNG') + t('fieldFindings') + heading('3. KẾT QUẢ PTN') + t('labResults') + heading('4. ĐÁNH GIÁ KẾT QUẢ') + f('Kết luận', 'conclusion') + f('Cỡ lô', 'steelLotSize') + f('Cùng mác, nhiều loại sản phẩm', 'steelSameGradeMultiProduct') + f('Kế hoạch lấy mẫu thủ công', 'steelManualSamplingPlanNote');
    case 'DECISION':
      return paragraph('QUYẾT ĐỊNH', { bold: true, size: 30, alignment: 'center', after: 80 }) + paragraph('Về việc phê duyệt và phát hành kết quả giám định', { bold: true, size: 22, alignment: 'center', after: 140 }) + fieldPair('Số quyết định', 'decisionNumber', 'Ngày quyết định', 'decisionDate', used) + f('Căn cứ phê duyệt', 'decisionBasis') + f('Nội dung quyết định', 'decisionText') + f('Khách hàng', 'customerName') + f('Sản phẩm / lô', 'productName') + f('Tiêu chuẩn áp dụng', 'standards') + f('Model máy', 'machineryModel') + f('Tình trạng máy', 'machineryCondition') + f('Loại than', 'coalType') + f('Tiêu chuẩn chất lượng than', 'coalQualityStandard') + f('Kết luận', 'conclusion') + f('Người ký quyết định', 'decisionSigner') + paragraph('Nơi nhận: hồ sơ PGD, chủ hồ sơ, khách hàng và các bên có liên quan theo quy định.', { italic: true, size: 20 });
    case 'INSPECTION_CERTIFICATE':
      return paragraph('CHỨNG THƯ GIÁM ĐỊNH', { bold: true, size: 31, alignment: 'center', color: '2F75B5', after: 100 }) + fieldPair('Số chứng thư', 'documentNumber', 'Ngày ký', 'signedAt', used) + paragraph('1. HỒ SƠ, CHỨNG TỪ LIÊN QUAN', { bold: true, size: 22, after: 80 }) + f('Khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress') + f('Hạng mục giám định', 'certificateScope') + f('Sản phẩm / lô', 'productName') + f('Mã lô', 'lotCode') + f('Tiêu chuẩn áp dụng', 'standards') + f('Phương thức ĐGSPH', 'assessmentMethod') + f('Model máy', 'machineryModel') + f('Số serial / nhận dạng', 'machinerySerialNumber') + f('Tình trạng máy', 'machineryCondition') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + f('Tiêu chuẩn chất lượng than', 'coalQualityStandard') + paragraph('2. KẾT QUẢ GIÁM ĐỊNH', { bold: true, size: 22, after: 80 }) + t('resultRows') + f('Kết luận', 'conclusion') + paragraph('Chứng thư chỉ có giá trị đối với lô hàng / đối tượng giám định nêu trên.', { italic: true, size: 19 });
    case 'DOSSIER_COVER':
      return paragraph('BÌA HỒ SƠ', { bold: true, size: 32, alignment: 'center', after: 140 }) + f('Mã hồ sơ / PYC', 'requestCode') + f('Khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress') + f('Hạng mục giám định', 'inspectionScope') + fieldPair('Thời gian thực hiện', 'performedAt', 'Địa điểm', 'location', used) + f('Model máy / loại than', 'machineryModel') + f('Loại than', 'coalType') + paragraph('MỤC LỤC HỒ SƠ', { bold: true, size: 24, alignment: 'center', before: 160 }) + t('dossierEntries') + f('Người soát xét', 'reviewer') + f('Nhân viên lưu trữ', 'archivist') + f('Mã lưu trữ', 'archiveReference');
    case 'CASE_TIMELINE':
      return paragraph('DIỄN BIẾN VỤ GIÁM ĐỊNH', { bold: true, size: 28, alignment: 'center', after: 140 }) + f('Mã hồ sơ / PYC', 'requestCode') + f('Khách hàng', 'customerName') + f('Sản phẩm / lô', 'productName') + f('Ngày giám định', 'eventDate') + paragraph('DIỄN BIẾN THEO THỜI GIAN', { bold: true, size: 22, before: 160, after: 80 }) + t('eventRows') + f('Xác nhận của khách hàng', 'customerConfirmation');
    case 'FIELD_ACTIVITY_LOG':
      return paragraph('PHIẾU GHI CHÉP HIỆN TRƯỜNG', { bold: true, size: 27, alignment: 'center', after: 140 }) + fieldPair('Mã hồ sơ / PYC', 'requestCode', 'Ngày', 'activityDate', used) + fieldPair('Buổi ghi chép', 'session', 'Chuyên gia / GĐV', 'auditor', used) + f('Khách hàng', 'customerName') + paragraph('NỘI DUNG GHI CHÉP', { bold: true, size: 22, before: 160, after: 80 }) + t('activityRows');
    case 'LAB_RESULT_REVIEW':
      return paragraph('BẢN ĐÁNH GIÁ KẾT QUẢ THỬ NGHIỆM', { bold: true, size: 25, alignment: 'center', after: 140 }) + f('Mã hồ sơ / PYC', 'requestCode') + f('Khách hàng', 'customerName') + f('Sản phẩm', 'productName') + paragraph('1. PHIẾU KẾT QUẢ PTN', { bold: true, size: 22, before: 160, after: 80 }) + t('labResultRows') + f('Tính đầy đủ kết quả', 'completeness') + f('Đánh giá sự phù hợp', 'conformity') + t('missingItems') + t('nonconformities') + f('Kiến nghị', 'recommendation') + f('Kết luận', 'conclusion') + f('Người đánh giá', 'reviewer');
    case 'INSPECTION_MINUTES':
      return paragraph('BIÊN BẢN GIÁM ĐỊNH', { bold: true, size: 29, alignment: 'center', after: 140 }) + fieldPair('Mã hồ sơ / PYC', 'requestCode', 'Thời gian', 'performedAt', used) + f('Khách hàng', 'customerName') + f('Địa chỉ', 'customerAddress') + fieldPair('Địa điểm', 'location', 'Hạng mục', 'inspectionScope', used) + f('Sản phẩm / lô', 'productName') + f('Số lượng / khối lượng', 'quantity') + f('Phương tiện vận tải', 'transportName') + f('Model máy', 'machineryModel') + f('Tình trạng máy', 'machineryCondition') + f('Tính đồng bộ dây chuyền', 'machinerySynchronization') + f('Loại than', 'coalType') + f('Nguồn / mỏ than', 'coalSource') + f('Tiêu chuẩn chất lượng than', 'coalQualityStandard') + f('Số hóa đơn', 'invoiceNumber') + f('Số hợp đồng', 'contractNumber') + f('Số packing list', 'packingListNumber') + heading('1. TÌNH TRẠNG TRƯỚC GIÁM ĐỊNH') + f('Mô tả', 'preInspectionCondition') + heading('2. KẾT QUẢ GIÁM ĐỊNH') + f('Kết quả', 'inspectionResult') + t('sampleRows') + f('Kết luận', 'conclusion') + f('Đại diện khách hàng xác nhận', 'customerConfirmation');
    case 'SAMPLE_HANDOVER':
      return paragraph('BIÊN BẢN GIAO MẪU PTN', { bold: true, size: 28, alignment: 'center', after: 140 }) + f('Mã hồ sơ / PYC', 'requestCode') + f('Khách hàng', 'customerName') + f('Sản phẩm', 'productName') + f('Phòng thí nghiệm', 'laboratoryName') + f('Mã PTN', 'laboratoryCode') + fieldPair('Bên giao mẫu', 'senderUnit', 'Ngày giao mẫu', 'sentAt', used) + f('Người giao mẫu', 'sender') + f('Người nhận mẫu', 'receiver') + heading('CHI TIẾT GIAO MẪU') + t('handoverRows') + f('Ghi chú giao mẫu', 'handoverNote') + paragraph('Bên giao và bên nhận xác nhận đúng mã mẫu, số lượng, tình trạng niêm phong và chỉ tiêu thử nghiệm.', { italic: true, size: 19 });
  }
}

function documentXml(template: PgdDocumentTemplate): string {
  const used = new Set<string>();
  const title = template.name.toLocaleUpperCase('vi-VN');
  const body = [header(template, title), paragraph(template.sourceFormLabel, { italic: true, size: 17, color: '64748B', after: 110 }), bodyFor(template, used), optionalFields(template, used), paragraph('Bản mẫu trống — chỉ nhập dữ liệu của hồ sơ PYC PGD hiện hành trước khi trình duyệt/ký.', { italic: true, size: 18, color: '64748B', before: 180, after: 80 }), '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/><w:cols w:num="1"/></w:sectPr>'].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

function stylesXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
}

function createDocx(template: PgdDocumentTemplate): Buffer {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', documentXml(template));
  zip.file('word/styles.xml', stylesXml());
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const templates = getPgdDocumentTemplates();
fs.mkdirSync(outputRoot, { recursive: true });
for (const template of templates) fs.writeFileSync(path.join(outputRoot, template.fileName), createDocx(template));
fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify({
  domain: 'pgd',
  version: '1.3',
  description: 'Bộ biểu mẫu DOCX PGD có bố cục nghiệp vụ cho thép/kim loại, máy móc/dây chuyền và than; placeholder [[key]] cùng cell bảng làm nguồn cho form nhập liệu và sinh tài liệu.',
  templates: templates.map((template) => ({
    id: template.id,
    kind: template.kind,
    code: template.code,
    fileName: template.fileName,
    placeholderKeys: template.placeholderKeys,
    requiredPlaceholderKeys: template.requiredPlaceholderKeys,
  })),
}, null, 2)}\n`);
