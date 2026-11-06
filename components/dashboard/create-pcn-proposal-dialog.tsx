'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Award, X, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePcnStore } from '@/store-pcn';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { formatPcnProposalCode, formatPcnDossierCode } from '@/utils/pcnIdentifier';
import type { CertificationProposal, PcnCertificationFieldCode } from '@/types';
import { validateIntakeClassification } from '@/utils/pgdcnIntakeCatalog';
import { matchPcnPublishedWorkflowTemplates } from '@/utils/pgdcnIntakeTemplateMatching';

const PRODUCT_GROUP_OPTIONS: { value: NonNullable<CertificationProposal['productGroup']>; label: string }[] = [
  { value: 'ELECTRICAL_ELECTRONIC', label: 'Điện - Điện tử' },
  { value: 'METAL_MATERIALS', label: 'Kim loại - Vật liệu' },
  { value: 'CONSTRUCTION_MATERIALS', label: 'Vật liệu xây dựng' },
  { value: 'MANAGEMENT_SYSTEM', label: 'Hệ thống quản lý' },
  { value: 'OTHER', label: 'Khác' },
];

interface CreatePcnProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePcnProposalDialog({ open, onOpenChange }: CreatePcnProposalDialogProps) {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('');
  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [productGroup, setProductGroup] = useState<NonNullable<CertificationProposal['productGroup']>>('ELECTRICAL_ELECTRONIC');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [standards, setStandards] = useState('QCVN 04:2009/BKHCN');
  const [workflowTemplateId, setWorkflowTemplateId] = useState('');
  const [selectedField, setSelectedField] = useState<PcnCertificationFieldCode>('QC4');
  const [channel, setChannel] = useState<'DIRECT' | 'EMAIL' | 'ONLINE_ZALO' | 'OTHER'>('DIRECT');

  const intakeClassification = validateIntakeClassification({
    domain: 'PCN', productGroup, standard: standards, method: 'METHOD_1', fieldCode: selectedField,
  });
  const workflowCandidates = intakeClassification.confirmationStatus === 'CONFIRMED'
    ? matchPcnPublishedWorkflowTemplates(pcn.workflowTemplates, { fieldCodes: [selectedField], method: 'METHOD_1' })
    : [];
  const selectedWorkflowTemplate = workflowCandidates.find((template) => template.id === workflowTemplateId)
    || (workflowCandidates.length === 1 ? workflowCandidates[0] : undefined);

