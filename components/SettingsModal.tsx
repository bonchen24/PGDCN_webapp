// Author: Gemini
// OS support: Web/Node
// Description: Modal for system settings and configuring default testers and working days

import React, { useState, useEffect } from 'react';
import { X, Settings, Calendar, Save, Sun, Moon, User, Check, Zap, Globe, Link, Plus, Trash2, PartyPopper, FileSpreadsheet, Loader2, Users, Edit2, UserPlus, Download, Upload, ShieldCheck, Search, Building, Tag, Package, Activity } from 'lucide-react';
import { useStore } from '../store';
import { buildBackupPayload } from '../utils/notificationBackup';
import { activityLogClient } from '../utils/activityLogApi';
import { AppSettings, DEFAULT_TESTER, LAB_CONSTANTS, DayConfig } from '../types';
import { formatDateVN, removeAccents } from '../utils/formatter';
import { CustomDatePicker } from './CustomDatePicker';
import { toast } from 'sonner';
import { fetchCollection, deleteDocFromPostgres, batchSaveToPostgres } from '../utils/firebase';
import { AdminBackupReminder } from './AdminBackupReminder';
import { normalizeSystemUserRole } from '../utils/systemUserRole';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { settings, updateSettings, fetchData, testers, dayConfigs, updateDayConfig, currentUser, systemUsers, addUser, updateUser, deleteUser, customers, addCustomer, updateCustomer, deleteCustomer, brands, addBrand, updateBrand, deleteBrand, products, addProduct, updateProduct, deleteProduct, setSyncModalOpen, runDetailedSyncDiagnostic } = useStore();
  
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    workOnSaturday: true,
    workOnSunday: false,
    defaultTestersAtd: [],
    defaultTestersEmc: [],
    defaultTestersChamber1: [],
    defaultTestersChamber2: [],
    cloudSyncEnabled: true,
  });

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayNote, setHolidayNote] = useState('');

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    requestsCount: number;
    handoverDocsCount: number;
    kqtnRecordsCount: number;
    customersCount: number;
    productsCount: number;
    brandsCount: number;
    dayConfigsCount: number;
    systemUsersCount: number;
    activityLogsCount: number;
    rawData: any;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user',
    position: '',
    shortName: '',
    responsibilities: '',
    phone: '',
    email: ''
  });

  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [editingCustomerCode, setEditingCustomerCode] = useState<string | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [confirmDeleteCustomerKey, setConfirmDeleteCustomerKey] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    address: '',
    taxId: '',
    customerCode: ''
  });

  const handleStartEditCustomer = (cust: any) => {
    setEditingCustomerCode(cust.customerCode || cust.name);
    setIsAddingCustomer(false);
    setCustomerForm({
      name: cust.name || '',
      address: cust.address || '',
      taxId: cust.taxId?.toString() || '',
      customerCode: cust.customerCode || ''
    });
  };

  const handleStartCreateCustomer = () => {
    setEditingCustomerCode('new');
    setIsAddingCustomer(true);
    setCustomerForm({
      name: '',
      address: '',
      taxId: '',
      customerCode: ''
    });
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim()) {
      toast.error('Vui lòng điền tên khách hàng!');
      return;
    }
    const mappedCustomer = {
      name: customerForm.name.trim(),
      address: customerForm.address.trim(),
      taxId: customerForm.taxId.trim(),
      customerCode: customerForm.customerCode.trim()
    };
    if (isAddingCustomer || editingCustomerCode === 'new') {
      const exists = customers.some(c => (c.customerCode || c.name).toLowerCase().trim() === (mappedCustomer.customerCode || mappedCustomer.name).toLowerCase().trim());
      if (exists) {
        toast.error('Khách hàng này đã tồn tại trong hệ thống!');
        return;
      }
      addCustomer(mappedCustomer);
      toast.success('Đã thêm khách hàng mới thành công!');
    } else {
      updateCustomer(editingCustomerCode!, mappedCustomer);
      toast.success('Đã cập nhật thông tin khách hàng thành công!');
    }
    setEditingCustomerCode(null);
    setIsAddingCustomer(false);
  };

  const handleDeleteCustomerClick = async (custKey: string) => {
    await deleteCustomer(custKey);
    toast.success('Đã xóa khách hàng thành công!');
    setConfirmDeleteCustomerKey(null);
  };

  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [editingBrandName, setEditingBrandName] = useState<string | null>(null);
  const [confirmDeleteBrandName, setConfirmDeleteBrandName] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState({ name: '' });

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [editingProductName, setEditingProductName] = useState<string | null>(null);
  const [confirmDeleteProductName, setConfirmDeleteProductName] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: '', testTimeEMC: 480, testTimeATD: 480 });

  const handleStartEditBrand = (b: string) => {
    setEditingBrandName(b);
    setBrandForm({ name: b });
  };

  const handleStartCreateBrand = () => {
    setEditingBrandName('new');
    setBrandForm({ name: '' });
  };

  const handleSaveBrand = () => {
    const cleanName = brandForm.name.trim();
    if (!cleanName) {
      toast.error('Vui lòng điền tên nhãn hiệu!');
      return;
    }
    if (editingBrandName === 'new') {
      const exists = brands.some(b => b.toLowerCase().trim() === cleanName.toLowerCase());
      if (exists) {
        toast.error('Nhãn hiệu này đã tồn tại!');
        return;
      }
      addBrand(cleanName);
      toast.success('Đã thêm nhãn hiệu mới thành công!');
    } else {
      updateBrand(editingBrandName!, cleanName);
      toast.success('Đã cập nhật nhãn hiệu thành công!');
    }
    setEditingBrandName(null);
  };

  const handleDeleteBrandClick = async (b: string) => {
    await deleteBrand(b);
    toast.success('Đã xóa nhãn hiệu thành công!');
    setConfirmDeleteBrandName(null);
  };

  const handleStartEditProduct = (p: any) => {
    setEditingProductName(p.name);
    setProductForm({
      name: p.name || '',
      testTimeEMC: p.testTimeEMC !== undefined ? p.testTimeEMC : 480,
      testTimeATD: p.testTimeATD !== undefined ? p.testTimeATD : 480
    });
  };

  const handleStartCreateProduct = () => {
    setEditingProductName('new');
    setProductForm({
      name: '',
      testTimeEMC: 480,
      testTimeATD: 480
    });
  };

  const handleSaveProduct = () => {
    const cleanName = productForm.name.trim();
    if (!cleanName) {
      toast.error('Vui lòng điền tên loại sản phẩm!');
      return;
    }
    const mapped = {
      name: cleanName,
      testTimeEMC: Number(productForm.testTimeEMC),
      testTimeATD: Number(productForm.testTimeATD)
    };
    if (editingProductName === 'new') {
      const exists = products.some(p => p.name.toLowerCase().trim() === cleanName.toLowerCase());
      if (exists) {
        toast.error('Loại sản phẩm này đã tồn tại!');
        return;
      }
      addProduct(mapped);
      toast.success('Đã thêm loại sản phẩm mới thành công!');
    } else {
      updateProduct(editingProductName!, mapped);
      toast.success('Đã cập nhật loại sản phẩm thành công!');
    }
    setEditingProductName(null);
  };

  const handleDeleteProductClick = async (name: string) => {
    await deleteProduct(name);
    toast.success('Đã xóa loại sản phẩm thành công!');
    setConfirmDeleteProductName(null);
  };

  useEffect(() => {
    if (isOpen && currentUser?.role === 'admin') {
      setLoadingRequests(true);
      fetchCollection("passwordResetRequests")
        .then(data => {
          const sorted = (data || []).sort((a: any, b: any) => {
            return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
          });
          setResetRequests(sorted);
        })
        .catch(err => console.error("Error fetching reset requests:", err))
        .finally(() => setLoadingRequests(false));
    }
  }, [isOpen, currentUser]);

  const handleDeleteRequest = async (id: string) => {
    try {
      await deleteDocFromPostgres("passwordResetRequests", id);
      setResetRequests(prev => prev.filter(r => r.id !== id));
      toast.success("Đã xóa lịch sử yêu cầu!");
    } catch (err: any) {
      toast.error("Lỗi khi xóa: " + err.message);
    }
  };

  const handleStartEdit = (user: any) => {
    setEditingUser(user);
    setUserForm({
      username: user['Tên đăng nhập'] || user['username'] || user.id || '',
      password: user['Mật khẩu'] || user['password'] || 'Abc123456',
      name: user['Họ và Tên'] || user['name'] || '',
      role: normalizeSystemUserRole(user, 'tester'),
      position: user['Chức vụ'] || user['position'] || '',
      shortName: user['Tên viết tắt'] || user['shortName'] || '',
      responsibilities: user['Thử nghiệm phụ trách'] || user['responsibilities'] || '',
      phone: user['Số điện thoại'] || user['phone'] || '',
      email: user['Email'] || user['email'] || ''
    });
  };

  const handleStartCreate = () => {
    setEditingUser('new');
    setUserForm({
      username: '',
      password: 'Abc123456',
      name: '',
      role: 'user',
      position: 'Nhân viên',
      shortName: '',
      responsibilities: 'EMC',
      phone: '',
      email: ''
    });
  };

  const handleSaveUser = async () => {
    if (!userForm.username || !userForm.name) {
      toast.error('Vui lòng điền đầy đủ Tên đăng nhập và Họ & Tên!');
      return;
    }
    const usernameClean = userForm.username.toLowerCase().trim();
    const mappedUser = {
      username: usernameClean,
      'Tên đăng nhập': usernameClean,
      password: userForm.password,
      'Mật khẩu': userForm.password,
      name: userForm.name.trim(),
      'Họ và Tên': userForm.name.trim(),
      role: userForm.role,
      'Loại tài khoản': userForm.role,
      position: userForm.position.trim(),
      'Chức vụ': userForm.position.trim(),
      shortName: userForm.shortName.trim() || userForm.name.trim().split(' ').pop() || userForm.name.trim(),
      'Tên viết tắt': userForm.shortName.trim() || userForm.name.trim().split(' ').pop() || userForm.name.trim(),
      responsibilities: userForm.responsibilities,
      'Thử nghiệm phụ trách': userForm.responsibilities,
      phone: userForm.phone.trim(),
      'Số điện thoại': userForm.phone.trim(),
      email: userForm.email.trim(),
      'Email': userForm.email.trim()
    };
    if (editingUser === 'new') {
      const exists = systemUsers.some(u => {
        const uName = (u['Tên đăng nhập'] || u['username'] || u.id || '').toString().toLowerCase().trim();
        return uName === usernameClean;
      });
      if (exists) {
        toast.error('Tên đăng nhập này đã tồn tại!');
        return;
      }
      await addUser(mappedUser);
    } else {
      await updateUser(editingUser.id, mappedUser);
    }
    setEditingUser(null);
  };

  const isNotGuest = (t: any) => {
    return !(
      t.position && (
        t.position.includes('Khách') || 
        t.position.includes('Đối tác') || 
        t.position.includes('Quan sát') || 
        t.position.includes('Guest')
      )
    ) && t.name !== 'Trần Hoàng Phương';
  };

  useEffect(() => {
    if (isOpen) {
      const defaultEmc = settings.defaultTestersEmc || testers.filter(t => isNotGuest(t) && ((t.responsibilities && (t.responsibilities.toUpperCase().includes('EMC') || t.responsibilities.toUpperCase().includes('TẤT CẢ'))) || (t.position && (t.position.toUpperCase().includes('EMC') || t.position.toUpperCase().includes('TƯƠNG THÍCH ĐIỆN TỪ') || t.position.toUpperCase().includes('THỬ NGHIỆM'))))).map(t => t.name);
      setLocalSettings({
          ...settings,
          defaultTestersAtd: settings.defaultTestersAtd || testers.filter(t => isNotGuest(t) && ((t.responsibilities && (t.responsibilities.toUpperCase().includes('ATD') || t.responsibilities.toUpperCase().includes('ATĐ') || t.responsibilities.toUpperCase().includes('TẤT CẢ'))) || (t.position && (t.position.toUpperCase().includes('ATĐ') || t.position.toUpperCase().includes('ATD') || t.position.toUpperCase().includes('AN TOÀN ĐIỆN') || t.position.toUpperCase().includes('THỬ NGHIỆM'))))).map(t => t.name),
          defaultTestersEmc: defaultEmc,
          defaultTestersChamber1: settings.defaultTestersChamber1 || defaultEmc,
          defaultTestersChamber2: settings.defaultTestersChamber2 || defaultEmc,
          cloudSyncEnabled: settings.cloudSyncEnabled ?? true,
      });
    }
  }, [isOpen, settings, testers]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const toggleTester = (testerName: string, type: 'ATD' | 'EMC' | 'Chamber1' | 'Chamber2') => {
      setLocalSettings(prev => {
          let key: keyof AppSettings = 'defaultTestersEmc';
          if (type === 'ATD') key = 'defaultTestersAtd';
          else if (type === 'Chamber1') key = 'defaultTestersChamber1';
          else if (type === 'Chamber2') key = 'defaultTestersChamber2';
          
          const current = prev[key] || [];
          if (current.includes(testerName)) {
              if (current.length === 1) return prev; 
              return { ...prev, [key]: current.filter(t => t !== testerName) };
          } else {
              return { ...prev, [key]: [...current, testerName] };
          }
      });
  };

  const handleAddHoliday = () => {
      if (!holidayDate) return;
      updateDayConfig(holidayDate, { isHoliday: true, note: holidayNote || 'Nghỉ lễ' });
      setHolidayDate('');
      setHolidayNote('');
  };

  const removeHoliday = (date: string) => {
      updateDayConfig(date, { isHoliday: false, note: '' });
  };

  const handleBackup = async () => {
    try {
      const state = useStore.getState();
      const backupTimestamp = new Date().toISOString();
      const activityLogs = await activityLogClient.fetchAll();
      const data = buildBackupPayload(state, backupTimestamp, activityLogs);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_DDTLab_${backupTimestamp.split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Đã xuất JSON portable; file PDF KQTN được sao lưu bằng backup máy chủ.");
    } catch (error: any) {
      console.error('Activity log backup failed:', error);
      toast.error(`Không thể tải lịch sử hoạt động vào backup: ${error?.message || error}`);
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
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
        const dayConfigsCount = data.dayConfigs ? Object.keys(data.dayConfigs).length : 0;
        const systemUsersCount = Array.isArray(data.systemUsers) ? data.systemUsers.length : 0;
        const activityLogsCount = Array.isArray(data.activityLogs) ? data.activityLogs.length : 0;

        if (requestsCount === 0 && handoverDocsCount === 0 && customersCount === 0 && kqtnRecordsCount === 0) {
          throw new Error("File sao lưu không chứa dữ liệu hợp lệ.");
        }

        setRestorePreview({
          requestsCount,
          handoverDocsCount,
          kqtnRecordsCount,
          customersCount,
          productsCount,
          brandsCount,
          dayConfigsCount,
          systemUsersCount,
          activityLogsCount,
          rawData: data
        });
        toast.info("Đã phân tích file sao lưu thành công!");
      } catch (err: any) {
        toast.error("Lỗi đọc file sao lưu: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!restorePreview) return;
    setIsRestoring(true);
    try {
      await useStore.getState().restoreFromBackup(restorePreview.rawData);
      toast.success("Phục hồi toàn bộ dữ liệu từ file sao lưu thành công!");
      setRestorePreview(null);
    } catch (err: any) {
      toast.error("Lỗi khi phục hồi dữ liệu: " + (err.message || err));
    } finally {
      setIsRestoring(false);
    }
  };

  const holidays = (Object.values(dayConfigs) as DayConfig[]).filter(d => d.isHoliday).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end md:items-center justify-center p-2 md:p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg max-h-[calc(100dvh-1rem)] md:max-h-[90vh] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-slate-800 p-5 flex justify-between items-center text-white shrink-0">
          <div>
            <h3 className="text-lg font-black uppercase flex items-center gap-2">
              <Settings className="text-emerald-400" size={20} /> Thiết lập hệ thống
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Cấu hình thời gian & kết nối</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto min-h-0">
            <AdminBackupReminder />

            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2">Ngày làm việc cuối tuần</h4>
                <div className="grid grid-cols-1 gap-3">
                    <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <span className="text-xs font-black">T7</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-800">Làm việc Thứ 7</div>
                                <div className="text-[10px] text-slate-500">Cho phép xếp lịch thử nghiệm vào Thứ 7</div>
                            </div>
                        </div>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${localSettings.workOnSaturday ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${localSettings.workOnSaturday ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={localSettings.workOnSaturday} 
                            onChange={(e) => setLocalSettings({...localSettings, workOnSaturday: e.target.checked})} 
                        />
                    </label>

                    <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                                <span className="text-xs font-black">CN</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-800">Làm việc Chủ Nhật</div>
                                <div className="text-[10px] text-slate-500">Cho phép xếp lịch thử nghiệm vào Chủ Nhật</div>
                            </div>
                        </div>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${localSettings.workOnSunday ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${localSettings.workOnSunday ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={localSettings.workOnSunday} 
                            onChange={(e) => setLocalSettings({...localSettings, workOnSunday: e.target.checked})} 
                        />
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <Zap size={14} className="text-orange-500"/> Cơ sở dữ liệu PostgreSQL
                </h4>
                <div className="space-y-3">
                    <div className="p-3.5 bg-slate-50 border rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-700">PostgreSQL đang hoạt động</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            Dữ liệu của bạn được đồng bộ hóa hai chiều an toàn qua REST API PostgreSQL.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            <button
                                onClick={handleBackup}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                                <Download size={14} />
                                <span>Tải xuống JSON (Backup)</span>
                            </button>
                            
                            <label className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                                <Upload size={14} />
                                <span>Phục hồi từ JSON</span>
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    className="hidden" 
                                    onChange={handleRestoreFileSelected} 
                                />
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                runDetailedSyncDiagnostic();
                                setSyncModalOpen(true);
                            }}
                            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Activity size={14} className="text-indigo-600" />
                            <span>Mở Nhật ký & Chẩn đoán Lô (Sync Inspector)</span>
                        </button>

                        {restorePreview && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                                <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                                    <Zap size={14} className="animate-bounce" />
                                    <span>Thông tin file sao lưu phát hiện:</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-700 bg-white/65 p-2.5 rounded-lg border border-amber-100">
                                    <div>Yêu cầu thử nghiệm: <b className="text-amber-800">{restorePreview.requestsCount}</b></div>
                                    <div>Biên bản bàn giao: <b className="text-amber-800">{restorePreview.handoverDocsCount}</b></div>
                                    <div>Kết quả thử nghiệm: <b className="text-amber-800">{restorePreview.kqtnRecordsCount}</b></div>
                                    <div>Khách hàng: <b className="text-amber-800">{restorePreview.customersCount}</b></div>
                                    <div>Sản phẩm: <b className="text-amber-800">{restorePreview.productsCount}</b></div>
                                    <div>Thương hiệu: <b className="text-amber-800">{restorePreview.brandsCount}</b></div>
                                    <div>Ngày nghỉ lễ: <b className="text-amber-800">{restorePreview.dayConfigsCount}</b></div>
                                    <div>Tài khoản: <b className="text-amber-800">{restorePreview.systemUsersCount}</b></div>
                                    <div>Nhật ký hệ thống: <b className="text-amber-800">{restorePreview.activityLogsCount}</b></div>
                                </div>
                                <p className="text-[9px] text-red-600 leading-normal font-medium">
                                    * LƯU Ý: Quá trình khôi phục sẽ GHI ĐÈ HOÀN TOÀN dữ liệu hiện tại trên PostgreSQL bằng dữ liệu trong file này. Hãy chắc chắn bạn muốn thực hiện.
                                </p>
                                <div className="flex gap-2 justify-end pt-1">
                                    <button
                                        type="button"
                                        disabled={isRestoring}
                                        onClick={() => setRestorePreview(null)}
                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all"
                                    >
                                        Hủy bỏ
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isRestoring}
                                        onClick={confirmRestore}
                                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                    >
                                        {isRestoring ? (
                                            <>
                                                <Loader2 size={12} className="animate-spin" />
                                                <span>Đang khôi phục...</span>
                                            </>
                                        ) : (
                                            <span>Xác nhận Phục hồi</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {currentUser?.role === 'admin' && (
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users size={14} className="text-indigo-500"/> Quản lý tài khoản
                  </span>
                  {editingUser === null && (
                    <button 
                      onClick={handleStartCreate}
                      className="px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                    >
                      <UserPlus size={12} /> Thêm mới
                    </button>
                  )}
                </h4>

                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-900 font-medium">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    <strong>Bảo toàn dữ liệu 100%:</strong> Thêm mới hoặc xóa người dùng không làm mất phiếu yêu cầu, mẫu thử hay biên bản thử nghiệm lịch sử.
                  </span>
                </div>

                {editingUser !== null ? (
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-xs font-black text-slate-700">
                        {editingUser === 'new' ? 'Thêm tài khoản mới' : 'Chỉnh sửa tài khoản'}
                      </span>
                      <button 
                        onClick={() => setEditingUser(null)} 
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all"
                      >
                        Quay lại danh sách
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tên đăng nhập *</label>
                        <input 
                          type="text" 
                          disabled={editingUser !== 'new'}
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none disabled:bg-slate-100 disabled:text-slate-400 font-bold"
                          placeholder="VD: hunglx"
                          value={userForm.username}
                          onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mật khẩu *</label>
                        <input 
                          type="password" 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none font-bold"
                          placeholder="Mật khẩu đăng nhập"
                          value={userForm.password}
                          onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Họ và Tên *</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none font-bold"
                          placeholder="VD: Lương Xuân Hùng"
                          value={userForm.name}
                          onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tên viết tắt (Xếp lịch)</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none"
                          placeholder="Để trống sẽ tự động lấy từ chữ cuối của Họ tên"
                          value={userForm.shortName}
                          onChange={(e) => setUserForm(prev => ({ ...prev, shortName: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phân quyền</label>
                        <select 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none font-bold text-slate-700"
                          value={userForm.role}
                          onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                        >
                          <option value="admin">Admin hệ thống (toàn quyền)</option>
                          <option value="tester">Thử nghiệm viên</option>
                          <option value="guest">Khách hàng / Đối tác (Guest)</option>
                          <option value="viewer">Quan sát viên (Viewer)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Chức vụ / Phòng ban</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none"
                          placeholder="VD: Nhân viên, Phó phòng..."
                          value={userForm.position}
                          onChange={(e) => setUserForm(prev => ({ ...prev, position: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Thử nghiệm phụ trách</label>
                        <select 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none font-bold text-slate-700"
                          value={userForm.responsibilities}
                          onChange={(e) => setUserForm(prev => ({ ...prev, responsibilities: e.target.value }))}
                        >
                          <option value="Tất cả">Tất cả (EMC & ATĐ)</option>
                          <option value="EMC">EMC</option>
                          <option value="ITD">An toàn điện (ITD)</option>
                          <option value="">Không có</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Số điện thoại</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none"
                          placeholder="Số điện thoại liên lạc"
                          value={userForm.phone}
                          onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label>
                        <input 
                          type="email" 
                          className="w-full p-2 border rounded-lg text-xs bg-white outline-none"
                          placeholder="Email liên lạc"
                          value={userForm.email}
                          onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        type="button"
                        onClick={() => setEditingUser(null)} 
                        className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200/50 rounded-lg transition-all"
                      >
                        Hủy
                      </button>
                      <button 
                        type="button"
                        onClick={handleSaveUser}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-sm transition-all"
                      >
                        {editingUser === 'new' ? 'Tạo người dùng' : 'Cập nhật'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto space-y-1 bg-slate-50/50 p-2">
                    {systemUsers.length === 0 && (
                      <div className="text-center text-[10px] text-slate-500 italic py-4">
                        Chưa có tài khoản nào được tạo. Hãy nhấn "THÊM MỚI" để tạo tài khoản đầu tiên.
                      </div>
                    )}
                    {systemUsers.map((user: any) => {
                      const uUsername = user['Tên đăng nhập'] || user['username'] || user.id || '';
                      const uName = user['Họ và Tên'] || user['name'] || '';
                      const uRole = normalizeSystemUserRole(user);
                      const uPosition = user['Chức vụ'] || user['position'] || '';

                      return (
                        <div key={user.id || uUsername} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between shadow-xs hover:border-slate-200 transition-all">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-800 truncate">{uName}</span>
                              <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${
                                uRole === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' :
                                uRole === 'tester' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                'bg-purple-50 text-purple-600 border border-purple-100'
                              }`}>
                                {uRole === 'admin' ? 'Quản lý' : uRole === 'tester' ? 'TNV' : 'Khách'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                              @{uUsername} {uPosition ? `• ${uPosition}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => handleStartEdit(user)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                              title="Sửa thông tin"
                            >
                              <Edit2 size={12} />
                            </button>
                            {confirmDeleteId === user.id ? (
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={async () => {
                                    await deleteUser(user.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors"
                                >
                                  Xác nhận
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  if (currentUser?.username === uUsername) {
                                    toast.error('Bạn không thể xóa tài khoản hiện đang đăng nhập!');
                                    return;
                                  }
                                  setConfirmDeleteId(user.id);
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                title="Xóa tài khoản"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {currentUser?.role === 'admin' && (
              <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Building size={14} className="text-indigo-500"/> Quản lý danh sách Khách hàng
                  </span>
                  {editingCustomerCode === null && (
                    <button
                      type="button"
                      onClick={handleStartCreateCustomer}
                      className="px-2 py-1 text-[10px] bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Plus size={10} /> Thêm khách hàng
                    </button>
                  )}
                </h4>

                {editingCustomerCode !== null ? (
                  <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-100 shadow-sm text-xs">
                    <div className="font-bold text-slate-700">
                      {editingCustomerCode === 'new' ? 'Thêm khách hàng mới' : 'Sửa thông tin khách hàng'}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tên khách hàng *</label>
                        <input
                          type="text"
                          value={customerForm.name}
                          onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                          placeholder="Ví dụ: CÔNG TY CỔ PHẦN CASPER SE"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Mã khách hàng</label>
                        <input
                          type="text"
                          value={customerForm.customerCode}
                          onChange={(e) => setCustomerForm({ ...customerForm, customerCode: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                          placeholder="Ví dụ: KH001"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Địa chỉ</label>
                        <input
                          type="text"
                          value={customerForm.address}
                          onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                          placeholder="Địa chỉ trụ sở/nhận mẫu"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Mã số thuế</label>
                        <input
                          type="text"
                          value={customerForm.taxId}
                          onChange={(e) => setCustomerForm({ ...customerForm, taxId: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                          placeholder="Mã số thuế doanh nghiệp"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomerCode(null);
                          setIsAddingCustomer(false);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors font-medium cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomer}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs transition-colors font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Save size={12} /> Lưu lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                        placeholder="Tìm kiếm theo tên, mã số thuế hoặc địa chỉ..."
                      />
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {(() => {
                        const q = removeAccents(customerSearchQuery).toLowerCase();
                        const filtered = customers.filter(c => {
                          const nameMatch = removeAccents(String(c.name || '')).toLowerCase().includes(q);
                          const addrMatch = removeAccents(String(c.address || '')).toLowerCase().includes(q);
                          const taxMatch = removeAccents(String(c.taxId || '')).toLowerCase().includes(q);
                          const codeMatch = removeAccents(String(c.customerCode || '')).toLowerCase().includes(q);
                          return nameMatch || addrMatch || taxMatch || codeMatch;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center text-[10px] text-slate-400 italic py-4">
                              Không tìm thấy khách hàng phù hợp.
                            </div>
                          );
                        }

                        return filtered.map((c) => {
                          const cKey = c.customerCode || c.name;
                          return (
                            <div key={cKey} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-start justify-between gap-4 shadow-xs text-xs hover:border-indigo-100 hover:bg-indigo-50/10 transition-all">
                              <div className="flex-1 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  {c.name}
                                  {c.customerCode && (
                                    <span className="px-1 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[9px] font-mono">
                                      {c.customerCode}
                                    </span>
                                  )}
                                </div>
                                {c.address && (
                                  <div className="text-[10px] text-slate-500 flex items-start gap-1">
                                    <span className="font-semibold shrink-0">ĐC:</span>
                                    <span>{c.address}</span>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                  {c.taxId && (
                                    <div>
                                      <span className="font-semibold text-slate-500">MST:</span> <span className="font-mono text-slate-600">{c.taxId}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-center">
                                {confirmDeleteCustomerKey === cKey ? (
                                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-100">
                                    <span className="text-[9px] text-red-600 font-bold px-1">Xóa?</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomerClick(cKey)}
                                      className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded hover:bg-red-600 transition-colors cursor-pointer"
                                    >
                                      Có
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCustomerKey(null)}
                                      className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded hover:bg-slate-300 transition-colors cursor-pointer"
                                    >
                                      Không
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditCustomer(c)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                      title="Sửa thông tin khách hàng"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCustomerKey(cKey)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                      title="Xóa khách hàng"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentUser?.role === 'admin' && (
              <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Tag size={14} className="text-rose-500"/> Quản lý danh sách Nhãn hiệu (Brand)
                  </span>
                  {editingBrandName === null && (
                    <button
                      type="button"
                      onClick={handleStartCreateBrand}
                      className="px-2 py-1 text-[10px] bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Plus size={10} /> Thêm nhãn hiệu
                    </button>
                  )}
                </h4>

                {editingBrandName !== null ? (
                  <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-100 shadow-sm text-xs">
                    <div className="font-bold text-slate-700">
                      {editingBrandName === 'new' ? 'Thêm nhãn hiệu mới' : 'Sửa tên nhãn hiệu'}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Tên nhãn hiệu *</label>
                      <input
                        type="text"
                        value={brandForm.name}
                        onChange={(e) => setBrandForm({ name: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-rose-500"
                        placeholder="Ví dụ: Casper, Funiki, Daikin..."
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => setEditingBrandName(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors font-medium cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBrand}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-xs transition-colors font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Save size={12} /> Lưu lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        value={brandSearchQuery}
                        onChange={(e) => setBrandSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-rose-500"
                        placeholder="Tìm kiếm nhãn hiệu..."
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {(() => {
                        const q = removeAccents(brandSearchQuery).toLowerCase();
                        const filtered = brands.filter(b => 
                          removeAccents(String(b)).toLowerCase().includes(q)
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="col-span-full text-center text-[10px] text-slate-400 italic py-4">
                              Không tìm thấy nhãn hiệu phù hợp.
                            </div>
                          );
                        }

                        return filtered.map((b) => (
                          <div key={b} className="bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between shadow-xs text-xs hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                            <span className="font-bold text-slate-800 truncate" title={b}>{b}</span>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {confirmDeleteBrandName === b ? (
                                <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded border border-red-100">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBrandClick(b)}
                                    className="px-1 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded hover:bg-red-600 cursor-pointer"
                                  >
                                    Có
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteBrandName(null)}
                                    className="px-1 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded hover:bg-slate-300 cursor-pointer"
                                  >
                                    K
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditBrand(b)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                    title="Sửa"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteBrandName(b)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                    title="Xóa"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentUser?.role === 'admin' && (
              <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package size={14} className="text-amber-500"/> Quản lý loại sản phẩm (Product Types)
                  </span>
                  {editingProductName === null && (
                    <button
                      type="button"
                      onClick={handleStartCreateProduct}
                      className="px-2 py-1 text-[10px] bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Plus size={10} /> Thêm sản phẩm
                    </button>
                  )}
                </h4>

                {editingProductName !== null ? (
                  <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-100 shadow-sm text-xs">
                    <div className="font-bold text-slate-700">
                      {editingProductName === 'new' ? 'Thêm loại sản phẩm mới' : 'Sửa loại sản phẩm'}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tên loại sản phẩm *</label>
                        <input
                          type="text"
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-amber-500"
                          placeholder="Ví dụ: Điều hòa treo tường, Tủ lạnh..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Thời gian thử nghiệm EMC (phút)</label>
                          <input
                            type="number"
                            value={productForm.testTimeEMC}
                            onChange={(e) => setProductForm({ ...productForm, testTimeEMC: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-amber-500 font-mono"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Thời gian thử nghiệm ATD (phút)</label>
                          <input
                            type="number"
                            value={productForm.testTimeATD}
                            onChange={(e) => setProductForm({ ...productForm, testTimeATD: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-amber-500 font-mono"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => setEditingProductName(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors font-medium cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProduct}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs transition-colors font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Save size={12} /> Lưu lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-hidden focus:border-amber-500"
                        placeholder="Tìm kiếm loại sản phẩm..."
                      />
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {(() => {
                        const q = removeAccents(productSearchQuery).toLowerCase();
                        const filtered = products.filter(p => 
                          removeAccents(String(p.name || '')).toLowerCase().includes(q)
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center text-[10px] text-slate-400 italic py-4">
                              Không tìm thấy loại sản phẩm phù hợp.
                            </div>
                          );
                        }

                        return filtered.map((p) => (
                          <div key={p.name} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between shadow-xs text-xs hover:border-amber-100 hover:bg-amber-50/10 transition-all">
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="font-bold text-slate-800 truncate" title={p.name}>{p.name}</div>
                              <div className="flex gap-4 text-[10px] text-slate-400 mt-1">
                                <div><span className="font-semibold text-slate-500">EMC:</span> <span className="font-mono text-slate-600">{p.testTimeEMC || 0} phút</span></div>
                                <div><span className="font-semibold text-slate-500">ATD:</span> <span className="font-mono text-slate-600">{p.testTimeATD || 0} phút</span></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {confirmDeleteProductName === p.name ? (
                                <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-100">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProductClick(p.name)}
                                    className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded hover:bg-red-600 cursor-pointer"
                                  >
                                    Có
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteProductName(null)}
                                    className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded hover:bg-slate-300 cursor-pointer"
                                  >
                                    Không
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditProduct(p)}
                                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
                                    title="Sửa"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteProductName(p.name)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                    title="Xóa"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentUser?.role === 'admin' && (
              <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500" /> Yêu cầu khôi phục mật khẩu
                </h4>
                
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
                      <div key={req.id} className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col gap-1 shadow-xs text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{req.fullName || 'Người dùng hệ thống'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDateVN(req.timestamp)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Liên hệ: <b className="text-slate-700">{req.contact}</b>
                        </div>
                        <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 p-1.5 rounded mt-1 font-medium">
                          {req.details || 'Đã tự động đặt lại về mặc định 123456'}
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

            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <PartyPopper size={14} className="text-red-500"/> Ngày nghỉ lễ (Custom Holidays)
                </h4>
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <CustomDatePicker 
                            className="w-32 p-2 border rounded-lg text-xs font-bold bg-slate-50 outline-none"
                            value={holidayDate}
                            onChange={(val) => setHolidayDate(val)}
                        />
                        <input 
                            type="text" 
                            className="flex-1 p-2 border rounded-lg text-xs bg-white outline-none"
                            placeholder="Tên ngày lễ (VD: Tết Nguyên Đán)"
                            value={holidayNote}
                            onChange={(e) => setHolidayNote(e.target.value)}
                        />
                        <button 
                            onClick={handleAddHoliday}
                            disabled={!holidayDate}
                            className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                        {holidays.length === 0 && <div className="text-center text-[10px] text-slate-400 italic py-2">Chưa có ngày nghỉ lễ nào</div>}
                        {holidays.map(h => (
                            <div key={h.date} className="flex justify-between items-center p-2 bg-red-50 border border-red-100 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Calendar size={12} className="text-red-400" />
                                    <span className="text-xs font-bold text-red-700">{formatDateVN(h.date)}</span>
                                    <span className="text-[10px] text-red-500 font-medium truncate max-w-[100px]">- {h.note}</span>
                                </div>
                                <button onClick={() => removeHoliday(h.date)} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <User size={14} className="text-purple-500"/> Cấu hình Tự động xếp lịch
                </h4>
                
                <div className="space-y-4">
                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Người thử nghiệm An toàn điện (ITD)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {testers.filter(t => t.name !== 'Khác' && isNotGuest(t)).map(t => {
                                const isSelected = localSettings.defaultTestersAtd?.includes(t.name);
                                return (
                                    <div 
                                        key={t.name}
                                        onClick={() => toggleTester(t.name, 'ATD')}
                                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                        </div>
                                        <span className="text-xs font-bold">{t.shortName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Người thử nghiệm Buồng EMC 1</label>
                        <div className="grid grid-cols-2 gap-2">
                            {testers.filter(t => t.name !== 'Khác' && isNotGuest(t)).map(t => {
                                const isSelected = localSettings.defaultTestersChamber1?.includes(t.name);
                                return (
                                    <div 
                                        key={t.name}
                                        onClick={() => toggleTester(t.name, 'Chamber1')}
                                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                        </div>
                                        <span className="text-xs font-bold">{t.shortName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Người thử nghiệm Buồng EMC 2</label>
                        <div className="grid grid-cols-2 gap-2">
                            {testers.filter(t => t.name !== 'Khác' && isNotGuest(t)).map(t => {
                                const isSelected = localSettings.defaultTestersChamber2?.includes(t.name);
                                return (
                                    <div 
                                        key={t.name}
                                        onClick={() => toggleTester(t.name, 'Chamber2')}
                                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                        </div>
                                        <span className="text-xs font-bold">{t.shortName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-2">
                <h4 className="text-xs font-black text-orange-600 uppercase flex items-center gap-2">
                    <Zap size={14} className="fill-current"/> Chế độ Cao điểm Tự động
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed text-justify">
                    Hệ thống sẽ tự động kích hoạt chế độ <b>"Tăng ca" (22h/ngày)</b> khi tổng số mẫu thử nghiệm EMC tồn trong kho và đang xếp lịch vượt quá <b>{LAB_CONSTANTS.PEAK_LOAD_THRESHOLD} mẫu</b>. (Chỉ áp dụng cho thử nghiệm EMC)
                </p>
            </div>

        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:bg-white hover:shadow-sm uppercase transition-all">Hủy</button>
          <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 flex items-center gap-2 transition-all">
            <Save size={16} /> Lưu thiết lập
          </button>
        </div>
      </div>
    </div>
  );
};

// --- End of SettingsModal.tsx ---
