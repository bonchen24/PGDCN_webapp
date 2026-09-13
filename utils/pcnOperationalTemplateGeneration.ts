// Author: Codex
// Description: Render checked-in operational PCN templates from dossier context

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { PcnDossierDocumentContext } from './pcnDocumentGeneration.ts';
import type { PcnOperationalTemplateKind } from './pcnOperationalTemplateCatalog.ts';
import { extractPcnTemplatePlaceholderKeys } from './pcnTemplateDiscovery.ts';
import { getPcnOperationalTemplateForKind } from './pcnOperationalTemplateCatalog.ts';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function date(value?: string): string {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value);
}

const PCN_USER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  luongxuanhung: 'Lương Xuân Hùng',
  tranhoangphuong: 'Trần Hoàng Phương',
  vuthitham: 'Vũ Thị Thắm',
};

function displayUser(value: unknown): string {
  const username = clean(value);
  return PCN_USER_DISPLAY_NAMES[username.toLowerCase()] || username;
}

function buildData(context: PcnDossierDocumentContext, overrides: Record<string, unknown> = {}): Record<string, string> {
  const lot = context.sampleHandover || context.sampleLots?.[0];
  const route = context.sampleHandover || context.sampleRoutes?.[0];
  const request = context.labRequest;
  const forms = context.operationalForms;
  const assignment = forms?.assignment;
  const plan = forms?.evaluationPlan;
  const inspection = forms?.fieldInspection;
  const taking = forms?.sampleTaking;
  const coding = forms?.sampleCoding;
  const report = forms?.evaluationReport;
  const commercial = forms?.commercial;
  const sampleCodes = context.sampleHandover?.sampleCodes?.join(', ') || '';
  const resolvedSampleCodes = coding?.sampleCodes.join(', ') || sampleCodes;
  const data: Record<string, string> = {
    so_dang_ky: context.dossierCode,
    ma_ho_so: context.dossierCode,
    ten_cong_ty: context.customerName,
    dia_chi_ct: context.customerAddress,
    ma_so_thue: context.customerTaxId,
    nguoi_lien_he: context.customerContactPerson,
    dien_thoai: context.customerPhone,
    loai_sp: context.productName,
    model: context.model,
    nhan_hieu: context.brand,
    nha_san_xuat: context.manufacturer,
    dia_chi_nha_san_xuat: context.manufacturerAddress,
    tieu_chuan: plan?.criteria || context.fieldNames.join('; '),
    field_code: context.fieldNames.join('; '),
    method_label: context.method.replace('METHOD_', 'Phương thức '),
    ma_lo: coding?.lotCode || (lot && 'lotCode' in lot ? clean(lot.lotCode) : ''),
    seal_stamp: coding?.sealCode || taking?.sealCode || sampleCodes,
    ma_mau: resolvedSampleCodes,
    so_luong_mau: taking?.sampleQuantity ? `${taking.sampleQuantity} ${taking.unit}`.trim() : lot && 'quantity' in lot ? clean(lot.quantity) : clean(context.quantity),
    so_pyc: request?.pycNumber || context.sampleHandover?.pycNumber || '',
    phong_thu_nghiem: request?.laboratoryName || context.sampleHandover?.labName || route?.labName || '',
    ma_phong_thu_nghiem: context.sampleHandover?.labCode || route?.labCode || request?.routeLabCode || '',
    ngay_lay_mau: date(taking?.sampledAt || context.evaluationAt || context.proposalReceivedAt),
    ngay_kiem_tra: date(inspection?.inspectedAt || taking?.sampledAt || context.evaluationAt),
    ngay_phan_cong: date(assignment?.assignedAt || context.evaluationAt),
    ngay_giao_mau: date(context.sampleHandover?.handoverAt || request?.handoverAt),
    ngay_kqtn: date(request?.receivedAt),
    so_bao_cao: report?.reportNumber || '',
    ket_qua: report?.conclusion || '',
    nguoi_danh_gia: displayUser(assignment?.evaluatorUsername || context.evaluatorUsername || context.ownerUsername),
    nguoi_tham_xet: displayUser(assignment?.reviewerUsername || context.reviewerUsername),
    nguoi_phe_duyet: '',
    nguoi_luu_tru: '',
    so_gcn: '',
    ngay_cap_gcn: '',
    so_quyet_dinh: '',
    ngay_qd: '',
    so_hop_dong: commercial?.contractNumber || '',
    ngay_hop_dong: date(commercial?.signedAt),
    phi_dich_vu: commercial?.serviceValue || '',
    dieu_khoan_thanh_toan: commercial?.paymentTerms || '',
    ngay_giao_khach: '',
    nguoi_nhan: context.sampleHandover?.receiverName || request?.laboratoryName || '',
    ngay_lap: date(report?.reportedAt || context.evaluationAt),
    ngay_lap_bao_cao: date(report?.reportedAt || context.evaluationAt),
    nam: '',
    dia_chi_kho: plan?.location || context.warehouseAddress || inspection?.location || taking?.location || '',
    ngay_bat_dau: date(plan?.plannedStartAt || context.evaluationAt || context.proposalReceivedAt),
    nguoi_giao: context.sampleHandover?.senderName || context.customerContactPerson || displayUser(context.ownerUsername),
    dia_diem_lap: plan?.location || context.warehouseAddress || inspection?.location || taking?.location || '',
    ngay_ket_thuc: date(plan?.plannedEndAt || context.targetDate),
    ket_luan: inspection?.conclusion || report?.conclusion || '',
    dia_chi_don_vi: '',
    don_vi_chung_nhan: 'TVCI',
    nguoi_dai_dien: commercial?.customerSigner || context.customerContactPerson,
    nguoi_ky_ben_a: commercial?.customerSigner || context.customerContactPerson,
    nguoi_ky_ben_b: commercial?.pcnSigner || '',
    ngay_bat_dau_hieu_luc: date(commercial?.signedAt),
    ngay_het_hieu_luc: '',
    ngay_ket_thuc_hop_dong: '',
    // Only operational request notes belong in an outbound PYC. Internal form
    // notes and QA annotations must not leak into the customer-facing sample
    // table or force the official-looking form onto an extra page.
    ghi_chu: [request?.handoverNote, request?.issueDescription, context.sampleHandover?.handoverNote].map(clean).filter(Boolean).join(' • '),
  };
  return Object.fromEntries(Object.entries({ ...data, ...overrides }).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value ?? '')]));
}

/**
 * Uses the checked-in PCN template pack for operational DOCX output. A missing
 * source asset deliberately returns undefined so the established renderer can
 * remain the safe fallback for kinds without an approved source form.
 */
export function renderPcnOperationalTemplateDocx(kind: PcnOperationalTemplateKind, context: PcnDossierDocumentContext, overrides: Record<string, unknown> = {}): Buffer | undefined {
  const template = getPcnOperationalTemplateForKind(kind);
  if (!template) return undefined;
  if (template.usage === 'REFERENCE_ONLY') return undefined;
  const templatePath = path.join(process.cwd(), 'templates', 'pcn', template.fileName);
  if (!existsSync(templatePath)) return undefined;
  const sourceBytes = readFileSync(templatePath);
  const keys = extractPcnTemplatePlaceholderKeys(sourceBytes);
  const values = buildData(context, overrides);
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(values, key)) values[key] = '';
  const zip = new PizZip(sourceBytes);
  const document = new Docxtemplater(zip, {
    delimiters: { start: '[[', end: ']]' },
    paragraphLoop: true,
    linebreaks: true,
  });
  document.render(values);
  return document.getZip().generate({ type: 'nodebuffer' });
}

// --- End of pcnOperationalTemplateGeneration.ts ---