  // Quick fill from existing customer
  const handleSelectExistingCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custIndex = e.target.value;
    if (custIndex === '') return;
    const customer = pcn.customers[Number(custIndex)];
    if (customer) {
      setCustomerName(customer.name || '');
      setCustomerTaxId(customer.taxId || '');
      setCustomerAddress(customer.address || '');
      setCustomerContact(customer.contactPerson || '');
      if (customer.address && !warehouseAddress) {
        setWarehouseAddress(customer.address);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerAddress.trim() || (!customerContact.trim() && !customerTaxId.trim())) {
      setError('Vui lòng điền tên, địa chỉ và MST hoặc người liên hệ của khách hàng.');
      return;
    }
    if (!productName.trim() || !productType.trim() || !model.trim() || !brand.trim() || !specifications.trim() || !manufacturer.trim()) {
      setError('Vui lòng điền đầy đủ thông tin kỹ thuật sản phẩm (Tên, Kiểu loại, Model, Nhãn hiệu, Thông số, Nhà SX).');
      return;
    }
    if (!warehouseAddress.trim()) {
      setError('Vui lòng nhập địa chỉ kho hoặc vị trí lấy mẫu.');
      return;
    }
    if (workflowCandidates.length > 1 && !selectedWorkflowTemplate) {
      setError('Có nhiều bộ hồ sơ mẫu phù hợp. Hãy chọn một mẫu trước khi tạo Đề nghị.');
      return;
    }

    try {
      setLoading(true);
      const now = new Date().toISOString();
      const id = `pcn-${Date.now()}`;
      const randomSerial = Math.floor(Math.random() * 80) + 10;
      const proposalCode = formatPcnProposalCode(randomSerial, now);
      const dossierCode = formatPcnDossierCode(proposalCode, now);

      const proposal: CertificationProposal = {
        id,
        proposalCode,
        channel,
        status: 'RECEIVED',
        fieldCodes: [selectedField],
        receivedAt: now,
        registrationNumber: registrationNumber.trim(),
        registrationDate,
        productGroup,
        standards: standards.split(',').map((standard) => standard.trim()).filter(Boolean),
        customerSnapshot: {
          name: customerName.trim(),
          address: customerAddress.trim(),
          taxId: customerTaxId.trim(),
          contactPerson: customerContact.trim(),
        },
        warehouseAddress: warehouseAddress.trim(),
        productName: productName.trim(),
        productType: productType.trim(),
        model: model.trim(),
        brand: brand.trim(),
        specifications: specifications.trim(),
        manufacturer: manufacturer.trim(),
        quantity: Math.max(1, Number(quantity) || 1),
      };

      await pcn.addProposal(proposal, selectedWorkflowTemplate ? { id: selectedWorkflowTemplate.id, version: selectedWorkflowTemplate.version } : undefined);
      onOpenChange(false);
      
      // Navigate to PCN queue or detail
      const createdDossier = pcn.dossiers.find((d) => d.proposalId === id);
      if (createdDossier) {
        router.push(`/pcn/dossiers/${createdDossier.id}`);
      } else {
        router.push('/pcn');
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo đề nghị chứng nhận');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader className="border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Tạo Đề nghị Chứng nhận (PCN)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Tiếp nhận hồ sơ mới và khởi tạo lưu trình 7 bước chứng nhận sản phẩm
              </DialogDescription>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Tài liệu B1 có thể bổ sung sau; không cần đính kèm tệp khi tạo Đề nghị.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick select existing customer */}
          {pcn.customers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Chọn nhanh khách hàng đã lưu (tùy chọn)
              </label>
              <select
                onChange={handleSelectExistingCustomer}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Chọn khách hàng sẵn có --</option>
                {pcn.customers.map((c, idx) => {
                  const key = `${c.customerCode || c.taxId || 'cust'}-${idx}-${c.name}`;
                  return (
                    <option key={key} value={idx}>
                      {c.name} {c.customerCode ? `[${c.customerCode}]` : ''} {c.taxId ? `(${c.taxId})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Section: Customer info */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="pcn-create-registration-number">Số đăng ký *</label>
                <input id="pcn-create-registration-number" name="registrationNumber" required value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="pcn-create-registration-date">Ngày đăng ký *</label>
                <input id="pcn-create-registration-date" name="registrationDate" type="date" required value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Thông tin Khách hàng / Đơn vị đề nghị</span>
              <span className="text-rose-500">*</span>
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Tên doanh nghiệp / Khách hàng *"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Mã số thuế"
                  value={customerTaxId}
                  onChange={(e) => setCustomerTaxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Người liên hệ / Đại diện"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Địa chỉ trụ sở chính *"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Địa chỉ kho / Nơi khảo sát, lấy mẫu *"
                  required
                  value={warehouseAddress}
                  onChange={(e) => setWarehouseAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Product info */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="pcn-create-product-group">Nhóm sản phẩm *</label>
                <select id="pcn-create-product-group" name="productGroup" required value={productGroup} onChange={(e) => setProductGroup(e.target.value as NonNullable<CertificationProposal['productGroup']>)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none">
                  {PRODUCT_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="pcn-create-standards">Tiêu chuẩn / quy chuẩn *</label>
                <input id="pcn-create-standards" name="standards" required value={standards} onChange={(e) => setStandards(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Thông tin Sản phẩm & Lĩnh vực chứng nhận</span>
              <span className="text-rose-500">*</span>
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Tên sản phẩm, hàng hóa *"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Kiểu / Loại sản phẩm *"
                  required
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Model / Mã hiệu *"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Nhãn hiệu / Brand *"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Nhà sản xuất *"
                  required
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Thông số kỹ thuật chính *"
                  required
                  value={specifications}
                  onChange={(e) => setSpecifications(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Số lượng mẫu
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Lĩnh vực chứng nhận
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedField('QC4'); setStandards('QCVN 04:2009/BKHCN'); }}
                    className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      selectedField === 'QC4'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    QC4 (VLXD)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedField('QC9'); setStandards('QCVN 09:2012/BKHCN'); }}
                    className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      selectedField === 'QC9'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    QC9 (Điện - Điện tử)
                  </button>
                </div>
              </div>
            </div>
            {workflowCandidates.length > 1 && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="pcn-create-workflow-template">Bộ hồ sơ quy trình *</label>
                <select id="pcn-create-workflow-template" required value={workflowTemplateId} onChange={(e) => setWorkflowTemplateId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none">
                  <option value="">Chọn bộ hồ sơ phù hợp</option>
                  {workflowCandidates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Dialog footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                  Tạo Đề nghị PCN
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
