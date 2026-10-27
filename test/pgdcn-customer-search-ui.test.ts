import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnCustomersView, {
  filterCustomersBySearch,
  filterPgdCustomers,
  PgdCustomerSearchProjection,
} from '../components/PgdcnCustomersView';
import type { CustomerRef } from '../types';

type TestDirectoryCustomer = CustomerRef & {
  region?: string;
  businessType?: string;
};

test('PGD customer projection searches normalized identity and contact fields accessibly', () => {
  const customer: CustomerRef = {
    name: 'Công ty Điện lực Ánh Dương',
    address: 'Hà Nội',
    customerCode: 'KH-DIEN-01',
    taxId: '0102040608',
    contactPerson: 'Đặng Thị Ánh',
    phone: '0987654321',
    email: 'anh@example.vn',
  };

  for (const query of ['cong ty dien luc', 'kh-dien-01', '0102040608', 'dang thi anh', '0987654321', 'ANH@EXAMPLE.VN']) {
    assert.deepEqual(filterCustomersBySearch([customer], query), [customer], `query should find customer by ${query}`);
  }
  assert.deepEqual(filterCustomersBySearch([customer], 'khong-co-ket-qua'), []);
  assert.deepEqual(filterCustomersBySearch([customer], '   '), [customer]);

  const source = fs.readFileSync(new URL('../components/PgdcnCustomersView.tsx', import.meta.url), 'utf8');
  const markup = renderToStaticMarkup(React.createElement(PgdcnCustomersView, { scopes: ['PGD'] }));
  const $ = cheerio.load(markup);

  const search = $('[role="search"][aria-label="Tìm kiếm khách hàng dùng chung"] input[type="search"]');
  assert.equal(search.length, 1);
  assert.match(search.parent().text(), /Tìm khách hàng/);
  assert.ok((search.attr('class') || '').includes('min-h-11'));
  assert.ok((search.attr('class') || '').includes('focus-visible:ring-2'));
  assert.equal($('[role="status"]').text().trim(), '0 khách hàng');
  assert.match($('.pcn-page-surface').text(), /Chưa có khách hàng dùng chung/);
  assert.match(source, /Không tìm thấy khách hàng phù hợp/);
  assert.match(source, /Xóa tìm kiếm/);
  assert.match(source, /aria-live="polite"[\s\S]*?filteredCustomers\.length/);
  assert.match(source, /if \(scopes\.includes\('PCN'\)\) return <PcnCustomersManagementView \/>;/);
});

test('PGD customer projection displays warnings for missing customerCode and contact info', () => {
  const bothMissing: CustomerRef = {
    name: 'Doanh nghiệp Thiếu Cả Hai',
    address: 'Hà Nội',
    customerCode: '   ',
    phone: '',
    email: '  ',
    contactPerson: '\t',
  };
  const missingCodeOnly: CustomerRef = {
    name: 'Doanh nghiệp Có Liên Hệ',
    address: 'Đà Nẵng',
    customerCode: '',
    phone: '0901234567',
  };
  const missingContactOnly: CustomerRef = {
    name: 'Doanh nghiệp Có Mã',
    address: 'TP.HCM',
    customerCode: 'KH-HCM-01',
    phone: '   ',
    email: '',
    contactPerson: '',
  };
  const completeCustomer: CustomerRef = {
    name: 'Doanh nghiệp Đầy Đủ',
    address: 'Cần Thơ',
    customerCode: 'KH-CT-02',
    phone: '0912345678',
    email: 'contact@example.vn',
    contactPerson: 'Trần Văn A',
  };

  const markup = renderToStaticMarkup(
    React.createElement(PgdCustomerSearchProjection, {
      customers: [bothMissing, missingCodeOnly, missingContactOnly, completeCustomer],
    })
  );
  const $ = cheerio.load(markup);

  const articles = $('article');
  assert.equal(articles.length, 4);

  // 1. Both missing: shows both "Chưa có mã" and "Chưa có liên hệ" warnings
  const bothArticle = articles.filter((_, el) => $(el).text().includes('Doanh nghiệp Thiếu Cả Hai'));
  assert.equal(bothArticle.length, 1);
  const bothWarnings = bothArticle.find('[role="status"]');
  assert.ok(bothWarnings.length >= 2, 'both warnings must have role="status"');
  assert.match(bothArticle.text(), /Chưa có mã/);
  assert.match(bothArticle.text(), /Chưa có liên hệ/);

  // 2. Missing code only: shows "Chưa có mã", does NOT show "Chưa có liên hệ"
  const codeOnlyArticle = articles.filter((_, el) => $(el).text().includes('Doanh nghiệp Có Liên Hệ'));
  assert.match(codeOnlyArticle.text(), /Chưa có mã/);
  assert.doesNotMatch(codeOnlyArticle.text(), /Chưa có liên hệ/);
  assert.match(codeOnlyArticle.text(), /0901234567/);

  // 3. Missing contact only: shows "Chưa có liên hệ", shows customerCode
  const contactOnlyArticle = articles.filter((_, el) => $(el).text().includes('Doanh nghiệp Có Mã'));
  assert.doesNotMatch(contactOnlyArticle.text(), /Chưa có mã/);
  assert.match(contactOnlyArticle.text(), /KH-HCM-01/);
  assert.match(contactOnlyArticle.text(), /Chưa có liên hệ/);

  // 4. Complete customer: neither warning is displayed
  const completeArticle = articles.filter((_, el) => $(el).text().includes('Doanh nghiệp Đầy Đủ'));
  assert.doesNotMatch(completeArticle.text(), /Chưa có mã/);
  assert.doesNotMatch(completeArticle.text(), /Chưa có liên hệ/);
  assert.match(completeArticle.text(), /KH-CT-02/);
  assert.match(completeArticle.text(), /0912345678/);
});

