// Author: Gemini
// OS support: Web/Node
// Description: Utility for exporting application state into structured UTF-8 CSV files with Vietnamese accents support
import { TestRequest, HandoverDoc, CustomerRef, ProductRef } from '../types';
import { formatDateVN } from './formatter';

export const exportAllToCSV = (
  requests: TestRequest[],
  handoverDocs: HandoverDoc[],
  customers: CustomerRef[],
  products: ProductRef[],
  brands: string[]
) => {
  const dateStr = new Date().toISOString().split('T')[0];

  const escapeCSV = (str: any) => {
    if (str === undefined || str === null) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1. Export Requests
  const requestHeaders = [
    'Mã YCTN (PYC)',
    'Mã mẫu ATĐ',
    'Mã mẫu EMC 1',
    'Mã mẫu EMC 2',
    'Chủng loại',
    'Model',
    'Thương hiệu',
    'Số lượng',
    'Khách hàng',
    'Trạng thái YCTN',
    'Trạng thái mẫu',
    'KTV phụ trách',
    'Ngày nhận mẫu',
    'Ngày xếp lịch',
    'Ngày kết thúc',
    'Độ ưu tiên',
    'Ghi chú'
  ];

  const requestRows = (requests || []).map(r => [
    escapeCSV(r.requestCode || ''),
    escapeCSV(r.atdEncodeNumber || ''),
    escapeCSV(r.emcEncodeNumber || ''),
    escapeCSV(r.itdEncodeNumber || ''),
    escapeCSV(r.type || ''),
    escapeCSV(r.modelName || ''),
    escapeCSV(r.brand || ''),
    escapeCSV(r.quantity || 1),
    escapeCSV(r.customerName || ''),
    escapeCSV(r.status || ''),
    escapeCSV(r.sampleStatus || ''),
    escapeCSV(r.testerName || ''),
    escapeCSV(formatDateVN(r.receivedDate)),
    escapeCSV(formatDateVN(r.scheduledDate)),
    escapeCSV(formatDateVN(r.endDate)),
    escapeCSV(r.priority || 1),
    escapeCSV(r.note || '')
  ].join(','));

  const requestsCsv = '\uFEFF' + [requestHeaders.map(escapeCSV).join(','), ...requestRows].join('\n');
  downloadBlob(requestsCsv, `SaoLuu_DDTLab_YeuCau_${dateStr}.csv`);

  // 2. Export Customers
  if (customers && customers.length > 0) {
    const custHeaders = ['Mã KH', 'Tên khách hàng', 'Địa chỉ', 'Mã số thuế', 'Người liên hệ', 'Số điện thoại', 'Email'];
    const custRows = customers.map(c => [
      escapeCSV(c.customerCode || ''),
      escapeCSV(c.name || ''),
      escapeCSV(c.address || ''),
      escapeCSV(c.taxId || ''),
      escapeCSV(c.contactPerson || ''),
      escapeCSV(c.phone || ''),
      escapeCSV(c.email || '')
    ].join(','));
    const custCsv = '\uFEFF' + [custHeaders.map(escapeCSV).join(','), ...custRows].join('\n');
    downloadBlob(custCsv, `SaoLuu_DDTLab_KhachHang_${dateStr}.csv`);
  }

  // 3. Export Handover Docs
  if (handoverDocs && handoverDocs.length > 0) {
    const hHeaders = ['Số BB', 'Mã mẫu/PYC', 'Người giao', 'Người nhận', 'Ngày giao nhận', 'Khách hàng', 'Trạng thái'];
    const hRows = handoverDocs.map(h => [
      escapeCSV(h.docNumber || ''),
      escapeCSV((h.sampleIds || []).join('; ')),
      escapeCSV(h.representative || ''),
      escapeCSV(h.labRepresentative || ''),
      escapeCSV(formatDateVN(h.date)),
      escapeCSV(h.customerName || ''),
      escapeCSV(h.status || '')
    ].join(','));
    const hCsv = '\uFEFF' + [hHeaders.map(escapeCSV).join(','), ...hRows].join('\n');
    downloadBlob(hCsv, `SaoLuu_DDTLab_BienBan_${dateStr}.csv`);
  }
};

// --- End of exportCsv.ts ---
