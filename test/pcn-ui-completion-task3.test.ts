import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import { PcnCustomerContactDisplay } from '../components/PcnCustomersManagementView';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const customers = read('components/PcnCustomersManagementView.tsx');
const documents = read('components/PcnDocumentGenerationPanel.tsx');
const nodeWork = read('components/PcnDossierNodeWorkPanel.tsx');
const sampleFlow = read('components/PcnSampleFlowView.tsx');
const caseEvidence = read('components/PgdCaseEvidencePanel.tsx');
const userManagement = read('components/PcnUserManagementView.tsx');
const pgdWorkspace = read('components/PgdWorkspace.tsx');
const pgdStepWork = read('components/PgdDossierStepWorkPanel.tsx');
const pgdStationForms = read('components/PgdStationFormsPanel.tsx');
const pgdDossierOperations = read('components/PgdDossierOperationsPanel.tsx');
const pgdSourceForms = read('components/PgdSourceFormsPanel.tsx');
const dossierBusinessWorkspace = read('components/PgdcnDossierBusinessWorkspace.tsx');
const pgdIntakeSamples = read('components/PgdIntakeSampleTable.tsx');
const pgdTableFieldEditor = read('components/PgdTableFieldEditor.tsx');
const pgdIntakeDropzone = read('components/PgdcnIntakeDropzone.tsx');
const pgdcnAppShell = read('components/PgdcnAppShell.tsx');

test('core PCN and PGD work surfaces expose a visible focus ring for descendant controls', () => {
  for (const [name, source] of [
    ['PCN customers', customers],
    ['PCN document generation', documents],
    ['PCN dossier node work', nodeWork],
    ['PCN sample flow', sampleFlow],
    ['PGD case evidence', caseEvidence],
    ['PCN user management', userManagement],
    ['PGD workspace', pgdWorkspace],
  ] as const) {
    assert.ok(source.includes('[&_*:focus-visible]:ring-2'), `${name} should expose a focus-visible ring to its controls`);
    assert.ok(source.includes('[&_*:focus-visible]:ring-offset-2'), `${name} should separate focus rings from the surface`);
  }
});

test('decision labels, instructions, and primary actions keep readable type and touch size', () => {
  const requiredReadableLines = [
    [customers, 'Thêm khách hàng'],
    [nodeWork, 'Cập nhật mục này sẽ yêu cầu rà soát lại các bước sau.'],
    [sampleFlow, 'Mỗi dòng là một mẫu riêng; PYC vẫn được tạo theo toàn bộ lô.'],
    [caseEvidence, 'Tài liệu cần bổ sung'],
    [userManagement, 'Chức danh quản lý và vai trò chuyên môn độc lập; lãnh đạo có thể đồng thời là chuyên gia.'],
    [pgdWorkspace, 'Nhóm sản phẩm, loại hình và mã PYC là định danh nghiệp vụ;'],
  ] as const;

  for (const [source, phrase] of requiredReadableLines) {
    const line = source.split('\n').find((candidate) => candidate.includes(phrase));
    assert.ok(line, `expected to find UI copy: ${phrase}`);
    assert.match(line!, /text-(?:\[11px\]|xs|sm|base)/, `copy should be at least 11px: ${phrase}`);
  }

  assert.ok(/className="[^"]*mobile-touch-target[^"]*min-h-11[^"]*text-\[11px\][^"]*"[^>]*>.*?Thêm khách hàng/.test(customers), 'customer creation action meets the compact type and touch target contract');
  assert.ok(/className="[^"]*mobile-touch-target[^"]*min-h-11[^"]*text-\[11px\][^"]*"[^>]*>[\s\S]*?Lưu chứng từ/.test(caseEvidence), 'PGD evidence save action meets the compact type and touch target contract');
  assert.ok(/<button[^>]*className="[^"]*mobile-touch-target[^"]*min-h-11[^"]*text-\[11px\][^"]*"[^>]*>.*?Thêm nhân sự/.test(userManagement), 'user creation action meets the compact type and touch target contract');
});

