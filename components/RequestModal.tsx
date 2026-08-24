// Author: Gemini
// OS support: Web/Node
// Description: RequestModal component for creating and editing test requests with customer autofill and otherCustomerInfo autocomplete

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ClipboardList, Loader2, Sparkles, Building2, Box, Settings, Plus, Trash2, ListChecks, Camera, Image as ImageIcon, Pencil, RotateCcw, Save, FileText, ChevronDown, Database, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { RequestStatus, MachineType, PriorityLevel, SampleStatus, TestRequest, LAB_CONSTANTS, CustomerRef, TestCategory } from '../types';
import { generateSequenceCode, calculateLotSequenceInYear, generateSampleEncodeNumber, removeAccents, formatTestTime, formatPhoneNumber } from '../utils/formatter';
import { fileToGenerativePart, extractRequestsFromFile } from '../utils/gemini';
import { searchCustomers, searchBrands } from '../utils/referenceData';
import { deleteRequestModalDraft, getRequestDraftKey, loadRequestModalDraft, saveRequestModalDraft, type RequestDraftRecord, type RequestModalDraft } from '../utils/requestDraft';
import { isIemmSealStamp, normalizeSealStampBase, applySealStampPolicy } from '../utils/sealStampPolicy';
import { useStore } from '../store';
import { CustomDatePicker } from './CustomDatePicker';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (req: TestRequest) => void; 
  requests: TestRequest[];
  existingGroup?: TestRequest[];
}

interface SampleItem {
  id: string;
  modelName: string;
  brand: string;
  type: string;
  quantity: number;
  testTimeEMC: number;
  testTimeATD: number;
  specifications: string;
  standard: string;
  customsDeadline?: string;
  note?: string;
  sampleLocation?: string;
  testCriteria?: string;
  unit?: string;
  testCategory?: TestCategory;
  atdEncodeNumber?: string;
  emcEncodeNumber?: string;
  itdEncodeNumber?: string;
  sealStamp?: string;
  mtt?: string;
  price?: string | number;
  retryCount?: number;
}

interface ScanFile {
  mimeType: string;
  data: string; 
}

const SectionHeader = ({ icon: Icon, title, children }: any) => (
  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-3 mt-4 first:mt-0">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-emerald-600" />
      <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
    </div>
    {children}
  </div>
);

