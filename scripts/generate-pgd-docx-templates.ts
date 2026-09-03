import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

import { getPgdDocumentTemplates } from '../utils/pgdDocumentTemplates.ts';

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

function run(text: string, bold = false): string {
  return `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(text: string, bold = false, alignment = 'left'): string {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/><w:spacing w:after="100"/></w:pPr>${run(text, bold)}</w:p>`;
}

function tableCell(text: string, width: number, bold = false): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(text, bold)}</w:tc>`;
}

function fieldTable(template: ReturnType<typeof getPgdDocumentTemplates>[number]): string {
  const rows = [
    ['Trường thông tin', 'Nội dung nhập liệu'],
    ...template.cells
      .filter((cell) => cell.active !== false)
      .map((cell) => [cell.label, `[[${cell.key}]]`]),
  ];
  const body = rows.map((row, index) => `<w:tr>${tableCell(row[0], 3600, index === 0)}${tableCell(row[1], 5400, index === 0)}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C4D6"/><w:left w:val="single" w:sz="4" w:color="B8C4D6"/><w:bottom w:val="single" w:sz="4" w:color="B8C4D6"/><w:right w:val="single" w:sz="4" w:color="B8C4D6"/><w:insideH w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideV w:val="single" w:sz="4" w:color="D7DEE8"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="3600"/><w:gridCol w:w="5400"/></w:tblGrid>${body}</w:tbl>`;
}

function documentXml(template: ReturnType<typeof getPgdDocumentTemplates>[number]): string {
  const title = template.name.toLocaleUpperCase('vi-VN');
  const body = [
    paragraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', true, 'center'),
    paragraph('TRUNG TÂM TVCI · PHÒNG GIÁM ĐỊNH - CHỨNG NHẬN', true, 'center'),
    paragraph(title, true, 'center'),
    paragraph(`Mã biểu mẫu: ${template.code} · Phiên bản: ${template.version}`, false, 'center'),
    paragraph(template.sourceFormLabel),
    fieldTable(template),
    paragraph('Biểu mẫu được hoàn thiện từ dữ liệu hồ sơ PGD và kiểm tra trước khi phát hành.'),
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>',
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

function stylesXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
}

function createDocx(template: ReturnType<typeof getPgdDocumentTemplates>[number]): Buffer {
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
  version: '1.2',
  description: 'Bộ biểu mẫu DOCX PGD với placeholder [[key]] làm nguồn cho form nhập liệu và sinh tài liệu.',
  templates: templates.map((template) => ({
    id: template.id,
    kind: template.kind,
    code: template.code,
    fileName: template.fileName,
    placeholderKeys: template.placeholderKeys,
    requiredPlaceholderKeys: template.requiredPlaceholderKeys,
  })),
}, null, 2)}\n`);
