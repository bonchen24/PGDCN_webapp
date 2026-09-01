import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import PizZip from 'pizzip';

import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';
import { PCN_OPERATIONAL_TEMPLATE_CATALOG, getPcnOperationalTemplateForKind } from '../utils/pcnOperationalTemplateCatalog.ts';
import { renderPcnOperationalTemplateDocx } from '../utils/pcnOperationalTemplateGeneration.ts';

const root = path.resolve('templates/pcn');

function readableDocxText(bytes: Buffer): string {
  const zip = new PizZip(bytes);
  return Object.keys(zip.files)
    .filter((name) => /^word\/(?:document|header\d*|footer\d*)\.xml$/i.test(name))
    .map((name) => zip.file(name)?.asText() || '')
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

test('PCN operational template pack has source-derived DOCX files and manifest metadata', () => {
  assert.equal(PCN_OPERATIONAL_TEMPLATE_CATALOG.length, 16);
  assert.ok(PCN_OPERATIONAL_TEMPLATE_CATALOG.every((template) => template.id.startsWith('pcn-')));
  assert.ok(PCN_OPERATIONAL_TEMPLATE_CATALOG.every((template) => template.fileName.endsWith('.docx')));
  assert.ok(PCN_OPERATIONAL_TEMPLATE_CATALOG.every((template) => fs.existsSync(path.join(root, template.fileName))), 'missing template file');
  assert.equal(getPcnOperationalTemplateForKind('LAB_REQUEST')?.fileName, 'PCN_PYC_gui_PTN.docx');
  assert.equal(getPcnOperationalTemplateForKind('TEST_REPORT')?.fileName, 'PCN_Bao_cao_KQTN.docx');
  assert.equal(getPcnOperationalTemplateForKind('TEST_REPORT')?.usage, 'REFERENCE_ONLY');
  assert.equal(getPcnOperationalTemplateForKind('COMMERCIAL')?.fileName, 'PCN_Hop_dong_dich_vu_chung_nhan.docx');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).templates.length, 16);
});

test('PCN operational templates expose required placeholders and no legacy customer data', () => {
  for (const template of PCN_OPERATIONAL_TEMPLATE_CATALOG) {
    const bytes = fs.readFileSync(path.join(root, template.fileName));
    const keys = new Set(extractPcnTemplatePlaceholderKeys(bytes));
    for (const required of template.requiredPlaceholderKeys) assert.ok(keys.has(required), `${template.id} missing [[${required}]]`);
    const text = readableDocxText(bytes);
    for (const forbidden of ['DDT', 'Haimy', 'Giám định', 'giám định', 'Dropbox', 'Synology', 'Trần Hoàng Phương', 'Vũ Thị Thắm']) {
      assert.doesNotMatch(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${template.id} contains ${forbidden}`);
    }
  }
});

test('PCN sample coding template keeps batch seal and sample-code placeholders distinct', () => {
  const template = PCN_OPERATIONAL_TEMPLATE_CATALOG.find((item) => item.generationKind === 'SAMPLE_CODING');
  assert.ok(template);
  const keys = extractPcnTemplatePlaceholderKeys(fs.readFileSync(path.join(root, template.fileName)));
  assert.ok(keys.includes('ma_lo'));
  assert.ok(keys.includes('seal_stamp'));
  assert.ok(keys.includes('ma_mau'));
  assert.notEqual(keys.indexOf('seal_stamp'), keys.indexOf('ma_mau'));
});

test('PCN source-derived templates do not duplicate operational rows or legacy handover text', () => {
  const read = (fileName: string) => readableDocxText(fs.readFileSync(path.join(root, fileName)));
  const evaluationPlan = read('PCN_Ke_hoach_danh_gia_CNSP.docx');
  assert.doesNotMatch(evaluationPlan, /\[\[method_label\]\]\s+\[\[method_label\]\]/);
  assert.doesNotMatch(evaluationPlan, /\[\[tieu_chuan\]\]\s+\[\[tieu_chuan\]\]/);

  const coding = read('PCN_Bien_ban_ma_hoa_mau.docx');
  assert.equal((coding.match(/Người mã hóa mẫu/g) || []).length, 1);

  const handover = read('PCN_Bien_ban_giao_nhan_mau.docx');
  assert.doesNotMatch(handover, /vật liệu và kiểm tra không phá hủy/i);
  assert.doesNotMatch(handover, /năm 2020/i);
  assert.equal((handover.match(/\[\[ma_phong_thu_nghiem\]\]/g) || []).length, 1);

  const fieldInspection = read('PCN_Bien_ban_kiem_tra_hien_truong.docx');
  assert.equal((fieldInspection.match(/\[\[so_dang_ky\]\]/g) || []).length, 1);
  assert.equal((fieldInspection.match(/\[\[tieu_chuan\]\]/g) || []).length, 2, 'quy chuẩn is shown in both the national-regulation and product-standard fields');

  const labRequest = read('PCN_PYC_gui_PTN.docx');
  assert.equal((labRequest.match(/\[\[ghi_chu\]\]/g) || []).length, 1);
});

test('operational DOCX generation uses the checked-in PCN form and resolves placeholders', () => {
  const document = renderPcnOperationalTemplateDocx('LAB_REQUEST', {
    dossierId: 'dossier-1', dossierCode: 'HS-QC4-01', proposalCode: 'DN-QC4-01', proposalReceivedAt: '2026-08-31T00:00:00.000Z',
    customerName: 'Khách hàng mẫu', customerAddress: 'Địa chỉ mẫu', customerTaxId: '0100000000', customerContactPerson: 'Người liên hệ', customerPhone: '0900000000', customerEmail: '',
    productName: 'Sản phẩm mẫu', productType: 'Thiết bị', specifications: 'Thông số', warehouseAddress: 'Kho mẫu', model: 'M-01', brand: 'Nhãn mẫu', manufacturer: 'Nhà sản xuất mẫu', manufacturerAddress: 'Địa chỉ nhà sản xuất', quantity: 1,
    method: 'METHOD_1', status: 'INTAKE_REVIEW', ownerUsername: 'owner', evaluatorUsername: 'evaluator', reviewerUsername: 'reviewer', targetDate: '2026-09-01', evaluationAt: '2026-08-31T00:00:00.000Z', fieldNames: ['Quy chuẩn 4'], checklist: [], attachments: [], contextHash: 'a'.repeat(64),
    labRequest: { requestId: 'request-1', pycNumber: 'PYC-01', fieldCode: 'QC4', laboratoryName: 'PTN mẫu', status: 'DRAFT', requestedAt: '', targetDate: '', criteria: 'QCVN 4', handoverAt: '', receivedAt: '', handoverNote: '', issueDescription: '', updatedAt: '', sampleLotId: '', lotCode: '', sampleName: '', model: '', brand: '', quantity: 1, unit: '', currentLocation: '', sampleLotUpdatedAt: '', sampleRouteId: '', routeLabCode: '', routeStatus: '', routeUpdatedAt: '' },
  } as any);
  assert.ok(document);
  const xml = new PizZip(document!).file('word/document.xml')?.asText() || '';
  assert.match(xml, /PHIẾU YÊU CẦU VÀ TIẾP NHẬN MẪU THỬ NGHIỆM/);
  assert.doesNotMatch(xml, /\[\[so_pyc\]\]/);
  assert.match(xml, /PYC-01/);
});