const InputGroup = ({ label, required, children }: any) => (
  <div className="space-y-1 relative w-full">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const inputClass = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold bg-white hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-150 h-[34px] disabled:bg-slate-100/70 disabled:text-slate-400";
const selectClass = "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold bg-white hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-150 h-[34px] cursor-pointer";
const requestCodeInputClass = "w-full border border-emerald-200 bg-emerald-50/20 text-emerald-800 rounded-lg px-2.5 py-1.5 text-[11px] font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase h-[34px]";

const parseDraftPositiveInteger = (value: string, minimum: number): number => {
  if (value === '') return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : 0;
};

const parseDraftOptionalInteger = (value: string, minimum = 0): number | undefined => {
  if (value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : undefined;
};

export const RequestModal = ({ isOpen, onClose, requests, existingGroup }: RequestModalProps) => {
  const { addRequests, customers, brands, products, addCustomer, updateCustomer, currentUser } = useStore();
  const isAdmin = currentUser?.role === 'admin' || 
                  currentUser?.position?.toLowerCase().includes('quản lý') || 
                  currentUser?.position?.toLowerCase().includes('trưởng phòng');
  const requestDraftKey = useMemo(() => getRequestDraftKey(currentUser?.username), [currentUser?.username]);

  const combinedCustomers = useMemo(() => {
    const list = customers.map(c => {
      let finalAddress = String(c.address || '').trim();
      let finalTaxId = String(c.taxId || '').trim();

      const isAddressTaxId = /^[\d\-\s]+$/.test(finalAddress) && finalAddress.length > 5;
      const isTaxIdAddress = /[a-zA-Z]/.test(finalTaxId);

      if (isAddressTaxId) {
          if (isTaxIdAddress) {
              const temp = finalAddress;
              finalAddress = finalTaxId;
              finalTaxId = temp;
          } else {
              finalTaxId = finalAddress;
              finalAddress = '';
          }
      } else if (!finalAddress && isTaxIdAddress) {
          finalAddress = finalTaxId;
          finalTaxId = '';
      }

      return { ...c, address: finalAddress, taxId: finalTaxId };
    });
    
    const seen = new Set(list.map(c => String(c.name || '').toLowerCase().trim()));
    requests.forEach(req => {
      const nameLower = String(req.customerName || '').toLowerCase().trim();
      if (req.customerName && !seen.has(nameLower)) {
        seen.add(nameLower);
        let finalAddress = String(req.address || '').trim();
        let finalTaxId = String(req.taxId || '').trim();

        const isAddressTaxId = /^[\d\-\s]+$/.test(finalAddress) && finalAddress.length > 5;
        const isTaxIdAddress = /[a-zA-Z]/.test(finalTaxId);

        if (isAddressTaxId) {
            if (isTaxIdAddress) {
                const temp = finalAddress;
                finalAddress = finalTaxId;
                finalTaxId = temp;
            } else {
                finalTaxId = finalAddress;
                finalAddress = '';
            }
        } else if (!finalAddress && isTaxIdAddress) {
            finalAddress = finalTaxId;
            finalTaxId = '';
        }

        list.push({
          name: req.customerName,
          address: finalAddress,
          phone: req.phone || '',
          contactPerson: req.contactPerson || '',
          taxId: finalTaxId,
          email: req.email || ''
        });
      }
    });
    return list;
  }, [customers, requests]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicateModelConfirm, setShowDuplicateModelConfirm] = useState(false);
  const [draftRecovery, setDraftRecovery] = useState<RequestModalDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<'inactive' | 'loading' | 'available' | 'active'>('inactive');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftResetToken, setDraftResetToken] = useState(0);
  const draftBaselineRef = useRef<string | null>(null);

  const [sampleList, setSampleList] = useState<SampleItem[]>([]);

  const hasDuplicateMtt = (mttVal: string, sampleId: string) => {
    if (!mttVal) return false;
    const normalized = mttVal.trim().toUpperCase();
    return sampleList.some(s => {
      if (s.id === sampleId) return false;
      const sMtt = (s.mtt || '').trim().toUpperCase();
      return sMtt === normalized;
    });
  };

  const [currentSample, setCurrentSample] = useState<SampleItem>(() => {
    return {
      id: '',
      modelName: '',
      brand: '',
      type: '',
      quantity: 1,
      testTimeEMC: 0,
      testTimeATD: 0,
      unit: 'Cái',
      specifications: '220V~ 50Hz',
      standard: '',
      customsDeadline: '',
      note: '',
      sampleLocation: '',
      testCriteria: '',
      testCategory: TestCategory.ATD,
      atdEncodeNumber: '',
      emcEncodeNumber: '',
      itdEncodeNumber: '',
      sealStamp: ''
    };
  });

  const [generalInfo, setGeneralInfo] = useState(() => {
    const defaultCustName = 'Phòng Giám định - Chứng nhận, Phát triển thị trường';
    const foundCustomer = customers?.find(c => 
      String(c.name || '').toLowerCase().trim() === defaultCustName.toLowerCase().trim()
    );
    return {
      requestCode: '',
      customerName: foundCustomer ? foundCustomer.name : defaultCustName,
      senderUnit: '',
      address: foundCustomer ? (foundCustomer.address ?? '') : 'Số 3, ngõ 76 Đường Trung Văn, Phường Đại Mỗ, Thành phố Hà Nội',
      contactPerson: foundCustomer ? (foundCustomer.contactPerson ?? '') : 'Đặng Đức Bình',
      phone: foundCustomer ? (foundCustomer.phone ?? '') : '',
      email: foundCustomer ? (foundCustomer.email ?? '') : '',
      taxId: foundCustomer ? (foundCustomer.taxId ?? '') : '',
      invoiceCompanyName: '',
      invoiceAddress: '',
      invoiceTaxId: '',
      invoiceEmail: '',
      invoiceReceiverName: '',
      otherCustomerInfo: '',
      labAddress: 'Số 3 ngõ 76 đường Trung Văn, phường Đại Mỗ, Hà Nội',
      resultCopyCount: 2,
      priority: PriorityLevel.NORMAL,
      note: '',
      encodeNumber: '',
      requestDate: new Date().toISOString().split('T')[0],
      receivedDate: new Date().toISOString().split('T')[0],
      deadlineDate: '',
      sampleCondition: 'Mới' as 'Mới' | 'Cũ',
      postTestHandling: 'Lưu mẫu' as 'Lưu mẫu' | 'Hủy' | 'Nhận lại',
      sealStamp: '',
      status: RequestStatus.PENDING as RequestStatus
    };
  });

  const duplicateModelsInCurrentForm = useMemo(() => {
    const dups: { modelName: string; existingRequestCode: string; existingCustomerName: string }[] = [];
    const existingGroupIds = existingGroup ? existingGroup.map(r => r.id) : [];

    sampleList.forEach(sample => {
      if (!sample.modelName) return;
      const cleanModel = String(sample.modelName).trim().toLowerCase();
      if (!cleanModel || cleanModel.length < 2) return;
      
      const matches = requests.filter(req => {
        if (existingGroupIds.includes(req.id)) return false;
        if (generalInfo.requestCode && req.requestCode && req.requestCode.trim().toLowerCase() === generalInfo.requestCode.trim().toLowerCase()) return false;
        if (!req.modelName) return false;
        const reqModel = String(req.modelName).trim().toLowerCase();
        if (!reqModel || reqModel.length < 2) return false;
        return reqModel === cleanModel;
      });

      if (matches.length > 0) {
        if (!dups.some(d => d.modelName.trim().toLowerCase() === cleanModel)) {
          dups.push({
            modelName: sample.modelName,
            existingRequestCode: matches[0].requestCode || 'CHƯA PHÂN LOẠI',
            existingCustomerName: matches[0].customerName || 'Chưa có tên'
          });
        }
      }
    });

    return dups;
  }, [sampleList, requests, existingGroup, generalInfo.requestCode]);

  const existingRequestsWithModel = useMemo(() => {
    if (!currentSample.modelName) return [];
    const cleanModel = String(currentSample.modelName).trim().toLowerCase();
    if (!cleanModel || cleanModel.length < 2) return [];

    const existingGroupIds = existingGroup ? existingGroup.map(r => r.id) : [];
    return requests.filter(req => {
      if (existingGroupIds.includes(req.id)) return false;
      if (generalInfo.requestCode && req.requestCode && req.requestCode.trim().toLowerCase() === generalInfo.requestCode.trim().toLowerCase()) return false;
      if (!req.modelName) return false;
      const reqModel = String(req.modelName).trim().toLowerCase();
      if (!reqModel || reqModel.length < 2) return false;
      return reqModel === cleanModel;
    });
  }, [currentSample.modelName, requests, existingGroup, generalInfo.requestCode]);

  const isDuplicateModel = existingRequestsWithModel.length > 0;
  const [useCustomerInfoForInvoice, setUseCustomerInfoForInvoice] = useState(false);

  const draftPayload = useMemo(() => ({
    generalInfo: generalInfo as unknown as RequestDraftRecord,
    sampleList: sampleList.map(sample => sample as unknown as RequestDraftRecord),
    currentSample: currentSample as unknown as RequestDraftRecord,
    useCustomerInfoForInvoice
  }), [generalInfo, sampleList, currentSample, useCustomerInfoForInvoice]);
  const draftSnapshot = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);

  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerRef[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [otherCustomerSuggestions, setOtherCustomerSuggestions] = useState<CustomerRef[]>([]);
  const [showOtherCustomerSuggestions, setShowOtherCustomerSuggestions] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const customerWrapperRef = useRef<HTMLDivElement>(null);
  const otherCustomerWrapperRef = useRef<HTMLDivElement>(null);
  const brandWrapperRef = useRef<HTMLDivElement>(null);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [showNewCustomerConfirm, setShowNewCustomerConfirm] = useState(false);
  const [newCustomerPendingData, setNewCustomerPendingData] = useState<{
    name: string;
    address: string;
    taxId: string;
    phone: string;
    email: string;
  } | null>(null);
  const [sampleTypeSearch, setSampleTypeSearch] = useState('');
  const [showSampleTypeSuggestions, setShowSampleTypeSuggestions] = useState(false);
  const sampleTypeWrapperRef = useRef<HTMLDivElement>(null);
  const [activeRowProductDropdownId, setActiveRowProductDropdownId] = useState<string | null>(null);
  const [rowProductSearch, setRowProductSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanFiles, setScanFiles] = useState<ScanFile[]>([]); 
  const [isDragging, setIsDragging] = useState(false);

  const reorderSampleList = (list: SampleItem[], encodeNum: string, baseSeal: string): SampleItem[] => {
    const sealStamps = applySealStampPolicy(list.map(sample => sample.sealStamp || ''), baseSeal);
    return list.map((sample, idx) => {
      const updated = { ...sample };
      if (!updated.mtt) {
        updated.mtt = `M${String(idx + 1).padStart(2, '0')}`;
      }

      if (updated.atdEncodeNumber) {
        updated.atdEncodeNumber = generateSampleEncodeNumber('ITDC', encodeNum, updated.mtt);
      }
      if (updated.emcEncodeNumber) {
        updated.emcEncodeNumber = generateSampleEncodeNumber('EMC', encodeNum, updated.mtt);
      }
      if (updated.itdEncodeNumber) {
        updated.itdEncodeNumber = generateSampleEncodeNumber('ITD', encodeNum, updated.mtt);
      }

      if (isIemmSealStamp(baseSeal)) {
        updated.sealStamp = sealStamps[idx];
      }
      return updated;
    });
  };

  const handleGenerateCode = () => {
    const nextCode = generateSequenceCode('DDT', requests, 'requestCode', new Date(generalInfo.requestDate));
    setGeneralInfo(prev => ({ ...prev, requestCode: nextCode }));
  };

  const handleGenerateEncodeNumber = () => {
    const lotSeq = calculateLotSequenceInYear(requests, new Date(generalInfo.requestDate || new Date()));
    const year = new Date(generalInfo.requestDate || new Date()).getFullYear().toString().slice(-2);
    const nextLotEncode = `${lotSeq.toString().padStart(3, '0')}-${year}`;
    
    setGeneralInfo(prev => ({ ...prev, encodeNumber: nextLotEncode }));

    setSampleList(prev => reorderSampleList(prev, nextLotEncode, generalInfo.sealStamp));

    setCurrentSample(prev => {
        const updated = { ...prev };
        const idx = editingSampleId ? sampleList.findIndex(x => x.id === editingSampleId) : sampleList.length;
        const mttVal = updated.mtt || `M${String(idx + 1).padStart(2, '0')}`;
        if (updated.atdEncodeNumber) updated.atdEncodeNumber = generateSampleEncodeNumber('ITDC', nextLotEncode, mttVal);
        if (updated.emcEncodeNumber) updated.emcEncodeNumber = generateSampleEncodeNumber('EMC', nextLotEncode, mttVal);
        if (updated.itdEncodeNumber) updated.itdEncodeNumber = generateSampleEncodeNumber('ITD', nextLotEncode, mttVal);
        return updated;
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (isOpen) {
      draftBaselineRef.current = null;
      setDraftRecovery(null);
      setDraftSavedAt(null);

      if (existingGroup && existingGroup.length > 0) {
        setDraftStatus('inactive');
        const first = existingGroup[0];
        const initialSealStamp = isIemmSealStamp(first.sealStamp)
          ? normalizeSealStampBase(first.sealStamp)
          : (first.sealStamp || '');

        let initialEncodeNumber = first.encodeNumber || '';
        if (!initialEncodeNumber) {
          const sampleEncode = existingGroup.map(req => req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || '').find(Boolean) || '';
          if (sampleEncode) {
            initialEncodeNumber = sampleEncode.replace(/^(ATD|EMC|ITDC|ITD)\s+/i, '').replace(/-M\d+$/i, '');
          }
        }

        setGeneralInfo({
          requestCode: first.requestCode || '',
          customerName: first.customerName || '',
          senderUnit: first.senderUnit || '',
          address: first.address || '',
          contactPerson: first.contactPerson || '',
          phone: first.phone || '',
          email: first.email || '',
          taxId: first.taxId || '',
          invoiceCompanyName: first.invoiceCompanyName || '',
          invoiceAddress: first.invoiceAddress || '',
          invoiceTaxId: first.invoiceTaxId || '',
          invoiceEmail: first.invoiceEmail || '',
          invoiceReceiverName: first.invoiceReceiverName || '',
          otherCustomerInfo: first.otherCustomerInfo || '',
          labAddress: first.labAddress || 'Số 3 ngõ 76 đường Trung Văn, phường Đại Mỗ, Hà Nội',
          resultCopyCount: first.resultCopyCount || 2,
          priority: first.priority || PriorityLevel.NORMAL,
          note: first.note || '',
          encodeNumber: initialEncodeNumber,
          requestDate: first.requestDate ? first.requestDate.split('T')[0] : new Date().toISOString().split('T')[0],
          receivedDate: first.receivedDate ? first.receivedDate.split('T')[0] : (first.requestDate ? first.requestDate.split('T')[0] : new Date().toISOString().split('T')[0]),
          deadlineDate: first.deadlineDate || '',
          sampleCondition: (first.sampleCondition || 'Mới') as any,
          postTestHandling: (first.postTestHandling || 'Lưu mẫu') as any,
          sealStamp: initialSealStamp,
          status: (first.status || RequestStatus.PENDING) as RequestStatus
        });
        
        const mappedSamples: SampleItem[] = existingGroup.map((req, reqIdx) => {
          let existingMtt = req.mtt || '';
          if (!existingMtt) {
            const fields = [req.atdEncodeNumber, req.emcEncodeNumber, req.itdEncodeNumber, req.sealStamp];
            for (const f of fields) {
              if (f && typeof f === 'string') {
                const match = f.match(/-M([A-Z0-9]+)$/i) || f.match(/\s+M([A-Z0-9]+)$/i);
                if (match) {
                  existingMtt = `M${match[1]}`;
                  break;
                }
              }
            }
          }
          if (!existingMtt) {
            existingMtt = `M${String(reqIdx + 1).padStart(2, '0')}`;
          }

          return {
            id: req.id,
            modelName: req.modelName,
            brand: req.brand || '',
            type: req.type || '',
            quantity: req.quantity || 1,
            testTimeEMC: req.testTimeEMC || 0,
            testTimeATD: req.testTimeATD || 0,
            unit: req.unit || 'Cái',
            specifications: req.specifications || '',
            standard: req.standard || '',
            customsDeadline: req.customsDeadline ? req.customsDeadline.split('T')[0] : '',
            note: req.note || '',
            sampleLocation: req.sampleLocation || '',
            testCriteria: req.testCriteria || '',
            testCategory: req.testCategory || TestCategory.ATD,
            atdEncodeNumber: req.atdEncodeNumber || '',
            emcEncodeNumber: req.emcEncodeNumber || '',
            itdEncodeNumber: req.itdEncodeNumber || '',
            sealStamp: req.sealStamp || '',
            mtt: existingMtt,
            retryCount: req.retryCount || 0
          };
        });
        setSampleList(mappedSamples);
        setUseCustomerInfoForInvoice(
          !!first.invoiceCompanyName && first.invoiceCompanyName === first.customerName &&
          first.invoiceTaxId === first.taxId
        );
      } else {
        setDraftStatus('loading');
        const nextCode = generateSequenceCode('DDT', requests, 'requestCode');
        const lotSeq = calculateLotSequenceInYear(requests, new Date());
        const year = new Date().getFullYear().toString().slice(-2);
        const nextLotEncode = `${lotSeq.toString().padStart(3, '0')}-${year}`;

        const defaultCustName = 'Phòng Giám định - Chứng nhận, Phát triển thị trường';
        const foundCustomer = combinedCustomers?.find(c => 
          String(c.name || '').toLowerCase().trim() === defaultCustName.toLowerCase().trim()
        );

        setGeneralInfo(prev => ({ 
          ...prev, 
          requestCode: nextCode, 
          encodeNumber: nextLotEncode,
          requestDate: new Date().toISOString().split('T')[0],
          customerName: foundCustomer ? foundCustomer.name : defaultCustName,
          senderUnit: '',
          address: foundCustomer ? (foundCustomer.address ?? '') : 'Số 3, ngõ 76 Đường Trung Văn, Phường Đại Mỗ, Thành phố Hà Nội',
          contactPerson: foundCustomer ? (foundCustomer.contactPerson ?? '') : 'Đặng Đức Bình',
          phone: foundCustomer ? (foundCustomer.phone ?? '') : '',
          email: foundCustomer ? (foundCustomer.email ?? '') : '',
          taxId: foundCustomer ? (foundCustomer.taxId ?? '') : '',
          invoiceCompanyName: '',
          invoiceAddress: '',
          invoiceTaxId: '',
          invoiceEmail: '',
          invoiceReceiverName: '',
          otherCustomerInfo: '',
          labAddress: 'Số 3 ngõ 76 đường Trung Văn, phường Đại Mỗ, Hà Nội',
          resultCopyCount: 2,
          priority: PriorityLevel.NORMAL,
          note: '',
          receivedDate: new Date().toISOString().split('T')[0],
          deadlineDate: '',
          sampleCondition: 'Mới',
          postTestHandling: 'Lưu mẫu',
          sealStamp: ''
        }));
        setSampleList([]);
        setUseCustomerInfoForInvoice(false);

        void loadRequestModalDraft(requestDraftKey)
          .then(draft => {
            if (cancelled) return;
            if (draft) {
              setDraftRecovery(draft);
              setDraftSavedAt(draft.savedAt);
              setDraftStatus('available');
            } else {
              setDraftStatus('active');
            }
          })
          .catch(() => {
            if (!cancelled) setDraftStatus('active');
          });
      }

      setScanFiles([]);
      setIsScanning(false);
      resetCurrentSample();
      setEditingSampleId(null);
      setCustomerSuggestions([]);
      setBrandSuggestions([]);
      setIsSubmitting(false);
      setActiveRowProductDropdownId(null);
      setRowProductSearch('');
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, existingGroup, requestDraftKey, draftResetToken]);

  useEffect(() => {
    if (!isOpen || draftStatus !== 'active' || draftBaselineRef.current !== null) return;
    draftBaselineRef.current = draftSnapshot;
  }, [isOpen, draftStatus, draftSnapshot]);

  useEffect(() => {
    if (!isOpen || existingGroup?.length || draftStatus !== 'active') return;
    if (!draftBaselineRef.current || draftBaselineRef.current === draftSnapshot) return;

    const timeoutId = window.setTimeout(() => {
      void saveRequestModalDraft(requestDraftKey, draftPayload)
        .then(draft => setDraftSavedAt(draft.savedAt))
        .catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, existingGroup, draftStatus, draftSnapshot, draftPayload, requestDraftKey]);


  const prevGeneralSealStampRef = useRef(generalInfo.sealStamp);

  useEffect(() => {
    if (prevGeneralSealStampRef.current !== generalInfo.sealStamp) {
      prevGeneralSealStampRef.current = generalInfo.sealStamp;
      setSampleList(prev => reorderSampleList(prev, generalInfo.encodeNumber, generalInfo.sealStamp));
    }
  }, [generalInfo.sealStamp]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerWrapperRef.current && !customerWrapperRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
      if (otherCustomerWrapperRef.current && !otherCustomerWrapperRef.current.contains(event.target as Node)) {
        setShowOtherCustomerSuggestions(false);
      }
      if (brandWrapperRef.current && !brandWrapperRef.current.contains(event.target as Node)) {
        setShowBrandSuggestions(false);
      }
      if (sampleTypeWrapperRef.current && !sampleTypeWrapperRef.current.contains(event.target as Node)) {
        setShowSampleTypeSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const newFiles: ScanFile[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            try {
              const base64 = await fileToGenerativePart(file);
              newFiles.push({ mimeType: file.type, data: base64 });
              toast.success("Đã dán ảnh từ Clipboard thành công!");
            } catch (err) {
              console.error("Lỗi đọc file paste:", err);
              toast.error("Không thể đọc ảnh dán");
            }
          }
        }
      }
      if (newFiles.length > 0) {
        setScanFiles(prev => [...prev, ...newFiles]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const newFiles: ScanFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
      if (file.type.startsWith('image/') || file.type === 'application/pdf' || isWord) {
        try {
          const base64 = await fileToGenerativePart(file);
          const mimeType = file.type || (isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');
          newFiles.push({ mimeType, data: base64 });
        } catch (err) {
          console.error("Lỗi đọc file kéo thả:", err);
          toast.error(`Không thể đọc file: ${file.name}`);
        }
      } else {
        toast.error(`File không đúng định dạng (chỉ nhận Ảnh/PDF/Word): ${file.name}`);
      }
    }
    if (newFiles.length > 0) {
      setScanFiles(prev => [...prev, ...newFiles]);
      toast.success(`Đã thêm ${newFiles.length} tài liệu từ kéo thả!`);
    }
  };

  
  const updateCustomerList = (value: string) => {
      if (!value || String(value).trim().length === 0) {
          setCustomerSuggestions(combinedCustomers.slice(0, 50));
      } else {
          const suggestions = searchCustomers(value, combinedCustomers);
          setCustomerSuggestions(suggestions);
      }
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGeneralInfo(prev => ({ ...prev, customerName: value }));
    updateCustomerList(value);
    setShowCustomerSuggestions(true);
  };

  const handleCustomerFocus = () => {
      updateCustomerList(generalInfo.customerName);
      setShowCustomerSuggestions(true);
  };

  const toggleCustomerDropdown = () => {
      if (showCustomerSuggestions) {
          setShowCustomerSuggestions(false);
      } else {
          updateCustomerList(generalInfo.customerName);
          setShowCustomerSuggestions(true);
      }
  };

  const selectCustomer = (customer: CustomerRef) => {
    setGeneralInfo(prev => ({
        ...prev,
        customerName: customer.name,
        address: customer.address ?? '',
        taxId: customer.taxId ?? '',
        phone: formatPhoneNumber(customer.phone) ?? '',
        email: customer.email ?? '',
        contactPerson: customer.contactPerson ?? ''
    }));
    setShowCustomerSuggestions(false);
  };

  const clearCustomer = () => {
      setGeneralInfo(prev => ({ ...prev, customerName: '', address: '' }));
      updateCustomerList('');
      setShowCustomerSuggestions(true);
  }

  const handleOtherCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGeneralInfo(prev => ({ ...prev, otherCustomerInfo: value }));
    if (value && value.trim().length > 0) {
      const suggestions = searchCustomers(value, combinedCustomers);
      setOtherCustomerSuggestions(suggestions);
      setShowOtherCustomerSuggestions(true);
    } else {
      setOtherCustomerSuggestions([]);
      setShowOtherCustomerSuggestions(false);
    }
  };

  const handleOtherCustomerFocus = () => {
    if (generalInfo.otherCustomerInfo && generalInfo.otherCustomerInfo.trim().length > 0) {
      const suggestions = searchCustomers(generalInfo.otherCustomerInfo, combinedCustomers);
      setOtherCustomerSuggestions(suggestions);
      setShowOtherCustomerSuggestions(true);
    }
  };

  const selectOtherCustomer = (customer: CustomerRef) => {
    setGeneralInfo(prev => ({
      ...prev,
      otherCustomerInfo: customer.name
    }));
    setShowOtherCustomerSuggestions(false);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentSample(prev => ({ ...prev, brand: value }));
    if (String(value).trim().length > 0) {
        const suggestions = searchBrands(value, brands);
        setBrandSuggestions(suggestions);
        setShowBrandSuggestions(true);
    } else {
        setBrandSuggestions(brands.slice(0, 10));
        setShowBrandSuggestions(true);
    }
  };

  const selectBrand = (brand: string) => {
    setCurrentSample(prev => ({ ...prev, brand: brand }));
    setShowBrandSuggestions(false);
  };

  const handleAddBrandDirectly = (brandName: string) => {
    if (!brandName || String(brandName).trim() === '') return;
    const cleanBrand = String(brandName).trim();
    useStore.getState().addBrand(cleanBrand);
    setCurrentSample(prev => ({ ...prev, brand: cleanBrand }));
    setShowBrandSuggestions(false);
    toast.success(`Đã thêm mới nhãn hiệu: "${cleanBrand}"`);
  };

  const resetCurrentSample = () => {
    setCurrentSample({
      id: '',
      modelName: '',
      brand: '',
      type: '',
      quantity: 1,
      testTimeEMC: 0,
      testTimeATD: 0,
      specifications: '220V~ 50Hz',
      standard: '',
      customsDeadline: '',
      note: '',
      sampleLocation: '',
      testCriteria: '',
      unit: 'Cái',
      testCategory: TestCategory.ATD,
      atdEncodeNumber: '',
      emcEncodeNumber: '',
      itdEncodeNumber: '',
      sealStamp: ''
    });
    setSampleTypeSearch('');
    setEditingSampleId(null);
  };

  const handleDeleteRequestDraft = async () => {
    try {
      await deleteRequestModalDraft(requestDraftKey);
      draftBaselineRef.current = null;
      setDraftRecovery(null);
      setDraftSavedAt(null);
      setDraftStatus('loading');
      setDraftResetToken(prev => prev + 1);
      toast.success('Đã xóa bản nháp và làm mới biểu mẫu.');
    } catch {
      toast.error('Không thể xóa bản nháp trên thiết bị này.');
    }
  };

  const handleRestoreRequestDraft = () => {
    if (!draftRecovery) return;
    const { payload } = draftRecovery;

    setGeneralInfo(payload.generalInfo as typeof generalInfo);
    setSampleList(payload.sampleList as unknown as SampleItem[]);
    setCurrentSample(payload.currentSample as unknown as SampleItem);
    setUseCustomerInfoForInvoice(payload.useCustomerInfoForInvoice);
    setScanFiles([]);
    setIsScanning(false);
    setEditingSampleId(null);
    setSampleTypeSearch('');
    setDraftRecovery(null);
    setDraftStatus('active');
    draftBaselineRef.current = null;
    toast.success('Đã khôi phục bản nháp.');
  };

  const handleModalClose = () => {
    if (!existingGroup?.length && draftStatus === 'active' && draftBaselineRef.current && draftBaselineRef.current !== draftSnapshot) {
      void saveRequestModalDraft(requestDraftKey, draftPayload).catch(() => undefined);
    }
    onClose();
  };

  
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: ScanFile[] = [];
    for (let i = 0; i < files.length; i++) {
        try {
            const file = files[i];
            const base64 = await fileToGenerativePart(file);
            const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
            const mimeType = file.type || (isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');
            newFiles.push({ mimeType, data: base64 });
        } catch (err) {
            console.error("Lỗi đọc file:", err);
            toast.error(`Không thể đọc file: ${files[i].name}`);
        }
    }
    setScanFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeScanFile = (index: number) => {
    setScanFiles(prev => prev.filter((_, i) => i !== index));
  };

  const executeAiScan = async () => {
    if (scanFiles.length === 0) return;
    setIsScanning(true);
    const loadingToast = toast.loading("AI đang phân tích tài liệu...");
    try {
      const data = await extractRequestsFromFile(scanFiles, brands, customers, products.map(p => p.name));
      setGeneralInfo(prev => ({
        ...prev,
        customerName: data.customerInfo.name || prev.customerName,
        senderUnit: data.customerInfo.senderUnit || prev.senderUnit,
        address: data.customerInfo.address || prev.address,
        phone: data.customerInfo.phone || prev.phone,
        taxId: data.customerInfo.taxId || prev.taxId,
        contactPerson: data.customerInfo.contactPerson || prev.contactPerson,
        sealStamp: data.sealStamp || prev.sealStamp || '',
        sampleCondition: (data.sampleCondition as any) || prev.sampleCondition,
        postTestHandling: (data.postTestHandling as any) || prev.postTestHandling,
        resultCopyCount: data.resultCopyCount !== undefined ? data.resultCopyCount : prev.resultCopyCount,
      }));
      if (data.samples && data.samples.length > 0) {
        const newSamples: SampleItem[] = data.samples.map((s, index) => {
          const matchedProduct = products.find(p => p.name === s.type);
          const currentSealStamp = data.sealStamp || '';
          const mttVal = `M${String(index + 1).padStart(2, '0')}`;
          const encodeNum = generalInfo.encodeNumber;

          const cats = s.testCategories || [];
          const isEMC = cats.includes('EMC');
          const isITD = cats.includes('ITD');
          const isITDC = cats.includes('ITDC');

          const atdCode = isITDC ? generateSampleEncodeNumber('ITDC', encodeNum, mttVal) : '';
          const emcCode = isEMC ? generateSampleEncodeNumber('EMC', encodeNum, mttVal) : '';
          const itdCode = isITD ? generateSampleEncodeNumber('ITD', encodeNum, mttVal) : '';

          let sampleStandard = s.standard || '';
          if (isEMC && !sampleStandard.includes('TCVN 7492-1: 2018')) {
            sampleStandard = sampleStandard ? `${sampleStandard}, TCVN 7492-1: 2018` : 'TCVN 7492-1: 2018';
          }

          let derivedCat = TestCategory.ATD;
          if (isEMC && (isITD || isITDC)) {
            derivedCat = TestCategory.BOTH;
          } else if (isEMC) {
            derivedCat = TestCategory.EMC;
          }

          return {
            id: `ai-${Date.now()}-${index}`,
            modelName: s.modelName || 'Unknown',
            brand: s.brand || '',
            type: s.type || MachineType.AIR_CONDITIONER,
            quantity: s.quantity || 1,
            testTimeEMC: matchedProduct?.testTimeEMC || 0,
            testTimeATD: matchedProduct?.testTimeATD || 0,
            specifications: s.specifications || '220V~ 50Hz',
            standard: sampleStandard,
            customsDeadline: '',
            note: '',
            sampleLocation: '',
            testCriteria: s.testCriteria || '',
            unit: 'Cái',
            testCategory: derivedCat,
            atdEncodeNumber: atdCode,
            emcEncodeNumber: emcCode,
            itdEncodeNumber: itdCode,
            mtt: mttVal,
            sealStamp: isIemmSealStamp(currentSealStamp)
              ? `${currentSealStamp}-${mttVal}`
              : ((s as any).sealStamp || (index === 0 ? currentSealStamp : ''))
          };
        });
        setSampleList(prev => reorderSampleList([...prev, ...newSamples], generalInfo.encodeNumber, data.sealStamp || generalInfo.sealStamp));
        toast.dismiss(loadingToast);
        toast.success(`AI đã tìm thấy ${newSamples.length} mẫu.`);
        setScanFiles([]);
      } else {
        toast.dismiss(loadingToast);
        toast.info("AI không tìm thấy thông tin mẫu nào.");
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error("Lỗi phân tích AI: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddSample = () => {
    if (!String(currentSample.modelName || "").trim()) {
      toast.warning("Vui lòng nhập Tên Model!");
      return;
    }

    if (currentSample.brand && String(currentSample.brand || "").trim() !== '') {
      useStore.getState().addBrand(String(currentSample.brand || "").trim());
    }

    const nextIdx = sampleList.length;
    const defaultSeal = isIemmSealStamp(generalInfo.sealStamp)
      ? (nextIdx === 0 ? generalInfo.sealStamp : `${generalInfo.sealStamp}-M${String(nextIdx + 1).padStart(2, '0')}`)
      : (nextIdx === 0 ? generalInfo.sealStamp : '');
    const sampleToAdd = { 
        ...currentSample, 
        id: `manual-${Date.now()}`,
        quantity: currentSample.quantity > 0 ? currentSample.quantity : 1,
        retryCount: currentSample.retryCount ?? 0,
        sealStamp: currentSample.sealStamp || defaultSeal
    };

    const newList = [...sampleList, sampleToAdd];
    setSampleList(reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp));
    resetCurrentSample();
  };

  const handleEditSample = (sample: SampleItem) => {
    setCurrentSample(sample);
    setSampleTypeSearch(sample.type);
    setEditingSampleId(sample.id);
  };

  const handleUpdateSample = () => {
    if (!String(currentSample.modelName || "").trim()) {
      toast.warning("Vui lòng nhập Tên Model!");
      return;
    }
    
    if (currentSample.brand && String(currentSample.brand || "").trim() !== '') {
      useStore.getState().addBrand(String(currentSample.brand || "").trim());
    }
    
    const normalizedSample = {
      ...currentSample,
      quantity: currentSample.quantity > 0 ? currentSample.quantity : 1,
      retryCount: currentSample.retryCount ?? 0
    };
    const newList = sampleList.map(item => item.id === editingSampleId ? normalizedSample : item);
    setSampleList(reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp));
    resetCurrentSample();
  };

  const removeSample = (id: string) => {
    const newList = sampleList.filter(s => s.id !== id);
    setSampleList(reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp));
    if (editingSampleId === id) resetCurrentSample();
  };

  
  
  const filteredProducts = useMemo(() => {
      const query = removeAccents(sampleTypeSearch).toLowerCase().trim();
      const productList = products.length > 0 ? products.map(p => p.name) : Object.values(MachineType);
      if (!query) return productList;
      
      const queryWords = query.split(/\s+/).filter(Boolean);
      return productList.filter(name => {
          const nameNormalized = removeAccents(name || '').toLowerCase();
          return queryWords.every(word => nameNormalized.includes(word));
      });
  }, [sampleTypeSearch, products]);

  
  const executeSaveRequests = async (saveCustomer: boolean, autoCustomerData?: any) => {
    setIsSubmitting(true);
    const isSubmittingId = toast.loading("Đang lưu phiếu yêu cầu...", { duration: Infinity });

    try {
      const dataToSave = autoCustomerData || newCustomerPendingData;
      if (saveCustomer && dataToSave) {
        const nameClean = String(dataToSave.name || '').toLowerCase().trim();
        const existingCustomer = customers.find(c => String(c.name || '').toLowerCase().trim() === nameClean);
        
        if (existingCustomer) {
          const updates = {
            name: dataToSave.name,
            address: dataToSave.address,
            taxId: dataToSave.taxId,
            customerCode: existingCustomer.customerCode || ''
          };
          updateCustomer(existingCustomer.customerCode || existingCustomer.name, updates);
          toast.info(`Thông tin khách hàng "${dataToSave.name}" đã được cập nhật vào cơ sở dữ liệu.`);
        } else {
          const newCustomerObj = {
            name: dataToSave.name,
            address: dataToSave.address,
            taxId: dataToSave.taxId
          };
          addCustomer(newCustomerObj);
          toast.info(`Khách hàng mới "${dataToSave.name}" đã được lưu vào cơ sở dữ liệu.`);
        }
      }

      const lotSeq = calculateLotSequenceInYear(requests);
      const requestDurationDays = 20;
      const totalLotDays = 20;

      const customerTaxId = String(generalInfo.taxId || '').trim();
      const requestsToCreate: TestRequest[] = [];
      const { deleteRequest, updateRequest } = useStore.getState();

      const currentSampleIds = sampleList.map(s => s.id);
      
      if (existingGroup) {
          const existingIds = existingGroup.map(r => r.id);
          const deletedIds = existingIds.filter(id => !currentSampleIds.includes(id));
          deletedIds.forEach(id => {
              deleteRequest(id);
          });
      }

      sampleList.forEach((sample, index) => {
          const isATD = !!sample.atdEncodeNumber || !!sample.itdEncodeNumber;
          const isEMC = !!sample.emcEncodeNumber;
          const derivedCategory = (isATD && isEMC) ? TestCategory.BOTH : (isEMC ? TestCategory.EMC : TestCategory.ATD);
          
          const matchedProduct = products.find(p => String(p.name || '').toLowerCase().trim() === String(sample.type || '').toLowerCase().trim());

          let rawEMC = sample.testTimeEMC || matchedProduct?.testTimeEMC || 0;
          let rawATD = sample.testTimeATD || matchedProduct?.testTimeATD || 0;

          let timeEMC = 0;
          let timeATD = 0;
          if (isATD || isEMC) {
              timeEMC = isEMC ? rawEMC : 0;
              timeATD = isATD ? rawATD : 0;
          } else {
              timeEMC = rawEMC;
              timeATD = rawATD;
          }
          
          const isNew = !existingGroup || sample.id.startsWith('manual-') || sample.id.startsWith('ai-') || sample.id === '';
          const reqId = isNew ? `r-${Date.now()}-${index}` : sample.id;

          const reqData: TestRequest = {
              id: reqId,
              requestCode: generalInfo.requestCode,
              status: generalInfo.status || RequestStatus.PENDING,
              sampleStatus: SampleStatus.WAITING,
              requestDate: generalInfo.requestDate,
              scheduledDate: null,
              testTimeEMC: timeEMC,
              testTimeATD: timeATD,
              customerName: generalInfo.customerName,
              senderUnit: generalInfo.senderUnit,
              address: generalInfo.address,
              contactPerson: generalInfo.contactPerson,
              phone: generalInfo.phone,
              email: generalInfo.email,
              taxId: generalInfo.taxId,
              invoiceCompanyName: useCustomerInfoForInvoice ? generalInfo.customerName : generalInfo.invoiceCompanyName,
              invoiceAddress: useCustomerInfoForInvoice ? generalInfo.address : generalInfo.invoiceAddress,
              invoiceTaxId: useCustomerInfoForInvoice ? generalInfo.taxId : generalInfo.invoiceTaxId,
              invoiceEmail: useCustomerInfoForInvoice ? generalInfo.email : generalInfo.invoiceEmail,
              invoiceReceiverName: useCustomerInfoForInvoice ? generalInfo.contactPerson : generalInfo.invoiceReceiverName,
              otherCustomerInfo: generalInfo.otherCustomerInfo,
              labAddress: generalInfo.labAddress,
              resultCopyCount: generalInfo.resultCopyCount > 0 ? generalInfo.resultCopyCount : 1,
              priority: generalInfo.priority,
              note: sample.note || generalInfo.note,
              modelName: sample.modelName,
              brand: sample.brand,
              type: sample.type as MachineType,
              testCategory: derivedCategory,
              quantity: sample.quantity > 0 ? sample.quantity : 1,
              unit: sample.unit || 'Cái',
              sampleCondition: generalInfo.sampleCondition,
              postTestHandling: generalInfo.postTestHandling,
              atdEncodeNumber: sample.atdEncodeNumber,
              emcEncodeNumber: sample.emcEncodeNumber,
              itdEncodeNumber: sample.itdEncodeNumber,
              encodeNumber: generalInfo.encodeNumber,
              specifications: sample.specifications,
              standard: sample.standard,
              customsDeadline: sample.customsDeadline,
              receivedDate: generalInfo.receivedDate || generalInfo.requestDate || new Date().toISOString().split('T')[0],
              deadlineDate: generalInfo.deadlineDate,
              duration: requestDurationDays,
              totalLotDays: totalLotDays,
              ecnCode: '',
              sampleLocation: sample.sampleLocation,
              price: sample.price,
              testCriteria: sample.testCriteria,
              sealStamp: sample.sealStamp || '',
              mtt: sample.mtt || '',
              retryCount: sample.retryCount || 0
          };

          if (isNew) {
              requestsToCreate.push(reqData);
          } else {
              const existingItem = existingGroup?.find(r => r.id === reqId);
              if (existingItem) {
                  reqData.status = generalInfo.status || existingItem.status;
                  reqData.sampleStatus = existingItem.sampleStatus;
                  reqData.scheduledDate = existingItem.scheduledDate;
                  reqData.ecnCode = existingItem.ecnCode;
                  reqData.result = existingItem.result;
                  reqData.retryCount = sample.retryCount !== undefined ? sample.retryCount : (existingItem.retryCount || 0);
                  reqData.lastFailReason = existingItem.lastFailReason;
                  updateRequest(reqId, reqData);
              }
          }
      });

      if (requestsToCreate.length > 0) {
          await addRequests(requestsToCreate, true);
      }
      
      await useStore.getState().syncWithCloud(true);

      if (!existingGroup?.length) {
        await deleteRequestModalDraft(requestDraftKey).catch(() => undefined);
      }
      
      toast.success(existingGroup ? `Đã cập nhật phiếu ${generalInfo.requestCode}.` : `Đã nhận phiếu ${generalInfo.requestCode} với ${sampleList.length} mẫu.`, { id: isSubmittingId, duration: 4000 });
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi khi lưu dữ liệu: ${err.message}`, { id: isSubmittingId, duration: 5000 });
    } finally {
      setIsSubmitting(false);
      setShowNewCustomerConfirm(false);
      setNewCustomerPendingData(null);
    }
  };

  const proceedToSave = async () => {
    const customerTaxId = String(generalInfo.taxId || '').trim();

    if (!customerTaxId) {
        await executeSaveRequests(false);
        return;
    }

    let isNewCustomer = false;
    let pendingData = null;

    if (generalInfo.customerName) {
        const nameClean = String(generalInfo.customerName).toLowerCase().trim();
        const existingCustomer = customers.find(c => String(c.name || '').toLowerCase().trim() === nameClean);

        if (existingCustomer) {
            const currentAddress = String(generalInfo.address || '').trim();
            const dbTaxId = String(existingCustomer.taxId || '').trim();
            const dbAddress = String(existingCustomer.address || '').trim();

            const hasChanges = 
                (customerTaxId !== dbTaxId) ||
                (currentAddress !== dbAddress);

            if (hasChanges) {
                isNewCustomer = true;
                pendingData = {
                    name: generalInfo.customerName,
                    address: generalInfo.address || existingCustomer.address || '',
                    taxId: customerTaxId
                };
            }
        } else {
            isNewCustomer = true;
            pendingData = {
                name: generalInfo.customerName,
                address: generalInfo.address || '',
                taxId: customerTaxId
            };
        }
    }

    if (isNewCustomer && pendingData) {
        await executeSaveRequests(true, pendingData);
    } else {
        await executeSaveRequests(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sampleList.length === 0) {
      toast.warning("Vui lòng thêm ít nhất một mẫu thử!");
      return;
    }
    if (!generalInfo.customerName || !generalInfo.requestCode) {
      toast.warning("Thiếu Mã PYC hoặc Tên Khách Hàng!");
      return;
    }

    const mtts = sampleList.map((sample, idx) => (sample.mtt || `M${String(idx + 1).padStart(2, '0')}`).trim().toUpperCase());
    const duplicateMtts = mtts.filter((item, index) => mtts.indexOf(item) !== index);
    if (duplicateMtts.length > 0) {
      toast.warning(`Mã mẫu thử (MTT) "${duplicateMtts[0]}" bị trùng lặp! Vui lòng kiểm tra lại.`);
      return;
    }

    setIsSubmitting(true);
    const syncToastId = toast.loading("Đang kiểm tra dữ liệu mới nhất từ cơ sở dữ liệu...", { duration: Infinity });
    
    let latestRequests = requests;
    try {
      latestRequests = await useStore.getState().fetchLatestRequests();
    } catch (err) {
      console.warn("Lỗi đồng bộ kiểm tra trước khi lưu:", err);
    } finally {
      toast.dismiss(syncToastId);
      setIsSubmitting(false);
    }

    const existingGroupIds = existingGroup ? existingGroup.map(r => r.id) : [];

    const reqCodeClean = generalInfo.requestCode ? generalInfo.requestCode.trim().toLowerCase() : '';
    if (reqCodeClean) {
      const isRequestCodeDuplicate = latestRequests.some(req => 
        !existingGroupIds.includes(req.id) && 
        req.requestCode &&
        req.requestCode.trim().toLowerCase() === reqCodeClean
      );
      if (isRequestCodeDuplicate) {
        toast.error(`Số phiếu yêu cầu (Mã PYC) "${generalInfo.requestCode.trim()}" đã tồn tại trên hệ thống (do người dùng khác vừa tạo)! Vui lòng nhập hoặc đổi sang số phiếu khác.`, { duration: 6000 });
        return;
      }
    }

    const encodeNumClean = generalInfo.encodeNumber ? generalInfo.encodeNumber.trim().toLowerCase() : '';
    if (encodeNumClean) {
      const duplicateEncodeReq = latestRequests.find(req => 
        !existingGroupIds.includes(req.id) && 
        req.encodeNumber &&
        req.encodeNumber.trim().toLowerCase() === encodeNumClean
      );
      if (duplicateEncodeReq) {
        toast.error(`Số mã hóa lô "${generalInfo.encodeNumber.trim()}" đã tồn tại ở PYC "${duplicateEncodeReq.requestCode || 'CHƯA PHÂN LOẠI'}" trên hệ thống! Vui lòng nhập hoặc đổi sang số lô khác.`, { duration: 6000 });
        return;
      }
    }

    for (const sample of sampleList) {
      if (sample.atdEncodeNumber && sample.atdEncodeNumber.trim()) {
        const atdClean = sample.atdEncodeNumber.trim().toLowerCase();
        const dup = latestRequests.find(req => 
          !existingGroupIds.includes(req.id) && 
          req.atdEncodeNumber && 
          req.atdEncodeNumber.trim().toLowerCase() === atdClean
        );
        if (dup) {
          toast.error(`Mã mã hóa mẫu ATD "${sample.atdEncodeNumber.trim()}" đã tồn tại ở PYC "${dup.requestCode || 'CHƯA PHÂN LOẠI'}"! Vui lòng đổi sang mã khác.`, { duration: 6000 });
          return;
        }
      }
      if (sample.emcEncodeNumber && sample.emcEncodeNumber.trim()) {
        const emcClean = sample.emcEncodeNumber.trim().toLowerCase();
        const dup = latestRequests.find(req => 
          !existingGroupIds.includes(req.id) && 
          req.emcEncodeNumber && 
          req.emcEncodeNumber.trim().toLowerCase() === emcClean
        );
        if (dup) {
          toast.error(`Mã mã hóa mẫu EMC "${sample.emcEncodeNumber.trim()}" đã tồn tại ở PYC "${dup.requestCode || 'CHƯA PHÂN LOẠI'}"! Vui lòng đổi sang mã khác.`, { duration: 6000 });
          return;
        }
      }
      if (sample.itdEncodeNumber && sample.itdEncodeNumber.trim()) {
        const itdClean = sample.itdEncodeNumber.trim().toLowerCase();
        const dup = latestRequests.find(req => 
          !existingGroupIds.includes(req.id) && 
          req.itdEncodeNumber && 
          req.itdEncodeNumber.trim().toLowerCase() === itdClean
        );
        if (dup) {
          toast.error(`Mã mã hóa mẫu ITD "${sample.itdEncodeNumber.trim()}" đã tồn tại ở PYC "${dup.requestCode || 'CHƯA PHÂN LOẠI'}"! Vui lòng đổi sang mã khác.`, { duration: 6000 });
          return;
        }
      }
    }

    sampleList.forEach(sample => {
      if (sample.brand && String(sample.brand || "").trim() !== '') {
        useStore.getState().addBrand(String(sample.brand || "").trim());
      }
    });

    if (duplicateModelsInCurrentForm.length > 0) {
      setShowDuplicateModelConfirm(true);
    } else {
      await proceedToSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end md:items-center justify-center md:p-4 backdrop-blur-sm">
      {}
       <div className="absolute inset-0" onClick={handleModalClose} aria-label="Đóng modal"></div>
      
      <div className="bg-white w-full md:max-w-7xl h-[90vh] max-h-[calc(100dvh-1rem)] md:h-[85vh] md:max-h-[calc(100dvh-2rem)] rounded-t-[2rem] md:rounded-[2.5rem] shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200 relative z-10">
        
         <div className="bg-emerald-600 p-4 md:p-5 text-white flex justify-between items-center relative overflow-hidden shrink-0">
           <div className="relative z-10 flex flex-col gap-0.5">
             <div className="flex items-center gap-4">
                 <h3 className="text-base md:text-lg font-black uppercase">{existingGroup && existingGroup.length > 0 ? "Chỉnh sửa Phiếu Yêu Cầu" : "Tạo Phiếu Yêu Cầu"}</h3>
             </div>
             <p className="text-[10px] md:text-xs text-emerald-100 font-medium flex items-center gap-1">
               <Database size={12}/> Nhập liệu thủ công hoặc sử dụng AI để quét tài liệu
             </p>
           </div>
            <button onClick={handleModalClose} className="p-2 hover:bg-white/20 rounded-full relative z-10 transition-all"><X size={20}/></button>
            <div className="absolute top-0 right-0 p-6 opacity-10"><ClipboardList size={80} /></div>
         </div>

         {!existingGroup?.length && draftStatus === 'loading' && (
           <div className="absolute inset-0 z-[30] flex items-center justify-center bg-white/80 p-4 backdrop-blur-[1px]" aria-live="polite">
             <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-600 shadow-lg">
               <Loader2 size={16} className="animate-spin text-emerald-600" /> Đang kiểm tra bản nháp...
             </div>
           </div>
         )}

         {!existingGroup?.length && draftRecovery && (
           <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2.5 md:px-5">
             <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
               <div className="flex items-start gap-2 text-amber-900">
                 <RotateCcw size={16} className="mt-0.5 shrink-0" />
                 <div>
                   <p className="text-[11px] font-black uppercase">Tìm thấy bản nháp chưa hoàn tất</p>
                   <p className="text-[10px] font-medium text-amber-800">Bạn có muốn tiếp tục nhập liệu từ lần trước không?</p>
                 </div>
               </div>
               <div className="flex shrink-0 gap-2">
                 <button type="button" onClick={handleRestoreRequestDraft} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase text-white shadow-sm transition-colors hover:bg-emerald-700">
                   <RotateCcw size={12} /> Khôi phục bản nháp
                 </button>
                 <button type="button" onClick={handleDeleteRequestDraft} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-red-600 transition-colors hover:bg-red-50">
                   <Trash2 size={12} /> Xóa bản nháp
                 </button>
               </div>
             </div>
           </div>
         )}

         <>
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-b border-slate-200 shrink-0 transition-colors p-2 md:p-3 ${isDragging ? 'bg-emerald-50 border-emerald-400' : 'bg-slate-50'}`}
                >
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-3 justify-between border-2 border-dashed border-slate-200 rounded-xl p-2.5 bg-slate-50 shadow-sm hover:border-emerald-500 transition-colors relative group">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <label className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileInput} />
                                <Camera size={14} />
                                <span className="text-[10px] font-bold uppercase">Chụp ảnh</span>
                            </label>
                            <label className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" className="hidden" accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple onChange={handleFileInput} />
                                <ImageIcon size={14} />
                                <span className="text-[10px] font-bold uppercase">Tải Ảnh/PDF/Word</span>
                            </label>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-0.5 hidden md:flex">
                            <span className="text-[11px] font-semibold text-slate-600">Kéo thả file ảnh, PDF hoặc Word (.docx) vào đây</span>
                            <span className="text-[9px] text-slate-400">hoặc nhấn phím tắt <kbd className="bg-slate-100 px-1 py-0.5 rounded border text-[9px] font-bold">Ctrl + V</kbd></span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto max-w-full py-0.5">
                            {scanFiles.length === 0 ? (
                                <span className="text-[10px] text-slate-400 italic md:hidden">Chưa chọn tài liệu</span>
                            ) : (
                                <div className="flex gap-1">
                                    {scanFiles.map((file, idx) => (
                                        <div key={idx} className="relative w-8 h-8 shrink-0 group/file bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center">
                                            {file.mimeType === 'application/pdf' ? <FileText size={16} className="text-red-500" /> : <img src={`data:${file.mimeType};base64,${file.data}`} className="w-full h-full object-cover rounded-md" alt="scan" />}
                                            <button type="button" onClick={() => removeScanFile(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover/file:opacity-100 transition-opacity z-10"><X size={8} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {scanFiles.length > 0 && (
                            <button type="button" onClick={executeAiScan} disabled={isScanning} className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-black text-[10px] uppercase shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50 shrink-0">
                                {isScanning ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                                {isScanning ? "Đang quét..." : `AI quét ${scanFiles.length} file`}
                            </button>
                        )}
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 md:p-4 bg-slate-100/80">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
                    <div className="lg:col-span-4 space-y-3 lg:order-1">
                    <div className="bg-indigo-50 p-3 md:p-4 rounded-xl shadow-sm border border-indigo-200 space-y-3">
                    <SectionHeader icon={Building2} title="1. Thông tin khách hàng" />
                    <div ref={customerWrapperRef} className="relative">
                        <InputGroup label="Khách hàng" required>
                        <div className="relative">
                            <input 
                                required 
                                type="text" 
                                className={`${inputClass} pr-12 font-bold`} 
                                value={generalInfo.customerName} 
                                onChange={handleCustomerChange} 
                                onFocus={handleCustomerFocus}
                                placeholder="Chọn hoặc nhập tên..." 
                                autoComplete="off"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {generalInfo.customerName && (
                                    <button type="button" onClick={clearCustomer} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                        <X size={12} />
                                    </button>
                                )}
                                <button type="button" onClick={toggleCustomerDropdown} className="text-slate-400 hover:text-emerald-600 transition-colors p-1">
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </div>
                        </InputGroup>
                        {showCustomerSuggestions && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                                
                                {customerSuggestions.length > 0 ? (
                                    customerSuggestions.map((customer, idx) => (
                                        <div key={idx} onClick={() => selectCustomer(customer)} className="p-2.5 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0 group">
                                            <div className="text-[11px] font-black text-slate-800 uppercase group-hover:text-emerald-700">{customer.name}</div>
                                            {customer.address && (
                                                <div className="text-[9px] text-slate-500 truncate group-hover:text-emerald-600 mt-0.5">{customer.address}</div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-[10px] text-slate-400 italic">Không có dữ liệu phù hợp</div>
                                )}
                            </div>
                        )}
                    </div>
                    <InputGroup label="Địa chỉ">
                        <input type="text" className={inputClass} value={generalInfo.address} onChange={e => setGeneralInfo({...generalInfo, address: e.target.value})} />
                    </InputGroup>
                    <InputGroup label="Người liên hệ">
                        <input type="text" className={inputClass} value={generalInfo.contactPerson} onChange={e => setGeneralInfo({...generalInfo, contactPerson: e.target.value})} />
                    </InputGroup>
                    <div className="grid grid-cols-2 gap-3">
                        <InputGroup label="Điện thoại">
                            <input type="text" className={inputClass} value={generalInfo.phone} onChange={e => setGeneralInfo({...generalInfo, phone: e.target.value})} />
                        </InputGroup>
                        <InputGroup label="Email">
                            <input type="text" className={inputClass} value={generalInfo.email} onChange={e => setGeneralInfo({...generalInfo, email: e.target.value})} />
                        </InputGroup>
                    </div>
                    <div ref={otherCustomerWrapperRef} className="relative">
                        <InputGroup label="Thông tin khác">
                            <input 
                                type="text" 
                                className={inputClass} 
                                value={generalInfo.otherCustomerInfo} 
                                onChange={handleOtherCustomerChange} 
                                onFocus={handleOtherCustomerFocus}
                                placeholder="Ví dụ: Tên nhà nhập khẩu, yêu cầu khác, tài liệu đính kèm..." 
                                autoComplete="off"
                            />
                        </InputGroup>
                        {showOtherCustomerSuggestions && otherCustomerSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                                {otherCustomerSuggestions.map((customer, idx) => (
                                    <div key={idx} onClick={() => selectOtherCustomer(customer)} className="p-2.5 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0 group">
                                        <div className="text-[11px] font-black text-slate-800 uppercase group-hover:text-emerald-700">{customer.name}</div>
                                        {customer.address && (
                                            <div className="text-[9px] text-slate-500 truncate group-hover:text-emerald-600 mt-0.5">{customer.address}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <SectionHeader icon={ClipboardList} title="2. Thông tin viết hóa đơn">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-emerald-700 transition-colors">
                            <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={useCustomerInfoForInvoice}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setUseCustomerInfoForInvoice(checked);
                                    if (checked) {
                                        setGeneralInfo(prev => ({
                                            ...prev,
                                            invoiceCompanyName: prev.customerName,
                                            invoiceAddress: prev.address,
                                            invoiceTaxId: prev.taxId,
                                            invoiceEmail: prev.email,
                                            invoiceReceiverName: prev.contactPerson
                                        }));
                                    }
                                }}
                            />
                            Sử dụng thông tin khách hàng
                        </label>
                    </SectionHeader>
                    <InputGroup label="Tên đơn vị">
                        <input type="text" className={inputClass} value={generalInfo.invoiceCompanyName} onChange={e => setGeneralInfo({...generalInfo, invoiceCompanyName: e.target.value})} disabled={useCustomerInfoForInvoice} />
                    </InputGroup>
                    <InputGroup label="Địa chỉ">
                        <input type="text" className={inputClass} value={generalInfo.invoiceAddress} onChange={e => setGeneralInfo({...generalInfo, invoiceAddress: e.target.value})} disabled={useCustomerInfoForInvoice} />
                    </InputGroup>
                    <div className="grid grid-cols-2 gap-3">
                        <InputGroup label="Mã số thuế">
                            <input type="text" className={inputClass} value={generalInfo.invoiceTaxId} onChange={e => setGeneralInfo({...generalInfo, invoiceTaxId: e.target.value})} disabled={useCustomerInfoForInvoice} />
                        </InputGroup>
                        <InputGroup label="Email">
                            <input type="text" className={inputClass} value={generalInfo.invoiceEmail} onChange={e => setGeneralInfo({...generalInfo, invoiceEmail: e.target.value})} />
                        </InputGroup>
                    </div>
                    </div>
                    </div>
                    <div className="lg:col-span-8 flex flex-col space-y-3 lg:order-2 bg-emerald-50 p-3 md:p-4 rounded-xl shadow-sm border border-emerald-200">
                    <SectionHeader icon={ClipboardList} title="Thông tin phiếu" />
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                            <InputGroup label="Mã Phiếu Yêu Cầu (PYC)" required>
                                <div className="relative flex items-center">
                                    <input required type="text" className={`${requestCodeInputClass} pr-10`} value={generalInfo.requestCode} onChange={e => setGeneralInfo({...generalInfo, requestCode: e.target.value})} />
                                    <button type="button" onClick={handleGenerateCode} title="Lấy số phiếu tự động" className="absolute right-1 top-1 bottom-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 rounded-md transition-colors flex items-center justify-center">
                                        <RefreshCw size={12} />
                                    </button>
                                </div>
                            </InputGroup>
                        </div>
                        <div className="col-span-4">
                            <InputGroup label="Ngày đăng ký">
                                <CustomDatePicker className={inputClass} value={generalInfo.requestDate} onChange={val => setGeneralInfo({...generalInfo, requestDate: val})} />
                            </InputGroup>
                        </div>
                        <div className="col-span-4">
                            <InputGroup label="Số mã hóa lô" required>
                                <div className="relative flex items-center">
                                    <input 
                                        required 
                                        type="text" 
                                        className={`${inputClass} pr-10 uppercase`} 
                                        value={generalInfo.encodeNumber} 
                                        onChange={e => {
                                            const newEncode = e.target.value.toUpperCase();
                                            setGeneralInfo({...generalInfo, encodeNumber: newEncode});
                                            setSampleList(prev => reorderSampleList(prev, newEncode, generalInfo.sealStamp));
                                            setCurrentSample(prev => {
                                                const updated = { ...prev };
                                                const idx = editingSampleId ? sampleList.findIndex(x => x.id === editingSampleId) : sampleList.length;
                                                const mttVal = updated.mtt || `M${String(idx + 1).padStart(2, '0')}`;
                                                if (updated.atdEncodeNumber) updated.atdEncodeNumber = generateSampleEncodeNumber('ITDC', newEncode, mttVal);
                                                if (updated.emcEncodeNumber) updated.emcEncodeNumber = generateSampleEncodeNumber('EMC', newEncode, mttVal);
                                                if (updated.itdEncodeNumber) updated.itdEncodeNumber = generateSampleEncodeNumber('ITD', newEncode, mttVal);
                                                return updated;
                                            });
                                        }} 
                                        placeholder="Ví dụ: 146-26" 
                                    />
                                    <button type="button" onClick={handleGenerateEncodeNumber} title="Lấy số mã hóa lô tự động" className="absolute right-1 top-1 bottom-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 rounded-md transition-colors flex items-center justify-center">
                                        <RefreshCw size={12} />
                                    </button>
                                </div>
                            </InputGroup>
                        </div>
                    </div>

                    <SectionHeader icon={Settings} title="Thiết lập chung" />
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                            <InputGroup label="Tình trạng mẫu">
                                <select className={selectClass} value={generalInfo.sampleCondition} onChange={e => setGeneralInfo({...generalInfo, sampleCondition: e.target.value as any})}>
                                    <option value="Mới">Mới</option>
                                    <option value="Cũ">Đã sử dụng</option>
                                </select>
                            </InputGroup>
                        </div>
                        <div className="col-span-4">
                            <InputGroup label="Xử lý sau thử nghiệm">
                                <select className={selectClass} value={generalInfo.postTestHandling} onChange={e => setGeneralInfo({...generalInfo, postTestHandling: e.target.value as any})}>
                                    <option value="Lưu mẫu">Lưu mẫu</option>
                                    <option value="Hủy">Hủy</option>
                                    <option value="Nhận lại">Nhận lại</option>
                                </select>
                            </InputGroup>
                        </div>
                        <div className="col-span-4">
                            <InputGroup label="Mức ưu tiên">
                                <select className={selectClass} value={generalInfo.priority} onChange={e => setGeneralInfo({...generalInfo, priority: parseInt(e.target.value)})}>
                                    <option value={PriorityLevel.NORMAL}>Thường</option>
                                    <option value={PriorityLevel.HIGH}>Cao</option>
                                    <option value={PriorityLevel.VIP}>VIP</option>
                                </select>
                            </InputGroup>
                        </div>

                        <div className="col-span-4">
                            <InputGroup label="Ngày nhận mẫu">
                                <div className="relative flex items-center">
                                    <CustomDatePicker className={`${inputClass} pr-16`} value={generalInfo.receivedDate} onChange={val => setGeneralInfo({...generalInfo, receivedDate: val})} />
                                    <button type="button" onClick={() => setGeneralInfo({...generalInfo, receivedDate: new Date().toISOString().split('T')[0]})} className="absolute right-1 top-1 bottom-1 px-2 my-0.5 text-[9px] bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700 transition-colors">Hôm nay</button>
                                </div>
                            </InputGroup>
                        </div>
                        <div className="col-span-2">
                            <InputGroup label="Hạn trả KQ">
                                <input type="text" placeholder="dd/mm" className={inputClass} value={generalInfo.deadlineDate} onChange={e => setGeneralInfo({...generalInfo, deadlineDate: e.target.value})} />
                            </InputGroup>
                        </div>
                        <div className="col-span-2">
                            <InputGroup label="Số lượng bản sao KQ">
                                <input type="number" min="1" className={inputClass} value={generalInfo.resultCopyCount === 0 ? '' : generalInfo.resultCopyCount} onChange={e => setGeneralInfo({...generalInfo, resultCopyCount: parseDraftPositiveInteger(e.target.value, 1)})} />
                            </InputGroup>
                        </div>
                        <div className="col-span-4">
                            <InputGroup label="Địa chỉ PTN">
                                <input type="text" className={inputClass} value={generalInfo.labAddress} onChange={e => setGeneralInfo({...generalInfo, labAddress: e.target.value})} />
                            </InputGroup>
                        </div>
                        <div className="col-span-12">
                            <InputGroup label="Tem niêm phong chung">
                                <input 
                                    type="text" 
                                    className={`${inputClass} bg-white font-bold text-emerald-800 border-emerald-100 focus:ring-emerald-500 focus:border-emerald-500`} 
                                    value={generalInfo.sealStamp || ''} 
                                    onChange={e => setGeneralInfo({...generalInfo, sealStamp: e.target.value})} 
                                    placeholder="Ví dụ: NP2026 (Các mẫu sẽ tự động sinh: NP2026-M01, NP2026-M02...)" 
                                />
                                <span className="text-[10px] text-slate-500">IEMM sẽ tự sinh M01, M02...; tem bên khác nhập tự do theo từng mẫu.</span>
                            </InputGroup>
                        </div>
                    </div>

                    <SectionHeader icon={Box} title="Chi tiết mẫu thử nghiệm" />
                    <div className={`rounded-xl p-3 border mb-4 shadow-sm transition-colors ${editingSampleId ? 'bg-orange-50 border-orange-200' : 'bg-slate-50/50 border-slate-200'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                            <div ref={sampleTypeWrapperRef} className="md:col-span-4 relative">
                                <InputGroup label="Tên mẫu">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            className={`${inputClass} bg-white pr-10 font-bold`} 
                                            value={sampleTypeSearch} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                setSampleTypeSearch(val);
                                                setShowSampleTypeSuggestions(true);
                                                const matchedProduct = products.find(p => String(p.name || '').toLowerCase() === String(val || '').toLowerCase());
                                                if (matchedProduct) {
                                                    setCurrentSample(prev => ({
                                                        ...prev,
                                                        type: matchedProduct.name,
                                                        testTimeEMC: matchedProduct.testTimeEMC || prev.testTimeEMC,
                                                        testTimeATD: matchedProduct.testTimeATD || prev.testTimeATD
                                                    }));
                                                } else {
                                                    setCurrentSample(prev => ({
                                                        ...prev,
                                                        type: val
                                                    }));
                                                }
                                            }} 
                                            onFocus={() => setShowSampleTypeSuggestions(true)}
                                            placeholder="Chọn hoặc nhập tên mẫu..."
                                            autoComplete="off"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            {sampleTypeSearch && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setSampleTypeSearch('');
                                                        setShowSampleTypeSuggestions(true);
                                                    }} 
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            <button 
                                                type="button" 
                                                onClick={() => setShowSampleTypeSuggestions(!showSampleTypeSuggestions)} 
                                                className="text-slate-400 hover:text-emerald-600 transition-colors p-1"
                                            >
                                                <ChevronDown size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </InputGroup>
                                {showSampleTypeSuggestions && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[150] overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map((pName, idx) => {
                                                const matchedProduct = products.find(p => p.name === pName);
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        onClick={() => {
                                                            setCurrentSample(prev => ({
                                                                ...prev,
                                                                type: pName,
                                                                testTimeEMC: matchedProduct?.testTimeEMC || prev.testTimeEMC,
                                                                testTimeATD: matchedProduct?.testTimeATD || prev.testTimeATD
                                                            }));
                                                            setSampleTypeSearch(pName);
                                                            setShowSampleTypeSuggestions(false);
                                                        }} 
                                                        className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0 group flex flex-col"
                                                    >
                                                        <div className="text-xs font-black text-slate-800 uppercase group-hover:text-emerald-700">{pName}</div>
                                                        {matchedProduct && (
                                                            <div className="text-[10px] text-slate-400 font-medium group-hover:text-emerald-600">
                                                                Thời gian kiểm: ITD {formatTestTime(matchedProduct.testTimeATD)} | EMC {formatTestTime(matchedProduct.testTimeEMC)}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div 
                                                onClick={() => {
                                                    setCurrentSample(prev => ({
                                                        ...prev,
                                                        type: sampleTypeSearch
                                                    }));
                                                    setShowSampleTypeSuggestions(false);
                                                }}
                                                className="p-3 hover:bg-emerald-50 cursor-pointer text-center text-xs font-bold text-slate-500"
                                            >
                                                Sử dụng tên mẫu mới: "{sampleTypeSearch}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="md:col-span-4">
                                <InputGroup label="Tên Model" required>
                                    <input type="text" className={`${inputClass} bg-white font-bold`} value={currentSample.modelName} onChange={e => setCurrentSample({...currentSample, modelName: e.target.value})} placeholder="Nhập model..." />
                                </InputGroup>
                                {isDuplicateModel && (
                                    <div className="text-[10px] text-amber-600 font-bold mt-1 flex flex-col gap-0.5 bg-amber-50 border border-amber-200/50 rounded-lg p-1.5 animate-in slide-in-from-top-1">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs">⚠️</span> Model đã tồn tại trên hệ thống!
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-medium">
                                            Lần gần nhất tại PYC: <span className="font-bold text-indigo-600">{existingRequestsWithModel[0].requestCode}</span> ({existingRequestsWithModel[0].customerName})
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div ref={brandWrapperRef} className="md:col-span-4 relative">
                                <InputGroup label="Nhãn hiệu">
                                    <input 
                                        type="text" 
                                        className={`${inputClass} bg-white pr-8`} 
                                        value={currentSample.brand} 
                                        onChange={handleBrandChange} 
                                        onFocus={handleBrandChange} 
                                        autoComplete="off"
                                    />
                                </InputGroup>
                                {showBrandSuggestions && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden max-h-40 overflow-y-auto">
                                        {brandSuggestions.length > 0 ? (
                                            brandSuggestions.map((brand, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => selectBrand(brand)} 
                                                    className="p-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0 text-[10px] font-bold text-slate-700"
                                                >
                                                    {brand}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-2 text-[10px] text-slate-400 italic text-center">Không tìm thấy nhãn hiệu phù hợp</div>
                                        )}
                                        {String(currentSample.brand || "").trim() !== '' && !brands.some(b => String(b).toLowerCase().trim() === String(currentSample.brand).toLowerCase().trim()) && (
                                            <div 
                                                onClick={() => handleAddBrandDirectly(currentSample.brand)}
                                                className="p-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 cursor-pointer border-t border-slate-100 flex items-center gap-1.5 bg-emerald-50/30"
                                            >
                                                <Plus size={12} className="stroke-[3]" /> Thêm mới: "{String(currentSample.brand || "").trim()}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-3">
                            <div className="md:col-span-4">
                                <InputGroup label="Thông số kỹ thuật">
                                    <input type="text" className={`${inputClass} bg-white`} value={currentSample.specifications} onChange={e => setCurrentSample({...currentSample, specifications: e.target.value})} />
                                </InputGroup>
                            </div>
                            <div className="md:col-span-4">
                                <InputGroup label="Chỉ tiêu thí nghiệm">
                                    <input type="text" className={`${inputClass} bg-white`} value={currentSample.testCriteria || ''} onChange={e => setCurrentSample({...currentSample, testCriteria: e.target.value})} placeholder="VD: Full, 4CT..." />
                                </InputGroup>
                            </div>
                            <div className="md:col-span-4">
                                <InputGroup label="Số lượng" required>
                                    <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 h-[34px]">
                                        <input type="number" min="1" className="w-full bg-transparent px-2 py-1.5 text-[11px] font-bold outline-none text-center text-emerald-700 h-full" value={currentSample.quantity === 0 ? '' : currentSample.quantity} onChange={e => setCurrentSample({...currentSample, quantity: parseDraftPositiveInteger(e.target.value, 1)})} />
                                        <input list="unit-options-request" className="bg-slate-100 border-l border-slate-200 px-2 py-1.5 text-[11px] font-bold outline-none text-slate-700 w-16 h-full cursor-pointer" value={currentSample.unit} onChange={e => setCurrentSample({...currentSample, unit: e.target.value})} />
                                        <datalist id="unit-options-request">
                                            <option value="Cái" />
                                            <option value="Bộ" />
                                            <option value="Chiếc" />
                                            <option value="Cuộn" />
                                            <option value="Mét" />
                                            <option value="Kg" />
                                            <option value="Lít" />
                                            <option value="Mẫu" />
                                            <option value="Bình" />
                                            <option value="Chai" />
                                        </datalist>
                                    </div>
                                </InputGroup>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-6 mb-1">
                                <InputGroup label="Mã hóa mẫu (Tự động)">
                                    <div className="flex items-center gap-6 bg-white border border-slate-200 rounded-lg px-3 h-[34px]">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="accent-emerald-600 w-3.5 h-3.5" 
                                                checked={!!currentSample.atdEncodeNumber} 
                                                onChange={(e) => {
                                                    setCurrentSample(prev => {
                                                        const idx = editingSampleId ? sampleList.findIndex(x => x.id === editingSampleId) : sampleList.length;
                                                        const mttVal = prev.mtt || `M${String(idx + 1).padStart(2, '0')}`;
                                                        const atdEncode = e.target.checked ? generateSampleEncodeNumber('ITDC', generalInfo.encodeNumber, mttVal) : '';
                                                        const nextStandard = prev.emcEncodeNumber ? 'TCVN 7492-1: 2018' : '';
                                                        return {
                                                            ...prev, 
                                                            atdEncodeNumber: atdEncode,
                                                            standard: nextStandard
                                                        };
                                                    });
                                                }}
                                            />
                                            <span className="text-[11px] font-bold text-slate-700">ITDC</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="accent-blue-600 w-3.5 h-3.5" 
                                                checked={!!currentSample.emcEncodeNumber} 
                                                onChange={(e) => {
                                                    setCurrentSample(prev => {
                                                        const idx = editingSampleId ? sampleList.findIndex(x => x.id === editingSampleId) : sampleList.length;
                                                        const mttVal = prev.mtt || `M${String(idx + 1).padStart(2, '0')}`;
                                                        const emcEncode = e.target.checked ? generateSampleEncodeNumber('EMC', generalInfo.encodeNumber, mttVal) : '';
                                                        let nextStandard = prev.standard || '';
                                                        if (e.target.checked) {
                                                            if (!nextStandard.includes('TCVN 7492-1: 2018')) {
                                                                nextStandard = nextStandard ? `${nextStandard}, TCVN 7492-1: 2018` : 'TCVN 7492-1: 2018';
                                                            }
                                                        }
                                                        return {
                                                            ...prev, 
                                                            emcEncodeNumber: emcEncode,
                                                            standard: nextStandard
                                                        };
                                                    });
                                                }}
                                            />
                                            <span className="text-[11px] font-bold text-slate-700">EMC</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="accent-purple-600 w-3.5 h-3.5" 
                                                checked={!!currentSample.itdEncodeNumber} 
                                                onChange={(e) => {
                                                    setCurrentSample(prev => {
                                                        const idx = editingSampleId ? sampleList.findIndex(x => x.id === editingSampleId) : sampleList.length;
                                                        const mttVal = prev.mtt || `M${String(idx + 1).padStart(2, '0')}`;
                                                        return {
                                                            ...prev, 
                                                            itdEncodeNumber: e.target.checked ? generateSampleEncodeNumber('ITD', generalInfo.encodeNumber, mttVal) : ''
                                                        };
                                                    });
                                                }}
                                            />
                                            <span className="text-[11px] font-bold text-slate-700">ITD</span>
                                        </label>
                                    </div>
                                </InputGroup>
                            </div>
                            <div className="md:col-span-6 mb-1">
                                <InputGroup label="Tiêu chuẩn áp dụng">
                                    <input type="text" className={`${inputClass} bg-white`} value={currentSample.standard || ''} onChange={e => setCurrentSample({...currentSample, standard: e.target.value})} placeholder="Nhập tiêu chuẩn áp dụng..." />
                                </InputGroup>
                            </div>
                            <div className="md:col-span-6">
                                <InputGroup label="Ghi chú">
                                    <input type="text" className={`${inputClass} bg-white`} value={currentSample.note || ''} onChange={e => setCurrentSample({...currentSample, note: e.target.value})} placeholder="Ghi chú..." />
                                </InputGroup>
                            </div>
                            <div className="md:col-span-3">
                                <InputGroup label="Tem niêm phong">
                                    <input 
                                        type="text" 
                                        className={`${inputClass} bg-white`} 
                                        value={currentSample.sealStamp} 
                                        onChange={e => setCurrentSample({...currentSample, sealStamp: e.target.value})}
                                        placeholder="Tự động sinh theo tem chung..." 
                                    />
                                        <span className="text-[10px] text-slate-500">Tem IEMM tự động theo MTT; mã bên khác giữ nguyên free style.</span>
                                </InputGroup>
                            </div>
                            <div className="md:col-span-2">
                                <InputGroup label="Số lần test Fail">
                                    <input 
                                        type="number" 
                                        min="0"
                                        className={`${inputClass} bg-white font-bold text-red-600 border-red-200 focus:ring-red-500`} 
                                        value={currentSample.retryCount ?? ''} 
                                        onChange={e => setCurrentSample({...currentSample, retryCount: parseDraftOptionalInteger(e.target.value)})}
                                    />
                                </InputGroup>
                            </div>
                            <div className="md:col-span-2 flex items-end">
                                {editingSampleId ? (
                                    <button type="button" onClick={handleUpdateSample} className="w-full flex items-center justify-center gap-1.5 bg-orange-500 text-white p-2 h-[34px] rounded-lg text-[10px] font-black uppercase hover:bg-orange-600 transition-all active:scale-95 active:translate-y-0.5 active:shadow-sm shadow-lg shadow-orange-100"><Save size={14} /> Lưu</button>
                                ) : (
                                    <button type="button" onClick={handleAddSample} className="w-full flex items-center justify-center gap-1.5 bg-slate-800 text-white p-2 h-[34px] rounded-lg text-[10px] font-black uppercase hover:bg-slate-900 transition-all active:scale-95 active:translate-y-0.5 active:shadow-sm shadow-lg"><Plus size={14} /> Thêm</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                <div className="border-t border-slate-100 pt-6 mt-6">
                    <div className="flex flex-col min-h-[220px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Danh sách mẫu ({sampleList.length})</label>
                        <div className="border rounded-2xl overflow-hidden bg-slate-50/50">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                                        <tr>
                                            <th className="p-3 border-b">STT</th>
                                            <th className="p-3 border-b">MTT</th>
                                            <th className="p-3 border-b">Số mã hóa</th>
                                            <th className="p-3 border-b">Model / Nhãn hiệu</th>
                                            <th className="p-3 border-b">Loại sản phẩm</th>
                                            <th className="p-3 border-b text-center">SL / ĐVT</th>
                                            <th className="p-3 border-b">Tiêu chuẩn / Chỉ tiêu</th>
                                            <th className="p-3 border-b">Tem niêm phong</th>
                                            <th className="p-3 border-b">Ghi chú</th>
                                            <th className="p-3 border-b text-center">Lần Fail</th>
                                            <th className="p-3 border-b text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs">
                                        {sampleList.map((sample, sIdx) => (
                                            <tr key={sample.id} className={`border-b last:border-0 hover:bg-white transition-colors ${editingSampleId === sample.id ? 'bg-orange-50' : 'bg-slate-50'}`}>
                                                <td className="p-3 font-bold text-slate-400">{sIdx + 1}</td>
                                                <td className="p-3">
                                                    <input 
                                                        type="text"
                                                        className={`w-16 text-center border rounded-lg px-2 py-1 text-[11px] font-bold uppercase outline-none transition-all ${
                                                            hasDuplicateMtt(sample.mtt || `M${String(sIdx + 1).padStart(2, '0')}`, sample.id)
                                                                ? 'border-red-500 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500'
                                                                : 'border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-700'
                                                        }`}
                                                        value={sample.mtt ?? ''}
                                                        placeholder="M01"
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setSampleList(prev => {
                                                                const newList = prev.map(s => s.id === sample.id ? { ...s, mtt: val } : s);
                                                                return val ? reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp) : newList;
                                                            });
                                                            if (editingSampleId === sample.id) {
                                                                setCurrentSample(prev => ({ ...prev, mtt: val }));
                                                            }
                                                        }}
                                                    />
                                                    {hasDuplicateMtt(sample.mtt || `M${String(sIdx + 1).padStart(2, '0')}`, sample.id) && (
                                                        <span className="text-[9px] text-red-500 font-bold block mt-0.5 text-center">Trùng</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col gap-1 w-32">
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 hover:text-emerald-700">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                                checked={!!sample.atdEncodeNumber}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setSampleList(prev => {
                                                                        const newList = prev.map(s => s.id === sample.id ? {
                                                                            ...s,
                                                                            atdEncodeNumber: checked ? 'TEMP' : ''
                                                                        } : s);
                                                                        return reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp);
                                                                    });
                                                                }}
                                                            />
                                                            <span className="w-8 shrink-0">ITDC</span>
                                                            {sample.atdEncodeNumber ? (
                                                                <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-100 truncate max-w-[80px]" title={sample.atdEncodeNumber}>
                                                                    {sample.atdEncodeNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] text-slate-400 italic">chưa lấy</span>
                                                            )}
                                                        </label>
                                                        
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 hover:text-blue-700">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                checked={!!sample.emcEncodeNumber}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setSampleList(prev => {
                                                                        const newList = prev.map(s => {
                                                                            if (s.id === sample.id) {
                                                                                let nextStandard = s.standard || '';
                                                                                if (checked) {
                                                                                    if (!nextStandard.includes('TCVN 7492-1: 2018')) {
                                                                                        nextStandard = nextStandard ? `${nextStandard}, TCVN 7492-1: 2018` : 'TCVN 7492-1: 2018';
                                                                                    }
                                                                                }
                                                                                return {
                                                                                    ...s,
                                                                                    emcEncodeNumber: checked ? 'TEMP' : '',
                                                                                    standard: nextStandard
                                                                                };
                                                                            }
                                                                            return s;
                                                                        });
                                                                        return reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp);
                                                                    });
                                                                }}
                                                            />
                                                            <span className="w-8 shrink-0">EMC</span>
                                                            {sample.emcEncodeNumber ? (
                                                                <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-100 truncate max-w-[80px]" title={sample.emcEncodeNumber}>
                                                                    {sample.emcEncodeNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] text-slate-400 italic">chưa lấy</span>
                                                            )}
                                                        </label>
                                                        
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 hover:text-purple-700">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                                checked={!!sample.itdEncodeNumber}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setSampleList(prev => {
                                                                        const newList = prev.map(s => s.id === sample.id ? {
                                                                            ...s,
                                                                            itdEncodeNumber: checked ? 'TEMP' : ''
                                                                        } : s);
                                                                        return reorderSampleList(newList, generalInfo.encodeNumber, generalInfo.sealStamp);
                                                                    });
                                                                }}
                                                            />
                                                            <span className="w-8 shrink-0">ITD</span>
                                                            {sample.itdEncodeNumber ? (
                                                                <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-100 truncate max-w-[80px]" title={sample.itdEncodeNumber}>
                                                                    {sample.itdEncodeNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] text-slate-400 italic">chưa lấy</span>
                                                            )}
                                                        </label>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-black text-slate-800 flex items-center gap-1.5 flex-wrap">
                                                        <span>{sample.modelName}</span>
                                                        {(() => {
                                                            const cleanModel = String(sample.modelName || '').trim().toLowerCase();
                                                            const existingGroupIds = existingGroup ? existingGroup.map(r => r.id) : [];
                                                            const match = requests.find(req => 
                                                                !existingGroupIds.includes(req.id) &&
                                                                req.modelName && 
                                                                String(req.modelName).trim().toLowerCase() === cleanModel
                                                            );
                                                            if (match) {
                                                                return (
                                                                    <span 
                                                                        className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-200 cursor-help"
                                                                        title={`Model đã tồn tại ở PYC ${match.requestCode} - KH: ${match.customerName}`}
                                                                    >
                                                                        ⚠️ Trùng
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 uppercase">{sample.brand}</div>
                                                </td>
                                                <td className="p-3 relative">
                                                    <div className="flex flex-col gap-1.5 w-44">
                                                        <div className="relative">
                                                            <div 
                                                                className="flex items-center justify-between border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold bg-white hover:border-slate-300 focus-within:ring-2 focus-within:ring-emerald-500 cursor-pointer h-[32px]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (activeRowProductDropdownId === sample.id) {
                                                                    setActiveRowProductDropdownId(null);
                                                                } else {
                                                                    setActiveRowProductDropdownId(sample.id);
                                                                    setRowProductSearch(sample.type || '');
                                                                }
                                                            }}
                                                        >
                                                            <input 
                                                                type="text"
                                                                className="w-full bg-transparent outline-none font-bold text-slate-800 text-[11px] p-0 border-none cursor-text"
                                                                value={activeRowProductDropdownId === sample.id ? rowProductSearch : (sample.type || '')}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    setRowProductSearch(e.target.value);
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveRowProductDropdownId(sample.id);
                                                                    if (activeRowProductDropdownId !== sample.id) {
                                                                        setRowProductSearch(sample.type || '');
                                                                    }
                                                                }}
                                                                placeholder="Chọn loại..."
                                                            />
                                                            <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
                                                        </div>
                                                        
                                                        {activeRowProductDropdownId === sample.id && (
                                                            <>
                                                                <div 
                                                                    className="fixed inset-0 z-[190]" 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveRowProductDropdownId(null);
                                                                    }}
                                                                />
                                                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden max-h-48 overflow-y-auto animate-in slide-in-from-top-1">
                                                                    {(() => {
                                                                        const q = removeAccents(rowProductSearch).toLowerCase().trim();
                                                                        const pList = products.length > 0 ? products : Object.values(MachineType).map(name => ({ name }));
                                                                        
                                                                        let filtered = pList;
                                                                        if (q) {
                                                                            const queryWords = q.split(/\s+/).filter(Boolean);
                                                                            filtered = pList.filter(p => {
                                                                                const nameNormalized = removeAccents(p.name || '').toLowerCase();
                                                                                return queryWords.every(word => nameNormalized.includes(word));
                                                                            });
                                                                        }
                                                                        
                                                                        if (filtered.length === 0) {
                                                                            return (
                                                                                <div 
                                                                                    className="p-2 text-center text-[10px] text-slate-400 italic hover:bg-slate-50 cursor-pointer font-bold"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (String(rowProductSearch).trim()) {
                                                                                            setSampleList(prev => prev.map(s => s.id === sample.id ? {
                                                                                                ...s,
                                                                                                type: String(rowProductSearch).trim()
                                                                                            } : s));
                                                                                        }
                                                                                        setActiveRowProductDropdownId(null);
                                                                                    }}
                                                                                >
                                                                                    Dùng loại: "{rowProductSearch}"
                                                                                </div>
                                                                            );
                                                                        }
                                                                        
                                                                        return filtered.map((p, pIdx) => (
                                                                            <div 
                                                                                key={pIdx}
                                                                                className="p-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0 text-[10px] font-bold text-slate-700"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSampleList(prev => prev.map(s => s.id === sample.id ? {
                                                                                        ...s,
                                                                                        type: p.name,
                                                                                        testTimeEMC: p.testTimeEMC !== undefined ? p.testTimeEMC : s.testTimeEMC,
                                                                                        testTimeATD: p.testTimeATD !== undefined ? p.testTimeATD : s.testTimeATD
                                                                                    } : s));
                                                                                    setActiveRowProductDropdownId(null);
                                                                                }}
                                                                            >
                                                                                {p.name}
                                                                            </div>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </>
                                                        )}
                                                        </div>
                                                        <input 
                                                            type="text"
                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                            value={sample.specifications || ''}
                                                            placeholder="Thông số..."
                                                            onChange={e => {
                                                                const newSpecs = e.target.value;
                                                                setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, specifications: newSpecs } : s));
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-1.5 w-16 mx-auto">
                                                        <input 
                                                            type="number"
                                                            min="1"
                                                            className="w-full text-center border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-black bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                             value={sample.quantity === 0 ? '' : sample.quantity}
                                                             onChange={e => {
                                                                 const val = parseDraftPositiveInteger(e.target.value, 1);
                                                                setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, quantity: val } : s));
                                                                if (editingSampleId === sample.id) {
                                                                    setCurrentSample(prev => ({ ...prev, quantity: val }));
                                                                }
                                                            }}
                                                        />
                                                        <input 
                                                            type="text"
                                                            className="w-full text-center border border-slate-200 rounded-lg px-1 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all leading-none"
                                                             value={sample.unit ?? ''}
                                                            placeholder="ĐVT"
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, unit: val } : s));
                                                                if (editingSampleId === sample.id) {
                                                                    setCurrentSample(prev => ({ ...prev, unit: val }));
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-3 min-w-[150px]">
                                                    <div className="flex flex-col gap-1.5">
                                                        <input 
                                                            type="text"
                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                            value={sample.standard || ''}
                                                            placeholder="Tiêu chuẩn..."
                                                            onChange={e => {
                                                                const newStandard = e.target.value;
                                                                setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, standard: newStandard } : s));
                                                            }}
                                                        />
                                                        <input 
                                                            type="text"
                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                            value={sample.testCriteria || ''}
                                                            placeholder="Chỉ tiêu..."
                                                            onChange={e => {
                                                                const newCriteria = e.target.value;
                                                                setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, testCriteria: newCriteria } : s));
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <input 
                                                        type="text"
                                                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                        value={sample.sealStamp || ''}
                                                        placeholder="Chưa có"
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, sealStamp: val } : s));
                                                            if (editingSampleId === sample.id) {
                                                                setCurrentSample(prev => ({ ...prev, sealStamp: val }));
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input 
                                                        type="text"
                                                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                        value={sample.note || ''}
                                                        placeholder="Ghi chú..."
                                                        onChange={e => {
                                                            const newNote = e.target.value;
                                                            setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, note: newNote } : s));
                                                        }}
                                                    />
                                                </td>
                                                <td className="p-3 text-center w-16">
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        className="w-12 text-center border rounded-lg px-1 py-1 text-[11px] font-bold text-red-700 bg-red-50/50 border-red-200 outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                                                         value={sample.retryCount ?? ''}
                                                         onChange={e => {
                                                             const val = parseDraftOptionalInteger(e.target.value);
                                                            setSampleList(prev => prev.map(s => s.id === sample.id ? { ...s, retryCount: val } : s));
                                                            if (editingSampleId === sample.id) {
                                                                setCurrentSample(prev => ({ ...prev, retryCount: val }));
                                                            }
                                                        }}
                                                        title="Admin / Nhân viên có thể chỉnh sửa số lần test Fail (tích tụ)"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" onClick={() => handleEditSample(sample)} className="text-slate-300 hover:text-orange-500 transition-colors"><Pencil size={16} /></button>
                                                        <button type="button" onClick={() => removeSample(sample.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                 <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white z-10">
                     <div className="mr-auto flex items-center gap-3">
                         {draftSavedAt && !draftRecovery && (
                             <button type="button" onClick={handleDeleteRequestDraft} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-black uppercase text-red-600 transition-colors hover:bg-red-50">
                                 <Trash2 size={12} /> Xóa bản nháp
                             </button>
                         )}
                         {draftSavedAt && <span className="hidden text-[10px] font-semibold text-slate-400 md:inline">Đã lưu tạm</span>}
                     </div>
                     <button type="button" onClick={handleModalClose} className="px-6 py-3 text-[11px] font-black text-slate-400 uppercase hover:bg-slate-50 rounded-xl transition-all">Hủy bỏ</button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-emerald-600 text-white text-[11px] font-black uppercase rounded-xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:shadow-emerald-200 active:scale-95 active:translate-y-0.5 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-100 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />} 
                        {existingGroup && existingGroup.length > 0 ? "Cập nhật Phiếu Yêu Cầu" : "Tạo Phiếu Yêu Cầu"} ({sampleList.length} mẫu)
                    </button>
                </div>
                </form>
            </>
      </div>

      {showNewCustomerConfirm && newCustomerPendingData && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 pb-3">
              <Building2 size={24} className="stroke-[2.5]" />
              {(() => {
                const isExistingName = customers.some(c => String(c.name || '').toLowerCase().trim() === String(newCustomerPendingData.name || '').toLowerCase().trim());
                return (
                  <h4 className="text-sm font-black uppercase tracking-wider">
                    {isExistingName ? "Cập nhật Khách hàng!" : "Phát hiện Khách hàng mới!"}
                  </h4>
                );
              })()}
            </div>
            
            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
              {(() => {
                const isExistingName = customers.some(c => String(c.name || '').toLowerCase().trim() === String(newCustomerPendingData.name || '').toLowerCase().trim());
                return isExistingName 
                  ? "Tên khách hàng này đã tồn tại nhưng có thông tin mới (VD: Mã số thuế). Bạn có muốn cập nhật thông tin mới vào cơ sở dữ liệu không?"
                  : "Hệ thống không tìm thấy khách hàng này trong cơ sở dữ liệu dựa trên Mã số thuế/Tên. Bạn có muốn lưu thông tin khách hàng này để sử dụng cho các lần sau?";
              })()}
            </p>

            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase font-black text-slate-400">Tên khách hàng</span>
                <span className="text-xs font-bold text-slate-800">{newCustomerPendingData.name}</span>
              </div>
              {newCustomerPendingData.taxId && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase font-black text-slate-400">Mã số thuế (MST)</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">{newCustomerPendingData.taxId}</span>
                </div>
              )}
              {newCustomerPendingData.address && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase font-black text-slate-400">Địa chỉ</span>
                  <span className="text-xs font-semibold text-slate-600">{newCustomerPendingData.address}</span>
                </div>
              )}
              {(newCustomerPendingData.phone || newCustomerPendingData.email) && (
                <div className="grid grid-cols-2 gap-2 border-t border-slate-200/50 pt-2 mt-1">
                  {newCustomerPendingData.phone && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400">Điện thoại</span>
                      <span className="text-[11px] font-bold text-slate-700">{newCustomerPendingData.phone}</span>
                    </div>
                  )}
                  {newCustomerPendingData.email && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400">Email</span>
                      <span className="text-[11px] font-semibold text-slate-600 truncate">{newCustomerPendingData.email}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => executeSaveRequests(true)}
                className="w-full py-3 bg-emerald-600 text-white font-black text-[11px] uppercase rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 active:translate-y-0.5 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none animate-pulse-subtle"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu Khách Hàng & Phiếu Yêu Cầu
              </button>
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => executeSaveRequests(false)}
                className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 active:translate-y-0.5 active:shadow-inner font-bold text-[11px] uppercase rounded-xl transition-all duration-100 flex items-center justify-center gap-2 border border-slate-200/50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null} Chỉ lưu Phiếu (Không lưu Khách hàng)
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowNewCustomerConfirm(false);
                  setNewCustomerPendingData(null);
                }}
                className="w-full py-2.5 bg-white text-slate-400 hover:text-slate-600 font-semibold text-[10px] uppercase rounded-xl transition-all text-center"
              >
                Quay lại chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModelConfirm && duplicateModelsInCurrentForm.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 pb-3">
              <ClipboardList size={24} className="stroke-[2.5]" />
              <h4 className="text-sm font-black uppercase tracking-wider">Cảnh báo trùng lặp Model!</h4>
            </div>
            
            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
              Phát hiện các model sản phẩm sau đã tồn tại trong cơ sở dữ liệu hệ thống. Bạn có chắc chắn muốn tiếp tục nhận phiếu yêu cầu này không?
            </p>

            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 max-h-48 overflow-y-auto">
              {duplicateModelsInCurrentForm.map((dup, idx) => (
                <div key={idx} className="flex flex-col gap-0.5 border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <span className="text-xs font-black text-slate-800 uppercase">{dup.modelName}</span>
                  <div className="text-[9px] text-slate-500 font-medium">
                    Đã có ở PYC: <span className="font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">{dup.existingRequestCode}</span> - Khách hàng: <span className="font-semibold text-slate-700">{dup.existingCustomerName}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={async () => {
                  setShowDuplicateModelConfirm(false);
                  await proceedToSave();
                }}
                className="w-full py-3 bg-amber-600 text-white font-black text-[11px] uppercase rounded-xl shadow-lg shadow-amber-100 hover:bg-amber-700 active:scale-95 active:translate-y-0.5 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Vẫn tiếp tục lưu phiếu
              </button>
              <button 
                type="button" 
                onClick={() => setShowDuplicateModelConfirm(false)}
                className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-[11px] uppercase rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200/50"
              >
                Quay lại chỉnh sửa mẫu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestModal;

// --- End of RequestModal.tsx ---
