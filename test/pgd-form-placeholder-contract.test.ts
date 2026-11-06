import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getPgdDocumentTemplates,
  getPgdTemplateCellPlaceholder,
} from '../utils/pgdDocumentTemplates.ts';

test('PGD document cells expose an operator-facing placeholder for every scalar input', () => {
  for (const template of getPgdDocumentTemplates()) {
    for (const cell of template.cells.filter((item) => item.active !== false && item.type !== 'TABLE')) {
      const placeholder = getPgdTemplateCellPlaceholder(cell);
      assert.ok(placeholder.trim(), `${template.code}/${cell.key} is missing a placeholder`);
      if (cell.type === 'DATE') assert.match(placeholder, /dd\/mm\/yyyy/i, `${template.code}/${cell.key} should explain the date format`);
      if (cell.validation?.options?.length) assert.match(placeholder, /chọn/i, `${template.code}/${cell.key} should guide option selection`);
    }
  }
});

test('PGD drafting UI keeps template placeholders internal and renders visible field labels', () => {
  const source = fs.readFileSync('components/PgdDocumentGenerationPanel.tsx', 'utf8');
  assert.doesNotMatch(source, /placeholder=/);
  assert.match(source, /Chọn giá trị/);
});

test('PGD intake form uses visible Vietnamese labels for domain-specific fields', () => {
  const source = fs.readFileSync('components/PgdProductGroupFields.tsx', 'utf8');
  assert.doesNotMatch(source, /placeholder=/);
  assert.match(source, /Thông số kỹ thuật/);
  assert.match(source, /Năm sản xuất/);
});

test('PGD workflow forms keep labels visible without HTML placeholders', () => {
  const workspace = fs.readFileSync('components/PgdWorkspace.tsx', 'utf8');
  const stations = fs.readFileSync('components/PgdStationFormsPanel.tsx', 'utf8');
  const sourceForms = fs.readFileSync('components/PgdSourceFormsPanel.tsx', 'utf8');
  const evidence = fs.readFileSync('components/PgdCaseEvidencePanel.tsx', 'utf8');
  assert.doesNotMatch(workspace, /function fieldPlaceholder|React\.cloneElement|placeholder=/);
  assert.match(workspace, /Ghi nhận lô hàng \*/);
  assert.match(workspace, /Kết luận KQTN \*/);
  assert.doesNotMatch(stations, /function stationFieldPlaceholder|cloneElement|placeholder=/);
  assert.match(stations, /aria-required/);
  assert.match(stations, /REQUIRED_STATION_FIELDS/);
  assert.match(stations, /text-rose-600/);
  assert.match(stations, /Kết luận đối chiếu với tiêu chuẩn.*text-rose-600/);
  assert.match(stations, /PgdcnDateInput/);
  assert.match(sourceForms, /function SourceField/);
  assert.match(sourceForms, /Ngày đánh giá.*required/);
  assert.doesNotMatch(sourceForms, /placeholder=/);
  assert.match(evidence, /PgdcnDateInput/);
  assert.match(evidence, /Tiêu đề chứng từ.*text-rose-600/);
});

test('PCN signer delegation keeps required dates accessible in the shared date format', () => {
  const source = fs.readFileSync('components/PcnSignerDelegationPanel.tsx', 'utf8');
  const dateInputSource = fs.readFileSync('components/PgdcnDateInput.tsx', 'utf8');

  assert.match(source, /PgdcnDateInput/);
  assert.match(source, /<RequiredLabel>Thời hạn<\/RequiredLabel>/);
  assert.match(source, /aria-label="Thời hạn từ ngày"/);
  assert.match(source, /aria-label="Thời hạn đến ngày"/);
  assert.match(source, /PgdcnDateInput[^>]*required[^>]*aria-required="true"[^>]*aria-label="Thời hạn từ ngày"/);
  assert.match(source, /PgdcnDateInput[^>]*required[^>]*aria-required="true"[^>]*aria-label="Thời hạn đến ngày"/);
  assert.doesNotMatch(source, /type="date"/);

  assert.match(dateInputSource, /formatDateDdMmYyyy/);
  assert.match(dateInputSource, /parseDdMmYyyy/);
});

test('PCN proposal intake keeps visible Vietnamese labels beside the editable fields', () => {
  const source = fs.readFileSync('components/PcnWorkspace.tsx', 'utf8');

  const boundFields: Array<{ label: string; controlId: string }> = [
    { label: 'Khách hàng *', controlId: 'pcn-customer' },
    { label: 'Địa chỉ khách hàng *', controlId: 'pcn-proposal-customer-address' },
    { label: 'Địa chỉ/kho liên quan *', controlId: 'pcn-proposal-warehouse-address' },
    { label: 'Nhóm sản phẩm *', controlId: 'pcn-proposal-product-group' },
    { label: 'Phương thức chứng nhận *', controlId: 'pcn-proposal-method' },
    { label: 'QCVN / TCVN *', controlId: 'pcn-proposal-standard' },
  ];

  for (const { label, controlId } of boundFields) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fieldPattern = new RegExp(`<Field[^>]*label="${escapedLabel}"[\\s\\S]*?id="${controlId}"`);
    assert.match(source, fieldPattern, `PCN proposal form should bind visible label "${label}" to control "${controlId}"`);
  }

  assert.match(
    source,
    /<Field[^>]*label="Ngày tiếp nhận \*"[\s\S]*?<PgdcnDateInput[^>]*id="pcn-proposal-received-at"[^>]*required[^>]*aria-required="true"/,
    'PCN proposal should bind required intake date to PgdcnDateInput with aria-required="true"',
  );

  assert.match(source, /function Field/);
  assert.doesNotMatch(source, /placeholder=/);
  assert.doesNotMatch(source, /id="pcn-proposal-(?:model|brand|manufacturer|specifications)"[^>]*required/);
});