test('PGD customer filter controls support contact status, omit absent metadata, and compose cleanly', () => {
  const plainCustomers: CustomerRef[] = [
    {
      name: 'Khách Hàng Có Liên Hệ',
      address: 'Hà Nội',
      customerCode: 'KH-001',
      phone: '0901112233',
    },
    {
      name: 'Khách Hàng Không Liên Hệ',
      address: 'Hải Phòng',
      customerCode: 'KH-002',
      phone: '   ',
      email: '',
      contactPerson: '',
    },
  ];

  // When no records have explicit region or businessType, the controls must not be rendered
  const plainMarkup = renderToStaticMarkup(
    React.createElement(PgdCustomerSearchProjection, { customers: plainCustomers })
  );
  const $plain = cheerio.load(plainMarkup);
  assert.equal($plain('select[aria-label="Lọc tình trạng liên hệ"]').length, 1);
  assert.equal($plain('select[aria-label="Lọc khu vực"]').length, 0, 'region filter must be omitted when no explicit metadata');
  assert.equal($plain('select[aria-label="Lọc loại doanh nghiệp"]').length, 0, 'businessType filter must be omitted when no explicit metadata');

  // Contact status select attributes and accessibility
  const contactSelect = $plain('select[aria-label="Lọc tình trạng liên hệ"]');
  assert.ok((contactSelect.attr('class') || '').includes('min-h-11'), 'filter controls must be at least 44px');
  const contactOptions = contactSelect.find('option').map((_, el) => $plain(el).val()).get();
  assert.deepEqual(contactOptions, ['all', 'with-contact', 'without-contact']);

  // When records have explicit region and businessType, the filters render with corresponding options
  const richCustomers: TestDirectoryCustomer[] = [
    {
      name: 'Công ty Bắc Hà',
      address: 'Hà Nội',
      customerCode: 'KH-BH-01',
      phone: '0901234567',
      region: 'Miền Bắc',
      businessType: 'Công ty TNHH',
    },
    {
      name: 'Công ty Nam Trung',
      address: 'Đà Nẵng',
      customerCode: 'KH-NT-02',
      phone: ' ',
      region: 'Miền Trung',
      businessType: 'Cổ phần',
    },
  ];

  const richMarkup = renderToStaticMarkup(
    React.createElement(PgdCustomerSearchProjection, { customers: richCustomers })
  );
  const $rich = cheerio.load(richMarkup);
  assert.equal($rich('select[aria-label="Lọc khu vực"]').length, 1);
  assert.equal($rich('select[aria-label="Lọc loại doanh nghiệp"]').length, 1);
  assert.match($rich('select[aria-label="Lọc khu vực"]').text(), /Miền Bắc/);
  assert.match($rich('select[aria-label="Lọc khu vực"]').text(), /Miền Trung/);
  assert.match($rich('select[aria-label="Lọc loại doanh nghiệp"]').text(), /Công ty TNHH/);
  assert.match($rich('select[aria-label="Lọc loại doanh nghiệp"]').text(), /Cổ phần/);

  // Behavior helper tests: filterPgdCustomers composability
  const filteredWithContact = filterPgdCustomers(richCustomers, { contactStatus: 'with-contact' });
  assert.equal(filteredWithContact.length, 1);
  assert.equal(filteredWithContact[0].customerCode, 'KH-BH-01');

  const filteredWithoutContact = filterPgdCustomers(richCustomers, { contactStatus: 'without-contact' });
  assert.equal(filteredWithoutContact.length, 1);
  assert.equal(filteredWithoutContact[0].customerCode, 'KH-NT-02');

  const filteredByRegion = filterPgdCustomers(richCustomers, { region: 'Miền Bắc' });
  assert.equal(filteredByRegion.length, 1);
  assert.equal(filteredByRegion[0].customerCode, 'KH-BH-01');

  const filteredCombined = filterPgdCustomers(richCustomers, {
    searchTerm: 'bac ha',
    contactStatus: 'with-contact',
    region: 'Miền Bắc',
    businessType: 'Công ty TNHH',
  });
  assert.equal(filteredCombined.length, 1);
  assert.equal(filteredCombined[0].customerCode, 'KH-BH-01');

  const filteredMismatch = filterPgdCustomers(richCustomers, {
    searchTerm: 'bac ha',
    region: 'Miền Trung',
  });
  assert.equal(filteredMismatch.length, 0);

  // Read-only invariant: no add/edit/delete buttons in PGD projection
  assert.equal($plain('button:contains("Thêm khách hàng")').length, 0);
  assert.equal($plain('button[aria-label="Xóa"]').length, 0);
});
