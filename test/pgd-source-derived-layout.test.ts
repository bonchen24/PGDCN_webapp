import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import PizZip from 'pizzip';

import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';
import { getPgdDocumentTemplates } from '../utils/pgdDocumentTemplates.ts';

const root = path.resolve(process.cwd());

const EXPECTED_LAYOUT: Record<string, string[]> = {
  'PGD-BM-01': ['HỒ SƠ GIÁM ĐỊNH', 'MỤC LỤC HỒ SƠ', '[[registryDocuments]]', '[[machineryModel]]', '[[coalType]]'],
  'PGD-BM-02': ['PHIẾU PHÂN CÔNG', 'CAM KẾT KHÁCH QUAN', '[[inspectors]]'],
  'PGD-BM-03': ['KẾ HOẠCH GIÁM ĐỊNH', 'THÀNH PHẦN ĐOÀN', '[[productLines]]', '[[agenda]]'],
  'PGD-BM-04': ['BIÊN BẢN KIỂM TRA TẠI HIỆN TRƯỜNG', 'TÌNH TRẠNG BAO GÓI', '[[sampleRows]]'],
  'PGD-BM-05': ['BIÊN BẢN LẤY MẪU', 'THÔNG TIN VỀ MẪU', '[[sampleRows]]'],
  'PGD-BM-06': ['PHIẾU YÊU CẦU VÀ TIẾP NHẬN MẪU THỬ NGHIỆM', 'CHỈ TIÊU THỬ NGHIỆM', '[[testItems]]'],
  'PGD-BM-07': ['BÁO CÁO KẾT QUẢ GIÁM ĐỊNH', 'ĐÁNH GIÁ KẾT QUẢ', '[[labResults]]', '[[machineryCondition]]', '[[coalQualityStandard]]'],
  'PGD-BM-08': ['CHỨNG THƯ GIÁM ĐỊNH', 'HỒ SƠ, CHỨNG TỪ LIÊN QUAN', '[[resultRows]]'],
  'PGD-BM-09': ['QUYẾT ĐỊNH', 'CĂN CỨ PHÊ DUYỆT', '[[decisionText]]'],
  'PGD-BM-10': ['BÌA HỒ SƠ', 'MỤC LỤC HỒ SƠ', '[[dossierEntries]]'],
  'PGD-BM-11': ['DIỄN BIẾN VỤ GIÁM ĐỊNH', 'DIỄN BIẾN THEO THỜI GIAN', '[[eventRows]]'],
  'PGD-BM-12': ['PHIẾU GHI CHÉP HIỆN TRƯỜNG', 'NỘI DUNG GHI CHÉP', '[[activityRows]]'],
  'PGD-BM-13': ['BẢN ĐÁNH GIÁ KẾT QUẢ THỬ NGHIỆM', 'TÍNH ĐẦY ĐỦ', '[[labResultRows]]'],
  'PGD-BM-14': ['BIÊN BẢN GIÁM ĐỊNH', 'KẾT QUẢ GIÁM ĐỊNH', '[[inspectionResult]]'],
  'PGD-BM-15': ['BIÊN BẢN GIAO MẪU PTN', 'CHI TIẾT GIAO MẪU', '[[handoverRows]]'],
};

test('PGD DOCX pack contains source-derived forms, not the generic Cell/Giá trị table', () => {
  const templates = getPgdDocumentTemplates();
  for (const template of templates) {
    const filePath = path.join(root, 'templates', 'pgd', template.fileName);
    assert.equal(fs.existsSync(filePath), true, `missing ${template.fileName}`);
    const xml = new PizZip(fs.readFileSync(filePath)).file('word/document.xml')?.asText() || '';
    const headerXml = new PizZip(fs.readFileSync(filePath)).file('word/header1.xml')?.asText() || '';
    const visibleText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN');
    for (const expected of EXPECTED_LAYOUT[template.code] || []) {
      assert.match(visibleText, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${template.code} missing ${expected}`);
    }
    assert.doesNotMatch(visibleText, /TRƯỜNG THÔNG TIN\s+NỘI DUNG NHẬP LIỆU/);
    assert.ok((xml.match(/<w:tbl[ >]/g) || []).length >= 2, `${template.code} needs multiple business tables`);
    assert.ok((headerXml.match(/<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/gi) || []).length <= 1, `${template.code} must not repeat the PAGE field in its header`);
    assert.deepEqual(extractPcnTemplatePlaceholderKeys(fs.readFileSync(filePath)), [...template.placeholderKeys].sort((left, right) => left.localeCompare(right)));
  }
});

// --- End of pgd-source-derived-layout.test.ts ---
