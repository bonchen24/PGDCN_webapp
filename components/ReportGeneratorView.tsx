// Author: Gemini
// OS support: Web/Node
// Description: Giao diện chính Sleek Interface phục vụ quá trình test thiết bị điện

'use client';

import React, { useMemo, useState, useRef } from 'react';

import SelectSampleModal from './SelectSampleModal';
import DocxSettingsModal from './DocxSettingsModal';
import { TestRequest, KQTNRecord } from '../types';
import { useStore } from '../store';
import { toast } from 'sonner';
import { formatDateVN } from '../utils/formatter';
import { formatBilingualReportDate } from '../lib/reportFormatting';
import { resolveGeminiModel } from '../utils/geminiSettings';
import { CustomDatePicker } from './CustomDatePicker';
import DefaultStandardForm from './DefaultStandardForm';

import { STANDARDS, ApplianceStandard } from "../lib/standards";
import CropperModal from "../components/CropperModal";
import DeviceCombobox from "../components/DeviceCombobox";
import SimpleCombobox from "../components/SimpleCombobox";
import MultiSelectCombobox from "../components/MultiSelectCombobox";
import { DEVICE_NAMES } from "../lib/device-names";
import { MAHOA_CODES } from "../lib/mahoa-codes";
import { getReportValidationFieldLabel, parseReportDateRange, validateReportConsistency } from '../lib/reportValidation';
import EmcBepDien1VungNauForm, { EmcData, emptyPhaseRow, emptyPowerRow } from "../components/EmcBepDien1VungNauForm";
import DayCapDienForm, { initialDayCapDienData, DayCapDienData } from '../components/DayCapDienForm';
import { stripTransientKqtnImages } from '../utils/transientReportImages';
import { getKqtnSampleKey } from '../utils/kqtnIdentity';
import { X, Crop, Search, AlertTriangle, CheckCircle2, ShieldCheck, FileCheck, Camera, Info, Sparkles, Check, Loader2, Plus, Trash2, ArrowLeft, Layers, FileText, Save, FileDown, FileCog,
  Flame, Wind, Coffee, Thermometer, Zap, Shirt, Snowflake, Activity, Plug, Box, Shield, Monitor
} from 'lucide-react';

const getStandardIcon = (id: string) => {
  switch (id) {
    case 'toaster': return <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500 mb-1" strokeWidth={1.5} />;
    case 'iron': return <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 mb-1" strokeWidth={1.5} />;
    case 'rice_cooker': return <Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600 mb-1" strokeWidth={1.5} />;
    case 'fan': return <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-500 mb-1" strokeWidth={1.5} />;
    case 'storage_heater':
    case 'instant_heater': return <Thermometer className="w-6 h-6 sm:w-7 sm:h-7 text-red-500 mb-1" strokeWidth={1.5} />;
    case 'hair_dryer': return <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-pink-500 mb-1" strokeWidth={1.5} />;
    case 'microwave': return <Box className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500 mb-1" strokeWidth={1.5} />;
    case 'emc_bep_dien': return <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600 mb-1" strokeWidth={1.5} />;
    case 'emc_dieu_hoa': return <Snowflake className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400 mb-1" strokeWidth={1.5} />;
    case 'emc_may_giat': return <Shirt className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-600 mb-1" strokeWidth={1.5} />;
    case 'emc_may_hut_bui': return <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500 mb-1" strokeWidth={1.5} />;
    case 'emc_may_khoan': return <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-slate-600 mb-1" strokeWidth={1.5} />;
    case 'emc_may_say_toc': return <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-pink-400 mb-1" strokeWidth={1.5} />;
    case 'emc_may_xay': return <Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-stone-600 mb-1" strokeWidth={1.5} />;
    case 'emc_tu_lanh': return <Snowflake className="w-6 h-6 sm:w-7 sm:h-7 text-blue-300 mb-1" strokeWidth={1.5} />;
    case 'emc_dung_cu_dien_dun_nuoc_nong': return <Thermometer className="w-6 h-6 sm:w-7 sm:h-7 text-red-400 mb-1" strokeWidth={1.5} />;
    case 'day_cap_dien': return <Plug className="w-6 h-6 sm:w-7 sm:h-7 text-green-600 mb-1" strokeWidth={1.5} />;
    default: return <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 mb-1" strokeWidth={1.5} />;
  }
};


