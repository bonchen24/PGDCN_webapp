// Author: Gemini
// OS support: Web/Node
// Description: Custom system management views for Brands, Customers, Products, and System Settings with inline table editing

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Pencil, Trash2, Save, Users, UserPlus, Tag, Package, Settings, 
  Building, Download, Upload, UploadCloud, Loader2, AlertCircle, Edit2, ShieldAlert, X, Check, ShieldCheck, Lock, Activity
} from 'lucide-react';
import { useStore } from '../store';
import { AppSettings, DayConfig } from '../types';
import { toast } from 'sonner';
import { fetchCollection, deleteDocFromPostgres } from '../utils/firebase';
import { formatDateVN, removeAccents } from '../utils/formatter';
import { buildBackupPayload } from '../utils/notificationBackup';
import { activityLogClient } from '../utils/activityLogApi';
import {
  canEditOperationalSettings,
  canViewSystemSettings,
  isAdminOnlyAction as resolveAdminOnlyAction,
  isSystemSettingsAdmin as resolveSystemSettingsAdmin,
  isSystemSettingsManager as resolveSystemSettingsManager,
} from '../utils/systemSettingsPolicy';
import { AdminBackupReminder } from './AdminBackupReminder';
import { normalizeSystemUserRole, withSystemUserRoleAliases } from '../utils/systemUserRole';

