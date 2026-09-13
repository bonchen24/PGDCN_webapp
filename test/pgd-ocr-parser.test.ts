import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPgdOcrDraftFromText } from '../utils/pgdOcrParser.ts';

test('PGD OCR maps the labels used by HS_GD cover sheets without inventing requester data', () => {
  const draft = buildPgdOcrDraftFromText(`
    MÃ HỒ SƠ: 1102-26-GĐ
    Khách hàng : Công ty Cổ phần Điện tử Viễn thông Nam Á
    Hạng mục giám định: Thép theo thông tư 58
    Thời gian thực hiện : 18/5/2026
    Địa điểm : Tổ dân phố Trại - Thái Nguyên
    Người thực hiện : Nguyễn Hải Nam
  `, '1102-01.jpg', 1, 0.91, 'PADDLEOCR');

  assert.equal(draft.fields.registrationNumber, '1102-26-GĐ');
  assert.equal(draft.fields.customerName, 'Công ty Cổ phần Điện tử Viễn thông Nam Á');
  assert.equal(draft.fields.productName, 'Thép theo thông tư 58');
  assert.equal(draft.fields.inspectionScope, 'Thép theo thông tư 58');
  assert.equal(draft.fields.inspectionScheduledAt, '18/5/2026');
  assert.equal(draft.fields.inspectionLocation, 'Tổ dân phố Trại - Thái Nguyên');
  assert.equal(draft.fields.productGroup, 'STEEL_METAL');
  assert.equal(draft.fields.method, 'TT58');
  assert.equal(draft.fields.operatorName, 'Nguyễn Hải Nam');
  assert.equal(draft.fields.requesterPhone, undefined);
});

test('PGD OCR tolerates PaddleOCR accent loss and labels split over two lines', () => {
  const draft = buildPgdOcrDraftFromText(`
TAP DOAN CONG NGHIEP THAN - KHOANG SAN VIET NAM
MA HO SO: 1102-26-GD
Khách hàng
: Cong ty Co phan Dien tu Vien thong Nam A
Hang muc giam dinh: Thep theo thong tu 58
Thoigian thurc hien : 18/5/2026
Dia diem
: To dan pho Trai - Thai Nguyen
Nguoi thyc hien
: Nguyen Hai Nam
`, '1102-01.jpg', 1, 0.9315, 'PADDLEOCR');

  assert.equal(draft.fields.registrationNumber, '1102-26-GD');
  assert.equal(draft.fields.customerName, 'Cong ty Co phan Dien tu Vien thong Nam A');
  assert.equal(draft.fields.productName, 'Thep theo thong tu 58');
  assert.equal(draft.fields.brand, undefined);
  assert.equal(draft.fields.inspectionScheduledAt, '18/5/2026');
  assert.equal(draft.fields.inspectionLocation, 'To dan pho Trai - Thai Nguyen');
  assert.equal(draft.fields.operatorName, 'Nguyen Hai Nam');
  assert.equal(draft.fields.productGroup, 'STEEL_METAL');
  assert.equal(draft.fields.method, 'TT58');
});