export default function ReportGeneratorView() {
  const { kqtnRecords, addKqtnRecord, updateKqtnRecord, currentUser, testers } = useStore();
  const [mounted, setMounted] = useState(false);
  const [isSelectSampleOpen, setIsSelectSampleOpen] = useState(false);
  const [isDocxSettingsOpen, setIsDocxSettingsOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<TestRequest | null>(null);

  const labManagerOptions = useMemo(() => {
    const managers = (testers || []).filter(t => {
      if (!t || !t.name || t.name === 'Khác') return false;
      const pos = (t.position || '').toLowerCase();
      return pos.includes('trưởng phòng') || pos.includes('phó trưởng phòng') || pos.includes('phó phòng') || pos.includes('trưởng') || pos.includes('phó') || t.name === 'Vũ Việt Anh' || t.name === 'Lương Xuân Hùng';
    }).map(t => t.name);

    if (!managers.includes('Vũ Việt Anh')) managers.unshift('Vũ Việt Anh');
    if (!managers.includes('Lương Xuân Hùng')) managers.push('Lương Xuân Hùng');
    return Array.from(new Set(managers));
  }, [testers]);

  const handleSelectSample = (req: TestRequest) => {
    setSelectedSample(req);
    const requestCodeStr = String(req.requestCode || '');
    const encodeNum = String(req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || req.encodeNumber || '');
    const modelStr = req.modelName !== undefined && req.modelName !== null ? String(req.modelName) : '';
    const typeStr = req.type !== undefined && req.type !== null ? String(req.type) : '';
    const brandStr = req.brand !== undefined && req.brand !== null ? String(req.brand) : '';
    const customerStr = req.customerName !== undefined && req.customerName !== null ? String(req.customerName) : '';
    const addressStr = req.address !== undefined && req.address !== null ? String(req.address) : '';
    const requestDateStr = req.requestDate ? (parseReportDateRange(String(req.requestDate)).start || String(req.requestDate)) : '';
    const receivedDateRaw = req.receivedDate || req.requestDate || '';
    const receivedDateStr = receivedDateRaw ? (parseReportDateRange(String(receivedDateRaw)).start || String(receivedDateRaw)) : '';
    const testerNameStr = req.testerName !== undefined && req.testerName !== null ? String(req.testerName) : '';
    const sealStampStr = req.sealStamp !== undefined && req.sealStamp !== null ? String(req.sealStamp) : '';
    const testDateVal = req.scheduledDate && req.endDate
      ? `${formatDateVN(req.scheduledDate)} – ${formatDateVN(req.endDate)}`
      : req.scheduledDate
      ? formatDateVN(req.scheduledDate)
      : req.result?.testDate
      ? formatDateVN(req.result.testDate)
      : '';
    
    setReportMeta(prev => ({
      ...prev,
      requestDate: requestDateStr || prev.requestDate,
      requestCode: requestCodeStr || prev.requestCode,
      reportNo: encodeNum || prev.reportNo || requestCodeStr,
      codingNumber: encodeNum || prev.codingNumber,
      sealStamp: sealStampStr || prev.sealStamp,
      sampleName: typeStr || modelStr || prev.sampleName,
      model: modelStr || prev.model,
      brand: brandStr || prev.brand,
      senderUnit: customerStr || prev.senderUnit,
      senderAddress: addressStr || prev.senderAddress,
      sampleReceiptDate: String(receivedDateStr) || prev.sampleReceiptDate,
      testerName: testerNameStr || prev.testerName,
      testDate: testDateVal || prev.testDate,
      deviceNameVi: typeStr || modelStr || prev.deviceNameVi,
    }));
    setEmcData(prev => ({
      ...prev,
      brand: brandStr || prev.brand,
      model: modelStr || prev.model,
    }));
  };

  const [tieuchuanOptions, setTieuchuanOptions] = useState<string[]>([]);
  const [dayCapDienData, setDayCapDienData] = useState<DayCapDienData>(initialDayCapDienData);
  
  React.useEffect(() => {
    // Fetch tieuchuan options with retry
    const fetchTieuchuan = async (retries = 3) => {
      try {
        const res = await fetch('/api/tieuchuan');
        const data = await res.json();
        if (data && data.data) {
          setTieuchuanOptions(data.data);
        }
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => fetchTieuchuan(retries - 1), 1000);
        } else {
          console.warn("Failed to load tieuchuan after multiple attempts", err);
        }
      }
    };
    
    fetchTieuchuan();
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const [selectedStandard, setSelectedStandard] = useState<ApplianceStandard | null>(null);
  const [ocrData, setOcrData] = useState({
    brand: '', model: '', sealStamp: '', voltage: '', frequency: '', power: '', current: '', clockFreq: '', origin: '', manufacturer: '', countryOfOrigin: '', ipRating: ''
  });
  
  const [reportMeta, setReportMeta] = useState({
    requestCode: '',
    requestDate: '',
    reportNo: '',
    rawReportDate: '',
    reportDate: '',
    sampleReceiptDate: '',
    testDate: '',
    senderUnit: 'Phòng Giám định – Chứng nhận, Phát triển thị trường',
    senderAddress: 'Số 565 đường Nguyễn Trãi, phường Thanh Liệt, TP. Hà Nội',
    sampleName: '',
    codingNumber: '',
    sealStamp: '',
    model: '',
    brand: '',
    testerName: '',
    managerName: '',
    manufacturer: '',
    countryOfOrigin: '',
    deviceNameVi: '',
    deviceNameEn: '',
    testMethod: [] as string[], // Phương pháp thử nghiệm (Dây cáp điện)
    evaluationStandard: [] as string[] // Tiêu chuẩn đánh giá (Dây cáp điện)
  });

  const [emcData, setEmcData] = useState<EmcData>({
    brand: '',
    model: '',
    power: '',
    voltage: '',
    current: '',
    frequency: '',
    clockFreq: '',
    ambientTemp: '',
    ambientHumidity: '',
    images: {
      label: null,
      phaseL: null,
      phaseN: null,
      powerDisturbance: null,
      discontinuousPhaseN: null,
      sample: null,
      setupVoltage: null,
      setupPower: null,
      setupRadiated: null,
    },
    tablePhaseL: Array.from({ length: 5 }, emptyPhaseRow),
    tablePhaseN: Array.from({ length: 5 }, emptyPhaseRow),
    tablePower: Array.from({ length: 1 }, emptyPowerRow),
    tablePhaseL_2: Array.from({ length: 5 }, emptyPhaseRow),
    tablePhaseN_2: Array.from({ length: 5 }, emptyPhaseRow),
    tablePower_2: Array.from({ length: 1 }, emptyPowerRow),
    tablePhaseL_3: Array.from({ length: 5 }, emptyPhaseRow),
    tablePhaseN_3: Array.from({ length: 5 }, emptyPhaseRow),
    tablePower_3: Array.from({ length: 1 }, emptyPowerRow),
    tableMag1_A: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag1_B: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag1_C: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag2_A: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag2_B: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag2_C: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag3_A: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag3_B: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag3_C: Array.from({ length: 5 }, emptyPhaseRow),
    tablePhaseL_4: Array.from({ length: 5 }, emptyPhaseRow),
    tablePhaseN_4: Array.from({ length: 5 }, emptyPhaseRow),
    tablePower_4: Array.from({ length: 1 }, emptyPowerRow),
    tableMag4_A: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag4_B: Array.from({ length: 5 }, emptyPhaseRow),
    tableMag4_C: Array.from({ length: 5 }, emptyPhaseRow),
  });

  const handleNameplateOcr = (values: { manufacturer: string; countryOfOrigin: string }) => {
    setReportMeta(prev => ({
      ...prev,
      manufacturer: values.manufacturer,
      countryOfOrigin: values.countryOfOrigin,
    }));
  };

  const [deviceHistoryVi, setDeviceHistoryVi] = useState<string[]>([]);
  const [deviceHistoryEn, setDeviceHistoryEn] = useState<string[]>([]);

  React.useEffect(() => {
    try {
      const storedVi = localStorage.getItem('deviceHistoryVi');
      const storedEn = localStorage.getItem('deviceHistoryEn');
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (storedVi) setDeviceHistoryVi(JSON.parse(storedVi));
      
      if (storedEn) setDeviceHistoryEn(JSON.parse(storedEn));
    } catch(e) {}
  }, []);
  const [testResults, setTestResults] = useState<Record<string, { req: string; result: string; evaluation: string; subData?: any }>>({});
  const [criteriaType, setCriteriaType] = useState<'full' | 'reduced' | null>(null);
  const [subOptionTitle, setSubOptionTitle] = useState<string | null>(null);
  const [expandedStandardId, setExpandedStandardId] = useState<string | null>(null);

  const isEmcReport = selectedStandard?.id?.startsWith('emc_') || false;

  const reportValidation = useMemo(() => validateReportConsistency({
    dates: {
      requestDate: reportMeta.requestDate,
      sampleReceiptDate: reportMeta.sampleReceiptDate,
      testDate: reportMeta.testDate,
      reportDate: reportMeta.rawReportDate,
    },
    source: selectedSample ? {
      requestCode: selectedSample.requestCode,
      model: selectedSample.modelName,
      brand: selectedSample.brand,
      codingNumber: selectedSample.atdEncodeNumber || selectedSample.emcEncodeNumber || selectedSample.itdEncodeNumber || selectedSample.encodeNumber,
      sealStamp: selectedSample.sealStamp,
      specifications: selectedSample.specifications,
      requestDate: selectedSample.requestDate,
    } : undefined,
    report: reportMeta,
    ocr: ocrData,
    form: isEmcReport ? {
      model: emcData.model,
      brand: emcData.brand,
      power: emcData.power,
      voltage: emcData.voltage,
      current: emcData.current,
      frequency: emcData.frequency,
    } : undefined,
  }), [emcData, isEmcReport, ocrData, reportMeta, selectedSample]);

  const getFieldIssues = (field: string) => reportValidation.issues.filter(issue => issue.field === field);
  const getFieldClass = (field: string, baseClass: string) => {
    const issues = getFieldIssues(field);
    if (issues.some(issue => issue.severity === 'error')) return `${baseClass} border-red-400 focus:border-red-500`;
    if (issues.some(issue => issue.severity === 'warning')) return `${baseClass} border-amber-400 focus:border-amber-500`;
    return baseClass;
  };
  const renderFieldIssues = (field: string) => {
    const issues = getFieldIssues(field);
    if (!issues.length) return null;
    return <div className={`mt-0.5 text-[10px] leading-tight ${issues.some(issue => issue.severity === 'error') ? 'text-red-600' : 'text-amber-700'}`}>{issues[0].message}</div>;
  };
  const blockingValidationIssues = reportValidation.issues.filter(issue => issue.severity === 'error');
  const warningValidationIssues = reportValidation.issues.filter(issue => issue.severity === 'warning');
  const getValidationLocations = (issues: typeof reportValidation.issues) => Array.from(new Set(issues.map(issue => getReportValidationFieldLabel(issue.field))));
  const blockingValidationLocations = getValidationLocations(blockingValidationIssues);
  const warningValidationLocations = getValidationLocations(warningValidationIssues);

  const [isCropping, setIsCropping] = useState<'product1' | 'product2' | 'nameplate1' | 'nameplate2' | null>(null);
  const [cropOverlaySrc, setCropOverlaySrc] = useState('');
  const [dragOverType, setDragOverType] = useState<'product1' | 'product2' | 'nameplate1' | 'nameplate2' | null>(null);
  const [hoveredType, setHoveredType] = useState<'product1' | 'product2' | 'nameplate1' | 'nameplate2' | null>(null);
  const [productPhoto1, setProductPhoto1] = useState<string>('');
  const [productPhoto2, setProductPhoto2] = useState<string>('');
  const [nameplatePhoto1, setNameplatePhoto1] = useState<string>('');
  const [nameplatePhoto2, setNameplatePhoto2] = useState<string>('');

  const [isParsingDocx, setIsParsingDocx] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'info' | 'preview'>('info');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

  // Helper date formatter
  const formatReportDate = (raw: string) => {
    return formatBilingualReportDate(raw);
  };

  // Initialize Default Date
  React.useEffect(() => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    const raw = `${y}-${m}-${d}`;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReportMeta(prev => ({
      ...prev,
      rawReportDate: raw,
      reportDate: formatReportDate(raw)
    }));
  }, []);

  const handleDateChange = (type: 'report' | 'sampleReceipt' | 'testStart' | 'testEnd', value: string) => {
    const newMeta = { ...reportMeta };
    if (type === 'report') newMeta.rawReportDate = value;
    else if (type === 'sampleReceipt') newMeta.sampleReceiptDate = value;
    else if (type === 'testStart') {
      const end = reportMeta.testDate.split(' – ')[1] || '';
      newMeta.testDate = `${value} – ${end}`;
    } else if (type === 'testEnd') {
      const start = reportMeta.testDate.split(' – ')[0] || '';
      newMeta.testDate = `${start} – ${value}`;
    }
    if (type === 'report') {
      newMeta.reportDate = formatReportDate(value.split('-').reverse().join('/')); 
    }
    setReportMeta(newMeta);
  };

  const translateDeviceName = async (viName: string) => {
    if (!viName || !selectedStandard) return;
    setIsTranslating(true);
    try {
      const state = useStore.getState();
      const currentUser = state.currentUser;
      const userApiKey = currentUser ? state.userPreferences[currentUser.username]?.geminiApiKey : undefined;
      const geminiModel = resolveGeminiModel(state);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userApiKey) headers["X-Gemini-API-Key"] = userApiKey;
      if (geminiModel) headers["x-gemini-model"] = geminiModel;

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "translate", viName })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Lỗi khi dịch tên");
      }
      const data = await res.json();
      const translation = data.text?.trim() || "";
    setReportMeta(prev => ({ ...prev, deviceNameEn: translation }));
      
      // Save to history
      setDeviceHistoryVi(prev => {
        const next = Array.from(new Set([viName, ...prev])).slice(0, 20);
        localStorage.setItem('deviceHistoryVi', JSON.stringify(next));
        return next;
      });
    } catch(err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleModelChange = (val: string) => {
    setReportMeta(prev => ({ ...prev, model: val }));
    setTestResults(prev => {
      if (prev && prev['7.1_6']) {
        return {
          ...prev,
          ['7.1_6']: { ...prev['7.1_6'], result: val }
        };
      }
      return prev;
    });
  };

  // --- Handlers: Select Standard ---
  const handleSelectStandard = (standard: ApplianceStandard, cType: 'full' | 'reduced' = 'full') => {
    setSelectedStandard(standard);
    const initialResults: any = {};
    const clausesToUse = cType === 'reduced' && standard.reducedClauses ? standard.reducedClauses : standard.clauses;
    clausesToUse.forEach(clause => {
      let subData: any = null;
      if (clause.subTable === 'POWER_AND_CURRENT') {
        if (standard.id === 'fan') {
          subData = [
            { cond: '220V ~ 50Hz', nominal: '50', unit: 'W', result: '-', limit: '+20%', dev: '-' },
            { cond: '220V ~ 50Hz', nominal: '-', unit: 'A', result: '-', limit: '-', dev: '-' }
          ];
        } else if (standard.id === 'microwave') {
          subData = [
            { cond: '230V ~ 50Hz', nominal: '3200', unit: 'W', result: '-', limit: '+15%; -10%', dev: '-' },
            { cond: '230V ~ 50Hz', nominal: '-', unit: 'A', result: '-', limit: '-', dev: '-' }
          ];
        } else {
          subData = [
            { cond: '220V ~ 50Hz', nominal: '4500', unit: 'W', result: '-', limit: '+5%; -10%', dev: '-' },
            { cond: '220V ~ 50Hz', nominal: '-', unit: 'A', result: '-', limit: '-', dev: '-' }
          ];
        }
      } else if (clause.subTable === 'HEATING') {
        if (standard.id === 'fan') {
          subData = {
            ambient: '40°C',
            condition: '1,06 lần điện áp danh định',
            workFollow: 'Làm việc cho đến khi thiết lập các điều kiện ổn định',
            rows: [
              { name: 'Độ tăng nhiệt cách điện dây nguồn', unit: '°C', result: '-', limit: '≤35' },
              { name: 'Độ tăng nhiệt bề mặt nút bấm, tay cầm, bộ phận cầm nắm sử dụng bình thường', unit: '°C', result: '-', limit: '≤35' },
              { name: 'Độ tăng nhiệt bề mặt nút bấm, tay cầm, bộ phận cầm nắm sử dụng thời gian ngắn', unit: '°C', result: '≤45' },
              { name: 'Độ tăng nhiệt bề mặt vỏ ngoài động cơ', unit: '°C', result: '-', limit: '≤60' },
              { name: 'Độ tăng nhiệt bề mặt giá đỡ, vách, góc thử nghiệm', unit: '°C', result: '-', limit: '≤50' },
            ]
          };
        } else if (standard.id === 'microwave') {
          subData = {
            ambient: '25°C',
            condition: '1,06 lần điện áp danh định.',
            workFollow: 'Thiết bị làm việc 10 phút, sau đó nghỉ 1 phút, mở cửa lò và thay một bình tải nước mới, làm việc trong ba chu kỳ',
            rows: [
              { name: 'Độ tăng nhiệt cách điện dây nguồn', unit: '°C', result: '-', limit: '≤50' },
              { name: 'Độ tăng nhiệt bề mặt nút bấm, tay cầm, bộ phận cầm nắm sử dụng bình thường', unit: '°C', result: '-', limit: '≤50' },
              { name: 'Độ tăng nhiệt bề mặt nút bấm, tay cầm, bộ phận cầm nắm sử dụng thời gian ngắn', unit: '°C', result: '-', limit: '≤60' },
              { name: 'Độ tăng nhiệt bề mặt kính thiết bị', unit: '°C', result: '-', limit: '≤65' },
              { name: 'Độ tăng nhiệt cuộn dây máy biến áp', unit: '°C', result: '-', limit: '≤90' },
              { name: 'Độ tăng nhiệt cuộn dây động cơ quạt', unit: '°C', result: '-', limit: '≤90' },
              { name: 'Độ tăng nhiệt bề mặt giá đỡ, vách, góc thử nghiệm', unit: '°C', result: '-', limit: '≤65' },
            ]
          };
        } else {
          subData = {
            ambient: '25°C',
            condition: '1,15 lần công suất danh định',
            workFollow: '',
            rows: [
              { name: 'Độ tăng nhiệt cách điện dây nguồn', unit: '°C', result: '-', limit: '≤50' },
              { name: 'Độ tăng nhiệt bề mặt nút bấm, tay cầm, bộ phận cầm nắm sử dụng bình thường', unit: '°C', result: '-', limit: '≤50' },
              { name: 'Độ tăng nhiệt bề mặt nút bấm, tay cầm, bộ phận cầm nắm sử dụng thời gian ngắn', unit: '°C', result: '-', limit: '≤60' },
              { name: 'Độ tăng nhiệt bề mặt giá đỡ, vách, góc thử nghiệm', unit: '°C', result: '-', limit: '≤65' },
            ]
          };
        }
      } else if (clause.subTable === 'LEAKAGE_AND_DIELECTRIC') {
        if (standard.id === 'microwave') {
          const leakLimit = (clause.id === '16' || clause.id === '16.2' || clause.id === '16.3') ? '≤3,5' : '≤3,5';
          const basicLimit = (clause.id === '16' || clause.id === '16.2' || clause.id === '16.3') ? '1250' : '1000';
          subData = [
            { name: 'Dòng điện rò giữa bộ phận mang điện và bộ phận kim loại chạm tới được', unit: 'mA', result: '-', limit: leakLimit },
            { name: 'Độ bền điện đối với cách điện chính', unit: 'V/1min', result: 'Không xuất hiện phóng điện đánh thủng', limit: basicLimit },
            { name: 'Độ bền điện đối với cách điện phụ', unit: 'V/1min', result: '-', limit: '1750' },
            { name: 'Độ bền điện đối với cách điện tăng cường', unit: 'V/1min', result: '-', limit: '3000' },
          ];
        } else {
          subData = [
            { name: 'Dòng điện rò giữa cực bất kì của nguồn cung cấp và bộ phận kim loại chạm tới được', unit: 'mA', result: '-', limit: '≤0,75' },
            { name: 'Độ bền điện đối với cách điện chính', unit: 'V/1min', result: 'Không xuất hiện phóng điện đánh thủng', limit: '1000' },
            { name: 'Độ bền điện đối với cách điện phụ', unit: 'V/1min', result: '-', limit: '1750' },
            { name: 'Độ bền điện đối với cách điện tăng cường', unit: 'V/1min', result: '-', limit: '3000' },
          ];
        }
      } else if (clause.subTable === 'ABNORMAL') {
        if (standard.id === 'microwave' || standard.id === 'hair_dryer' || standard.id === 'toaster') {
          subData = {
            ambient: '25°C',
            workFollow: '',
            rows: [
              { name: 'Độ tăng nhiệt dây nguồn', unit: '°C', result: '-', limit: '≤ 150' },
              { name: 'Độ tăng nhiệt cuộn dây động cơ', unit: '°C', result: '-', limit: '≤ 215' },
              { name: 'Độ tăng nhiệt sàn/vách của góc thử nghiệm', unit: '°C', result: '-', limit: '≤ 150' },
            ]
          };
        } else if (standard.id === 'iron') {
          subData = {
            ambient: '24°C',
            workFollow: '',
            rows: [
              { name: 'Độ tăng nhiệt dây nguồn', unit: '°C', result: '-', limit: '≤ 150' },
              { name: 'Độ tăng nhiệt cuộn dây động cơ', unit: '°C', result: '-', limit: '≤ 215' },
            ]
          };
        } else if (standard.id === 'storage_heater') {
          subData = {
            ambient: '25°C',
            workFollow: '',
            rows: [
              { name: 'Độ tăng nhiệt sàn/vách của góc thử nghiệm', unit: '°C', result: '-', limit: '≤ 150' },
              { name: 'Độ tăng nhiệt dây nguồn', unit: '°C', result: '-', limit: '≤ 150' },
            ]
          };
        } else {
          subData = {
            ambient: '25°C',
            workFollow: '',
            rows: [
              { name: 'Độ tăng nhiệt sàn/vách của góc thử nghiệm', unit: '°C', result: '-', limit: '≤ 150' },
              { name: 'Độ tăng nhiệt dây nguồn', unit: '°C', result: '-', limit: '≤ 150' },
              { name: 'Độ tăng nhiệt cuộn dây động cơ', unit: '°C', result: '-', limit: '≤ 215' },
            ]
          };
        }
      } else if (clause.subTable === 'ABNORMAL_35') {
        subData = {
          ambient: '25°C',
          workFollow: '',
          rows: [
            { name: 'Nhiệt độ nước hộp chứa nước > 1 Lít đối với bình đun nước nóng có đầu ra để hở', unit: '°C', result: '-', limit: '≤ 99' },
            { name: 'Nhiệt độ nước hộp chứa nước >1 Lít đối với bình đun nước nóng có đầu ra hạn chế', unit: '°C', result: '-', limit: '≤ 140' },
            { name: 'Độ tăng nhiệt sàn/vách của góc thử nghiệm', unit: '°C', result: '-', limit: '≤ 150' },
            { name: 'Độ tăng nhiệt dây nguồn', unit: '°C', result: '-', limit: '≤ 150' }
          ]
        };
      } else if (clause.subTable === 'CLAUSE_22') {
        subData = {
          inputTemp: '',
          rows: [
            { name: 'Nhiệt độ của nước đầu ra', unit: '°C', result: '-', limit: '≤ 98' }
          ]
        };
      } else if (clause.subTable === 'CLAUSE_22_35') {
        subData = [
          {
            section: 'Thử nghiệm 22.107',
            tempIn: '',
            rows: [
              { name: 'Nhiệt độ của nước đầu ra', unit: '°C', result: '-', limit: '≤ 90' },
              { name: 'Chênh lệch nhiệt độ giữa nước đầu ra so với nước đầu vào', unit: '°C', result: '-', limit: '≤ 75' },
              { name: 'Nhiệt độ của nước đầu ra đối với thiết bị được thiết kế chỉ cấp nước cho vòi hoa sen', unit: '°C', result: '-', limit: '≤ 55' }
            ]
          },
          {
            section: 'Thử nghiệm 22.108',
            tempIn: '-',
            tempOut: '-',
            rows: [
              { name: 'Nhiệt độ của nước đầu ra trong 10s', unit: '°C', result: '-', limit: '≤ 25' }
            ]
          }
        ];
      } else if (clause.subTable === 'CLAUSE_24') {
        subData = {
          inputTemp: '',
          rows: [
            { name: 'Nhiệt độ của nước đầu ra khi nối tắt bộ điều nhiệt', unit: '°C', result: '-', limit: '≤ 99' },
            { name: 'Nhiệt độ của cơ cấu cắt theo nguyên lý nhiệt khi tác động', unit: '°C', result: '-', limit: '≤ 110' },
            { name: 'Chênh lệch giữa nhiệt độ nước sau khi cơ cấu tác động và nhiệt độ làm việc cho phép...', unit: '°C', result: '-', limit: '≤ 20' }
          ]
        };
      } else if (clause.subTable === 'EARTHING') {
        if (standard.id === 'microwave') {
          subData = [
            { name: 'Điện trở giữa điện áp rơi của tiếp điểm nối đất đầu ô cắm và phần kim loại chạm tới được\n- Dòng điện thử: 25A', unit: 'Ω', result: '-', limit: '≤0,1' }
          ];
        } else {
          subData = [
            { name: 'Điện trở giữa điện áp rơi của tiếp điểm nối đất đầu ô cắm và phần kim loại chạm tới được\n- Dòng điện thử: 25A', unit: 'Ω', result: '-', limit: '≤0,1' }
          ];
        }
      } else if (clause.subTable === 'CREEPAGE_CLEARANCE') {
        if (standard.id === 'microwave') {
          subData = [
            { section: 'Chiều dài đường rò', rows: [
              { name: 'Cách điện chính', unit: 'mm', result: '-', limit: '≥ 2,5' },
              { name: 'Cách điện chức năng', unit: 'mm', result: '-', limit: '≥ 2,0' }
            ]},
            { section: 'Khe hở không khí', rows: [
              { name: 'Cách điện chính', unit: 'mm', result: '-', limit: '≥ 1,5' },
              { name: 'Cách điện chức năng', unit: 'mm', result: '-', limit: '≥ 2,0' }
            ]}
          ];
        } else {
          subData = [
            { section: 'Chiều dài đường rò', rows: [
              { name: 'Cách điện chính', unit: 'mm', result: '-', limit: '≥ 2,5' },
              { name: 'Cách điện chức năng', unit: 'mm', result: '-', limit: '≥ 2,0' }
            ]},
            { section: 'Khe hở không khí', rows: [
              { name: 'Cách điện chính', unit: 'mm', result: '-', limit: '≥ 1,5' },
              { name: 'Cách điện chức năng', unit: 'mm', result: '-', limit: '≥ 2,0' }
            ]}
          ];
        }
      } else if (clause.subTable === 'HEAT_FIRE') {
        if (standard.id === 'microwave') {
          subData = [
            { section: 'Thử nghiệm nén viên bi', rows: [
              { name: '75°C ± 2°C với các bộ phận bên ngoài', unit: 'mm', result: '-', limit: '≤ 2,0' },
              { name: '125°C ± 2°C với các bộ phận đỡ các phần mang điện', unit: 'mm', result: '-', limit: '≤ 2,0' }
            ]},
            { section: 'Thử nghiệm sợi dây nóng đỏ', rows: [
              { name: '550°C ± 10°C với các bộ phận bằng vật liệu phi kim loại', unit: 's', result: '-', limit: '≤ 30' },
              { name: '750°C ± 10°C với các bộ phận bằng vật liệu phi kim loại đỡ mối nối mang điện', unit: 's', result: '-', limit: '≤ 30' }
            ]}
          ];
        } else {
          subData = [
            { section: 'Thử nghiệm nén viên bi', rows: [
              { name: '75°C ± 2°C với các bộ phận bên ngoài', unit: 'mm', result: '-', limit: '≤ 2,0' },
              { name: '125°C ± 2°C với các bộ phận đỡ các phần mang điện', unit: 'mm', result: '-', limit: '≤ 2,0' }
            ]},
            { section: 'Thử nghiệm sợi dây nóng đỏ', rows: [
              { name: '550°C ± 10°C với các bộ phận bằng vật liệu phi kim loại', unit: 's', result: '-', limit: '≤ 30' },
              { name: '750°C ± 10°C với các bộ phận bằng vật liệu phi kim loại đỡ mối nối mang điện', unit: 's', result: '-', limit: '≤ 30' }
            ]}
          ];
        }
        if (standard.id === 'hair_dryer' && Array.isArray(subData)) {
          subData.push({ section: 'Thử nghiệm ngọn lửa hình kim', rows: [
            { name: 'Với các bộ phận bằng vật liệu phi kim loại bọc ngoài phần tử gia nhiệt và linh kiện khác', unit: 's', result: '-', limit: '≤ 30' },
            { name: 'Với các bộ phận bằng vật liệu phi kim loại bên trong vỏ bọc', unit: 's', result: '-', limit: '≤ 30' },
            { name: 'Mạch in', unit: 's', result: '-', limit: '≤ 15' }
          ] });
        }
      } else if (clause.subTable === 'CLAUSE_32') {
        if (standard.id === 'microwave') {
          subData = {
            ambient: 'Vị trí đo bất kì cách mặt ngoài thiết bị 50mm',
            rows: [
              { name: 'Điều 18', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.101', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.102', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.103', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.104', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.105', unit: 'W/m2', result: '-', limit: '≤ 100' },
              { name: '22.109', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: '22.110', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: '22.111', unit: 'W/m2', result: '-', limit: '≤ 100' },
              { name: '22.112', unit: 'W/m2', result: '-', limit: '≤ 100' },
              { name: '22.113', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: '32', unit: 'W/m2', result: '-', limit: '≤ 50' }
            ]
          };
        } else {
          subData = {
            ambient: 'Vị trí đo bất kì cách mặt ngoài thiết bị 50mm',
            rows: [
              { name: 'Điều 18', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.101', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.102', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.103', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.104', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: 'Điều 21.105', unit: 'W/m2', result: '-', limit: '≤ 100' },
              { name: '22.109', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: '22.110', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: '22.111', unit: 'W/m2', result: '-', limit: '≤ 100' },
              { name: '22.112', unit: 'W/m2', result: '-', limit: '≤ 100' },
              { name: '22.113', unit: 'W/m2', result: '-', limit: '≤ 50' },
              { name: '32', unit: 'W/m2', result: '-', limit: '≤ 50' }
            ]
          };
        }
      }
      initialResults[clause.id] = { req: clause.requirement, result: clause.defaultResult || '', evaluation: clause.defaultEvaluation || 'N/A', subData, subTable: clause.subTable };
    });
    setTestResults(initialResults);
  };

  // --- Handlers: Image Crop & Upload ---
  const handlePhotoFile = (file: File, type: 'product1' | 'product2' | 'nameplate1' | 'nameplate2') => {
    if (file.type.startsWith('image/')) {
      setIsCropping(type);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropOverlaySrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'product1' | 'product2' | 'nameplate1' | 'nameplate2') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(null);
    let file = null;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file' && e.dataTransfer.items[i].type.startsWith('image/')) {
          const itemFile = e.dataTransfer.items[i].getAsFile();
          if (itemFile) file = itemFile;
          break;
        }
      }
    }
    if (file) handlePhotoFile(file, type);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, type: 'product1' | 'product2' | 'nameplate1' | 'nameplate2') => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverType !== type) setDragOverType(type);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(null);
  };

  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.clipboardData) {
        let file = null;
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          file = e.clipboardData.files[0];
        } else if (e.clipboardData.items) {
          for (let i = 0; i < e.clipboardData.items.length; i++) {
            if (e.clipboardData.items[i].type.indexOf("image") !== -1) {
              const itemFile = e.clipboardData.items[i].getAsFile();
              if (itemFile) file = itemFile;
              break;
            }
          }
        }
        
        if (file && file.type.startsWith('image/')) {
          e.preventDefault();
          let targetType: 'product1' | 'product2' | 'nameplate1' | 'nameplate2' = 'product1';
          if (hoveredType) {
            targetType = hoveredType;
          } else {
            if (!productPhoto1) targetType = 'product1';
            else if (!productPhoto2) targetType = 'product2';
            else if (!nameplatePhoto1) targetType = 'nameplate1';
            else if (!nameplatePhoto2) targetType = 'nameplate2';
          }
          
          handlePhotoFile(file, targetType);
        }
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [productPhoto1, productPhoto2, nameplatePhoto1, nameplatePhoto2, hoveredType]);

  const handlePhotoClick = (type: 'product1' | 'product2' | 'nameplate1' | 'nameplate2') => {
    setIsCropping(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropOverlaySrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropComplete = async (croppedBase64: string) => {
    if (isCropping === 'product1') {
      setProductPhoto1(croppedBase64);
    } else if (isCropping === 'product2') {
      setProductPhoto2(croppedBase64);
    } else if (isCropping === 'nameplate1') {
      setNameplatePhoto1(croppedBase64);
      processOcr(croppedBase64);
    } else if (isCropping === 'nameplate2') {
      setNameplatePhoto2(croppedBase64);
      processOcr(croppedBase64);
    }
    closeCropper();
  };

  const closeCropper = () => {
    setIsCropping(null);
    setCropOverlaySrc('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Handlers: OCR processing ---
  const processOcr = async (base64: string) => {
    setIsOcrProcessing(true);
    try {
      const state = useStore.getState();
      const currentUser = state.currentUser;
      const userApiKey = currentUser ? state.userPreferences[currentUser.username]?.geminiApiKey : undefined;
      const geminiModel = resolveGeminiModel(state);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userApiKey) headers["X-Gemini-API-Key"] = userApiKey;
      if (geminiModel) headers["x-gemini-model"] = geminiModel;

      const base64Str = base64.split(',')[1] || base64;
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "ocr", base64: base64Str })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Lỗi khi trích xuất OCR");
      }
      const json = await res.json();
      const data = JSON.parse(json.text || "{}");

      setOcrData({
        brand: data.brand || '',
        model: data.model || '',
        sealStamp: data.sealStamp || '',
        voltage: data.voltage || '',
        frequency: data.frequency || '',
        power: data.power || '',
        current: data.current || '',
        clockFreq: data.clockFreq || '',
        origin: data.origin || '',
        manufacturer: data.manufacturer || '',
        countryOfOrigin: data.countryOfOrigin || data.origin || '',
        ipRating: data.ipRating || '',
      });

      if (data.sealStamp) {
        setReportMeta(prev => ({
          ...prev,
          sealStamp: data.sealStamp || prev.sealStamp
        }));
      }
      if (data.manufacturer || data.countryOfOrigin || data.origin) {
        setReportMeta(prev => ({
          ...prev,
          manufacturer: data.manufacturer || prev.manufacturer,
          countryOfOrigin: data.countryOfOrigin || data.origin || prev.countryOfOrigin,
        }));
      }
    } catch (err) {
      console.error('OCR error:', err);
      alert('Lỗi khi trích xuất OCR');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // --- Handlers: Parse old DOCX ---
  const triggerDocxUpload = () => {
    docxInputRef.current?.click();
  };

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsParsingDocx(true);
    try {
      const formData = new FormData();
      formData.append('file', e.target.files[0]);
      
      if (isEmcReport) {
        const res = await fetch('/api/extract-radimation', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setEmcData(prev => {
              const next = { ...prev };
              if (result.tablePhaseL && result.tablePhaseL.length > 0) {
                next.tablePhaseL = result.tablePhaseL;
              }
              if (result.tablePhaseN && result.tablePhaseN.length > 0) {
                next.tablePhaseN = result.tablePhaseN;
              }
              if (result.tablePower && result.tablePower.length > 0) {
                next.tablePower = result.tablePower;
              }
              if (result.images) {
                next.images = { ...next.images, ...result.images };
              }
              return next;
            });
            alert('Đã kế thừa dữ liệu báo cáo EMC (gồm các bảng trang 3) thành công!');
          } else {
            alert('Lỗi: ' + (result.error || 'Không thể đọc file DOCX'));
          }
        } else {
          alert('Lỗi xử lý file từ phía Server');
        }
      } else {
        const res = await fetch('/api/parse-docx', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          const { parsedData } = await res.json();
          // Ánh xạ dữ liệu nếu bảng đang mở
          if (selectedStandard) {
            setTestResults(prev => {
              const next = { ...prev };
              Object.keys(next).forEach(clauseId => {
                 if (parsedData[clauseId]) {
                   next[clauseId].result = parsedData[clauseId].result || next[clauseId].result;
                   next[clauseId].evaluation = parsedData[clauseId].evaluation || next[clauseId].evaluation;
                 }
              });
              return next;
            });
          }
          alert('Đã kế thừa dữ liệu báo cáo cũ thành công!');
        } else {
          alert('Lỗi xử lý file từ phía Server');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kế thừa DOCX');
    } finally {
      setIsParsingDocx(false);
      if (docxInputRef.current) docxInputRef.current.value = '';
    }
  };

  ;

  ;

  ;

  ;
  ;

  ;

  ;

  // --- Handlers: Save Report Only ---
  const handleSaveReport = async () => {
    if (!selectedStandard) return;
    if (reportValidation.hasErrors) {
      toast.error('Không thể Lưu báo cáo: vui lòng xử lý các lỗi đối soát trước.');
      return;
    }
    setIsSavingReport(true);

    if (reportMeta.deviceNameVi) {
       setDeviceHistoryVi(prev => {
          const next = Array.from(new Set([reportMeta.deviceNameVi, ...prev])).slice(0, 20);
          localStorage.setItem('deviceHistoryVi', JSON.stringify(next));
          return next;
       });
    }
    if (reportMeta.deviceNameEn) {
       setDeviceHistoryEn(prev => {
          const next = Array.from(new Set([reportMeta.deviceNameEn, ...prev])).slice(0, 20);
          localStorage.setItem('deviceHistoryEn', JSON.stringify(next));
          return next;
       });
    }

    try {
      const record: KQTNRecord = {
        id: String(Date.now()),
        requestId: selectedSample?.id,
        requestCode: reportMeta.requestCode || undefined,
        reportNo: reportMeta.codingNumber || reportMeta.reportNo,
        sampleCode: reportMeta.codingNumber,
        sampleKey: getKqtnSampleKey({ sampleCode: reportMeta.codingNumber }),
        sealStamp: reportMeta.sealStamp,
        sampleName: reportMeta.sampleName,
        model: reportMeta.model,
        brand: reportMeta.brand,
        senderUnit: reportMeta.senderUnit,
        testDate: reportMeta.testDate,
        reportDate: reportMeta.reportDate,
        testerName: reportMeta.testerName,
        managerName: reportMeta.managerName,
        criteriaType: criteriaType || undefined,
        subOptionTitle: subOptionTitle || undefined,
        version: 1,
        versionHistory: [],
        createdBy: currentUser?.name || 'Người dùng hệ thống',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || 'Người dùng hệ thống',
        standardId: selectedStandard.id,
        standardTitle: selectedStandard.standard,
        testResultsData: JSON.parse(JSON.stringify(testResults)),
        emcData: JSON.parse(JSON.stringify(emcData)),
        dayCapDienData: JSON.parse(JSON.stringify(dayCapDienData)),
        productPhoto1,
        productPhoto2,
        nameplatePhoto1,
        nameplatePhoto2,
        nameplatePhotos: [nameplatePhoto1, nameplatePhoto2].filter(Boolean),
        createdAt: new Date().toISOString()
      };
      const existingResult = kqtnRecords.find((item) => getKqtnSampleKey(item) === getKqtnSampleKey(record));
      const overwriteConfirmed = existingResult
        ? window.confirm('This sample head already has a KQTN result. Overwrite the old result?')
        : false;
      if (existingResult && !overwriteConfirmed) {
        toast.info('The old KQTN result was kept.');
        return;
      }
      const persistedRecord = {
        ...stripTransientKqtnImages(record),
        __overwriteConfirmed: overwriteConfirmed,
      } as KQTNRecord;
      await addKqtnRecord(persistedRecord);
      toast.success('Đã lưu dữ liệu báo cáo thành công!');
    } catch (err) {
      console.error("Lưu báo cáo thất bại:", err);
      toast.error('Có lỗi xảy ra khi lưu báo cáo!');
    } finally {
      setIsSavingReport(false);
    }
  };

  // --- Handlers: Generate Docx ---
  const handleGenerateDocx = async () => {
    if (!selectedStandard) return;
    if (reportValidation.hasErrors) {
      toast.error('Không thể xuất báo cáo DOCX: vui lòng xử lý các lỗi đối soát trước.');
      return;
    }
    setIsGeneratingDocx(true);
    
    if (reportMeta.deviceNameVi) {
       setDeviceHistoryVi(prev => {
          const next = Array.from(new Set([reportMeta.deviceNameVi, ...prev])).slice(0, 20);
          localStorage.setItem('deviceHistoryVi', JSON.stringify(next));
          return next;
       });
    }
    if (reportMeta.deviceNameEn) {
       setDeviceHistoryEn(prev => {
          const next = Array.from(new Set([reportMeta.deviceNameEn, ...prev])).slice(0, 20);
          localStorage.setItem('deviceHistoryEn', JSON.stringify(next));
          return next;
       });
    }

    try {
      const payloadTestResults = JSON.parse(JSON.stringify(testResults));
      
      let powerW = 0;
      const pData = payloadTestResults['10']?.subData;
      if (pData && Array.isArray(pData)) {
         powerW = parseFloat((pData[0].nominal || '').toString().replace(',', '.')) || 0;
      }
      const computedVal = 0.75 * 0.001 * powerW;
      const fStr = `≤${computedVal.toFixed(2).replace('.', ',')}`;
      
      for (const clId of Object.keys(payloadTestResults)) {
         const clause = payloadTestResults[clId];
         if (clause && clause.subTable === 'LEAKAGE_AND_DIELECTRIC' && Array.isArray(clause.subData)) {
             if (clause.subData[0].limit === 'FORMULA') {
                 clause.subData[0].limit = fStr;
             } else if (clause.subData[0].limit === '≤0,5_2') {
                 clause.subData[0].limit = '≤0,5';
             }
         }
      }

      const res = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ocrData, testResults: payloadTestResults, standard: selectedStandard, criteriaType,
            productPhoto1, productPhoto2, nameplatePhoto1, nameplatePhoto2, nameplatePhotos: [nameplatePhoto1, nameplatePhoto2].filter(Boolean), reportMeta, emcData, dayCapDienData,
            subOptionTitle
          })
      });
      
      if (res.ok) {
        const docxPayload = await res.json();
        
        if (docxPayload && docxPayload.base64) {
            try {
              const defaultFilename = (reportMeta.codingNumber || reportMeta.reportNo) ? `${reportMeta.codingNumber || reportMeta.reportNo}.docx` : (docxPayload.filename || 'Report.docx');
              const byteCharacters = atob(docxPayload.base64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

              if ('showSaveFilePicker' in window) {
                try {
                  const handle = await (window as any).showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [{
                      description: 'Word Document',
                      accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
                    }],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(blob);
                  await writable.close();
                  toast.success('Đã xuất file báo cáo (.docx) thành công!');
                  return;
                } catch (pickerErr: any) {
                  if (pickerErr.name === 'AbortError') return;
                  throw pickerErr;
                }
              } else {
                 throw new Error("showSaveFilePicker not available");
              }
            } catch (err) {
                try {
                    const defaultFilename = (reportMeta.codingNumber || reportMeta.reportNo) ? `${reportMeta.codingNumber || reportMeta.reportNo}.docx` : (docxPayload.filename || 'Report.docx');
                    const link = document.createElement("a");
                    link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxPayload.base64}`;
                    link.download = defaultFilename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('Đã tải xuống file báo cáo (.docx) thành công!');
                } catch (fbErr) {
                    console.error("Lỗi khi tải xuống file:", fbErr);
                    toast.error('Có lỗi xảy ra khi lưu file. Vui lòng thử lại!');
                }
            }
        }
      } else {
         const errData = await res.json();
         toast.error(`Lỗi xuất báo cáo DOCX: ${errData.error || 'Lỗi không xác định'}`);
      }
    } catch (err) {
       console.error("Report Generation failed", err);
       toast.error("Lỗi xuất báo cáo DOCX.");
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-full max-h-[100dvh] overflow-hidden w-full bg-[#1b4332] flex-col lg:flex-row text-slate-800 mobile-safe-bottom md:pb-0">
      {/* Main Workspace */}
      <main className="flex-grow flex flex-col overflow-hidden">
        <header className="min-h-12 sm:min-h-16 py-3 bg-white flex flex-wrap sm:flex-nowrap items-center justify-between px-3 sm:px-6 flex-shrink-0 gap-2 z-10 shadow-sm relative">
          <div className="flex items-center gap-2 max-w-[calc(100%-140px)] sm:max-w-none text-[14px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
            {selectedStandard && (
              <button 
                className="p-1 -ml-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition flex items-center justify-center shrink-0" 
                onClick={() => { setSelectedStandard(null); setCriteriaType(null); setSubOptionTitle(null); }}
                title="Quay lại danh sách mẫu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <span className="cursor-pointer hover:text-slate-800 font-medium" onClick={() => { setSelectedStandard(null); setCriteriaType(null); setSubOptionTitle(null); }}>Mẫu báo cáo</span>
            {selectedStandard && (
                <>
                    <span className="mx-1 text-slate-400">/</span>
                    <span className="cursor-pointer hover:text-slate-800 font-medium truncate" onClick={() => { setCriteriaType(null); setSubOptionTitle(null); }}>{selectedStandard.standard}</span>
                </>
            )}
            {criteriaType && (
                <>
                    <span className="mx-1 text-slate-400">/</span>
                    <span className="font-bold text-slate-800 truncate">{subOptionTitle || (criteriaType === 'full' ? 'Đầy đủ chỉ tiêu' : 'Giảm chỉ tiêu')}</span>
                </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDocxSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs sm:text-sm font-semibold transition shadow-xs border border-slate-200"
              title="Quản lý và cập nhật biểu mẫu Word (.docx)"
            >
              <FileCog className="w-4 h-4 text-emerald-600" />
              <span>Cài đặt docx</span>
            </button>
          </div>
        </header>

        {!selectedStandard ? (
          /* Dashboard Grid */
          <div className="p-2 sm:p-4 lg:p-5 overflow-y-auto flex-grow min-h-0 bg-gradient-to-b from-slate-50 to-white">
            <div className="w-full max-w-[1400px] mx-auto">
               <div className="grid grid-cols-2 min-[390px]:grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-3 pb-4 mt-0">
                 {STANDARDS.map(std => (
                   <div key={std.id} 
                        className={`bg-white border rounded-xl p-2 sm:p-3 cursor-pointer transition-all flex flex-col items-center text-center justify-start sm:justify-center active:scale-[0.97] touch-manipulation relative group ${expandedStandardId === std.id ? 'min-h-[132px] sm:min-h-[152px] overflow-visible border-emerald-500 shadow-lg ring-2 ring-emerald-100 z-10' : 'min-h-[88px] sm:min-h-[104px] overflow-hidden border-slate-200/80 shadow-sm hover:border-emerald-300 hover:shadow-md'}`}
                        onClick={() => {
                          if (std.id === 'emc_dung_cu_dien_dun_nuoc_nong' || std.id === 'emc_tu_lanh' || std.id === 'emc_may_say_toc' || std.id === 'emc_may_khoan') {
                            setCriteriaType('full');
                            setSubOptionTitle(null);
                            handleSelectStandard(std, 'full');
                          } else {
                            setExpandedStandardId(expandedStandardId === std.id ? null : std.id);
                          }
                        }}>
                     
                     <div className="flex flex-col items-center justify-center h-full transition-transform duration-300 group-hover:-translate-y-1">
                       {getStandardIcon(std.id)}
                       <div className="font-bold text-slate-700 text-[9px] sm:text-[10px] leading-tight px-0.5 group-hover:text-emerald-700 transition-colors">{std.standard}</div>
                     </div>

                     {expandedStandardId === std.id && (
                       <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-2 sm:p-3 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                         <button className="mobile-touch-target absolute top-1.5 sm:top-2 right-1.5 sm:right-2 p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors" onClick={() => setExpandedStandardId(null)} aria-label="Đóng lựa chọn tiêu chuẩn">
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        <div className="font-bold text-slate-800 text-[10px] sm:text-sm mb-2 sm:mb-3 text-center border-b border-slate-100 pb-1 sm:pb-2 w-full truncate px-3 sm:px-4">{std.standard}</div>
                        <div className="flex flex-col gap-1.5 sm:gap-2 w-full overflow-y-auto max-h-full hide-scrollbar">
                        {std.id === 'emc_bep_dien' || std.id === 'emc_dieu_hoa' ? (
                          (std.id === 'emc_bep_dien' ? [
                            'Bếp điện 1 vùng nấu',
                            'Bếp điện 2 vùng nấu',
                            'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại',
                            'Bếp từ + hồng ngoại',
                            'Bếp từ 1 vùng nấu',
                            'Bếp từ 2 vùng nấu',
                            'Bếp từ 3 vùng nấu',
                            'Bếp từ 4 vùng nấu'
                          ] : [
                            '1 khối-loại hai chiều',
                            '1 khối-loại một chiều',
                            'loại hai chiều',
                            'loại một chiều',
                            'loại một chiều-không có đầu nối tải'
                          ]).map((item, idx) => {
                            return (
                              <button 
                                key={idx} 
                                className="w-full text-center px-1 sm:px-3 py-1.5 sm:py-2 text-[9px] sm:text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors active:opacity-80 touch-manipulation border border-emerald-100" 
                                onClick={() => { setCriteriaType('full'); setSubOptionTitle(item); handleSelectStandard(std, 'full'); }}
                              >
                                {item}
                              </button>
                            );
                          })
                        ) : std.id === 'emc_may_giat' ? (
                          <>
                            <button className="w-full text-center px-1 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-xs font-semibold rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition active:opacity-80 touch-manipulation" onClick={() => { setCriteriaType('full'); setSubOptionTitle('Có chức năng sấy'); handleSelectStandard(std, 'full'); }}>Có sấy</button>
                            <button className="w-full text-center px-1 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:opacity-80 touch-manipulation" onClick={() => { setCriteriaType('reduced'); setSubOptionTitle('Không có chức năng sấy'); handleSelectStandard(std, 'reduced'); }}>Không sấy</button>
                          </>
                        ) : (std.id === 'emc_may_hut_bui' || std.id === 'emc_may_xay') ? (
                          <>
                            <button className="w-full text-center px-1 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-xs font-semibold rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition active:opacity-80 touch-manipulation" onClick={() => { setCriteriaType('full'); setSubOptionTitle('Có dùng tay giả'); handleSelectStandard(std, 'full'); }}>Dùng tay giả</button>
                            <button className="w-full text-center px-1 sm:px-3 py-2 sm:py-2.5 text-[9px] sm:text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:opacity-80 touch-manipulation" onClick={() => { setCriteriaType('reduced'); setSubOptionTitle('Không dùng tay giả'); handleSelectStandard(std, 'reduced'); }}>Không dùng</button>
                          </>
                        ) : (
                          <>
                            <button className="w-full text-center px-1 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition active:opacity-80 touch-manipulation" onClick={() => { setCriteriaType('full'); setSubOptionTitle(null); handleSelectStandard(std, 'full'); }}>Đầy đủ</button>
                            <button className="w-full text-center px-1 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:opacity-80 touch-manipulation" onClick={() => { setCriteriaType('reduced'); setSubOptionTitle(null); handleSelectStandard(std, 'reduced'); }}>Giảm thiểu</button>
                          </>
                        )}
                        </div>
                     </div>
                   )}
                 </div>
               ))}
             </div>
            </div>
          </div>
        ) : (
          /* Testing Module Layout */
          <div className="flex flex-col flex-grow min-h-0 bg-[#1b4332] overflow-hidden relative">

            {/* Pill Tabs for Mobile/Desktop */}
            <div className="flex px-4 py-3 gap-2 shrink-0 max-w-2xl mx-auto w-full z-10 lg:hidden">
              <button 
                 className={`mobile-touch-target flex-1 py-2 text-xs uppercase tracking-wide font-bold rounded-md transition-all flex items-center justify-center touch-manipulation ${activeMobileTab === 'info' ? 'border-2 border-emerald-400 text-white shadow-sm bg-[#1b4332]' : 'bg-white/10 text-emerald-100 hover:bg-white/20'}`}
                onClick={() => setActiveMobileTab('info')}
              >
                THÔNG TIN
              </button>
              <button 
                 className={`mobile-touch-target flex-1 py-2 text-xs uppercase tracking-wide font-bold rounded-md transition-all flex items-center justify-center touch-manipulation ${activeMobileTab === 'preview' ? 'border-2 border-emerald-400 text-white shadow-sm bg-[#1b4332]' : 'bg-white/10 text-emerald-100 hover:bg-white/20'}`}
                onClick={() => setActiveMobileTab('preview')}
              >
                ĐÁNH GIÁ
              </button>
            </div>

            <div className="flex-grow flex flex-col lg:grid lg:grid-cols-[400px_1fr] lg:gap-6 lg:px-6 lg:pb-6 overflow-hidden z-10">
              {/* Left Column: Form & Photos */}
              <div className={`bg-white rounded-t-2xl lg:rounded-2xl p-4 flex-col overflow-y-auto shadow-sm min-h-0 ${activeMobileTab === 'info' ? 'flex flex-grow lg:flex-grow-0' : 'hidden lg:flex'}`}>
                
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-800">Thông Tin Báo Cáo</h2>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b4332] hover:bg-[#143325] text-white rounded-md text-sm font-semibold transition shadow-sm" onClick={() => setIsSelectSampleOpen(true)}>
                    <Search className="w-4 h-4" />
                    <span>Chọn mẫu</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 mb-4">
                  <div className="flex flex-col col-span-1 sm:col-span-2 hidden">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Số Phiếu YC</label>
                    <input type="text" className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" placeholder="VD: DDT-2601-001" value={reportMeta.requestCode || ''} onChange={e => setReportMeta({...reportMeta, requestCode: e.target.value})} />
                  </div>
                   <div className="flex flex-col col-span-1 sm:col-span-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Số mã hóa</label>
                     <input type="text" list="mahoaCodesList" className={getFieldClass('codingNumber', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} value={reportMeta.codingNumber} onChange={e => setReportMeta(prev => ({ ...prev, codingNumber: e.target.value, reportNo: e.target.value }))} />
                     <datalist id="mahoaCodesList">
                       {MAHOA_CODES.map(code => <option key={code} value={code} />)}
                     </datalist>
                     {renderFieldIssues('codingNumber')}
                   </div>

                   <div className="flex flex-col col-span-1 sm:col-span-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Ngày Phiếu YC</label>
                     <input
                       type="text"
                       readOnly
                       className={getFieldClass('requestDate', 'border-b py-1 px-0 text-sm bg-slate-50 outline-none w-full')}
                       value={reportMeta.requestDate}
                       placeholder="Chọn mẫu để lấy ngày phiếu yêu cầu"
                     />
                     {renderFieldIssues('requestDate')}
                   </div>
                   
                   <div className="flex flex-col col-span-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Ngày Nhận Mẫu</label>
                     <CustomDatePicker className={getFieldClass('sampleReceiptDate', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} value={reportMeta.sampleReceiptDate} onChange={val => handleDateChange('sampleReceipt', val)} />
                     {renderFieldIssues('sampleReceiptDate')}
                   </div>
                   
                   <div className="flex flex-col col-span-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Ngày Báo Cáo</label>
                     <CustomDatePicker className={getFieldClass('reportDate', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} value={reportMeta.rawReportDate} onChange={val => handleDateChange('report', val)} />
                     {renderFieldIssues('reportDate')}
                   </div>
                   
                   <div className="flex flex-col col-span-1 sm:col-span-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Ngày Thử Nghiệm</label>
                     <input type="text" placeholder="VD: 14/08/2026 hoặc 10/08/2026 – 14/08/2026" className={getFieldClass('testDate', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} value={reportMeta.testDate} onChange={e => setReportMeta({...reportMeta, testDate: e.target.value})} />
                     {renderFieldIssues('testDate')}
                   </div>
                  
                  <div className="flex flex-col col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Đơn vị gửi mẫu</label>
                    <input type="text" list="senderUnits" className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" value={reportMeta.senderUnit} onChange={e => setReportMeta({...reportMeta, senderUnit: e.target.value})} />
                    <datalist id="senderUnits">
                      <option value="Phòng Giám định – Chứng nhận, Phát triển thị trường" />
                    </datalist>
                  </div>
                  
                  <div className="flex flex-col col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Địa chỉ (Đơn vị gửi mẫu)</label>
                    <input type="text" list="senderAddrs" className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" value={reportMeta.senderAddress} onChange={e => setReportMeta({...reportMeta, senderAddress: e.target.value})} />
                    <datalist id="senderAddrs">
                       <option value="Số 565 đường Nguyễn Trãi, phường Thanh Liệt, TP. Hà Nội" />
                    </datalist>
                  </div>

                  <div className="flex flex-col col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Tên mẫu đo/thử nghiệm</label>
                    <input type="text" className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" placeholder="Mẫu thử nghiệm" value={reportMeta.sampleName} onChange={e => setReportMeta({...reportMeta, sampleName: e.target.value})} />
                  </div>
                  
                   <div className="flex flex-col col-span-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Kiểu loại</label>
                     <input type="text" className={getFieldClass('model', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} value={reportMeta.model} onChange={e => handleModelChange(e.target.value)} />
                     {renderFieldIssues('model')}
                   </div>
                   
                    <div className="flex flex-col col-span-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Tem niêm phong</label>
                     <input 
                       type="text" 
                       list="sealStampCodesList"
                       placeholder="VD: IEMM-8891, IEMM-8892" 
                       className={getFieldClass('sealStamp', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} 
                       value={reportMeta.sealStamp || ''} 
                       onChange={e => setReportMeta({...reportMeta, sealStamp: e.target.value})} 
                      />
                      <datalist id="sealStampCodesList">
                        {MAHOA_CODES.map(code => <option key={code} value={code} />)}
                      </datalist>
                      {renderFieldIssues('sealStamp')}
                   </div>
                   {isEmcReport && (
                     <>
                       <div className="flex flex-col col-span-2">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Nhãn hiệu</label>
                         <input type="text" className={getFieldClass('brand', 'border-b py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full')} value={reportMeta.brand} onChange={e => setReportMeta({...reportMeta, brand: e.target.value})} />
                         {renderFieldIssues('brand')}
                       </div>
                      <div className="flex flex-col col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Nhà sản xuất</label>
                        <input type="text" className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" value={reportMeta.manufacturer} onChange={e => setReportMeta({...reportMeta, manufacturer: e.target.value})} />
                      </div>
                      <div className="flex flex-col col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Nước sản xuất</label>
                        <input type="text" className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" value={reportMeta.countryOfOrigin} onChange={e => setReportMeta({...reportMeta, countryOfOrigin: e.target.value})} />
                      </div>
                    </>
                  )}
                  <div className="flex flex-col col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Người thử nghiệm</label>
                    <input 
                      type="text" 
                      list="testerNamesList"
                      className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full" 
                      value={reportMeta.testerName} 
                      onChange={e => setReportMeta({...reportMeta, testerName: e.target.value})} 
                      placeholder="VD: Lã Trung Sơn"
                    />
                    <datalist id="testerNamesList">
                      {(testers || []).filter(t => t.name !== 'Khác').map(t => <option key={t.name} value={t.name} />)}
                    </datalist>
                  </div>
                  <div className="flex flex-col col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Phụ trách phòng TN</label>
                    <select 
                      className="border-b border-slate-300 py-1 px-0 text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors w-full cursor-pointer font-medium text-slate-800" 
                      value={reportMeta.managerName} 
                      onChange={e => setReportMeta({...reportMeta, managerName: e.target.value})}
                    >
                      <option value="">-- Chọn phụ trách PTN --</option>
                      {labManagerOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      {reportMeta.managerName && !labManagerOptions.includes(reportMeta.managerName) && (
                        <option value={reportMeta.managerName}>{reportMeta.managerName}</option>
                      )}
                    </select>
                  </div>
                  
                  {selectedStandard?.id === 'day_cap_dien' && (
                    <>
                      <div className="flex flex-col col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Phương pháp thử nghiệm</label>
                        <MultiSelectCombobox 
                          label=""
                          values={reportMeta.testMethod}
                          onChange={vals => setReportMeta({...reportMeta, testMethod: vals})}
                          options={tieuchuanOptions}
                          placeholder="Chọn phương pháp..."
                        />
                      </div>
                      <div className="flex flex-col col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Tiêu chuẩn đánh giá</label>
                        <MultiSelectCombobox 
                          label=""
                          values={reportMeta.evaluationStandard}
                          onChange={vals => setReportMeta({...reportMeta, evaluationStandard: vals})}
                          options={tieuchuanOptions}
                          placeholder="Chọn tiêu chuẩn..."
                        />
                      </div>
                    </>
                  )}

                  <div className="flex flex-col col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Tên thiết bị (Tiếng Việt)</label>
                    <DeviceCombobox 
                      label=""
                      value={reportMeta.deviceNameVi}
                      onChange={val => setReportMeta({...reportMeta, deviceNameVi: val})}
                      onSelect={(vi, en) => setReportMeta({...reportMeta, deviceNameVi: vi, deviceNameEn: en})}
                      options={DEVICE_NAMES}
                      displayField="vi"
                    />
                  </div>
                  <div className="flex flex-col col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Tên thiết bị (Tiếng Anh)</label>
                    <DeviceCombobox 
                      label=""
                      value={reportMeta.deviceNameEn}
                      onChange={val => setReportMeta({...reportMeta, deviceNameEn: val})}
                      onSelect={(vi, en) => setReportMeta({...reportMeta, deviceNameVi: vi, deviceNameEn: en})}
                      options={DEVICE_NAMES}
                      displayField="en"
                    />
                   </div>
                 </div>

                 {reportValidation.issues.length > 0 && (
                   <div role="alert" className={`mb-4 rounded-lg border p-3 text-xs ${reportValidation.hasErrors ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                     <div className="flex items-center gap-2 font-bold">
                       {reportValidation.hasErrors ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
                       <span>Kiểm tra đối soát hồ sơ</span>
                     </div>
                     <p className="mt-1">
                       {reportValidation.issues.filter(issue => issue.severity === 'error').length > 0 && `${reportValidation.issues.filter(issue => issue.severity === 'error').length} lỗi`}
                       {reportValidation.hasErrors && reportValidation.hasWarnings && ' · '}
                       {reportValidation.issues.filter(issue => issue.severity === 'warning').length > 0 && `${reportValidation.issues.filter(issue => issue.severity === 'warning').length} cảnh báo`}
                       {reportValidation.hasErrors ? ' — cần xử lý trước khi lưu hoặc xuất DOCX.' : ' — không chặn lưu hoặc xuất DOCX.'}
                     </p>
                     <ul className="mt-2 space-y-1 list-disc pl-4">
                       {reportValidation.issues.map(issue => <li key={`${issue.code}-${issue.field}-${issue.message}`}>{issue.message}</li>)}
                     </ul>
                   </div>
                 )}

                 {!isEmcReport && (
                <>
                  <div className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100 flex justify-between items-center">
                    Ảnh Sản Phẩm
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div 
                      className={`aspect-square cursor-pointer flex items-center justify-center border border-dashed rounded-md overflow-hidden transition-all relative ${dragOverType === 'product1' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 z-20' : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50'}`} 
                  onClick={() => handlePhotoClick('product1')}
                  onDrop={(e) => handleDrop(e, 'product1')}
                  onDragOver={(e) => handleDragOver(e, 'product1')}
                  onDragLeave={handleDragLeave}
                  onMouseEnter={() => setHoveredType('product1')}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded shadow-sm z-10 uppercase tracking-wide">Ảnh Mẫu 1</div>
                  {productPhoto1 ? (
                    <div className="relative w-full h-full group">
                      <img src={productPhoto1} alt="Product 1" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsCropping('product1'); setCropOverlaySrc(productPhoto1); }} title="Chỉnh sửa (Cắt / Xoay ảnh)" className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-md"><Crop size={14} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setProductPhoto1(''); }} title="Xóa ảnh" className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-md"><X size={14} /></button>
                      </div>
                    </div>
                  ) : <div className="text-center text-xs text-slate-500 font-medium tracking-wide">[ TẢI ẢNH MẪU 1 ]</div>}
                </div>
                <div 
                  className={`aspect-square cursor-pointer flex items-center justify-center border border-dashed rounded-md overflow-hidden transition-all relative ${dragOverType === 'product2' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 z-20' : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50'}`} 
                  onClick={() => handlePhotoClick('product2')}
                  onDrop={(e) => handleDrop(e, 'product2')}
                  onDragOver={(e) => handleDragOver(e, 'product2')}
                  onDragLeave={handleDragLeave}
                  onMouseEnter={() => setHoveredType('product2')}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded shadow-sm z-10 uppercase tracking-wide">Ảnh Mẫu 2</div>
                  {productPhoto2 ? (
                    <div className="relative w-full h-full group">
                      <img src={productPhoto2} alt="Product 2" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsCropping('product2'); setCropOverlaySrc(productPhoto2); }} title="Chỉnh sửa (Cắt / Xoay ảnh)" className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-md"><Crop size={14} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setProductPhoto2(''); }} title="Xóa ảnh" className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-md"><X size={14} /></button>
                      </div>
                    </div>
                  ) : <div className="text-center text-xs text-slate-500 font-medium tracking-wide">[ TẢI ẢNH MẪU 2 ]</div>}
                </div>
                <div 
                  className={`aspect-square cursor-pointer flex items-center justify-center border border-dashed rounded-md overflow-hidden transition-all relative ${dragOverType === 'nameplate1' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 z-20' : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50'}`} 
                  onClick={() => handlePhotoClick('nameplate1')}
                  onDrop={(e) => handleDrop(e, 'nameplate1')}
                  onDragOver={(e) => handleDragOver(e, 'nameplate1')}
                  onDragLeave={handleDragLeave}
                  onMouseEnter={() => setHoveredType('nameplate1')}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded shadow-sm z-10 uppercase tracking-wide">Ảnh Tem 1</div>
                  {nameplatePhoto1 ? (
                    <div className="relative w-full h-full group">
                      <img src={nameplatePhoto1} alt="Nameplate 1" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsCropping('nameplate1'); setCropOverlaySrc(nameplatePhoto1); }} title="Chỉnh sửa (Cắt / Xoay ảnh)" className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-md"><Crop size={14} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setNameplatePhoto1(''); }} title="Xóa ảnh" className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-md"><X size={14} /></button>
                      </div>
                    </div>
                  ) : <div className="text-center text-xs text-blue-600 font-medium tracking-wide">[ TẢI ẢNH TEM 1 ]</div>}
                </div>
                <div 
                  className={`aspect-square cursor-pointer flex items-center justify-center border border-dashed rounded-md overflow-hidden transition-all relative ${dragOverType === 'nameplate2' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 z-20' : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50'}`} 
                  onClick={() => handlePhotoClick('nameplate2')}
                  onDrop={(e) => handleDrop(e, 'nameplate2')}
                  onDragOver={(e) => handleDragOver(e, 'nameplate2')}
                  onDragLeave={handleDragLeave}
                  onMouseEnter={() => setHoveredType('nameplate2')}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded shadow-sm z-10 uppercase tracking-wide">Ảnh Tem 2</div>
                  {nameplatePhoto2 ? (
                    <div className="relative w-full h-full group">
                      <img src={nameplatePhoto2} alt="Nameplate 2" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsCropping('nameplate2'); setCropOverlaySrc(nameplatePhoto2); }} title="Chỉnh sửa (Cắt / Xoay ảnh)" className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-md"><Crop size={14} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setNameplatePhoto2(''); }} title="Xóa ảnh" className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-md"><X size={14} /></button>
                      </div>
                    </div>
                  ) : <div className="text-center text-xs text-blue-600 font-medium tracking-wide">[ TẢI ẢNH TEM 2 ]</div>}
                </div>
              </div>
                </>
              )}

              <div className="mt-auto pt-4 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 mb-2 font-medium">Kế Thừa (Phục hồi từ báo cáo cũ)</p>
                <button className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded text-sm transition" onClick={triggerDocxUpload} disabled={isParsingDocx}>
                   {isParsingDocx ? 'Đang trích xuất...' : 'Tải lên báo cáo hiện có'}
                </button>
              </div>

            </div>

            {/* Right Column: Table */}
            <div className={`bg-white rounded-t-2xl lg:rounded-2xl p-0 flex-col overflow-hidden shadow-sm relative isolate min-h-0 ${activeMobileTab === 'preview' ? 'flex flex-grow' : 'hidden lg:flex lg:flex-grow'}`}>
              {/* Report Header (Simulating PDF page start) */}
              <div className="flex justify-between items-center px-3 py-2 border-b border-slate-200 shrink-0 bg-white z-10 relative">
                <div className="flex items-center gap-2">
                   <div>
                     <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trung tâm thử nghiệm - kiểm định công nghiệp</h3>
                     <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phòng thí nghiệm điện - điện tử</h2>
                     <p className="text-xs text-slate-500 font-medium mt-0.5">Tiêu chuẩn: <span className="text-emerald-700 font-bold">{selectedStandard.standard}</span></p>
                   </div>
                </div>
                <div className="text-right flex flex-col gap-0 hidden sm:flex">
                   <div className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md inline-block">BM/QA-05</div>
                   <div className="text-xs text-slate-400 mt-1">Trang: 1</div>
                </div>
              </div>

              {/* PDF Background Watermark */}
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden">
                <div className="text-[80px] font-bold text-emerald-900 transform -rotate-45 whitespace-nowrap select-none">
                  PHÒNG THỬ NGHIỆM
                </div>
              </div>

              <div className="flex-grow overflow-auto z-10 relative">
                {isEmcReport ? (
                  <div className="report-form-compact p-4 bg-white/60 backdrop-blur-sm">
                    <EmcBepDien1VungNauForm data={emcData} setData={setEmcData} title={subOptionTitle || selectedStandard.standard} standardId={selectedStandard.id} onNameplateOcr={handleNameplateOcr} />
                  </div>
                ) : selectedStandard?.id === 'day_cap_dien' ? (
                  <div className="report-form-compact p-4 bg-white/60 backdrop-blur-sm">
                    <DayCapDienForm data={dayCapDienData} setData={setDayCapDienData} criteriaType={criteriaType} />
                  </div>
                ) : (
                  <div className="report-form-compact">
                    <DefaultStandardForm 
                      selectedStandard={selectedStandard}
                      criteriaType={criteriaType}
                      testResults={testResults}
                      setTestResults={setTestResults}
                    />
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-3 grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-2 mt-auto shrink-0 sm:justify-end border-t border-slate-200 bg-white z-10 relative">
                {reportValidation.hasErrors && (
                  <div role="alert" aria-live="assertive" className="col-span-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:order-first">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Xuất DOCX đang bị chặn</span>
                    </div>
                    <p className="mt-1">Cần xử lý: {blockingValidationLocations.join(', ')}.</p>
                    <p className="mt-1 text-red-700">Xem chi tiết tại mục “Kiểm tra đối soát hồ sơ” ở vùng biểu mẫu phía trên.</p>
                  </div>
                )}
                {!reportValidation.hasErrors && reportValidation.hasWarnings && (
                  <div role="status" aria-live="polite" className="col-span-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:order-first">
                    <div className="flex items-center gap-2 font-bold">
                      <Info className="h-4 w-4 shrink-0" />
                      <span>Có cảnh báo đối soát</span>
                    </div>
                    <p className="mt-1">Các vị trí chưa khớp: {warningValidationLocations.join(', ')}. Vẫn có thể xuất DOCX.</p>
                  </div>
                )}
                <button 
                   className="mobile-touch-target w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-md shadow-sm transition flex items-center justify-center gap-1.5 touch-manipulation disabled:opacity-60"
                   onClick={handleSaveReport}
                   disabled={isSavingReport || isGeneratingDocx || reportValidation.hasErrors}
                   title={reportValidation.hasErrors ? 'Vui lòng xử lý lỗi đối soát trước khi lưu' : undefined}
                >
                  {isSavingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu Báo Cáo</span>
                    </>
                  )}
                </button>
                <button 
                   className="mobile-touch-target w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-sm font-semibold rounded-md shadow-sm transition flex items-center justify-center sm:min-w-[140px] gap-1.5 touch-manipulation disabled:opacity-60" 
                   onClick={handleGenerateDocx} 
                   disabled={isGeneratingDocx || isSavingReport || reportValidation.hasErrors}
                   title={reportValidation.hasErrors ? 'Vui lòng xử lý lỗi đối soát trước khi xuất DOCX' : undefined}
                >
                  {isGeneratingDocx ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>Xuất File DOCX</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
        )}
      </main>



      {/* Hidden inputs & Cropper */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      <input type="file" ref={docxInputRef} className="hidden" accept=".docx" onChange={handleDocxUpload} />
      
      {isCropping && cropOverlaySrc && (
        <CropperModal 
           imageSrc={cropOverlaySrc}
           onCropComplete={handleCropComplete}
           onCancel={closeCropper}
        />
      )}
      <SelectSampleModal 
        isOpen={isSelectSampleOpen}
        onClose={() => setIsSelectSampleOpen(false)}
        onSelectSample={handleSelectSample}
      />
      <DocxSettingsModal 
        isOpen={isDocxSettingsOpen}
        onClose={() => setIsDocxSettingsOpen(false)}
      />
    </div>
  );
}

// --- End of ReportGeneratorView.tsx ---
