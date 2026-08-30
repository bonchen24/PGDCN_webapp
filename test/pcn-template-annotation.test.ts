import assert from 'node:assert/strict';
import test from 'node:test';

import PizZip from 'pizzip';

import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';
import { annotatePcnDocxTemplate } from '../utils/pcnTemplateAnnotation.ts';
import {
  getPcnTemplateAnnotationSuggestionCoverage,
  getPcnTemplateAnnotationSuggestions,
} from '../utils/pcnTemplateAnnotationSuggestions.ts';
import { PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';

function makeDocx(rows: string[]): Buffer {
  return makeDocxWithBody(`<w:tbl>${rows.join('')}</w:tbl>`);
}

function makeDocxWithBody(body: string): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  const zip = new PizZip();
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' });
}

function row(label: string, value = ''): string {
  return `<w:tr><w:tc><w:p><w:r><w:t>${label}</w:t></w:r></w:p></w:tc><w:tc><w:p>${value ? `<w:r><w:t>${value}</w:t></w:r>` : ''}</w:p></w:tc></w:tr>`;
}

test('template annotation inserts placeholders into the unique empty value cell', () => {
  const source = makeDocx([
    row('Kiểu loại'),
    '<w:tr><w:tc><w:p><w:r><w:t>Được nhập</w:t></w:r><w:r><w:t> khẩu bởi</w:t></w:r></w:p></w:tc><w:tc><w:p/></w:tc></w:tr>',
  ]);
  const result = annotatePcnDocxTemplate(source, [
    { key: 'loai_sp', sourceText: 'Kiểu loại' },
    { key: 'ten_cong_ty', sourceText: 'Được nhập khẩu bởi' },
  ]);

  assert.deepEqual(result.placeholderKeys, ['loai_sp', 'ten_cong_ty']);
  assert.deepEqual(result.appliedMappings.map((mapping) => mapping.key), ['loai_sp', 'ten_cong_ty']);
  assert.deepEqual(extractPcnTemplatePlaceholderKeys(result.bytes), ['loai_sp', 'ten_cong_ty']);
});

test('template annotation rejects ambiguous labels and occupied target cells', () => {
  assert.throws(
    () => annotatePcnDocxTemplate(makeDocx([row('Kiểu loại'), row('Kiểu loại')]), [{ key: 'loai_sp', sourceText: 'Kiểu loại' }]),
    /không duy nhất|ambiguous/i,
  );
  assert.throws(
    () => annotatePcnDocxTemplate(makeDocx([row('Kiểu loại', 'đã có dữ liệu')]), [{ key: 'loai_sp', sourceText: 'Kiểu loại' }]),
    /ô giá trị|trống|occupied/i,
  );
});

test('template annotation validates keys and duplicate mappings before changing the document', () => {
  const source = makeDocx([row('Kiểu loại')]);
  assert.throws(() => annotatePcnDocxTemplate(source, [{ key: 'bad key', sourceText: 'Kiểu loại' }]), /key|placeholder/i);
  assert.throws(() => annotatePcnDocxTemplate(source, [
    { key: 'loai_sp', sourceText: 'Kiểu loại' },
    { key: 'loai_sp', sourceText: 'Kiểu loại' },
  ]), /trùng|duplicate/i);
});

test('template annotation fills a blank inline value after a label split across Word runs', () => {
  const source = makeDocxWithBody('<w:p><w:r><w:t>Tên sản</w:t></w:r><w:r><w:t xml:space="preserve"> phẩm: </w:t></w:r><w:r><w:t>................................</w:t></w:r></w:p>');
  const result = annotatePcnDocxTemplate(source, [{ key: 'loai_sp', sourceText: 'Tên sản phẩm' }]);

  assert.deepEqual(result.placeholderKeys, ['loai_sp']);
  const xml = new PizZip(result.bytes).file('word/document.xml')!.asText();
  assert.match(xml, /\[\[loai_sp\]\]/);
  assert.doesNotMatch(xml, /\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\./);
});

test('template annotation rejects an inline label whose value is already occupied', () => {
  const source = makeDocxWithBody('<w:p><w:r><w:t>Tên sản phẩm: Bếp điện</w:t></w:r></w:p>');
  assert.throws(
    () => annotatePcnDocxTemplate(source, [{ key: 'loai_sp', sourceText: 'Tên sản phẩm' }]),
    /ô giá trị|trống|occupied/i,
  );
});

test('PCN template annotation suggestions use surveyed QC4/QC9 source labels without inventing missing fields', () => {
  const tdcProposal = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc9-proposal-method-1-tdc')!;
  const qc9Certificate = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc9-certificate-method-1')!;

  assert.deepEqual(getPcnTemplateAnnotationSuggestions(tdcProposal), {
    loai_sp: 'Tên sản phẩm',
    ten_cong_ty: 'Đơn vị yêu cầu:',
    dia_chi_ct: 'Địa chỉ:',
  });
  assert.deepEqual(getPcnTemplateAnnotationSuggestions(qc9Certificate), {
    loai_sp: 'Kiểu loại',
    ten_cong_ty: 'Được nhập khẩu bởi',
    so_dang_ky: 'Số giấy chứng nhận',
    ngay_cap_CN: 'Ngày cấp giấy chứng nhận',
  });
  assert.deepEqual(getPcnTemplateAnnotationSuggestions({ ...tdcProposal, id: 'unknown-template' }), {});
});

test('PCN template annotation coverage exposes the QC9 certificate field with no surveyed source label', () => {
  const qc9Certificate = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc9-certificate-method-1')!;

  assert.deepEqual(getPcnTemplateAnnotationSuggestionCoverage(qc9Certificate, qc9Certificate.requiredPlaceholderKeys), {
    requiredKeys: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN'],
    suggestedKeys: ['loai_sp', 'ten_cong_ty', 'so_dang_ky', 'ngay_cap_CN'],
    missingSuggestionKeys: ['dia_chi_ct'],
  });
});