test('wide work tables scroll locally and the PGD edit dialog keeps its footer outside the scroll body', () => {
  assert.match(customers, /<div className="overflow-x-auto">\s*<table/);
  assert.match(sampleFlow, /<div className="mt-3 overflow-x-auto[^\"]*">\s*<table className="min-w-/);

  assert.ok(/<section className="my-2 w-full max-w-5xl[^\"]*max-h-\[calc\(100dvh-1rem\)\][^\"]*flex[^\"]*flex-col/.test(pgdWorkspace), 'PGD edit panel is bounded by the viewport and uses a column layout');
  assert.ok(/<header className="[^\"]*shrink-0[^\"]*">[\s\S]*?<form onSubmit=\{submit\} className="flex min-h-0 flex-1 flex-col">/.test(pgdWorkspace), 'PGD edit header stays visible above the form body');
  assert.ok(/<div className="mobile-scroll-y min-h-0 flex-1 space-y-4 overflow-y-auto[^\"]*">[\s\S]*?<footer className="[^\"]*shrink-0/.test(pgdWorkspace), 'PGD edit footer stays outside the independently scrolling body');
  assert.ok(/<main[^>]*className="[^"]*mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto[^"]*"/.test(pgdcnAppShell), 'app shell main wrapper keeps horizontal overflow contained');
});

test('visible PGD work controls use readable labels and 44px mobile targets', () => {
  assert.ok(/dossier-action-compact inline-flex min-h-11 min-w-11/.test(pgdStepWork), 'document row icon actions meet the mobile target size');
  assert.ok(/dossier-action-compact inline-flex min-h-11 min-w-11[^\"]*bg-emerald-600/.test(pgdStepWork), 'document drafting action meets touch size');
  assert.ok(/mobile-touch-target min-h-11 rounded-lg bg-rose-600 px-3 text-(?:\[11px\]|xs|sm)/.test(pgdStepWork), 'exception confirmation meets touch and type size');
  assert.ok(/id="pgd-exception-reason"[\s\S]{0,300}?className="mobile-touch-target mt-1 min-h-11[^\"]*text-(?:\[11px\]|xs|sm)/.test(pgdStepWork), 'exception reason field meets touch and type size');
  assert.ok(/className="mobile-touch-target inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-3 text-(?:\[11px\]|xs|sm)/.test(pgdStepWork), 'complete-step action meets touch and type size');

  assert.ok(/openCreateRequest\} className="mobile-touch-target inline-flex min-h-11[^\"]*text-\[11px\]/.test(pgdWorkspace), 'request creation action meets touch and type size');
  assert.ok(/PgdRegisterTable/.test(pgdWorkspace), 'register table view is active without card toggle');
  assert.ok(/className="mobile-touch-target pgdcn-toolbar-actions inline-flex min-h-11 min-w-11/.test(pgdWorkspace), 'register refresh action meets mobile target size');
  assert.ok(/<p className="mt-0\.5 text-\[11px\] text-slate-400">Danh sách hồ sơ phát sinh trong ứng dụng; mở dòng để lập biên bản và đóng gói\.<\/p>/.test(pgdWorkspace), 'register instruction is readable');
  assert.ok(/<thead className="bg-slate-50 text-\[11px\]/.test(pgdWorkspace), 'register table decision headers are readable');
  assert.ok(/footer=\{<>\s*<p className="text-\[11px\]/.test(pgdWorkspace), 'intake footer instruction is readable');
  assert.ok(/setIntakeOpen\(false\)[^\"]*className="mobile-touch-target min-h-11[^\"]*text-\[11px\]/.test(pgdWorkspace), 'intake cancel action meets touch and type size');
});

test('active PGD station and evidence controls keep readable form text and touch targets', () => {
  assert.ok(pgdStationForms.includes("const inputClass = 'mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px]") && pgdStationForms.includes('focus-visible:ring-2 focus-visible:ring-blue-500'), 'PGD station inputs and selects meet touch, type, and focus-visible contracts');
  assert.ok(pgdStationForms.includes('<span className="mb-1 block text-[11px] font-black text-slate-500">{normalizedLabel}'), 'PGD station field labels are readable');
  assert.ok(pgdStationForms.includes('id="pgd-field-session-select"') && /id="pgd-field-session-select"[\s\S]{0,260}?className="mobile-touch-target min-h-11[^\"]*text-\[11px\]/.test(pgdStationForms), 'field session selector meets touch and type size');
  assert.ok(pgdStationForms.includes('THÊM PHIÊN HIỆN TRƯỜNG') && /mobile-touch-target min-h-11[^\"]*text-\[11px\] font-black text-white/.test(pgdStationForms), 'field session action meets touch and type size');
  assert.ok(/<span role="alert" className="ml-2 text-\[11px\] font-bold text-amber-700">Cảnh báo: còn yêu cầu chưa có kết quả\.<\/span>/.test(pgdStationForms), 'missing lab result warning is readable');
  assert.ok(pgdDossierOperations.includes('mobile-touch-target inline-flex min-h-11') && pgdDossierOperations.includes('text-[11px] font-black text-blue-700'), 'document package action meets touch and type size');
  assert.ok(/role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-\[11px\]/.test(pgdDossierOperations), 'incomplete dossier warning is readable');
  assert.ok(pgdDossierOperations.includes('min-h-11 rounded-lg bg-blue-600 px-2 text-[11px] font-black text-white'), 'attach-to-dossier action meets touch and type size');
  assert.ok(/className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-\[11px\]/.test(caseEvidence), 'sample removal action meets touch and type size');
  assert.ok(pgdWorkspace.includes('text-[11px] font-black text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Sửa thông tin hồ sơ'), 'PGD dossier edit action is readable');
  assert.ok(pgdWorkspace.includes('text-[11px] font-black text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Bot'), 'PGD contextual assistant action is readable');
  assert.ok(pgdWorkspace.includes('<PgdDossierFlow') && pgdWorkspace.includes('lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'), 'workflow rail and 60/40 workspace are active');
  assert.ok(pgdWorkspace.includes('text-[11px] leading-4 text-amber-800">Theo bảng cỡ lô của QT-GĐ-14'), 'sampling instruction is readable');
  assert.ok(pgdWorkspace.includes('mobile-touch-target min-h-11 flex items-center gap-2 self-end rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[11px] font-bold text-amber-900'), 'sampling option is a full mobile target');
  assert.ok(pgdWorkspace.includes('text-[11px] text-slate-700">{plan ? <div className="grid gap-2 sm:grid-cols-4">'), 'sampling counts use readable text');
  assert.ok(pgdWorkspace.includes('text-[11px] text-slate-500">Các trường dưới đây được chuẩn hóa từ sổ đăng ký'), 'register form instruction is readable');
  assert.ok(pgdWorkspace.includes('mb-1 text-[11px] font-black text-slate-600">{label}'), 'registry document field labels are readable');
  assert.ok(pgdWorkspace.includes('mobile-touch-target min-h-11 inline-flex items-center gap-1') && pgdWorkspace.includes('font-mono tracking-tight hover:text-emerald-700'), 'request card open action meets the mobile target size');
  assert.ok(pgdWorkspace.includes('text-[11px] font-black text-slate-800">{item.name}'), 'dashboard catalog decision labels are readable');
  assert.ok(userManagement.includes('text-[11px] font-black text-slate-600">Vai trò chuyên môn (có thể chọn nhiều):'), 'user role field label is readable');
  assert.ok(userManagement.includes('text-[11px] font-black text-slate-600">Phạm vi phòng:') && userManagement.includes('text-[11px] font-black text-slate-500">Phạm vi lĩnh vực:'), 'user scope field labels are readable');
});

test('active PGD source forms and dossier decision summaries use readable controls', () => {
  assert.ok(/const inputClass = 'mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-(?:\[11px\]|xs|sm)/.test(pgdSourceForms) && pgdSourceForms.includes('focus-visible:ring-2 focus-visible:ring-blue-500'), 'source form controls meet touch, type, and focus-visible contracts');
  assert.ok(pgdSourceForms.includes('text-[11px] font-black text-slate-500">{normalized}'), 'source form field labels are readable');
  assert.ok(pgdSourceForms.includes('mobile-touch-target inline-flex min-h-11') && pgdSourceForms.includes('text-[11px] font-black text-white'), 'source form primary actions meet touch and type size');
  assert.ok(pgdSourceForms.includes('overflow-x-auto rounded-lg border border-slate-100"><table className="min-w-full text-left text-[11px]'), 'source form tables scroll locally and keep readable content');

  assert.ok(dossierBusinessWorkspace.includes('min-w-0 space-y-3'), 'dossier decision summary can shrink inside the route');
  assert.ok(dossierBusinessWorkspace.includes('[&_*:focus-visible]:ring-2') && dossierBusinessWorkspace.includes('[&_*:focus-visible]:ring-indigo-500') && dossierBusinessWorkspace.includes('[&_*:focus-visible]:ring-blue-500'), 'shared decision summary gives its controls domain-colored keyboard focus');
  assert.ok(dossierBusinessWorkspace.includes('mobile-touch-target min-h-11 min-w-[10rem] flex-1') && dossierBusinessWorkspace.includes('mobile-touch-target min-h-11 max-w-full'), 'tracker search and filters meet the mobile target size');
  assert.ok(/mobile-touch-target mt-3 inline-flex min-h-11[^']*text-\[11px\] font-black text-white/.test(dossierBusinessWorkspace), 'next action button is readable at a 44px target');
  assert.ok(/blocker\.actionLabel && blocker\.onAction[\s\S]{0,180}?className="mobile-touch-target min-h-11[^"]*text-\[11px\] font-black/.test(dossierBusinessWorkspace), 'blocker action is readable at a 44px target');
  assert.ok(/fieldSession\.actionLabel && fieldSession\.onAction[\s\S]{0,180}?className="mobile-touch-target mt-3 inline-flex min-h-11[^"]*text-\[11px\] font-black/.test(dossierBusinessWorkspace), 'field session action is readable at a 44px target');
  assert.ok(dossierBusinessWorkspace.includes('text-[11px] leading-4 text-slate-600">{nextAction.reason}'), 'next action reasoning is readable');
  assert.ok(dossierBusinessWorkspace.includes('text-[11px] leading-4 text-slate-600">{blocker.reason}'), 'blocker guidance is readable');
});

test('PGD intake sample and template table editors keep readable controls, feedback, and local scrolling', () => {
  assert.ok(pgdIntakeSamples.includes('mobile-touch-target min-h-11 w-full min-w-0') && pgdIntakeSamples.includes('focus-visible:ring-2'), 'intake sample inputs meet touch, type, and visible focus contracts');
  assert.ok(pgdIntakeSamples.includes('text-[11px] font-black text-slate-500">{label}'), 'intake sample labels are readable');
  assert.ok(pgdIntakeSamples.includes('mobile-touch-target inline-flex min-h-11 items-center gap-1.5') && pgdIntakeSamples.includes('text-[11px] font-black text-blue-700 hover:bg-blue-100'), 'add sample action meets touch and type size');
  assert.ok(pgdIntakeSamples.includes('mobile-scroll-x mt-3 overflow-x-auto') && pgdIntakeSamples.includes('text-[11px] font-black uppercase tracking-wide'), 'intake sample table scrolls locally and has readable headers');
  assert.ok(pgdIntakeSamples.includes('role="alert" className="mt-1 text-[11px]'), 'duplicate sample validation is readable');

  assert.ok(pgdTableFieldEditor.includes('mobile-touch-target inline-flex min-h-11 items-center gap-1') && pgdTableFieldEditor.includes('text-[11px] font-black text-blue-700'), 'add row action meets touch and type size');
  assert.ok(pgdTableFieldEditor.includes('mobile-touch-target min-h-11 w-full') && pgdTableFieldEditor.includes('focus-visible:ring-2'), 'table cell inputs meet touch and visible focus contracts');
  assert.ok(pgdTableFieldEditor.includes('mobile-scroll-x min-w-0 max-w-full overflow-x-auto') && pgdTableFieldEditor.includes('text-left text-[11px]'), 'template table content is readable and scrolls locally');
  assert.ok(pgdTableFieldEditor.includes('mobile-touch-target inline-flex min-h-11 min-w-11'), 'row removal action meets the mobile target size');

  assert.ok(pgdIntakeDropzone.includes('mobile-touch-target min-h-11 cursor-pointer') && pgdIntakeDropzone.includes('text-[11px] font-black text-white'), 'file picker action meets touch and type size');
  assert.ok(pgdIntakeDropzone.includes('role="button" tabIndex={disabled ? -1 : 0}') && pgdIntakeDropzone.includes('mobile-touch-target min-h-11') && pgdIntakeDropzone.includes('focus-visible:ring-2'), 'drop area is a visible-focus keyboard target');
  assert.ok(pgdIntakeDropzone.includes('role="alert" className="mt-2 text-[11px]'), 'file validation feedback is readable');
  assert.ok(pgdIntakeDropzone.includes('mobile-touch-target min-h-11 rounded-md bg-emerald-600') && pgdIntakeDropzone.includes('text-[11px] font-black text-white disabled:bg-emerald-300'), 'OCR confirmation action meets touch and type size');
});

test('customer, sample-flow, and PGD dashboard decision details remain readable', () => {
  const contactMarkup = cheerio.load(renderToStaticMarkup(React.createElement(PcnCustomerContactDisplay, {
    customer: {
      name: 'Công ty Ánh Dương',
      address: 'Đà Nẵng',
      phone: ' 0901234567 ',
      email: ' anh@example.vn ',
      contactPerson: ' Đặng Thị Ánh ',
    },
  })));
  const contactLines = contactMarkup('div').first().children('div');
  const readableContactDetails = ['SĐT: 0901234567', 'Email: anh@example.vn', 'LH: Đặng Thị Ánh'];
  assert.equal(contactLines.length, readableContactDetails.length, 'customer contact details render as separate lines');
  readableContactDetails.forEach((detail, index) => {
    const line = contactLines.eq(index);
    assert.equal(line.text(), detail, `customer contact detail renders correctly: ${detail}`);
    assert.ok(line.attr('class')?.split(/\s+/).includes('text-[11px]'), `customer contact detail remains readable: ${detail}`);
  });
  assert.ok(sampleFlow.includes('text-[11px] font-bold text-slate-600">{dossier?.dossierCode') && sampleFlow.includes('text-[11px] text-slate-500">{lot.brand'), 'sample identifiers and product details are readable');
  assert.ok(sampleFlow.includes('text-[11px] font-black text-slate-600">{routes.length} phép thử đã gán') && sampleFlow.includes('text-[11px] font-bold text-slate-600"><MapPin'), 'sample route count and location are readable');
  assert.ok(pgdDossierOperations.includes('text-[11px] font-black uppercase text-slate-400">Bắt buộc hiện hành'), 'dossier document metric label is readable');
  assert.ok(pgdWorkspace.includes('truncate text-[11px] font-black uppercase tracking-wide text-slate-400'), 'PGD dashboard metric labels are readable');
});
