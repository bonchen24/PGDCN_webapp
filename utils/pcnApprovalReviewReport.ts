import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PizZip from 'pizzip';

import type { PcnApprovalCriterionResult, PcnApprovalReviewStatus, PcnApprovalReviewSummary } from './pcnApprovalReview.ts';

export interface PcnApprovalReviewReportDocument {
  dossierCode: string;
  fieldCode: string;
  generatedAt: string;
  criteria: PcnApprovalCriterionResult[];
  summary: PcnApprovalReviewSummary;
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function xml(value: unknown): string {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wordParagraph(value: string, options: { bold?: boolean; color?: string } = {}): string {
  const runProperties = `${options.bold ? '<w:b/>' : ''}${options.color ? `<w:color w:val="${options.color}"/>` : ''}`;
  return `<w:p><w:r>${runProperties}<w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
}

function statusLabel(status: PcnApprovalReviewStatus): string {
  return status === 'PASS' ? 'ĐẠT' : status === 'WARNING' ? 'CẢNH BÁO' : status === 'ERROR' ? 'LỖI' : 'CHƯA ĐỦ CĂN CỨ';
}

function buildReportBody(report: PcnApprovalReviewReportDocument): string {
  const rows = report.criteria.flatMap((criterion) => {
    const header = wordParagraph(`${criterion.title} — ${statusLabel(criterion.status)}`, { bold: true, color: criterion.status === 'ERROR' ? 'C00000' : criterion.status === 'WARNING' ? 'B26B00' : '1F7A4D' });
    const summary = wordParagraph(criterion.summary);
    const findings = criterion.findings.length === 0
      ? [wordParagraph('Không phát hiện bất thường rõ theo luật đã chạy.')]
      : criterion.findings.flatMap((finding) => [
        wordParagraph(`• ${finding.message}`, { bold: true }),
        ...(finding.detail ? [wordParagraph(`Chi tiết: ${finding.detail}`)] : []),
        ...(finding.suggestedAction ? [wordParagraph(`Đề nghị kiểm tra: ${finding.suggestedAction}`)] : []),
        ...finding.evidence.slice(0, 8).map((evidence) => wordParagraph(`Bằng chứng: ${evidence.fileName}${evidence.page ? ` — trang ${evidence.page}` : ''}${evidence.excerpt ? ` — ${evidence.excerpt}` : ''}`)),
      ]);
    return [header, summary, ...findings];
  });
  const intro = [
    wordParagraph('BÁO CÁO HỖ TRỢ KIỂM DUYỆT HỒ SƠ PCN', { bold: true, color: '135E96' }),
    wordParagraph(`Hồ sơ: ${report.dossierCode} | Lĩnh vực: ${report.fieldCode}`),
    wordParagraph(`Thời điểm tạo: ${report.generatedAt}`),
    wordParagraph(`Kết luận hỗ trợ: ${report.summary.conclusion}`, { bold: true }),
    wordParagraph(`Tóm tắt: Đạt ${report.summary.pass} · Cảnh báo ${report.summary.warning} · Lỗi ${report.summary.error} · Chưa đủ căn cứ ${report.summary.notEvaluable}`),
    wordParagraph('Đây là kết quả hỗ trợ đọc/đối soát, không phải quyết định phê duyệt và không thay đổi tiến trình hồ sơ.', { color: '7A4E00' }),
  ];
  return [...intro, ...rows].join('');
}

export function buildPcnApprovalReviewDocx(report: PcnApprovalReviewReportDocument): Buffer {
  const body = buildReportBody(report);
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function pdfSafe(value: unknown): string {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^\x20-\x7E]/g, '?');
}

export async function buildPcnApprovalReviewPdf(report: PcnApprovalReviewReportDocument): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  let page = document.addPage([595, 842]);
  let y = 805;
  const lines = [
    'BAO CAO HO TRO KIEM DUYET HO SO PCN',
    `Ho so: ${pdfSafe(report.dossierCode)} | Linh vuc: ${pdfSafe(report.fieldCode)}`,
    `Thoi diem tao: ${pdfSafe(report.generatedAt)}`,
    `Ket luan ho tro: ${pdfSafe(report.summary.conclusion)}`,
    `Tom tat: Dat ${report.summary.pass} | Canh bao ${report.summary.warning} | Loi ${report.summary.error} | Chua du can cu ${report.summary.notEvaluable}`,
    'Day la ket qua ho tro doc/doi soat, khong phai quyet dinh phe duyet.',
    '',
    ...report.criteria.flatMap((criterion) => [
      `${pdfSafe(criterion.title)} — ${pdfSafe(statusLabel(criterion.status))}`,
      pdfSafe(criterion.summary),
      ...(criterion.findings.length > 0 ? criterion.findings.flatMap((finding) => [
        `- ${pdfSafe(finding.message)}`,
        ...finding.evidence.slice(0, 4).map((evidence) => `  Bang chung: ${pdfSafe(evidence.fileName)}${evidence.page ? ` / trang ${evidence.page}` : ''}`),
      ]) : ['- Khong phat hien bat thuong ro theo luat da chay.']),
      '',
    ]),
  ];
  for (const rawLine of lines) {
    const chunks = rawLine.match(/.{1,96}(?:\s|$)/g) || [''];
    for (const chunk of chunks) {
      if (y < 45) { page = document.addPage([595, 842]); y = 805; }
      page.drawText(chunk.trim(), { x: 42, y, size: 9, font, color: rgb(0.12, 0.16, 0.22) });
      y -= 14;
    }
  }
  return Buffer.from(await document.save());
}
