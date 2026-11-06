'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, ClipboardCheck, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePgdStore } from '@/store-pgd';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import type { PgdProductGroup, PgdIntakeChannel } from '@/utils/pgdDomain';

interface CreatePgdRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRODUCT_GROUP_OPTIONS: { value: PgdProductGroup; label: string }[] = [
  { value: 'STEEL_METAL', label: 'Thép & Kim loại' },
  { value: 'MACHINERY_LINE', label: 'Máy móc & Dây chuyền' },
  { value: 'COAL', label: 'Than & Khoáng sản' },
  { value: 'OTHER', label: 'Hàng hóa & Thiết bị khác' },
];

export function CreatePgdRequestDialog({ open, onOpenChange }: CreatePgdRequestDialogProps) {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pgd = usePgdStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');

  const [productGroup, setProductGroup] = useState<PgdProductGroup>('STEEL_METAL');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('tấn');
  const [inspectionScope, setInspectionScope] = useState('Kiểm tra chất lượng và quy cách');
  const [inspectionLocation, setInspectionLocation] = useState('');
  const [intakeChannel, setIntakeChannel] = useState<PgdIntakeChannel>('DIRECT');

  // Quick fill from existing customers if any
  const handleSelectExistingCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custIndex = e.target.value;
    if (custIndex === '') return;
    const customer = pgd.customers[Number(custIndex)];
    if (customer) {
      setCustomerName(customer.name || '');
      setCustomerTaxId(customer.taxId || '');
      setCustomerAddress(customer.address || '');
      setCustomerPhone(customer.phone || '');
      setContactPerson(customer.contactPerson || '');
      if (customer.address && !inspectionLocation) {
        setInspectionLocation(customer.address);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerAddress.trim()) {
      setError('Vui lòng điền tên và địa chỉ của đơn vị yêu cầu / khách hàng.');
      return;
    }
    if (!productName.trim()) {
      setError('Vui lòng nhập tên hàng hóa / thiết bị cần giám định.');
      return;
    }
    if (!inspectionLocation.trim()) {
      setError('Vui lòng nhập địa điểm giám định.');
      return;
    }

    try {
      setLoading(true);
      const now = new Date().toISOString();
      const id = `pgd-${Date.now()}`;
      const defaultCatalogItem = pgd.catalog.find((item) => item.productGroup === productGroup) || pgd.catalog[0];

      const standards = defaultCatalogItem?.defaultStandards?.length
        ? defaultCatalogItem.defaultStandards
        : productGroup === 'STEEL_METAL'
          ? ['QCVN 20:2019/BKHCN và Sửa đổi 1:2021', 'JIS']
          : ['Tiêu chuẩn kỹ thuật hợp đồng'];

      const created = await pgd.createRequest({
        id,
        intakeChannel,
        productGroup,
        catalogItemId: defaultCatalogItem?.id || 'pgd-cat-default',
        standards,
        productName: productName.trim(),
        quantity: Math.max(1, Number(quantity) || 1),
        unit: unit.trim() || 'tấn',
        inspectionScope: inspectionScope.trim() || 'Giám định kỹ thuật theo hợp đồng',
        inspectionLocation: inspectionLocation.trim(),
        requester: {
          name: customerName.trim(),
          address: customerAddress.trim(),
          contactPerson: contactPerson.trim() || 'Người đại diện',
          phone: customerPhone.trim() || 'Chưa cập nhật',
        },
        customerSnapshot: {
          name: customerName.trim(),
          address: customerAddress.trim(),
          taxId: customerTaxId.trim() || 'Chưa cập nhật',
          phone: customerPhone.trim() || 'Chưa cập nhật',
        },
        sampleDrafts: [
          {
            sampleCode: `M-${Date.now().toString().slice(-4)}`,
            sampleTypeLabel: `${productName.trim()} - Mẫu đại diện`,
            quantity: 1,
            unit: 'bộ',
            disposition: 'LAB',
          },
        ],
      });

      onOpenChange(false);
      if (created?.id) {
        router.push(`/pgd/dossiers/${created.id}`);
      } else {
        router.push('/pgd');
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo phiếu yêu cầu giám định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader className="border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Tạo Phiếu yêu cầu Giám định (PGD)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Tiếp nhận PYC giám định kỹ thuật và kiểm tra nhà nước hàng hóa
              </DialogDescription>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Tài liệu B1 có thể bổ sung sau; không cần đính kèm tệp khi tạo Phiếu yêu cầu.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick select existing customer */}
          {pgd.customers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Chọn nhanh khách hàng đã lưu (tùy chọn)
              </label>
              <select
                onChange={handleSelectExistingCustomer}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Chọn khách hàng sẵn có --</option>
                {pgd.customers.map((c, idx) => {
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

          {/* Customer / Requester Section */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Đơn vị yêu cầu / Khách hàng</span>
              <span className="text-rose-500">*</span>
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Tên doanh nghiệp / Đơn vị yêu cầu *"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Mã số thuế"
                  value={customerTaxId}
                  onChange={(e) => setCustomerTaxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Số điện thoại"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Địa chỉ doanh nghiệp *"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Người liên hệ đại diện"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Inspection details */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Nội dung hàng hóa & Giám định</span>
              <span className="text-rose-500">*</span>
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nhóm sản phẩm
                </label>
                <select
                  value={productGroup}
                  onChange={(e) => setProductGroup(e.target.value as PgdProductGroup)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {PRODUCT_GROUP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kênh tiếp nhận
                </label>
                <select
                  value={intakeChannel}
                  onChange={(e) => setIntakeChannel(e.target.value as PgdIntakeChannel)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="DIRECT">Trực tiếp</option>
                  <option value="EMAIL">Email</option>
                  <option value="PORTAL">Cổng trực tuyến</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Tên hàng hóa / Hạng mục giám định *"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <input
                  type="number"
                  placeholder="Số lượng"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Đơn vị tính (tấn, kg, lô, cái...)"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Địa điểm giám định / Cảng / Kho *"
                  required
                  value={inspectionLocation}
                  onChange={(e) => setInspectionLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Phạm vi giám định (quy cách, chất lượng, số lượng...)"
                  value={inspectionScope}
                  onChange={(e) => setInspectionScope(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
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
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                  Tạo Phiếu yêu cầu PGD
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
