import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pgdSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const pcnSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('PGD create-request modal has an accessible fixed anatomy and official CTA', () => {
  assert.match(pgdSource, /data-testid="pgd-intake-modal"/);
  assert.match(pgdSource, /aria-labelledby="pgd-intake-title"/);
  assert.match(pgdSource, /data-testid="pgd-intake-body"/);
  assert.match(pgdSource, /data-testid="pgd-intake-footer"/);
  assert.match(pgdSource, /focus-visible:ring/);
  assert.match(pgdSource, /Tạo PYC & mở hồ sơ/);
});

test('PGD intake keeps the business sections visible without flattening catalog branches', () => {
    assert.match(pgdSource, /Người yêu cầu|Thông tin bên yêu cầu|Đơn vị yêu cầu/);
    assert.match(pgdSource, /Sản phẩm|Lô hàng|Hàng hóa \/ phạm vi/);
    assert.match(pgdSource, /Địa điểm|Phạm vi yêu cầu|Phạm vi giám định/);
    assert.match(pgdSource, /Chứng từ|Sổ đăng ký|Hồ sơ kỹ thuật/);
  assert.match(pgdSource, /productGroup/);
});

test('PCN proposal modal has an accessible fixed anatomy and domain CTA', () => {
  assert.match(pcnSource, /data-testid="pcn-proposal-form-modal"/);
  assert.match(pcnSource, /aria-labelledby="pcn-proposal-modal-title"/);
  assert.match(pcnSource, /data-testid="pcn-proposal-modal-body"/);
  assert.match(pcnSource, /data-testid="pcn-proposal-modal-footer"/);
  assert.match(pcnSource, /focus-visible:ring/);
  assert.match(pcnSource, /Tạo Đề nghị & bộ hồ sơ/);
});

test('PCN proposal form exposes structured customer, product, scope and OCR groups', () => {
  assert.match(pcnSource, /Kênh tiếp nhận/);
  assert.match(pcnSource, /Khách hàng/);
  assert.match(pcnSource, /Nhà sản xuất/);
  assert.match(pcnSource, /Lĩnh vực/);
  assert.match(pcnSource, /PcnOcrPanel/);
  assert.match(
    pcnSource,
    /<Field label="Mã Đề nghị">\s*<div[^>]*>Hệ thống tự cấp theo dạng PCN-YYMMDD-TT khi lưu<\/div>/
  );
  assert.match(pcnSource, /Tên sản phẩm/);
  assert.match(pcnSource, /xác nhận phạm vi/);
  assert.match(pcnSource, /if \(!canEdit\) return;/);
});