export const BrandsManagementView = () => {
  const { brands, addBrand, updateBrand, deleteBrand } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleStartEdit = (b: string) => {
    setEditingBrand(b);
    setEditBrandName(b);
  };

  const handleSaveEdit = (original: string) => {
    const clean = editBrandName.trim();
    if (!clean) {
      toast.error('Vui lòng nhập tên nhãn hiệu!');
      return;
    }
    updateBrand(original, clean);
    toast.success('Cập nhật nhãn hiệu thành công!');
    setEditingBrand(null);
  };

  const handleAddBrand = () => {
    const clean = newBrandName.trim();
    if (!clean) {
      toast.error('Vui lòng nhập tên nhãn hiệu!');
      return;
    }
    const exists = brands.some(b => String(b).toLowerCase().trim() === clean.toLowerCase());
    if (exists) {
      toast.error('Nhãn hiệu đã tồn tại!');
      return;
    }
    addBrand(clean);
    toast.success('Thêm nhãn hiệu thành công!');
    setNewBrandName('');
  };

  const handleDelete = async (name: string) => {
    await deleteBrand(name);
    toast.success('Đã xóa nhãn hiệu thành công!');
    setConfirmDelete(null);
  };

  const q = removeAccents(searchQuery).toLowerCase();
  const filtered = brands.filter(b => 
    removeAccents(String(b)).toLowerCase().includes(q)
  );

  return (
    <div className="p-3 md:p-4 space-y-4 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/50 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Tag className="text-rose-500" size={20} /> Quản lý Nhãn hiệu (Brands)
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Danh sách các nhãn hiệu thiết bị sử dụng trong hệ thống</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-hidden focus:border-rose-500 font-medium shadow-2xs"
              placeholder="Tìm kiếm nhãn hiệu..."
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white p-1 border border-slate-200 rounded-lg max-w-md w-full sm:w-auto shadow-2xs">
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
              className="flex-1 px-2.5 py-1 text-[11px] outline-none font-medium text-slate-800 min-w-[150px]"
              placeholder="Nhập nhãn hiệu mới..."
            />
            <button
              onClick={handleAddBrand}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus size={12} /> Thêm nhanh
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-[11px] text-slate-400 italic shadow-2xs">
            Không tìm thấy nhãn hiệu nào phù hợp.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((b, idx) => {
              const isEditing = editingBrand === b;
              const isConfirming = confirmDelete === b;
              return (
                <div 
                  key={b} 
                  className={`bg-white rounded-lg border p-3 transition-all flex flex-col justify-between min-h-[90px] shadow-2xs relative group hover:border-rose-500/30 hover:shadow-xs ${isEditing ? 'border-rose-500 ring-1 ring-rose-500/10' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                      STT {idx + 1}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {!isEditing && !isConfirming && (
                        <>
                          <button
                            onClick={() => handleStartEdit(b)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                            title="Sửa"
                          >
                            <Edit2 size={10} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(b)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 size={10} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center my-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editBrandName}
                        onChange={(e) => setEditBrandName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(b)}
                        className="w-full px-2 py-1 text-xs border border-rose-500 rounded-md outline-hidden font-bold text-slate-800"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold text-slate-800 text-[11px] tracking-tight break-all line-clamp-2">
                        {b}
                      </span>
                    )}
                  </div>

                  {(isEditing || isConfirming) && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-end gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(b)}
                            className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-all cursor-pointer"
                            title="Lưu"
                          >
                            <Check size={10} />
                          </button>
                          <button
                            onClick={() => setEditingBrand(null)}
                            className="p-1 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                            title="Hủy"
                          >
                            <X size={10} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-md border border-red-100 w-full justify-between">
                          <span className="text-[9px] text-red-600 font-bold pl-0.5">Xóa?</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(b)}
                              className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded hover:bg-red-600 cursor-pointer"
                            >
                              Có
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[8px] font-bold rounded hover:bg-slate-300 cursor-pointer"
                            >
                              Không
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const CustomersManagementView = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    name: '',
    customerCode: '',
    address: '',
    taxId: '',
    phone: '',
    email: '',
    contactPerson: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    customerCode: '',
    address: '',
    taxId: '',
    phone: '',
    email: '',
    contactPerson: ''
  });

  const handleStartEdit = (c: any) => {
    setEditingCode(c.customerCode || c.name);
    setEditForm({
      name: c.name || '',
      customerCode: c.customerCode || '',
      address: c.address || '',
      taxId: c.taxId || '',
      phone: c.phone || '',
      email: c.email || '',
      contactPerson: c.contactPerson || ''
    });
  };

  const handleSaveEdit = () => {
    const cleanName = editForm.name.trim();
    const cleanCode = editForm.customerCode.trim();
    if (!cleanName) {
      toast.error('Vui lòng nhập tên khách hàng!');
      return;
    }
    updateCustomer(editingCode!, {
      name: cleanName,
      customerCode: cleanCode,
      address: editForm.address.trim(),
      taxId: editForm.taxId.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      contactPerson: editForm.contactPerson.trim()
    });
    toast.success('Đã cập nhật thông tin khách hàng thành công!');
    setEditingCode(null);
  };

  const handleSaveAdd = () => {
    const cleanName = addForm.name.trim();
    const cleanCode = addForm.customerCode.trim();
    if (!cleanName) {
      toast.error('Vui lòng nhập tên khách hàng!');
      return;
    }
    const exists = customers.some(c => (c.customerCode || c.name).toLowerCase().trim() === (cleanCode || cleanName).toLowerCase());
    if (exists) {
      toast.error('Khách hàng này đã tồn tại!');
      return;
    }
    addCustomer({
      name: cleanName,
      customerCode: cleanCode,
      address: addForm.address.trim(),
      taxId: addForm.taxId.trim(),
      phone: addForm.phone.trim(),
      email: addForm.email.trim(),
      contactPerson: addForm.contactPerson.trim()
    });
    toast.success('Đã thêm khách hàng mới thành công!');
    setIsAdding(false);
    setAddForm({
      name: '',
      customerCode: '',
      address: '',
      taxId: '',
      phone: '',
      email: '',
      contactPerson: ''
    });
  };

  const handleDelete = async (key: string) => {
    await deleteCustomer(key);
    toast.success('Đã xóa khách hàng thành công!');
    setConfirmDelete(null);
  };

  const q = removeAccents(searchQuery).toLowerCase();
  const filtered = customers.filter(c => {
    const nameMatch = removeAccents(String(c.name || '')).toLowerCase().includes(q);
    const addrMatch = removeAccents(String(c.address || '')).toLowerCase().includes(q);
    const taxMatch = removeAccents(String(c.taxId || '')).toLowerCase().includes(q);
    const codeMatch = removeAccents(String(c.customerCode || '')).toLowerCase().includes(q);
    return nameMatch || addrMatch || taxMatch || codeMatch;
  });

  return (
    <div className="p-3 md:p-4 space-y-4 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/50 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Building className="text-indigo-500" size={20} /> Quản lý Khách hàng
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Danh sách đối tác và khách hàng gửi mẫu thử nghiệm</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={14} /> Thêm khách hàng
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="max-w-xs relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium shadow-2xs"
            placeholder="Tìm kiếm theo mã, tên, địa chỉ, MST..."
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3 pl-4 w-28">Mã KH</th>
                  <th className="p-3 w-56">Tên doanh nghiệp</th>
                  <th className="p-3 w-56">Địa chỉ & MST</th>
                  <th className="p-3">Thông tin liên hệ</th>
                  <th className="p-3 text-right pr-4 w-32">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isAdding && (
                  <tr className="bg-indigo-50/30">
                    <td className="p-2.5 pl-4">
                      <input
                        type="text"
                        value={addForm.customerCode}
                        onChange={(e) => setAddForm({ ...addForm, customerCode: e.target.value })}
                        className="w-full px-2 py-1.5 border border-indigo-300 rounded-md text-xs outline-none font-bold"
                        placeholder="MÃ KH"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        className="w-full px-2 py-1.5 border border-indigo-300 rounded-md text-xs outline-none font-bold"
                        placeholder="Tên doanh nghiệp"
                      />
                    </td>
                    <td className="p-2.5 space-y-1">
                      <input
                        type="text"
                        value={addForm.address}
                        onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                        className="w-full px-2 py-1.5 border border-indigo-200 rounded-md text-xs outline-none"
                        placeholder="Địa chỉ"
                      />
                      <input
                        type="text"
                        value={addForm.taxId}
                        onChange={(e) => setAddForm({ ...addForm, taxId: e.target.value })}
                        className="w-full px-2 py-1.5 border border-indigo-200 rounded-md text-xs outline-none font-mono"
                        placeholder="Mã số thuế"
                      />
                    </td>
                    <td className="p-2.5 space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="text"
                          value={addForm.phone}
                          onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                          className="w-full px-2 py-1.5 border border-indigo-200 rounded-md text-xs outline-none font-mono"
                          placeholder="SĐT"
                        />
                        <input
                          type="email"
                          value={addForm.email}
                          onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                          className="w-full px-2 py-1.5 border border-indigo-200 rounded-md text-xs outline-none"
                          placeholder="Email"
                        />
                      </div>
                      <input
                        type="text"
                        value={addForm.contactPerson}
                        onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                        className="w-full px-2 py-1.5 border border-indigo-200 rounded-md text-xs outline-none"
                        placeholder="Người liên hệ"
                      />
                    </td>
                    <td className="p-2.5 text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={handleSaveAdd}
                          className="p-1 bg-indigo-600 text-white hover:bg-indigo-500 rounded-md transition-all"
                          title="Lưu"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setIsAdding(false)}
                          className="p-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-md transition-all"
                          title="Hủy"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.length === 0 && !isAdding ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[11px] text-slate-400 italic">
                      Không tìm thấy khách hàng nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const cKey = c.customerCode || c.name;
                    const isEditing = editingCode === cKey;

                    return (
                      <tr key={cKey} className={`hover:bg-slate-50/55 transition-colors ${isEditing ? 'bg-indigo-50/20' : ''}`}>
                        <td className="p-2.5 pl-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.customerCode}
                              disabled
                              className="w-full px-2 py-1 border border-indigo-300 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-500"
                            />
                          ) : (
                            <span className="bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/50 font-mono font-bold text-indigo-600 text-[10px]">
                              {c.customerCode || 'N/A'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1 border border-indigo-300 rounded-md text-xs font-bold"
                            />
                          ) : (
                            <div className="font-bold text-slate-800 text-xs">{c.name}</div>
                          )}
                        </td>
                        <td className="p-2.5 space-y-1">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editForm.address}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                className="w-full px-2 py-1 border border-indigo-200 rounded-md text-xs"
                                placeholder="Địa chỉ"
                              />
                              <input
                                type="text"
                                value={editForm.taxId}
                                onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                                className="w-full px-2 py-1 border border-indigo-200 rounded-md text-xs font-mono"
                                placeholder="MST"
                              />
                            </>
                          ) : (
                            <>
                              {c.address && (
                                <div className="text-[10px] text-slate-500 flex items-start gap-1">
                                  <span className="font-semibold text-slate-400 shrink-0">ĐC:</span>
                                  <span className="line-clamp-2">{c.address}</span>
                                </div>
                              )}
                              {c.taxId && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  <span className="font-semibold text-slate-400">MST:</span> {c.taxId}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <div className="space-y-1">
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="text"
                                  value={editForm.phone}
                                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                  className="w-full px-2 py-1 border border-indigo-200 rounded-md text-xs font-mono"
                                  placeholder="SĐT"
                                />
                                <input
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                  className="w-full px-2 py-1 border border-indigo-200 rounded-md text-xs"
                                  placeholder="Email"
                                />
                              </div>
                              <input
                                type="text"
                                value={editForm.contactPerson}
                                onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                                className="w-full px-2 py-1 border border-indigo-200 rounded-md text-xs"
                                placeholder="Người liên hệ"
                              />
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {c.phone && (
                                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                  <span className="font-semibold text-slate-400">SĐT:</span> <span className="font-mono">{c.phone}</span>
                                </div>
                              )}
                              {c.email && (
                                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                  <span className="font-semibold text-slate-400">Email:</span> <span className="font-medium text-slate-700">{c.email}</span>
                                </div>
                              )}
                              {c.contactPerson && (
                                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                  <span className="font-semibold text-slate-400">LH:</span> <span className="font-bold text-slate-700">{c.contactPerson}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-all"
                                  title="Lưu"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingCode(null)}
                                  className="p-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-md transition-all"
                                  title="Hủy"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : confirmDelete === cKey ? (
                              <div className="flex items-center gap-1 bg-red-50 p-1 rounded-md border border-red-100">
                                <span className="text-[9px] text-red-600 font-bold px-1">Xóa?</span>
                                <button
                                  onClick={() => handleDelete(cKey)}
                                  className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded hover:bg-red-600 cursor-pointer"
                                >
                                  Có
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[8px] font-bold rounded hover:bg-slate-300 cursor-pointer"
                                >
                                  Không
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(c)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                                  title="Sửa khách hàng"
                                >
                                  <Edit2 size={10} />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(cKey)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                  title="Xóa khách hàng"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProductRow = ({ product, confirmDelete, setConfirmDelete, onDelete, onUpdate }: {
  product: any;
  confirmDelete: string | null;
  setConfirmDelete: (name: string | null) => void;
  onDelete: (name: string) => void;
  onUpdate: (oldName: string, updates: any) => void;
}) => {
  const [name, setName] = useState(product.name || '');
  const [testTimeEMC, setTestTimeEMC] = useState<string | number>(product.testTimeEMC !== undefined ? product.testTimeEMC : 480);
  const [testTimeATD, setTestTimeATD] = useState<string | number>(product.testTimeATD !== undefined ? product.testTimeATD : 60);

  useEffect(() => {
    setName(product.name || '');
    setTestTimeEMC(product.testTimeEMC !== undefined ? product.testTimeEMC : 480);
    setTestTimeATD(product.testTimeATD !== undefined ? product.testTimeATD : 60);
  }, [product]);

  const handleNameBlur = () => {
    const clean = name.trim();
    if (!clean) {
      setName(product.name || '');
      return;
    }
    if (clean !== product.name) {
      onUpdate(product.name, { name: clean });
    }
  };

  const handleEMCBlur = () => {
    const val = Number(testTimeEMC);
    if (isNaN(val) || val < 0) {
      setTestTimeEMC(product.testTimeEMC !== undefined ? product.testTimeEMC : 480);
      return;
    }
    if (val !== product.testTimeEMC) {
      onUpdate(product.name, { testTimeEMC: val });
    }
  };

  const handleATDBlur = () => {
    const val = Number(testTimeATD);
    if (isNaN(val) || val < 0) {
      setTestTimeATD(product.testTimeATD !== undefined ? product.testTimeATD : 60);
      return;
    }
    if (val !== product.testTimeATD) {
      onUpdate(product.name, { testTimeATD: val });
    }
  };

  return (
    <tr className="hover:bg-amber-50/10 transition-colors border-b border-slate-100">
      <td className="p-1 pl-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/20 rounded-md px-2 py-1.5 font-bold text-slate-800 text-xs focus:outline-hidden transition-all"
        />
      </td>
      <td className="p-1">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={testTimeEMC}
            onChange={(e) => setTestTimeEMC(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={handleEMCBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-24 bg-transparent border border-transparent hover:border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/20 rounded-md px-2 py-1.5 font-mono text-[11px] font-bold text-slate-800 focus:outline-hidden transition-all"
          />
          <span className="text-[10px] text-slate-400 font-medium select-none">phút</span>
        </div>
      </td>
      <td className="p-1">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={testTimeATD}
            onChange={(e) => setTestTimeATD(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={handleATDBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-24 bg-transparent border border-transparent hover:border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/20 rounded-md px-2 py-1.5 font-mono text-[11px] font-bold text-slate-800 focus:outline-hidden transition-all"
          />
          <span className="text-[10px] text-slate-400 font-medium select-none">phút</span>
        </div>
      </td>
      <td className="p-1 text-right pr-4">
        <div className="flex items-center justify-end gap-1">
          {confirmDelete === product.name ? (
            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-md border border-red-100">
              <span className="text-[9px] text-red-600 font-bold px-1">Xóa?</span>
              <button
                onClick={() => onDelete(product.name)}
                className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded hover:bg-red-600 cursor-pointer"
              >
                Có
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[8px] font-bold rounded hover:bg-slate-300 cursor-pointer"
              >
                Không
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(product.name)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export const ProductsManagementView = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    name: '',
    testTimeEMC: 480,
    testTimeATD: 60
  });

  const handleSaveAdd = () => {
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      toast.error('Vui lòng nhập tên loại sản phẩm!');
      return;
    }
    const exists = products.some(p => String(p.name).toLowerCase().trim() === cleanName.toLowerCase());
    if (exists) {
      toast.error('Loại sản phẩm này đã tồn tại!');
      return;
    }
    addProduct({
      name: cleanName,
      testTimeEMC: Number(addForm.testTimeEMC),
      testTimeATD: Number(addForm.testTimeATD)
    });
    toast.success('Đã thêm loại sản phẩm thành công!');
    setIsAdding(false);
    setAddForm({
      name: '',
      testTimeEMC: 480,
      testTimeATD: 60
    });
  };

  const handleDelete = async (name: string) => {
    await deleteProduct(name);
    toast.success('Đã xóa loại sản phẩm thành công!');
    setConfirmDelete(null);
  };

  const q = removeAccents(searchQuery).toLowerCase();
  const filtered = products.filter(p => 
    removeAccents(String(p.name || '')).toLowerCase().includes(q)
  );

  return (
    <div className="p-3 md:p-4 space-y-4 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/50 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="text-amber-500" size={20} /> Quản lý sản phẩm (Product Types)
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            Gán thời gian thử nghiệm tiêu chuẩn (theo phút) cho các loại sản phẩm sử dụng khi lập lịch
          </p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={14} /> Thêm sản phẩm
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="max-w-xs relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-hidden focus:border-amber-500 font-medium shadow-2xs"
            placeholder="Tìm kiếm loại sản phẩm..."
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3 pl-4">Tên loại sản phẩm</th>
                  <th className="p-3 w-60">Thời gian thử nghiệm EMC (phút)</th>
                  <th className="p-3 w-60">Thời gian thử nghiệm ATĐ (phút)</th>
                  <th className="p-3 text-right pr-4 w-40">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isAdding && (
                  <tr className="bg-amber-50/30">
                    <td className="p-2.5 pl-4">
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        className="w-full px-2 py-1.5 border border-amber-300 rounded-md text-xs outline-none font-bold"
                        placeholder="Tên loại sản phẩm"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        min="0"
                        value={addForm.testTimeEMC}
                        onChange={(e) => setAddForm({ ...addForm, testTimeEMC: Number(e.target.value) })}
                        className="w-full max-w-[120px] px-2 py-1.5 border border-amber-200 rounded-md text-xs outline-none font-mono font-bold"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        min="0"
                        value={addForm.testTimeATD}
                        onChange={(e) => setAddForm({ ...addForm, testTimeATD: Number(e.target.value) })}
                        className="w-full max-w-[120px] px-2 py-1.5 border border-amber-200 rounded-md text-xs outline-none font-mono font-bold"
                      />
                    </td>
                    <td className="p-2.5 text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={handleSaveAdd}
                          className="p-1 bg-amber-600 text-white hover:bg-amber-500 rounded-md transition-all"
                          title="Lưu"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setIsAdding(false)}
                          className="p-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-md transition-all"
                          title="Hủy"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.length === 0 && !isAdding ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[11px] text-slate-400 italic">
                      Không tìm thấy loại sản phẩm nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <ProductRow
                      key={p.name}
                      product={p}
                      confirmDelete={confirmDelete}
                      setConfirmDelete={setConfirmDelete}
                      onDelete={handleDelete}
                      onUpdate={updateProduct}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SystemSettingsView = () => {
  const { settings, updateSettings, systemUsers, addUser, updateUser, deleteUser, currentUser, testers, updateUserPreferences, setSyncModalOpen, runDetailedSyncDiagnostic } = useStore();
  const isSystemSettingsAdmin = resolveSystemSettingsAdmin(currentUser);
  const isSystemSettingsManager = resolveSystemSettingsManager(currentUser);
  const canViewSettings = canViewSystemSettings(currentUser);
  const canEditOperational = canEditOperationalSettings(currentUser);
  const isAdminOnlyAction = resolveAdminOnlyAction(currentUser);

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings || {
    workOnSaturday: true,
    workOnSunday: false,
    cloudSyncEnabled: true
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [restoreConfirmData, setRestoreConfirmData] = useState<any>(null);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setLoadingRequests(true);
      fetchCollection("passwordResetRequests")
        .then(data => {
          const sorted = (data || []).sort((a: any, b: any) => {
            return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
          });
          setResetRequests(sorted);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingRequests(false));
    }
  }, [currentUser]);

  const handleDeleteRequest = async (id: string) => {
    if (!isAdminOnlyAction) {
      toast.error("Bạn không có quyền thực hiện hành động này!");
      return;
    }
    try {
      await deleteDocFromPostgres("passwordResetRequests", id);
      setResetRequests(prev => prev.filter(r => r.id !== id));
      toast.success("Đã xóa lịch sử yêu cầu!");
    } catch (err: any) {
      toast.error("Lỗi khi xóa: " + err.message);
    }
  };

  const [addForm, setAddForm] = useState({
    username: '',
    password: '',
    name: '',
    shortName: '',
    role: 'tester',
    position: 'Nhân viên',
    responsibilities: 'Tất cả',
    phone: '',
    email: ''
  });

  const [editForm, setEditForm] = useState({
    username: '',
    password: '',
    name: '',
    shortName: '',
    role: 'tester',
    position: 'Nhân viên',
    responsibilities: 'Tất cả',
    phone: '',
    email: ''
  });

  const availableTesters = useMemo(() => {
    const list = new Set<string>();
    if (testers && Array.isArray(testers)) {
      testers.forEach(t => {
        if (t.name && t.name !== 'Khác') list.add(t.name);
      });
    }
    if (systemUsers && Array.isArray(systemUsers)) {
      systemUsers.forEach(u => {
        const name = u['Họ và Tên'] || u['name'];
        const role = normalizeSystemUserRole(u);
        if (name && (role === 'tester' || role === 'admin')) {
          list.add(name);
        }
      });
    }
    return Array.from(list);
  }, [testers, systemUsers]);

  const handleToggleWeekend = (day: 'Saturday' | 'Sunday') => {
    if (!canEditOperational) {
      toast.error('Bạn không có quyền chỉnh sửa cấu hình ngày làm việc!');
      return;
    }
    const updated = {
      ...localSettings,
      workOnSaturday: day === 'Saturday' ? !localSettings.workOnSaturday : localSettings.workOnSaturday,
      workOnSunday: day === 'Sunday' ? !localSettings.workOnSunday : localSettings.workOnSunday
    };
    setLocalSettings(updated);
    updateSettings({
      workOnSaturday: updated.workOnSaturday,
      workOnSunday: updated.workOnSunday,
    });
    toast.success('Đã lưu thiết lập ngày làm việc!');
  };

  const handleToggleTester = (key: 'defaultTesters' | 'defaultTestersAtd' | 'defaultTestersEmc' | 'defaultTestersChamber1' | 'defaultTestersChamber2', name: string) => {
    if (!canEditOperational) {
      toast.error('Bạn không có quyền chỉnh sửa nhân viên thử nghiệm mặc định!');
      return;
    }
    const currentList = localSettings[key] || [];
    let updatedList: string[];
    if (currentList.includes(name)) {
      updatedList = currentList.filter(item => item !== name);
    } else {
      updatedList = [...currentList, name];
    }
    const updated = {
      ...localSettings,
      [key]: updatedList
    };
    setLocalSettings(updated);
    updateSettings({ [key]: updatedList });
    toast.success('Đã cập nhật nhân viên thử nghiệm!');
  };

  const handleStartEditUser = (user: any) => {
    if (!isAdminOnlyAction) {
      toast.error('Bạn không có quyền chỉnh sửa tài khoản người dùng!');
      return;
    }
    const uUsername = user['Tên đăng nhập'] || user['username'] || user.id || '';
    const uName = user['Họ và Tên'] || user['name'] || '';
    const uRole = normalizeSystemUserRole(user, 'tester');
    const uPosition = user['Chức vụ'] || user['position'] || '';
    const uResponsibilities = user['Nhiệm vụ'] || user['responsibilities'] || 'Tất cả';
    const uPhone = user['Số điện thoại'] || user['phone'] || '';
    const uEmail = user['Email'] || user['email'] || '';

    setEditingUserId(user.id || uUsername);
    setEditForm({
      username: uUsername,
      password: '',
      name: uName,
      shortName: user.shortName || '',
      role: uRole,
      position: uPosition,
      responsibilities: uResponsibilities,
      phone: uPhone,
      email: uEmail
    });
  };

  const handleSaveEditUser = async () => {
    if (!isAdminOnlyAction) {
      toast.error('Bạn không có quyền chỉnh sửa tài khoản người dùng!');
      return;
    }
    const cleanUsername = editForm.username.toLowerCase().trim();
    const cleanName = editForm.name.trim();
    if (!cleanUsername || !cleanName) {
      toast.error('Vui lòng nhập tên đăng nhập và họ tên đầy đủ!');
      return;
    }

    const newPass = editForm.password.trim();
    const mappedUser = withSystemUserRoleAliases({
      id: editingUserId!,
      username: cleanUsername,
      name: cleanName,
      shortName: editForm.shortName.trim() || cleanName.split(' ').pop() || '',
      position: editForm.position.trim(),
      responsibilities: editForm.responsibilities,
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      ...(newPass ? { password: newPass, 'Mật khẩu': newPass } : {})
    }, normalizeSystemUserRole({ role: editForm.role }, 'tester'));

    try {
      await updateUser(editingUserId!, mappedUser);
      if (newPass) {
        await updateUserPreferences(editingUserId!, { customPassword: '' });
        if (cleanUsername !== editingUserId) {
          await updateUserPreferences(cleanUsername, { customPassword: '' });
        }
      }
      toast.success('Đã cập nhật tài khoản thành công!');
      setEditingUserId(null);
    } catch (e: any) {
      toast.error('Lỗi khi lưu tài khoản: ' + e.message);
    }
  };

  const handleSaveAddUser = async () => {
    if (!isAdminOnlyAction) {
      toast.error('Bạn không có quyền thêm tài khoản người dùng!');
      return;
    }
    const cleanUsername = addForm.username.toLowerCase().trim();
    const cleanName = addForm.name.trim();
    if (!cleanUsername || !cleanName) {
      toast.error('Vui lòng nhập tên đăng nhập và họ tên đầy đủ!');
      return;
    }

    const exists = systemUsers.some((u: any) => {
      const uUsername = u['Tên đăng nhập'] || u['username'] || u.id || '';
      return String(uUsername).toLowerCase().trim() === cleanUsername;
    });
    if (exists) {
      toast.error('Tên đăng nhập đã tồn tại!');
      return;
    }

    const mappedUser = withSystemUserRoleAliases({
      id: cleanUsername,
      username: cleanUsername,
      name: cleanName,
      shortName: addForm.shortName.trim() || cleanName.split(' ').pop() || '',
      position: addForm.position.trim(),
      responsibilities: addForm.responsibilities,
      phone: addForm.phone.trim(),
      email: addForm.email.trim(),
      ...(addForm.password.trim() ? { password: addForm.password.trim() } : { password: 'Abc123456' })
    }, normalizeSystemUserRole({ role: addForm.role }, 'tester'));

    try {
      await addUser(mappedUser);
      toast.success('Đã thêm người dùng mới thành công!');
      setIsAddingUser(false);
      setAddForm({
        username: '',
        password: '',
        name: '',
        shortName: '',
        role: 'tester',
        position: 'Nhân viên',
        responsibilities: 'Tất cả',
        phone: '',
        email: ''
      });
    } catch (e: any) {
      toast.error('Lỗi khi lưu tài khoản: ' + e.message);
    }
  };

  const handleBackup = async () => {
    if (!isAdminOnlyAction) {
      toast.error('Chỉ Admin mới có quyền sao lưu dữ liệu hệ thống!');
      return;
    }
    setIsBackingUp(true);
    try {
      const state = useStore.getState();
      const backupTimestamp = new Date().toISOString();
      const activityLogs = await activityLogClient.fetchAll();
      const backupData = buildBackupPayload(state, backupTimestamp, activityLogs);
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_DDTLab_${backupTimestamp.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      updateSettings({ lastBackupDate: backupTimestamp });
      toast.success('Đã xuất file sao lưu đầy đủ thành công!');
    } catch (e: any) {
      toast.error(`Lỗi xuất file sao lưu: ${e?.message || e}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdminOnlyAction) {
      toast.error('Bạn không có quyền khôi phục dữ liệu hệ thống!');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data || typeof data !== 'object') {
          throw new Error("File không đúng định dạng JSON.");
        }
        const requestsCount = Array.isArray(data.requests) ? data.requests.length : 0;
        const handoverDocsCount = Array.isArray(data.handoverDocs) ? data.handoverDocs.length : 0;
        const kqtnRecordsCount = Array.isArray(data.kqtnRecords) ? data.kqtnRecords.length : 0;
        const customersCount = Array.isArray(data.customers) ? data.customers.length : 0;
        const productsCount = Array.isArray(data.products) ? data.products.length : 0;
        const brandsCount = Array.isArray(data.brands) ? data.brands.length : 0;
        const dayConfigsCount = data.dayConfigs && typeof data.dayConfigs === 'object' ? Object.keys(data.dayConfigs).length : 0;
        const systemUsersCount = Array.isArray(data.systemUsers) ? data.systemUsers.length : 0;
        const notificationsCount = Array.isArray(data.notifications) ? data.notifications.length : 0;
        const activityLogsCount = Array.isArray(data.activityLogs) ? data.activityLogs.length : 0;
        const settingsCount = data.settings && typeof data.settings === 'object' ? Object.keys(data.settings).length : 0;

        const hasBackupData = [
          requestsCount,
          handoverDocsCount,
          kqtnRecordsCount,
          customersCount,
          productsCount,
          brandsCount,
          dayConfigsCount,
          systemUsersCount,
          notificationsCount,
          activityLogsCount,
          settingsCount,
        ].some(count => count > 0);
        if (!hasBackupData) {
          throw new Error("File sao lưu không chứa dữ liệu hợp lệ.");
        }

        setRestoreConfirmData({
          data,
          requestsCount,
          handoverDocsCount,
          kqtnRecordsCount,
          customersCount,
          productsCount,
          brandsCount,
          dayConfigsCount,
          systemUsersCount,
          notificationsCount,
          activityLogsCount,
          settingsCount,
        });
      } catch (err: any) {
        toast.error("Lỗi phục hồi dữ liệu: " + (err.message || err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmData) return;
    const { data } = restoreConfirmData;
    setRestoreConfirmData(null);
    const toastId = toast.loading("Đang tải dữ liệu vào bộ đệm...");
    try {
      await useStore.getState().restoreFromBackup(data);
      toast.success("Tải dữ liệu vào bộ đệm thành công! Vui lòng bấm 'Xác nhận & Lưu lên PostgreSQL' để đẩy dữ liệu.", { id: toastId });
    } catch (err: any) {
      toast.error("Lỗi phục hồi dữ liệu: " + (err.message || err), { id: toastId });
    }
  };

  const handleConfirmUpload = async () => {
    if (!isAdminOnlyAction) {
      toast.error('Chỉ Admin mới có quyền ghi đè dữ liệu lên PostgreSQL!');
      return;
    }
    setUploadConfirmOpen(false);
    const toastId = toast.loading("Đang đẩy toàn bộ dữ liệu lên PostgreSQL, vui lòng không tắt trình duyệt...");
    try {
      await useStore.getState().uploadToPostgres();
      toast.success("Đẩy dữ liệu lên PostgreSQL thành công!", { id: toastId });
    } catch (err: any) {
      toast.error("Lỗi đẩy dữ liệu: " + (err.message || err), { id: toastId });
    }
  };

  const handleCancelUpload = () => {
    setUploadConfirmOpen(false);
  };

  const handleCancelRestore = () => {
    setRestoreConfirmData(null);
  };

  return (
    <div className="p-3 md:p-6 space-y-6 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/50 min-w-0">
      <div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="text-slate-700" size={24} /> Thiết lập hệ thống (Settings)
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1">Cấu hình tham số vận hành phòng thử nghiệm và quản lý tài khoản</p>
      </div>

      <AdminBackupReminder />

      {!canViewSettings && (
        <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold select-none">
          <ShieldAlert size={16} className="shrink-0 text-amber-600 animate-bounce" />
          <span>Chế độ chỉ xem: Bạn không có quyền chỉnh sửa thiết lập hệ thống.</span>
        </div>
      )}

      {isSystemSettingsManager && (
        <div className="flex items-center gap-2.5 p-3.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-semibold select-none">
          <ShieldCheck size={16} className="shrink-0 text-blue-600" />
          <span>Quyền Quản lý: được cấu hình ngày làm việc, phân công KTV và xem chẩn đoán đồng bộ. Quản lý tài khoản và backup chỉ dành cho Admin.</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2">Ngày làm việc cuối tuần</h3>
            <div className="space-y-3">
              <label className={`flex items-center justify-between p-3.5 border rounded-xl transition-colors ${!canEditOperational ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">T7</div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">Làm việc Thứ 7</div>
                    <div className="text-[10px] text-slate-500">Tự động xếp lịch vào Thứ 7</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggleWeekend('Saturday')}
                  disabled={!canEditOperational}
                  className={`w-10 h-6 rounded-full p-1 transition-colors relative flex items-center ${!canEditOperational ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${localSettings.workOnSaturday ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${localSettings.workOnSaturday ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </button>
              </label>
 
              <label className={`flex items-center justify-between p-3.5 border rounded-xl transition-colors ${!canEditOperational ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 font-bold text-xs shrink-0">CN</div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">Làm việc Chủ Nhật</div>
                    <div className="text-[10px] text-slate-500">Tự động xếp lịch vào Chủ Nhật</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggleWeekend('Sunday')}
                  disabled={!canEditOperational}
                  className={`w-10 h-6 rounded-full p-1 transition-colors relative flex items-center ${!canEditOperational ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${localSettings.workOnSunday ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${localSettings.workOnSunday ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </button>
              </label>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 text-slate-700">
              <Users size={14} className="text-amber-500" /> Nhân viên thử nghiệm
            </h3>
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Thử nghiệm An toàn điện:</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-2 border rounded-xl bg-slate-50/50">
                  {availableTesters.map(name => {
                    const isSelected = (localSettings.defaultTestersAtd || []).includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => handleToggleTester('defaultTestersAtd', name)}
                        disabled={!canEditOperational}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          !canEditOperational ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        } ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Thử nghiệm EMC 1:</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-2 border rounded-xl bg-slate-50/50">
                  {availableTesters.map(name => {
                    const isSelected = (localSettings.defaultTestersChamber1 || []).includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => handleToggleTester('defaultTestersChamber1', name)}
                        disabled={!canEditOperational}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          !canEditOperational ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        } ${
                          isSelected 
                            ? 'bg-emerald-600 text-white border-emerald-600' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Thử nghiệm EMC 2:</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-2 border rounded-xl bg-slate-50/50">
                  {availableTesters.map(name => {
                    const isSelected = (localSettings.defaultTestersChamber2 || []).includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => handleToggleTester('defaultTestersChamber2', name)}
                        disabled={!canEditOperational}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          !canEditOperational ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        } ${
                          isSelected 
                            ? 'bg-amber-600 text-white border-amber-600' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 text-slate-700">
              <Activity size={14} className="text-indigo-600" /> Chẩn đoán & Nhật ký đồng bộ (Sync Inspector)
            </h3>
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kiểm tra đối chiếu dữ liệu giữa PostgreSQL Server và bộ nhớ máy để đảm bảo không bị sót bản ghi hoặc độ trễ mạng.
              </p>
              <button
                onClick={() => {
                  runDetailedSyncDiagnostic();
                  setSyncModalOpen(true);
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Activity size={14} /> Mở Nhật ký & Chẩn đoán Lô
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 text-slate-700">
              <Download size={14} className="text-emerald-500" /> Xuất & Khôi phục dữ liệu
            </h3>
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sao lưu hoặc phục hồi toàn bộ dữ liệu hệ thống thông qua tệp tin JSON để đảm bảo an toàn thông tin.
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleBackup}
                  disabled={!isAdminOnlyAction || isBackingUp}
                  className={`w-full py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${!isAdminOnlyAction || isBackingUp ? 'bg-slate-300 cursor-not-allowed opacity-60' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}
                >
                  {isBackingUp ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {isBackingUp ? 'Đang tạo backup...' : 'Tải file backup (.json)'}
                </button>
                <input
                  type="file"
                  id="restore-json-input"
                  accept=".json"
                  onChange={handleRestoreFileSelected}
                  className="hidden"
                />
                <button
                  onClick={() => document.getElementById('restore-json-input')?.click()}
                  disabled={!isAdminOnlyAction}
                  className={`w-full py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
                    !isAdminOnlyAction ? 'bg-slate-300 cursor-not-allowed opacity-60' : 'bg-amber-500 hover:bg-amber-600 cursor-pointer'
                  }`}
                >
                  <Upload size={14} /> Khôi phục từ file JSON
                </button>
              </div>
              
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setUploadConfirmOpen(true)}
                  disabled={!isAdminOnlyAction}
                  className={`w-full py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
                    !isAdminOnlyAction ? 'bg-slate-300 cursor-not-allowed opacity-60' : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
                  }`}
                >
                  <UploadCloud size={14} /> Xác nhận & Lưu lên PostgreSQL
                </button>
              </div>
            </div>
          </div>

          {isSystemSettingsAdmin && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 text-slate-700">
                <ShieldCheck size={14} className="text-emerald-500" /> Yêu cầu khôi phục mật khẩu
              </h3>
              
              {loadingRequests ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                  <Loader2 size={14} className="animate-spin text-emerald-500" />
                  Đang tải danh sách...
                </div>
              ) : resetRequests.length === 0 ? (
                <div className="text-center text-[10px] text-slate-400 italic py-4">
                  Chưa có yêu cầu khôi phục mật khẩu nào.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {resetRequests.map((req) => (
                    <div key={req.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{req.fullName || 'Người dùng hệ thống'}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {formatDateVN(req.timestamp)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Liên hệ: <b className="text-slate-700">{req.contact}</b>
                      </div>
                      <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg mt-1 font-medium">
                        {req.details || 'Đã tự động đặt lại về mật khẩu mặc định (Abc123456)'}
                      </div>
                      <div className="flex justify-end mt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id)}
                          className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={10} /> Xóa lưu vết
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center border-b pb-2 mb-4 shrink-0">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} className="text-indigo-500"/> Quản lý tài khoản truy cập
            </h3>
            {isSystemSettingsAdmin && !isAddingUser && (
              <button 
                onClick={() => setIsAddingUser(true)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer"
              >
                <UserPlus size={12} /> Thêm tài khoản
              </button>
            )}
          </div>

          <div className="mx-4 mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-900 font-medium">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Bảo toàn dữ liệu tuyệt đối:</strong> Thêm mới hoặc xóa người dùng chỉ cập nhật danh sách phân quyền truy cập. Toàn bộ mẫu thử, phiếu yêu cầu, biên bản giao nhận và kết quả thử nghiệm lịch sử đều được bảo toàn 100%.
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3 pl-4">Tên đăng nhập</th>
                  <th className="p-3">Họ và Tên</th>
                  <th className="p-3">Mật khẩu mới</th>
                  <th className="p-3">Phân quyền</th>
                  <th className="p-3">Chức danh / Liên hệ</th>
                  <th className="p-3 text-right pr-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isAddingUser && (
                  <tr className="bg-indigo-50/20">
                    <td className="p-3 pl-4">
                      <input
                        type="text"
                        value={addForm.username}
                        onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                        className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs font-bold outline-none"
                        placeholder="username"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs font-bold outline-none"
                        placeholder="Họ và Tên"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="password"
                        value={addForm.password}
                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs outline-none"
                        placeholder="Mật khẩu"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={addForm.role}
                        onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                        className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs outline-none font-bold text-slate-700 bg-white"
                      >
                        <option value="admin">Admin hệ thống (toàn quyền)</option>
                        <option value="tester">Thử nghiệm (Tester)</option>
                        <option value="guest">Khách hàng (Guest)</option>
                        <option value="viewer">Quan sát (Viewer)</option>
                      </select>
                    </td>
                    <td className="p-3 space-y-1">
                      <input
                        type="text"
                        value={addForm.position}
                        onChange={(e) => setAddForm({ ...addForm, position: e.target.value })}
                        className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs outline-none"
                        placeholder="Chức danh"
                      />
                    </td>
                    <td className="p-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={handleSaveAddUser}
                          className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg transition-all cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setIsAddingUser(false)}
                          className="p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {systemUsers.map((user: any) => {
                  const uUsername = user['Tên đăng nhập'] || user['username'] || user.id || '';
                  const uName = user['Họ và Tên'] || user['name'] || '';
                  const uRole = normalizeSystemUserRole(user);
                  const uPosition = user['Chức vụ'] || user['position'] || '';
                  const isEditing = editingUserId === (user.id || uUsername);

                  return (
                    <tr key={user.id || uUsername} className={`hover:bg-slate-50/55 transition-colors ${isEditing ? 'bg-indigo-50/20' : ''}`}>
                      <td className="p-3 pl-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.username}
                            disabled
                            className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs font-bold bg-slate-100 text-slate-500"
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-600">@{uUsername}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-xs font-bold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800">{uName}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs"
                            placeholder="Mật khẩu mới (bỏ trống nếu không đổi)"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300">••••••••</span>
                            {isAdminOnlyAction && (
                              <button
                                onClick={async () => {
                                  const confirmed = window.confirm(`Bạn có chắc chắn muốn khôi phục mật khẩu của @${uUsername} về mặc định (Abc123456)?`);
                                  if (!confirmed) return;
                                  try {
                                    const updatedUser = {
                                      ...user,
                                      'Mật khẩu': 'Abc123456',
                                      'password': 'Abc123456'
                                    };
                                    await updateUser(user.id, updatedUser);
                                    if (uUsername) {
                                      await updateUserPreferences(uUsername, { customPassword: '' });
                                    }
                                    if (user.id && user.id !== uUsername) {
                                      await updateUserPreferences(user.id, { customPassword: '' });
                                    }
                                    toast.success(`Đã khôi phục mật khẩu của @${uUsername} về mặc định (Abc123456) thành công!`);
                                  } catch (err: any) {
                                    toast.error('Lỗi khi khôi phục mật khẩu: ' + err.message);
                                  }
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50 rounded transition-all cursor-pointer"
                                title="Khôi phục về mật khẩu mặc định (Abc123456)"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs outline-none font-bold text-slate-700 bg-white"
                          >
                            <option value="admin">Admin hệ thống (toàn quyền)</option>
                            <option value="tester">Thử nghiệm (Tester)</option>
                            <option value="guest">Khách hàng (Guest)</option>
                            <option value="viewer">Quan sát (Viewer)</option>
                          </select>
                        ) : (
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            uRole === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' :
                            uRole === 'tester' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-purple-50 text-purple-600 border border-purple-100'
                          }`}>
                            {uRole === 'admin' ? 'Admin' : uRole === 'tester' ? 'TNV' : 'Khách'}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.position}
                            onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                            className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs"
                          />
                        ) : (
                          <span className="text-slate-500">{uPosition || 'Kỹ thuật viên'}</span>
                        )}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isAdminOnlyAction ? (
                            <span className="text-slate-400 font-medium text-[10px] italic flex items-center gap-1">
                              <Lock size={10} className="text-slate-400 shrink-0" /> Chỉ xem
                            </span>
                          ) : isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEditUser}
                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                                title="Lưu"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-all"
                                title="Hủy"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : confirmDeleteId === user.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100">
                              <span className="text-[9px] text-red-600 font-bold px-1.5">Xóa?</span>
                              <button
                                onClick={async () => {
                                  await deleteUser(user.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-md hover:bg-red-600 cursor-pointer"
                              >
                                Có
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded-md hover:bg-slate-300 cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEditUser(user)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Sửa tài khoản"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  if (currentUser?.username === uUsername) {
                                    toast.error('Không thể tự xóa tài khoản của bạn!');
                                    return;
                                  }
                                  setConfirmDeleteId(user.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Xóa tài khoản"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>



      {uploadConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-blue-50 border-b border-blue-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-blue-800 text-sm flex items-center gap-2">
                <UploadCloud size={18} className="text-blue-600" />
                Xác nhận lưu lên PostgreSQL
              </h3>
              <button onClick={handleCancelUpload} className="text-blue-500 hover:text-blue-700 bg-blue-100/50 hover:bg-blue-200/50 p-1.5 rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-slate-700 font-medium leading-relaxed mb-4">
                Bạn có chắc chắn muốn đẩy toàn bộ dữ liệu từ bộ đệm hiện tại lên PostgreSQL? 
              </p>
              
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border border-blue-100 text-xs font-bold flex items-start gap-2 mb-4">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p>Hành động này sẽ ghi đè dữ liệu hiện tại trên PostgreSQL bằng dữ liệu trong ứng dụng của bạn.</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                onClick={handleCancelUpload}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-5 py-2 text-xs font-black text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Check size={14} /> LƯU LÊN POSTGRESQL
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreConfirmData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-amber-50 border-b border-amber-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-amber-800 text-sm flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600" />
                Xác nhận khôi phục dữ liệu
              </h3>
              <button onClick={handleCancelRestore} className="text-amber-500 hover:text-amber-700 bg-amber-100/50 hover:bg-amber-200/50 p-1.5 rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-slate-700 font-medium leading-relaxed mb-4">
                Bạn có chắc chắn muốn khôi phục dữ liệu từ file JSON này? Dữ liệu hiện tại trên PostgreSQL sẽ được đồng bộ và cập nhật với:
              </p>
              
              <ul className="space-y-2 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm font-medium text-slate-700">
                <li className="flex items-center justify-between"><span>Yêu cầu thử nghiệm:</span> <span className="font-bold text-amber-600">{restoreConfirmData.requestsCount}</span></li>
                <li className="flex items-center justify-between"><span>Biên bản giao nhận:</span> <span className="font-bold text-amber-600">{restoreConfirmData.handoverDocsCount}</span></li>
                <li className="flex items-center justify-between"><span>Kết quả thử nghiệm:</span> <span className="font-bold text-amber-600">{restoreConfirmData.kqtnRecordsCount}</span></li>
                <li className="flex items-center justify-between"><span>Khách hàng:</span> <span className="font-bold text-amber-600">{restoreConfirmData.customersCount}</span></li>
                <li className="flex items-center justify-between"><span>Sản phẩm:</span> <span className="font-bold text-amber-600">{restoreConfirmData.productsCount}</span></li>
                <li className="flex items-center justify-between"><span>Nhãn hiệu:</span> <span className="font-bold text-amber-600">{restoreConfirmData.brandsCount}</span></li>
                <li className="flex items-center justify-between"><span>Tài khoản:</span> <span className="font-bold text-amber-600">{restoreConfirmData.systemUsersCount}</span></li>
                <li className="flex items-center justify-between"><span>Thông báo:</span> <span className="font-bold text-amber-600">{restoreConfirmData.notificationsCount}</span></li>
                <li className="flex items-center justify-between"><span>Nhật ký hệ thống:</span> <span className="font-bold text-amber-600">{restoreConfirmData.activityLogsCount}</span></li>
                <li className="flex items-center justify-between"><span>Trường thiết lập:</span> <span className="font-bold text-amber-600">{restoreConfirmData.settingsCount}</span></li>
              </ul>
              
              <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs font-bold flex items-start gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p>Hành động này không thể hoàn tác. Dữ liệu hiện tại có thể bị ghi đè hoàn toàn.</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                onClick={handleCancelRestore}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleConfirmRestore}
                className="px-5 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Check size={14} /> XÁC NHẬN KHÔI PHỤC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- End of SystemManagementViews.tsx ---
