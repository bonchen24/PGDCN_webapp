// Author: Gemini
// OS support: Web/Node
// Description: Main application component with routing, dashboard, requests view, schedule views, and optimized interval-based sync
import { WarehouseSidebar } from './components/WarehouseSidebar';
import React, { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Truck, 
  Plus, 
  RefreshCw, 
  Search, 
  Trash2, 
  Award,
  Package,
  ClipboardList,
  Printer,
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Settings,
  X,
  Undo2,
  Redo2,
  LayoutDashboard,
  CheckCircle2,
  UserCheck,
  SearchCheck,
  AlertTriangle,
  CalendarDays,
  User,
  Sparkles,
  Loader2,
  ArrowUpRight,
  TrendingUp,
  Activity,
  AlertCircle,
  BarChart3,
  Timer,
  Eye,
  Info, 
  Pencil,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListTodo,
  Menu,
  Building,
  Tag,
  LogOut,
  Bell,
  FileText,
  FileSpreadsheet,
  History
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useStore } from './store';
import { 
  TestRequest, 
  RequestStatus, 
  PriorityLevel, 
  HandoverType,
  SampleStatus,
  Tester,
  HandoverDoc,
  TestCategory,
  AppNotification,
} from './types';
import { calculateInternalDeadline } from './utils/scheduler'; 
import { formatDateVN, removeAccents, getVNDate } from './utils/formatter';
import { canViewNotification } from './utils/notificationEvents';
import { getNotificationDestination } from './utils/notificationNavigation';
import { isActivityLogVisibleToUser } from './utils/activityLog';
import { canViewSystemSettings } from './utils/systemSettingsPolicy';
import { getAssignedTesterNames } from './utils/dashboardStaffing';

import { RequestModal } from './components/RequestModal';
import { PrintFormModal } from './components/PrintFormModal';
import { HandoverModal } from './components/HandoverModal';
import { HandoverDocsModal } from './components/HandoverDocsModal';
import { ConfirmDeleteHandoverModal } from './components/ConfirmDeleteHandoverModal';
import { SettingsModal } from './components/SettingsModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { SyncDiagnosticModal } from './components/SyncDiagnosticModal';
import { NotificationDropdown } from './components/NotificationDropdown';
import { ScheduleView } from './components/ScheduleView';
import { ATDScheduleView } from './components/ATDScheduleView';
import { LoginScreen } from './components/LoginScreen';
import { AIChatBot } from './components/AIChatBot';
import SummaryLogView from './components/SummaryLogView';
const ReportGeneratorView = lazy(() => import('./components/ReportGeneratorView'));
import KQTNView from './components/KQTNView';
import { ActivityLogView } from './components/ActivityLogView';
import { BrandsManagementView, CustomersManagementView, ProductsManagementView, SystemSettingsView } from './components/SystemManagementViews';

const LOGO_BASE64 = "/tvci_logo.jpg";

const SampleStatusTag = ({ status }: { status: SampleStatus }) => {
  const styles = {
    [SampleStatus.WAITING]: 'bg-status-waiting text-status-waiting-fg border-status-waiting-fg/20',
    [SampleStatus.IN_LAB]: 'bg-status-inlab text-status-inlab-fg border-status-inlab-fg/20',
    [SampleStatus.RETURNED]: 'bg-status-returned text-status-returned-fg border-status-returned-fg/20',
  };
  return (
    <span className={`px-1 py-0.5 rounded text-[8px] font-black tracking-widest border flex items-center gap-1 shrink-0 uppercase shadow-sm ${styles[status]}`}>
      <div className={`w-1 h-1 rounded-full ${status === SampleStatus.IN_LAB ? 'bg-status-inlab-fg' : 'bg-current'}`} aria-hidden="true" />
      {status}
    </span>
  );
};

interface HighlightTextProps {
  text: string;
  search: string;
}

const HighlightText: React.FC<HighlightTextProps> = ({ text, search }) => {
  if (!search || !search.trim()) {
    return <>{text}</>;
  }

  const query = search.trim();
  const normalizedText = removeAccents(text).toLowerCase();
  const normalizedQuery = removeAccents(query).toLowerCase();

  const index = normalizedText.indexOf(normalizedQuery);
  if (index === -1) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  while (lastIndex < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, lastIndex);
    if (matchIndex === -1) {
      parts.push(text.slice(lastIndex));
      break;
    }

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const matchText = text.slice(matchIndex, matchIndex + normalizedQuery.length);
    parts.push(
      <mark key={matchIndex} className="bg-amber-100 text-amber-900 font-bold px-0.5 rounded-[2px] border border-amber-200/50">
        {matchText}
      </mark>
    );

    lastIndex = matchIndex + normalizedQuery.length;
  }

  return <>{parts}</>;
};

interface RequestGroupCardProps { 
  requestCode: string; 
  items: TestRequest[]; 
  onPrint: (r: TestRequest) => void;
  onEditGroup: (code: string) => void;
  onDeleteGroup: (code: string, count: number) => void;
  onDeleteSample: (id: string, name: string) => void;
  onCreateHandover?: (items: TestRequest[]) => void;
  searchQuery?: string;
}

const RequestGroupCard: React.FC<RequestGroupCardProps> = ({ 
  requestCode, 
  items, 
  onPrint,
  onEditGroup,
  onDeleteGroup,
  onDeleteSample,
  onCreateHandover,
  searchQuery = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { deleteRequest, updateRequest, handoverDocs, currentUser, requests } = useStore();
  const isAdmin = currentUser?.role === 'admin' || 
                  currentUser?.position?.toLowerCase().includes('quản lý') || 
                  currentUser?.position?.toLowerCase().includes('trưởng phòng');

  const handleTogglePrintStatus = (e: React.MouseEvent, reqItem: TestRequest) => {
    e.stopPropagation();
    const currentlyPrinted = !!reqItem.printStatus && reqItem.printStatus.trim() !== '' && reqItem.printStatus !== 'Chờ in';
    if (!currentlyPrinted) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      updateRequest(reqItem.id, { printStatus: `Đã in ${dd}/${mm}` });
      toast.success(`Cập nhật trạng thái in mẫu: ${dd}/${mm}`);
    } else {
      updateRequest(reqItem.id, { printStatus: 'Chờ in' });
      toast.info(`Đã hủy trạng thái in mẫu`);
    }
  };

  const isPycPrinted = items.some(i => i.isPycPrinted || (i.pycPrintStatus && i.pycPrintStatus.trim() !== '' && i.pycPrintStatus !== 'Chờ in'));
  const pycPrintDisplay = items.find(i => i.pycPrintStatus && i.pycPrintStatus.trim() !== '' && i.pycPrintStatus !== 'Chờ in')?.pycPrintStatus || (isPycPrinted ? 'Đã in PYC' : 'Chưa in PYC');

  const handleTogglePycPrintStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPycPrinted) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const statusText = `Đã in ${dd}/${mm}`;
      items.forEach(reqItem => {
        updateRequest(reqItem.id, { isPycPrinted: true, pycPrintStatus: statusText });
      });
      toast.success(`Đã đánh dấu Phiếu ${requestCode}: ${statusText}`);
    } else {
      items.forEach(reqItem => {
        updateRequest(reqItem.id, { isPycPrinted: false, pycPrintStatus: 'Chờ in' });
      });
      toast.info(`Đã hủy trạng thái in của Phiếu ${requestCode}`);
    }
  };
  const firstItem = items[0];
  const customerName = firstItem.customerName;
  const isVip = items.some(i => i.priority >= PriorityLevel.VIP);
  
  const completedCount = items.filter(i => i.status === RequestStatus.COMPLETED || i.status === RequestStatus.RESULTS_APPROVED).length;
  const progress = (completedCount / items.length) * 100;
  const deadline = calculateInternalDeadline(firstItem);
  const deadlineDisplay = deadline ? `${deadline.getDate().toString().padStart(2, '0')}/${(deadline.getMonth() + 1).toString().padStart(2, '0')}` : '';

  const regDateRaw = firstItem.requestDate || firstItem.createdAt || firstItem.receivedDate;
  const regDateObj = regDateRaw ? getVNDate(regDateRaw) : null;
  const regDateDisplay = regDateObj ? `${regDateObj.getDate().toString().padStart(2, '0')}/${(regDateObj.getMonth() + 1).toString().padStart(2, '0')}` : '';

  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== '') {
      const q = removeAccents(searchQuery.trim()).toLowerCase();
      const hasMatch = items.some(req => {
        const typeNormalized = removeAccents(String(req.type || '').toLowerCase());
        const brandNormalized = removeAccents(String(req.brand || '').toLowerCase());
        const modelNormalized = removeAccents(String(req.modelName || '').toLowerCase());
        const atdNormalized = req.atdEncodeNumber ? removeAccents(String(req.atdEncodeNumber).toLowerCase()) : '';
        const emcNormalized = req.emcEncodeNumber ? removeAccents(String(req.emcEncodeNumber).toLowerCase()) : '';
        const itdNormalized = req.itdEncodeNumber ? removeAccents(String(req.itdEncodeNumber).toLowerCase()) : '';
        const encodeNumberNormalized = req.encodeNumber ? removeAccents(String(req.encodeNumber).toLowerCase()) : '';
        const sampleCodeNormalized = (req as any).sampleCode ? removeAccents(String((req as any).sampleCode).toLowerCase()) : '';
        const sealStampNormalized = req.sealStamp ? removeAccents(String(req.sealStamp).toLowerCase()) : '';
        const otherInfoNormalized = req.otherCustomerInfo ? removeAccents(String(req.otherCustomerInfo).toLowerCase()) : '';
        
        return typeNormalized.includes(q) || 
               brandNormalized.includes(q) || 
               modelNormalized.includes(q) ||
               atdNormalized.includes(q) ||
               emcNormalized.includes(q) ||
               itdNormalized.includes(q) ||
               encodeNumberNormalized.includes(q) ||
               sampleCodeNormalized.includes(q) ||
               sealStampNormalized.includes(q) ||
               otherInfoNormalized.includes(q);
      });
      if (hasMatch) {
        setIsExpanded(true);
      }
    }
  }, [searchQuery, items]);

  const handleDelete = (e: React.MouseEvent, id: string, modelName: string) => {
      e.stopPropagation();
      onDeleteSample(id, modelName);
  }

  const showNote = (e: React.MouseEvent, note: string, model: string) => {
      e.stopPropagation();
      toast(
          <div className="flex flex-col gap-1">
              <div className="font-bold flex items-center gap-2 text-amber-600">
                  <Info size={16} /> Ghi chú: {model}
              </div>
              <div className="text-sm text-slate-600 bg-amber-50 p-2 rounded border border-amber-100">
                  {note}
              </div>
          </div>,
          { duration: 4000 }
      );
  };

  const getLotNumber = (items: TestRequest[]): string => {
    const first = items[0];
    if (first && (first as any).encodeNumber) {
      return (first as any).encodeNumber;
    }
    const encode = items.map(req => req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || '').find(Boolean) || '';
    if (!encode) return '';
    return encode.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '');
  };
  const lotNumber = getLotNumber(items);

  const headerEncodedNumbers = Array.from(new Set(
    [firstItem.atdEncodeNumber, firstItem.emcEncodeNumber, firstItem.itdEncodeNumber]
      .filter(Boolean)
  )).join(' - ') || (firstItem as any).sampleCode || 'CHƯA CÓ MÃ MẪU';

  return (
    <div className="bg-indigo-50 rounded-xl shadow-sm border border-indigo-200 hover:shadow-md hover:border-indigo-300 transition-all overflow-hidden group">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-2.5 md:p-3 cursor-pointer hover:bg-white transition-colors relative"
        role="button"
        aria-expanded={isExpanded}
      >
          <div className="flex items-start gap-2 pr-48 md:pr-0">
            <div className="flex items-start gap-2 flex-1 min-w-0">
               <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${isVip ? 'bg-gradient-to-br from-purple-100 to-fuchsia-50 text-purple-600 border border-purple-100' : 'bg-gradient-to-br from-slate-50 to-white text-slate-500 border border-slate-100'}`}>
                  {isVip ? <Award size={14} aria-hidden="true" /> : <FolderOpen size={14} strokeWidth={1.5} aria-hidden="true" />}
               </div>
               <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                     <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <h3 className="text-[11px] font-black text-slate-800 leading-none uppercase tracking-widest">
                           <HighlightText text={requestCode} search={searchQuery} />
                        </h3>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] border border-slate-200/50 shadow-sm font-bold">{items.length} mẫu</span>
                        {regDateDisplay && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] border border-slate-200/50 shadow-sm font-bold" title="Ngày đăng ký phiếu">
                            {regDateDisplay}
                          </span>
                        )}
                        {items.some(i => !!i.emcEncodeNumber) && (
                          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest shadow-sm">EMC</span>
                        )}
                        {items.some(i => !!i.itdEncodeNumber) && (
                          <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest shadow-sm">ITD</span>
                        )}
                        {items.some(i => !!i.atdEncodeNumber) && (
                          <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest shadow-sm">ITDC</span>
                        )}
                        {deadlineDisplay && <div className="text-[9px] font-black text-blue-700 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-100 uppercase shadow-sm whitespace-nowrap">{deadlineDisplay}</div>}
                     </div>
                     
                      <div className="request-card-action-group absolute top-2.5 right-2.5 z-10 md:static md:z-auto flex items-center gap-0.5 shrink-0 bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm">
                         <button onClick={(e) => { e.stopPropagation(); onEditGroup(requestCode); }} className="request-card-action mobile-touch-target p-0" title="Sửa PYC"><span className="request-card-action-visual inline-flex w-7 h-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"><Pencil size={12} strokeWidth={2.5} aria-hidden="true" /></span></button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onPrint(firstItem); }} 
                           onContextMenu={(e) => {
                            e.preventDefault();
                             e.stopPropagation();
                             handleTogglePycPrintStatus(e);
                           }}
                           className="request-card-action mobile-touch-target p-0" 
                           title={isPycPrinted ? `Đã in PYC (${pycPrintDisplay}) - Click để in lại | Chuột phải để hủy trạng thái` : 'Chưa in PYC - Click để in | Chuột phải để đánh dấu Đã in'}
                         >
                           <span className={`request-card-action-visual inline-flex w-7 h-7 items-center justify-center rounded-md transition-all relative ${
                             !isPycPrinted 
                               ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm ring-1 ring-amber-400/50' 
                               : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200/80'
                           }`}>
                             <Printer size={12} strokeWidth={2.5} aria-hidden="true" />
                             {!isPycPrinted && (
                               <>
                                 <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping opacity-75" />
                                 <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 border border-white rounded-full" />
                               </>
                             )}
                           </span>
                         </button>
                         {onCreateHandover && (currentUser.role === 'admin' || currentUser.role === 'tester') && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); onCreateHandover(items); }} 
                              className="request-card-action mobile-touch-target p-0" 
                             title="Lập BB giao nhận"
                           >
                             <span className="request-card-action-visual inline-flex w-7 h-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"><Truck size={12} strokeWidth={2.5} aria-hidden="true" /></span>
                           </button>
                         )}
                         {isAdmin && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); onDeleteGroup(requestCode, items.length); }}
                              className="request-card-action mobile-touch-target p-0"
                             title="Xóa toàn bộ phiếu này"
                           >
                             <span className="request-card-action-visual inline-flex w-7 h-7 items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={12} strokeWidth={2.5} aria-hidden="true" /></span>
                           </button>
                         )}
                        <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                        <div className="text-slate-400 p-1 hover:bg-slate-100 rounded transition-colors" aria-hidden="true">
                          {isExpanded ? <ChevronUp size={10} strokeWidth={2.5} /> : <ChevronDown size={10} strokeWidth={2.5} />}
                        </div>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 items-center text-[9px] font-bold text-slate-600">
                     {lotNumber && (
                       <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0" title="Số lô">
                         <span className="text-amber-800 uppercase tracking-widest text-[8px] shrink-0">Lô:</span>
                         <span className="text-amber-900 truncate"><HighlightText text={lotNumber} search={searchQuery} /></span>
                       </div>
                     )}
                     {firstItem.type && (
                       <div className="flex items-center gap-1 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0 text-blue-700" title="Loại sản phẩm">
                         <span className="truncate"><HighlightText text={firstItem.type} search={searchQuery} /></span>
                       </div>
                     )}
                     {firstItem.brand && (
                       <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0" title="Nhãn hiệu">
                         <span className="truncate"><HighlightText text={firstItem.brand} search={searchQuery} /></span>
                       </div>
                     )}
                     {items.some(i => !!i.sealStamp) && (
                       <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0 font-mono col-span-2 md:col-span-1" title="Tem niêm phong">
                         <span className="truncate"><HighlightText text={Array.from(new Set(items.map(req => req.sealStamp ? req.sealStamp.replace(/-M\d+$/i, '') : '').filter(Boolean))).join(', ')} search={searchQuery} /></span>
                       </div>
                     )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium truncate" title={customerName}>
                     <HighlightText text={customerName} search={searchQuery} />
                  </p>
                  {firstItem.otherCustomerInfo && (
                      <p className="text-[9px] text-slate-400 font-medium truncate italic" title={firstItem.otherCustomerInfo}>
                          <HighlightText text={firstItem.otherCustomerInfo} search={searchQuery} />
                      </p>
                  )}
               </div>
            </div>
         </div>
         
         <div className="flex items-center gap-2 mt-2">
             <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                 <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{width: `${progress}%`}}></div>
             </div>
             <span className="text-[8px] font-black uppercase tracking-widest text-slate-500" aria-hidden="true">{completedCount}/{items.length} xong</span>
         </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100/60 bg-slate-50/50" role="region">
          {items.map(req => {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const deadline = calculateInternalDeadline(req);
            const isOverdue = deadline ? (deadline < today && req.status !== RequestStatus.COMPLETED && req.status !== RequestStatus.RESULTS_APPROVED) : false;

            const sampleEncodedNumbers = Array.from(new Set(
              [req.atdEncodeNumber, req.emcEncodeNumber, req.itdEncodeNumber]
                .filter(Boolean)
            )).join(' - ');
            const sampleFullName = `${req.type} ${req.brand ? req.brand + ' ' : ''}${req.modelName}`;

            const logsForReq = requests.filter(r => r.id.startsWith(req.id + '-log-')).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

            return (
              <div key={req.id} className="border-b border-slate-100 last:border-0">
                <div className="p-2 md:px-3 hover:bg-white transition-colors flex justify-between items-center group/item gap-2">
                   <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className={`w-1 h-1 rounded-full shrink-0 ${isOverdue ? 'bg-status-overdue-fg' : 'bg-slate-400'}`}></div>
                      
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 truncate">
                          {sampleEncodedNumbers && (
                            <span className="text-[8px] text-blue-600 font-black tracking-widest uppercase bg-blue-50 px-1 py-0.5 rounded border border-blue-100 shrink-0 shadow-sm">
                                <HighlightText text={sampleEncodedNumbers} search={searchQuery} />
                            </span>
                          )}
                          
                          <h4 className={`text-[9px] truncate shrink-0 ${isOverdue ? 'text-status-overdue-fg font-black' : 'text-slate-700 font-bold'}`}>
                              <HighlightText text={sampleFullName} search={searchQuery} />
                          </h4>
                          
                          {req.note && (
                              <button 
                                  onClick={(e) => showNote(e, req.note!, req.modelName)}
                                  className="text-amber-500 hover:text-amber-600 transition-colors shrink-0"
                                  title="Xem ghi chú"
                              >
                                  <AlertCircle size={10} fill="currentColor" className="text-amber-100" />
                              </button>
                          )}
                          
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                             {(() => {
                               const isPrinted = !!req.printStatus && req.printStatus.trim() !== '' && req.printStatus !== 'Chờ in';
                               const printDisplay = isPrinted ? req.printStatus.replace(/^Đã in\s*/i, '').trim() : 'Chờ in';
                               return (
                                 <button
                                   type="button"
                                   onClick={(e) => handleTogglePrintStatus(e, req)}
                                   className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                                     isPrinted 
                                       ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm' 
                                       : 'bg-slate-100 text-slate-500 border-slate-200/80 hover:bg-slate-200 hover:text-slate-700'
                                   }`}
                                   title={isPrinted ? `Trạng thái in: ${req.printStatus} (Bấm để hủy)` : 'Bấm để đánh dấu đã in'}
                                 >
                                   <Printer size={9} className={isPrinted ? 'text-emerald-600' : 'text-slate-400'} />
                                   <span>{printDisplay}</span>
                                 </button>
                               );
                             })()}
                             <SampleStatusTag status={req.sampleStatus} />
                          </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-1 shrink-0">
                        {isOverdue && <span className="text-[7px] font-black tracking-widest bg-status-overdue-fg text-white px-1 py-0.5 rounded shadow-sm animate-pulse uppercase">Quá hạn</span>}
                        {req.status !== RequestStatus.SAMPLES_RECEIVED && req.status !== RequestStatus.PENDING && (
                          <span className={`text-[8px] font-black tracking-widest px-1 py-0.5 rounded shadow-sm uppercase ${req.status === RequestStatus.COMPLETED || req.status === RequestStatus.RESULTS_APPROVED ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border border-slate-200 text-slate-500'}`}>
                            {req.status}
                          </span>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={(e) => handleDelete(e, req.id, req.modelName)} 
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                            title="Xóa mẫu"
                          >
                              <Trash2 size={10} aria-hidden="true" />
                          </button>
                        )}
                   </div>
                </div>

                {logsForReq.map((logReq, idx) => {
                  const logDate = (logReq.updatedAt || logReq.createdAt) ? new Date(logReq.updatedAt || logReq.createdAt!).toLocaleDateString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'}) : '';
                  const logEncodedNumbers = Array.from(new Set(
                    [logReq.atdEncodeNumber, logReq.emcEncodeNumber, logReq.itdEncodeNumber]
                      .filter(Boolean)
                  )).join(' - ');
                  
                  return (
                    <div key={logReq.id} className="pl-7 pr-3 py-1.5 bg-red-50/20 hover:bg-red-50/40 border-t border-dashed border-red-100/60 flex justify-between items-center gap-2 text-slate-500 text-[9px]">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-1 h-1 rounded-full bg-red-400 shrink-0"></div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 truncate">
                          {logEncodedNumbers && (
                            <span className="text-[7px] text-red-600 font-bold tracking-widest uppercase bg-red-50 px-1 py-0.2 rounded border border-red-100 shrink-0">
                              {logEncodedNumbers}
                            </span>
                          )}
                          <span className="font-semibold text-red-600/80 truncate">
                            Thất bại lần {idx + 1}
                          </span>
                          {logReq.note && (
                            <span className="text-slate-400 italic truncate" title={logReq.note}>
                              - {logReq.note}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px] text-slate-400 font-medium">
                        <span>{logDate}</span>
                        <span className="px-1 py-0.5 bg-red-50/60 text-red-600 rounded border border-red-100/50 uppercase font-black text-[7px]">
                          {logReq.status}
                        </span>
                        {isAdmin && (
                          <button 
                            onClick={(e) => handleDelete(e, logReq.id, logReq.modelName)} 
                            className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                            title="Xóa vết lịch sử"
                          >
                            <Trash2 size={8} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface HandoverDocCardProps {
  doc: HandoverDoc;
  requests: TestRequest[];
  handoverSearch?: string;
  onViewDoc: (doc: HandoverDoc) => void;
  onDeleteDoc?: (doc: HandoverDoc) => void;
  isAdmin: boolean;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

const HandoverDocCard: React.FC<HandoverDocCardProps> = ({
  doc,
  requests,
  handoverSearch = "",
  onViewDoc,
  onDeleteDoc,
  isAdmin,
  expanded,
  onToggleExpand
}) => {
  const isReceive = doc.type === HandoverType.RECEIVE;
  
  const docSampleRequests = useMemo(() => {
    if (!Array.isArray(doc.sampleIds)) return [];
    return doc.sampleIds.map(id => requests.find(r => r.id === id)).filter((r): r is TestRequest => Boolean(r));
  }, [doc.sampleIds, requests]);

  const lotNumbers = useMemo(() => {
    return Array.from(new Set(
      docSampleRequests.map(req => {
        if (req.encodeNumber) return req.encodeNumber;
        const encode = req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || '';
        return encode ? encode.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '') : '';
      }).filter(Boolean)
    )).join(', ');
  }, [docSampleRequests]);

  const productTypes = useMemo(() => {
    return Array.from(new Set(docSampleRequests.map(r => r.type).filter(Boolean))).join(', ');
  }, [docSampleRequests]);

  const brands = useMemo(() => {
    return Array.from(new Set(docSampleRequests.map(r => r.brand).filter(Boolean))).join(', ');
  }, [docSampleRequests]);

  const formattedDate = doc.date ? formatDateVN(doc.date) : '';

  const totalCount = docSampleRequests.length;

  return (
    <div className={`rounded-xl shadow-sm border transition-all overflow-hidden group ${
      isReceive 
        ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300 hover:shadow-md' 
        : 'bg-blue-50/40 border-blue-200/80 hover:border-blue-300 hover:shadow-md'
    }`}>
      <div 
        onClick={() => onToggleExpand(doc.id)}
        className="p-2.5 md:p-3 cursor-pointer hover:bg-white transition-colors relative"
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
              isReceive 
                ? 'bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600 border border-emerald-100' 
                : 'bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-600 border border-blue-100'
            }`}>
              {isReceive ? <ClipboardList size={16} strokeWidth={2} aria-hidden="true" /> : <Truck size={16} strokeWidth={2} aria-hidden="true" />}
            </div>

            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center flex-wrap gap-1.5">
                  <h3 className="text-[11px] font-black text-slate-800 leading-none uppercase tracking-widest">
                    <HighlightText text={doc.docNumber} search={handoverSearch} />
                  </h3>

                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] border border-slate-200/50 shadow-sm font-bold">
                    {totalCount} mẫu
                  </span>

                  {formattedDate && (
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] border border-slate-200/50 shadow-sm font-bold" title="Ngày lập biên bản">
                      {formattedDate}
                    </span>
                  )}

                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest shadow-sm text-white ${
                    isReceive ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    {isReceive ? 'NHẬN MẪU' : 'TRẢ MẪU'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onViewDoc(doc); }} 
                    className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-colors" 
                    title="Xem chi tiết"
                  >
                    <Eye size={10} strokeWidth={2.5} aria-hidden="true" />
                  </button>

                  {isAdmin && onDeleteDoc && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc); }} 
                      className="p-1 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded transition-colors" 
                      title={`Xóa biên bản ${doc.docNumber}`}
                    >
                      <Trash2 size={10} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  )}

                  <div className="w-px h-3 bg-slate-200 mx-0.5"></div>

                  <div className="text-slate-400 p-1 hover:bg-slate-100 rounded transition-colors" aria-hidden="true">
                    {expanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 items-center text-[9px] font-bold text-slate-600">
                {lotNumbers && (
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0" title="Số lô">
                    <span className="text-amber-800 uppercase tracking-widest text-[8px] shrink-0">Lô:</span>
                    <span className="text-amber-900 truncate"><HighlightText text={lotNumbers} search={handoverSearch} /></span>
                  </div>
                )}
                {productTypes && (
                  <div className="flex items-center gap-1 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0 text-blue-700" title="Loại sản phẩm">
                    <span className="truncate"><HighlightText text={productTypes} search={handoverSearch} /></span>
                  </div>
                )}
                {brands && (
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded shadow-sm min-w-0" title="Nhãn hiệu">
                    <span className="truncate"><HighlightText text={brands} search={handoverSearch} /></span>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-500 font-medium truncate" title={doc.customerName}>
                <HighlightText text={doc.customerName} search={handoverSearch} />
              </p>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100/60 bg-slate-50/50" role="region">
          {docSampleRequests.length > 0 ? (
            docSampleRequests.map(req => {
              const sampleEncodedNumbers = Array.from(new Set(
                [req.atdEncodeNumber, req.emcEncodeNumber, req.itdEncodeNumber]
                  .filter(Boolean)
              )).join(' - ') || req.requestCode;

              const sampleFullName = `${req.type ? req.type + ' ' : ''}${req.brand ? req.brand + ' ' : ''}${req.modelName}`;

              return (
                <div key={req.id} className="border-b border-slate-100 last:border-0">
                  <div className="p-2 md:px-3 hover:bg-white transition-colors flex justify-between items-center group/item gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className="w-1 h-1 rounded-full bg-slate-400 shrink-0"></div>

                      <div className="flex items-center gap-1.5 flex-1 min-w-0 truncate">
                        {sampleEncodedNumbers && (
                          <span className="text-[8px] text-blue-600 font-black tracking-widest uppercase bg-blue-50 px-1 py-0.5 rounded border border-blue-100 shrink-0 shadow-sm">
                            <HighlightText text={sampleEncodedNumbers} search={handoverSearch} />
                          </span>
                        )}

                        <h4 className="text-[9px] text-slate-700 font-bold truncate shrink-0">
                          <HighlightText text={sampleFullName} search={handoverSearch} />
                        </h4>

                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-black text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            SL: {req.quantity || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-[10px] text-slate-400 italic text-center">Không có mẫu nào trong biên bản</div>
          )}
        </div>
      )}
    </div>
  );
};

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, code, count, affectedDocs = [], isSingleSample = false }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, code: string | null, count: number, affectedDocs?: string[], isSingleSample?: boolean }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true" style={{zIndex: 9999}}>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">{isSingleSample ? 'Xóa Mẫu?' : 'Xóa Phiếu Yêu Cầu?'}</h3>
                    <p className="text-xs text-slate-500">
                        {isSingleSample ? (
                            <>Bạn đang xóa mẫu <span className="font-bold text-slate-800">{code}</span>.</>
                        ) : (
                            <>Bạn đang xóa phiếu <span className="font-bold text-slate-800">{code}</span> gồm <span className="font-bold text-red-600">{count} mẫu</span>.</>
                        )}
                    </p>
                </div>
                
                {affectedDocs.length > 0 ? (
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 mb-6 text-left">
                        <div className="text-[10px] font-bold text-orange-700 uppercase mb-1 flex items-center gap-1">
                            <AlertTriangle size={12} /> Cảnh báo quan trọng
                        </div>
                        <p className="text-[10px] text-orange-800 mb-2">
                            {isSingleSample ? 'Mẫu này' : 'Các mẫu trong phiếu này'} đang nằm trong các Biên bản giao nhận sau:
                        </p>
                        <ul className="list-disc list-inside text-[10px] font-bold text-orange-700">
                            {affectedDocs.map(doc => <li key={doc}>{doc}</li>)}
                        </ul>
                        <p className="text-[9px] text-orange-600 mt-2 italic border-t border-orange-200 pt-1">
                            Việc xóa {isSingleSample ? 'mẫu này' : 'phiếu này'} sẽ <b>loại bỏ {isSingleSample ? 'nó' : 'các mẫu'} khỏi biên bản</b> tương ứng.
                        </p>
                    </div>
                ) : (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 mb-6">
                        <p className="text-[10px] text-red-800 font-medium flex gap-2 items-center text-left">
                            <AlertTriangle size={14} className="shrink-0" />
                            Hành động này sẽ xóa vĩnh viễn {isSingleSample ? 'mẫu này' : 'toàn bộ mẫu trong phiếu này'} và không thể hoàn tác.
                        </p>
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded-xl hover:bg-slate-200 transition-colors">
                        Hủy bỏ
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white text-xs font-bold uppercase rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all">
                        {affectedDocs.length > 0 ? 'Xác nhận xóa' : 'Xóa vĩnh viễn'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DashboardView = ({ requests, onReceiveRequest, onHandoverRequest, isAdmin }: { requests: TestRequest[]; onReceiveRequest: () => void; onHandoverRequest: () => void; isAdmin: boolean }) => {
  const { testers, currentUser } = useStore();
  const isAdminUser = currentUser?.role === 'admin' || 
                  currentUser?.position?.toLowerCase().includes('quản lý') || 
                  currentUser?.position?.toLowerCase().includes('trưởng phòng');

  const [hiddenTesters, setHiddenTesters] = useState<Record<string, boolean>>({});
  const [isTesterCustomizationOpen, setIsTesterCustomizationOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kpiPeriod, setKpiPeriod] = useState<'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL'>('TODAY');
  const [isKpiExpanded, setIsKpiExpanded] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const assignedTesterNames = getAssignedTesterNames(requests);
  const assignedTesters = testers.filter(t => t.name !== 'Khác' && assignedTesterNames.has(t.name));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        toast.error("Không thể mở toàn màn hình");
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const boardTesters = assignedTesters.filter(t => !hiddenTesters[t.name]);

  const toggleTesterVisibility = (testerName: string) => {
    if (!isAdminUser) return;
    setHiddenTesters(prev => ({
      ...prev,
      [testerName]: !prev[testerName]
    }));
  };

  const activeRequests = requests.filter(r => 
      !r.id.includes('-log-') &&
      ![RequestStatus.COMPLETED, RequestStatus.RESULTS_APPROVED, RequestStatus.RESULTS_SUBMITTED, 'Đã trả khách' as any].includes(r.status) &&
      r.sampleStatus !== SampleStatus.RETURNED
  );

  const isCompletedInPeriod = (r: TestRequest, period: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL') => {
    const isCompleted = [
      RequestStatus.COMPLETED,
      RequestStatus.RESULTS_APPROVED,
      RequestStatus.RESULTS_SUBMITTED,
      'Đã trả khách' as any
    ].includes(r.status) || r.sampleStatus === SampleStatus.RETURNED;

    if (!isCompleted) return false;
    if (period === 'ALL') return true;

    const dateStr = r.updatedAt || r.endDate || r.scheduledDate || r.requestDate || r.createdAt;
    if (!dateStr) return true;

    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return true;

    const today = new Date();
    today.setHours(0,0,0,0);

    if (period === 'TODAY') {
      const compDate = new Date(targetDate);
      compDate.setHours(0,0,0,0);
      return compDate.getTime() === today.getTime();
    }

    if (period === 'THIS_WEEK') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      return targetDate >= startOfWeek;
    }

    if (period === 'THIS_MONTH') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return targetDate >= startOfMonth;
    }

    return true;
  };

  const testerKpiStats = useMemo(() => {
    return boardTesters.map(tester => {
      const activeTasks = requests.filter(r => 
        !r.id.includes('-log-') &&
        r.testerName === tester.name &&
        ![RequestStatus.COMPLETED, RequestStatus.RESULTS_APPROVED, RequestStatus.RESULTS_SUBMITTED, 'Đã trả khách' as any].includes(r.status) &&
        r.sampleStatus !== SampleStatus.RETURNED
      );

      const completedTasks = requests.filter(r => 
        !r.id.includes('-log-') &&
        r.testerName === tester.name &&
        isCompletedInPeriod(r, kpiPeriod)
      );

      const completedCount = completedTasks.length;
      const activeCount = activeTasks.length;

      let ratingLabel = 'Sẵn sàng 🟢';
      let ratingBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

      if (completedCount >= 5) {
        ratingLabel = 'Xuất sắc 🏆';
        ratingBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
      } else if (completedCount >= 3) {
        ratingLabel = 'Tốt ⭐';
        ratingBadgeClass = 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold';
      } else if (completedCount >= 1) {
        ratingLabel = 'Đạt KPI 🟢';
        ratingBadgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      } else if (activeCount > 0) {
        ratingLabel = 'Đang làm ⏳';
        ratingBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
      }

      return {
        tester,
        activeCount,
        completedCount,
        ratingLabel,
        ratingBadgeClass
      };
    });
  }, [boardTesters, requests, kpiPeriod]);

  return (
    <div ref={containerRef} className={`flex flex-col bg-slate-50 ${isFullscreen ? 'h-screen w-screen fixed inset-0 z-[9999] p-2 md:p-3' : 'h-full p-2 md:p-4'} overflow-hidden`}>
       <div className="flex flex-col gap-2 mb-2 shrink-0 bg-white p-2 md:p-3 rounded-xl shadow-xs border border-slate-200">
         <div className="flex flex-wrap items-center justify-between gap-2">
           <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-emerald-600 shrink-0" />
              <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Bảng nhắc việc</h2>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                {activeRequests.length} công việc chưa xong
              </span>
              <button 
                onClick={() => setIsKpiExpanded(!isKpiExpanded)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border transition-all cursor-pointer shadow-xs ${
                  isKpiExpanded ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
                title="Đánh giá KPI công việc nhân sự"
              >
                <BarChart3 size={14} />
                <span>KPI Nhân sự</span>
                {isKpiExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
           </div>
           <div className="flex items-center gap-2">
              {isKpiExpanded && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setKpiPeriod('TODAY')}
                    className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md transition-all ${
                      kpiPeriod === 'TODAY' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Hôm nay
                  </button>
                  <button
                    onClick={() => setKpiPeriod('THIS_WEEK')}
                    className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md transition-all ${
                      kpiPeriod === 'THIS_WEEK' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tuần này
                  </button>
                  <button
                    onClick={() => setKpiPeriod('THIS_MONTH')}
                    className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md transition-all ${
                      kpiPeriod === 'THIS_MONTH' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tháng này
                  </button>
                </div>
              )}
              {isAdminUser && (
                 <div className="relative group">
                   <button
                     type="button"
                     onClick={() => setIsTesterCustomizationOpen(prev => !prev)}
                     aria-expanded={isTesterCustomizationOpen}
                     aria-controls="dashboard-tester-customization"
                     className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 transition-colors"
                   >
                     <Settings size={13} /> Tùy chỉnh nhân sự
                   </button>
                   <div
                     id="dashboard-tester-customization"
                     className={`absolute right-0 top-full mt-1 ${isTesterCustomizationOpen ? 'flex' : 'hidden'} flex-col bg-white border border-slate-200 shadow-xl rounded-xl p-2 w-48 z-50`}
                   >
                      {assignedTesters.map(t => (
                          <label key={t.name} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                             <input type="checkbox" checked={!hiddenTesters[t.name]} onChange={() => toggleTesterVisibility(t.name)} className="accent-emerald-600 rounded" />
                             <span className="text-xs font-bold text-slate-700">{t.name}</span>
                          </label>
                      ))}
                   </div>
                 </div>
              )}
              <button onClick={toggleFullscreen} className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                 <Eye size={13} /> {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              </button>
           </div>
         </div>

         {isKpiExpanded && (
           <div className="pt-2 border-t border-slate-100/80 flex items-center gap-2 overflow-x-auto scrollbar-thin pb-0.5">
              <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-slate-200 text-slate-500">
                 <Award size={16} className="text-amber-500" />
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase leading-none text-slate-800">
                       KPI {kpiPeriod === 'TODAY' ? 'Hôm nay' : kpiPeriod === 'THIS_WEEK' ? 'Tuần này' : kpiPeriod === 'THIS_MONTH' ? 'Tháng này' : 'Tất cả'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 leading-none mt-0.5">Hoàn thành & Đánh giá</span>
                 </div>
              </div>

              {testerKpiStats.map(({ tester, activeCount, completedCount, ratingLabel, ratingBadgeClass }) => (
                 <div 
                   key={tester.name} 
                   className="flex items-center gap-2 p-1.5 px-2 bg-slate-50 hover:bg-white rounded-lg border border-slate-200/80 shrink-0 min-w-[145px] shadow-2xs transition-all"
                 >
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-black text-[9px] text-slate-700 shrink-0 border border-slate-300">
                       {tester.shortName}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                       <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black text-slate-800 truncate" title={tester.name}>{tester.name}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-[9px] mt-0.5">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.1 rounded border border-emerald-100">
                             Xong: {completedCount}
                          </span>
                          <span className="font-bold text-slate-500 bg-slate-100 px-1 py-0.1 rounded">
                             Chờ: {activeCount}
                          </span>
                       </div>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border shrink-0 ${ratingBadgeClass}`}>
                       {ratingLabel}
                    </span>
                 </div>
              ))}
           </div>
         )}
       </div>

       <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-1.5 pb-1">
          {boardTesters.map(tester => {
              const testerRequests = activeRequests.filter(r => r.testerName === tester.name);
              
              return (
                  <div key={tester.name} className="flex flex-col flex-1 min-w-[140px] max-w-[220px] bg-slate-100/60 rounded-lg border border-slate-200/60 overflow-hidden shadow-2xs h-full max-h-full">
                     <div className={`p-1 px-1.5 border-b flex items-center justify-between ${tester.colorClass ? tester.colorClass.replace('text-', 'bg-').replace('600', '100') : 'bg-slate-200'} border-slate-200 shrink-0`}>
                        <div className="flex items-center gap-1 min-w-0">
                            <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center font-black text-[8px] shadow-2xs shrink-0">
                                {tester.shortName}
                            </div>
                            <h3 className="font-black text-[11px] text-slate-800 truncate" title={tester.name}>{tester.name}</h3>
                        </div>
                        <span className="bg-white px-1 py-0.1 rounded-full text-[9px] font-black shadow-2xs text-slate-700 shrink-0">{testerRequests.length}</span>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-1 space-y-1 scrollbar-thin">
                        {testerRequests.length === 0 ? (
                           <div className="p-2 min-h-[50px] flex flex-col items-center justify-center text-[10px] font-bold text-emerald-600 bg-emerald-50/70 rounded-md border border-emerald-200/80 text-center leading-tight">
                               <CheckCircle2 size={13} className="text-emerald-500 mb-0.5 shrink-0" />
                               <span>Đã hoàn thành, chờ giao việc</span>
                           </div>
                        ) : (
                           testerRequests.map(req => {
                              const encodeText = [req.emcEncodeNumber, req.itdEncodeNumber, req.atdEncodeNumber].filter(Boolean).join('-');
                              return (
                                 <div key={req.id} className="bg-white p-1 rounded-md border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col gap-0.5">
                                     <div className="flex items-start justify-between gap-1 pr-2">
                                        <div className="min-w-0 flex-1">
                                           <div className="text-[9.5px] font-bold text-slate-800 leading-none truncate" title={req.modelName}>{req.modelName}</div>
                                           <div className="text-[7.5px] font-medium text-slate-500 leading-tight truncate" title={req.customerName}>{req.customerName}</div>
                                        </div>
                                     </div>

                                     <div className="text-[7.5px] text-slate-600 flex flex-wrap gap-x-1 leading-none">
                                        {req.brand && <span><span className="opacity-60">Hiệu:</span><span className="font-semibold">{req.brand}</span></span>}
                                        {req.testCategory && <span><span className="opacity-60">Thử:</span><span className="font-semibold">{req.testCategory.replace('Cả An toàn điện và EMC', 'ATĐ&EMC').replace('An toàn điện', 'ATĐ').replace('Tương thích điện từ', 'EMC')}</span></span>}
                                        {req.quantity > 0 && <span><span className="opacity-60">SL:</span><span className="font-semibold">{req.quantity}</span></span>}
                                     </div>

                                     <div className="text-[7px] text-slate-500 flex flex-wrap gap-x-1 leading-none">
                                        {req.requestDate && <span><span className="opacity-60">Nhận:</span>{new Date(req.requestDate).toLocaleDateString('vi-VN')}</span>}
                                        {req.scheduledDate && <span className="text-emerald-700 font-semibold"><span className="opacity-60 text-slate-500">Lịch:</span>{new Date(req.scheduledDate).toLocaleDateString('vi-VN')}</span>}
                                        {req.deadlineDate && <span className="text-rose-600 font-semibold"><span className="opacity-60 text-slate-500">Hạn:</span>{new Date(req.deadlineDate).toLocaleDateString('vi-VN')}</span>}
                                     </div>

                                     <div className="flex items-center gap-0.5 flex-wrap">
                                        <span className="px-0.5 py-0.1 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[7px] font-bold uppercase">{req.requestCode}</span>
                                        {encodeText && <span className="px-0.5 py-0.1 bg-blue-50 border border-blue-100 text-blue-700 rounded text-[7px] font-bold uppercase">{encodeText}</span>}
                                        {req.status && <span className="px-0.5 py-0.1 bg-amber-50 border border-amber-100 text-amber-700 rounded text-[7px] font-bold uppercase">{req.status}</span>}
                                     </div>
                                     <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                                         {req.priority === PriorityLevel.URGENT && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="Khẩn cấp"></span>}
                                         {req.priority === PriorityLevel.VIP && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="VIP"></span>}
                                     </div>
                                 </div>
                              );
                           })
                        )}
                     </div>
                  </div>
              );
          })}
       </div>
    </div>
  );
};

type ActiveTab = 'dashboard' | 'requests' | 'schedule_itd' | 'schedule_emc' | 'handover' | 'summary_log' | 'kqtn' | 'report_generator' | 'brands' | 'customers' | 'products' | 'activity_log' | 'system_settings';

export default function App() {
  const { 
    requests, updateRequest, handoverDocs, runAutoSchedule, addHandoverDoc, deleteHandoverDoc, addRequest, addRequests, deleteRequestGroup, deleteRequest,
    preloadCsvCatalogs, fetchData, setupRealtimeSync, isLoading, isSyncing, hasUnsyncedChanges, undo, redo, past, future, currentUser, systemUsers, logout, syncWithCloud, syncError,
    userPreferences, forceReload, products, notifications = [],
    isSyncModalOpen, setSyncModalOpen, runDetailedSyncDiagnostic
  } = useStore();

  const isAdmin = currentUser?.role === 'admin' || 
                  currentUser?.position?.toLowerCase().includes('quản lý') || 
                  currentUser?.position?.toLowerCase().includes('trưởng phòng');
  const canAccessSystemSettings = canViewSystemSettings(currentUser);
  const canViewActivityLog = isActivityLogVisibleToUser(currentUser);

  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read && canViewNotification(n, currentUser)).length;
  }, [notifications, currentUser]);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isStandalone) {
      setShowInstallBtn(false);
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: 'portrait') => Promise<void>;
      };
    if (isTouchDevice && typeof orientation.lock === 'function') {
        orientation.lock('portrait').catch(() => {});
      }
    } else if (isIOS) {
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      toast.info('Để cài webapp, hãy chọn biểu tượng cài đặt trên thanh địa chỉ hoặc chọn “Thêm vào màn hình chính” từ menu trình duyệt.', { duration: 6000 });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA installation');
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const renderSyncStatus = () => {
    if (isSyncing) {
      return (
        <div 
          onClick={() => {
            runDetailedSyncDiagnostic();
            setSyncModalOpen(true);
          }}
          className="flex items-center justify-center w-6 h-6 bg-blue-50 text-blue-700 border border-blue-200 rounded-full select-none animate-pulse cursor-pointer" 
          title="Đang đồng bộ... Nhấp để xem nhật ký chẩn đoán"
        >
          <Loader2 size={12} className="animate-spin" />
        </div>
      );
    }
    if (hasUnsyncedChanges) {
      return (
        <div 
          onClick={() => {
            fetchData(true);
            runDetailedSyncDiagnostic();
            setSyncModalOpen(true);
          }}
          title="Có thay đổi mới chưa được lưu. Nhấp để đồng bộ ngay & xem nhật ký."
          className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full text-[10px] font-black uppercase tracking-wider select-none cursor-pointer hover:bg-gray-100 transition-all active:scale-95"
        >
          <AlertCircle size={12} className="shrink-0" />
          <span className="hidden sm:inline">Chưa lưu</span>
        </div>
      );
    }
    return (
      <div 
        onClick={() => {
          runDetailedSyncDiagnostic();
          setSyncModalOpen(true);
        }}
        title="Dữ liệu đã được đồng bộ hóa thành công với đám mây. Nhấp để mở Nhật ký chẩn đoán chi tiết."
        className="flex items-center justify-center w-6 h-6 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full select-none cursor-pointer hover:bg-emerald-100 transition-all active:scale-95"
      >
        <CheckCircle2 size={12} className="shrink-0" />
      </div>
    );
  };

  const showSyncInfo = () => {
    toast(
      <div className="flex flex-col gap-2 p-1 max-w-sm">
        <div className="font-extrabold flex items-center gap-2 text-emerald-700 text-[11px] uppercase tracking-wider">
          <Activity size={14} className="text-emerald-600 animate-pulse" /> Cơ chế đồng bộ đám mây
        </div>
        <div className="text-[10px] text-slate-600 space-y-1.5 leading-relaxed font-medium">
          <p>
            Hệ thống sử dụng cơ chế <b>đồng bộ hai chiều tự động</b> dựa trên dấu thời gian chỉnh sửa (<i>Last-Write-Wins</i>):
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-slate-500">
            <li>Mọi chỉnh sửa của bạn được tự động lưu cục bộ và đẩy lên đám mây sau 1 giây.</li>
            <li>Khi có xung đột giữa các thiết bị, phiên bản có thời gian chỉnh sửa cuối (<b>updatedAt</b>) sẽ được ưu tiên giữ lại.</li>
            <li>Tự động chạy cập nhật ngầm định kỳ <b>mỗi 30 giây</b> để đồng bộ các thay đổi mới nhất từ người dùng khác mà không ảnh hưởng tới thao tác của bạn.</li>
          </ul>
        </div>
      </div>,
      { duration: 8000 }
    );
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    currentUser?.role === 'guest' ? 'requests' :
    currentUser?.role === 'office_clerk' ? 'kqtn' :
    'dashboard'
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const guestRequestModalAutoOpenRef = useRef(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isHandoverDocsModalOpen, setIsHandoverDocsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isUserSettingsModalOpen, setIsUserSettingsModalOpen] = useState(false);
  const [editingRequestGroup, setEditingRequestGroup] = useState<TestRequest[] | undefined>(undefined);
  const [selectedRequestsForPrint, setSelectedRequestsForPrint] = useState<TestRequest[] | null>(null);
  const [deleteGroupModal, setDeleteGroupModal] = useState<{ isOpen: boolean, code: string | null, count: number, affectedDocs: string[] }>({ isOpen: false, code: null, count: 0, affectedDocs: [] });
  const [deleteSampleModal, setDeleteSampleModal] = useState<{ isOpen: boolean, id: string | null, name: string, affectedDocs: string[] }>({ isOpen: false, id: null, name: '', affectedDocs: [] });
  const [deleteHandoverDocModal, setDeleteHandoverDocModal] = useState<{ isOpen: boolean; doc: HandoverDoc | null }>({ isOpen: false, doc: null });

  const [selectedHandoverDoc, setSelectedHandoverDoc] = useState<HandoverDoc | null>(null);
  const [initialRequestGroupForHandover, setInitialRequestGroupForHandover] = useState<TestRequest[] | null>(null);

  const handleEditGroup = (code: string) => {
    const groupItems = requests.filter(r => r.requestCode === code);
    if (groupItems.length > 0) {
      setEditingRequestGroup(groupItems);
      setIsRequestModalOpen(true);
    }
  };

  const [handoverSearch, setHandoverSearch] = useState('');
  const [handoverTypeFilter, setHandoverTypeFilter] = useState<HandoverType | 'ALL'>('ALL');
  const [handoverMonthFilter, setHandoverMonthFilter] = useState<string | 'ALL'>('ALL');
  const [expandedDocIds, setExpandedDocIds] = useState<Record<string, boolean>>({});
  const toggleDocExpand = (docId: string) => {
    setExpandedDocIds(prev => ({ ...prev, [docId]: !prev[docId] }));
  };

  const [requestSearch, setRequestSearch] = useState('');
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<'ALL' | 'EMC' | 'ITD' | 'ITDC' | 'UNENCODED'>('ALL');
  const [requestSortOrder, setRequestSortOrder] = useState<'NEWEST' | 'OLDEST' | 'DEADLINE' | 'LOT_ASC' | 'LOT_DESC'>('NEWEST');
  const [requestDateFilter, setRequestDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [requestPriorityFilter, setRequestPriorityFilter] = useState<'ALL' | PriorityLevel>('ALL');
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (currentUser?.role === 'office_clerk') {
      if (activeTab !== 'kqtn') setActiveTab('kqtn');
      return;
    }
    if (activeTab === 'dashboard' && currentUser?.role === 'guest') {
      setActiveTab('requests');
    }
    if (activeTab === 'activity_log' && !canViewActivityLog) {
      setActiveTab('requests');
    }
  }, [activeTab, currentUser, canViewActivityLog]);

  useEffect(() => {
    setCurrentPage(1);
  }, [requestSearch, requestCategoryFilter, requestPriorityFilter]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      await preloadCsvCatalogs();
      if (cancelled) return;
      await fetchData();
      if (!cancelled) setupRealtimeSync();
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    
    const intervalId = setInterval(() => {
      const isAnyModalOpen = 
        isHandoverModalOpen || 
        isRequestModalOpen || 
        isPrintModalOpen || 
        isHandoverDocsModalOpen || 
        isSettingsModalOpen || 
        isUserSettingsModalOpen || 
        deleteGroupModal.isOpen || 
        deleteSampleModal.isOpen;

      
      if (
        !isAnyModalOpen && 
        document.visibilityState === 'visible' && 
        !isSyncing && 
        !isLoading && 
        !hasUnsyncedChanges
      ) {
        fetchData?.(false);
      }
    }, 180000); 

    return () => clearInterval(intervalId);
  }, [
    isHandoverModalOpen, 
    isRequestModalOpen, 
    isPrintModalOpen, 
    isHandoverDocsModalOpen, 
    isSettingsModalOpen, 
    isUserSettingsModalOpen, 
    deleteGroupModal.isOpen, 
    deleteSampleModal.isOpen,
    isSyncing,
    isLoading,
    hasUnsyncedChanges,
    fetchData
  ]);

  useEffect(() => {
    if (!currentUser) {
      guestRequestModalAutoOpenRef.current = false;
      return;
    }

    if (currentUser.role === 'guest' && !guestRequestModalAutoOpenRef.current) {
      setActiveTab('requests');
      setIsRequestModalOpen(true);
      guestRequestModalAutoOpenRef.current = true;
    }
  }, [currentUser?.username, currentUser?.role]);
  
  const nonLogRequests = useMemo(() => requests.filter(r => !r.id.includes('-log-')), [requests]);

  const handoverReceiveCount = useMemo(() => handoverDocs.filter(d => d.type === HandoverType.RECEIVE).length, [handoverDocs]);
  const handoverReturnCount = useMemo(() => handoverDocs.filter(d => d.type === HandoverType.RETURN).length, [handoverDocs]);

  const uniqueHandoverMonths = useMemo(() => {
    const months = new Set<string>();
    handoverDocs.forEach(doc => {
      if (doc.date) {
        const d = new Date(doc.date);
        if (!isNaN(d.getTime())) {
          months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    });
    return Array.from(months).sort().reverse();
  }, [handoverDocs]);

  const filteredHandoverDocs = useMemo(() => {
    const filtered = handoverDocs.filter(doc => {
      const searchNormalized = removeAccents(String(handoverSearch || '').toLowerCase().trim());
      const cleanSearch = searchNormalized.replace(/^(lô|lo)\s+/i, '');
      const docNumberNormalized = removeAccents(String(doc.docNumber || '').toLowerCase());
      const customerNameNormalized = removeAccents(String(doc.customerName || '').toLowerCase());

      const matchesSamples = handoverSearch !== '' && Array.isArray(doc.sampleIds) && doc.sampleIds.some(id => {
        const req = requests.find(r => r.id === id);
        if (!req) return false;
        const reqModel = removeAccents(String(req.modelName || '').toLowerCase());
        const reqBrand = removeAccents(String(req.brand || '').toLowerCase());
        const reqType = removeAccents(String(req.type || '').toLowerCase());
        const reqCode = removeAccents(String(req.requestCode || '').toLowerCase());
        const reqAtd = removeAccents(String(req.atdEncodeNumber || '').toLowerCase());
        const reqEmc = removeAccents(String(req.emcEncodeNumber || '').toLowerCase());
        const reqItd = removeAccents(String(req.itdEncodeNumber || '').toLowerCase());
        const reqEncode = removeAccents(String(req.encodeNumber || '').toLowerCase());
        const reqSeal = removeAccents(String(req.sealStamp || '').toLowerCase());
        const reqMtt = removeAccents(String(req.mtt || '').toLowerCase());

        const rawLot = req.encodeNumber || 
          [req.atdEncodeNumber, req.emcEncodeNumber, req.itdEncodeNumber]
            .map(e => e ? e.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '') : '')
            .find(Boolean) || '';
        const reqLot = removeAccents(rawLot.toLowerCase());

        return reqModel.includes(searchNormalized) || 
               reqBrand.includes(searchNormalized) || 
               reqType.includes(searchNormalized) ||
               reqCode.includes(searchNormalized) || (cleanSearch !== '' && reqCode.includes(cleanSearch)) ||
               reqAtd.includes(searchNormalized) || (cleanSearch !== '' && reqAtd.includes(cleanSearch)) ||
               reqEmc.includes(searchNormalized) || (cleanSearch !== '' && reqEmc.includes(cleanSearch)) ||
               reqItd.includes(searchNormalized) || (cleanSearch !== '' && reqItd.includes(cleanSearch)) ||
               reqEncode.includes(searchNormalized) || (cleanSearch !== '' && reqEncode.includes(cleanSearch)) ||
               reqSeal.includes(searchNormalized) || (cleanSearch !== '' && reqSeal.includes(cleanSearch)) ||
               reqMtt.includes(searchNormalized) ||
               (reqLot !== '' && (reqLot.includes(searchNormalized) || (cleanSearch !== '' && reqLot.includes(cleanSearch))));
      });

      const matchesSearch = handoverSearch === '' || 
        docNumberNormalized.includes(searchNormalized) || 
        (cleanSearch !== '' && docNumberNormalized.includes(cleanSearch)) ||
        customerNameNormalized.includes(searchNormalized) ||
        matchesSamples;
      
      const matchesType = handoverTypeFilter === 'ALL' || doc.type === handoverTypeFilter;

      let matchesMonth = true;
      if (handoverMonthFilter !== 'ALL') {
          if (doc.date) {
              const d = new Date(doc.date);
              if (!isNaN(d.getTime())) {
                  const docMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  matchesMonth = docMonth === handoverMonthFilter;
              } else {
                  matchesMonth = false;
              }
          } else {
              matchesMonth = false;
          }
      }

      return matchesSearch && matchesType && matchesMonth;
    });

    return filtered.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [handoverDocs, requests, handoverSearch, handoverTypeFilter, handoverMonthFilter]);

  const requestStats = useMemo(() => {
    let emc = 0;
    let itd = 0;
    let itdc = 0;
    let unencoded = 0;
    requests.forEach(r => {
        if (r.id.includes('-log-')) return;
        const isEmc = r.testCategory === TestCategory.EMC || r.testCategory === TestCategory.BOTH || r.emcEncodeNumber;
        const isItd = r.itdEncodeNumber || (!r.itdEncodeNumber && !r.atdEncodeNumber && (r.testCategory === TestCategory.ATD || r.testCategory === TestCategory.BOTH));
        const isItdc = !!r.atdEncodeNumber;
        const isUnencoded = !r.emcEncodeNumber && !r.atdEncodeNumber && !r.itdEncodeNumber;
        if (isEmc) emc++;
        if (isItd) itd++;
        if (isItdc) itdc++;
        if (isUnencoded) unencoded++;
    });
    return { emc, itd, itdc, unencoded };
  }, [requests]);

  const groupedRequests = useMemo(() => {
    let initialFiltered = requests.filter(r => !r.id.includes('-log-'));
    let isFiltered = false;

    if (requestCategoryFilter !== 'ALL' || requestSearch.trim() !== '' || requestDateFilter !== 'ALL' || requestPriorityFilter !== 'ALL') {
        isFiltered = true;
        if (requestCategoryFilter !== 'ALL') {
            initialFiltered = initialFiltered.filter(req => {
                const isEmc = req.testCategory === TestCategory.EMC || req.testCategory === TestCategory.BOTH || req.emcEncodeNumber;
                const isItd = req.itdEncodeNumber || (!req.itdEncodeNumber && !req.atdEncodeNumber && (req.testCategory === TestCategory.ATD || req.testCategory === TestCategory.BOTH));
                const isItdc = !!req.atdEncodeNumber;
                const isUnencoded = !req.emcEncodeNumber && !req.atdEncodeNumber && !req.itdEncodeNumber;
                if (requestCategoryFilter === 'EMC') return isEmc;
                if (requestCategoryFilter === 'ITD') return isItd;
                if (requestCategoryFilter === 'ITDC') return isItdc;
                if (requestCategoryFilter === 'UNENCODED') return isUnencoded;
                return true;
            });
        }
        if (requestPriorityFilter !== 'ALL') {
            initialFiltered = initialFiltered.filter(req => req.priority === requestPriorityFilter);
        }
        if (requestSearch.trim() !== '') {
            const searchNormalized = removeAccents(String(requestSearch || '').toLowerCase());
            initialFiltered = initialFiltered.filter(req => {
                const reqCodeNormalized = removeAccents(String(req.requestCode || '').toLowerCase());
                const custNameNormalized = removeAccents(String(req.customerName || '').toLowerCase());
                const modelNameNormalized = removeAccents(String(req.modelName || '').toLowerCase());
                const atdNormalized = req.atdEncodeNumber ? removeAccents(String(req.atdEncodeNumber).toLowerCase()) : '';
                const emcNormalized = req.emcEncodeNumber ? removeAccents(String(req.emcEncodeNumber).toLowerCase()) : '';
                const itdNormalized = req.itdEncodeNumber ? removeAccents(String(req.itdEncodeNumber).toLowerCase()) : '';
                const encodeNumberNormalized = req.encodeNumber ? removeAccents(String(req.encodeNumber).toLowerCase()) : '';
                const sampleCodeNormalized = (req as any).sampleCode ? removeAccents(String((req as any).sampleCode).toLowerCase()) : '';
                const typeNormalized = req.type ? removeAccents(String(req.type).toLowerCase()) : '';
                const brandNormalized = req.brand ? removeAccents(String(req.brand).toLowerCase()) : '';
                const sealStampNormalized = req.sealStamp ? removeAccents(String(req.sealStamp).toLowerCase()) : '';
                const otherInfoNormalized = req.otherCustomerInfo ? removeAccents(String(req.otherCustomerInfo).toLowerCase()) : '';
                
                return reqCodeNormalized.includes(searchNormalized) || 
                       custNameNormalized.includes(searchNormalized) ||
                       modelNameNormalized.includes(searchNormalized) ||
                       atdNormalized.includes(searchNormalized) ||
                       emcNormalized.includes(searchNormalized) ||
                       itdNormalized.includes(searchNormalized) ||
                       encodeNumberNormalized.includes(searchNormalized) ||
                       sampleCodeNormalized.includes(searchNormalized) ||
                       typeNormalized.includes(searchNormalized) ||
                       brandNormalized.includes(searchNormalized) ||
                       sealStampNormalized.includes(searchNormalized) ||
                       otherInfoNormalized.includes(searchNormalized);
            });
        }
        if (requestDateFilter !== 'ALL') {
            const today = new Date();
            today.setHours(0,0,0,0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            initialFiltered = initialFiltered.filter(req => {
                const reqDate = new Date(req.createdAt || req.receivedDate || today);
                reqDate.setHours(0,0,0,0);
                if (requestDateFilter === 'TODAY') return reqDate.getTime() === today.getTime();
                if (requestDateFilter === 'THIS_WEEK') return reqDate >= startOfWeek;
                if (requestDateFilter === 'THIS_MONTH') return reqDate >= startOfMonth;
                return true;
            });
        }
    }

    const matchingRequestCodes = new Set(isFiltered ? initialFiltered.map(req => req.requestCode) : []);
    const groups: Record<string, TestRequest[]> = {};
    
    requests.forEach(req => { 
        if (req.id.includes('-log-')) return;
        if (!isFiltered || matchingRequestCodes.has(req.requestCode)) {
            if(!groups[req.requestCode]) groups[req.requestCode] = []; 
            groups[req.requestCode].push(req); 
        }
    });

    return Object.entries(groups).sort((a, b) => {
        if (requestSortOrder === 'OLDEST') {
            const timeA = Math.min(...a[1].map(r => new Date(r.createdAt || r.requestDate || r.updatedAt || 0).getTime()));
            const timeB = Math.min(...b[1].map(r => new Date(r.createdAt || r.requestDate || r.updatedAt || 0).getTime()));
            return timeA - timeB;
        } else if (requestSortOrder === 'DEADLINE') {
            const deadlinesA = a[1].map(r => calculateInternalDeadline(r)?.getTime() || Infinity);
            const minDeadlineA = Math.min(...deadlinesA);
            const deadlinesB = b[1].map(r => calculateInternalDeadline(r)?.getTime() || Infinity);
            const minDeadlineB = Math.min(...deadlinesB);
            if (minDeadlineA !== minDeadlineB) {
                return minDeadlineA - minDeadlineB;
            }
            const timeA = Math.max(...a[1].map(r => new Date(r.createdAt || r.requestDate || r.updatedAt || 0).getTime()));
            const timeB = Math.max(...b[1].map(r => new Date(r.createdAt || r.requestDate || r.updatedAt || 0).getTime()));
            return timeB - timeA;
        } else if (requestSortOrder === 'LOT_ASC' || requestSortOrder === 'LOT_DESC') {
            const extractLot = (items: TestRequest[]) => {
                const encode = items.map(req => req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || '').find(Boolean) || '';
                if (!encode) return '';
                return encode.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '');
            };
            const lotA = extractLot(a[1]);
            const lotB = extractLot(b[1]);
            
            const parseLot = (lot: string) => {
                const parts = lot.split('-');
                if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                    return Number(parts[1]) * 100000 + Number(parts[0]);
                }
                return lot;
            };

            const valA = parseLot(lotA);
            const valB = parseLot(lotB);

            if (typeof valA === 'number' && typeof valB === 'number') {
                return requestSortOrder === 'LOT_ASC' ? valA - valB : valB - valA;
            } else {
                return requestSortOrder === 'LOT_ASC' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            }
        } else {
            const timeA = Math.max(...a[1].map(r => new Date(r.createdAt || r.requestDate || r.updatedAt || 0).getTime()));
            const timeB = Math.max(...b[1].map(r => new Date(r.createdAt || r.requestDate || r.updatedAt || 0).getTime()));
            return timeB - timeA;
        }
    });
  }, [requests, requestSearch, requestCategoryFilter, requestSortOrder, requestDateFilter, requestPriorityFilter]);

  const totalPages = Math.ceil(groupedRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return groupedRequests.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedRequests, currentPage, itemsPerPage]);

  const openPrintModal = (req: TestRequest) => { 
    const groupItems = requests.filter(r => r.requestCode === req.requestCode && !r.id.includes('-log-'));
    setSelectedRequestsForPrint(groupItems); 
    setIsPrintModalOpen(true); 
  };

  const handleOpenDeleteGroupModal = (code: string, count: number) => {
      
      const samplesInGroup = requests.filter(r => r.requestCode === code);
      const sampleIds = samplesInGroup.map(r => r.id);
      
      
      const affected = handoverDocs
          .filter(doc => Array.isArray(doc.sampleIds) && doc.sampleIds.some(sid => sampleIds.includes(sid)))
          .map(doc => doc.docNumber);
      
      const uniqueAffected = Array.from(new Set(affected));
      
      setDeleteGroupModal({ isOpen: true, code, count, affectedDocs: uniqueAffected });
  }

  const handleConfirmDeleteGroup = () => {
      if (deleteGroupModal.code) {
          deleteRequestGroup(deleteGroupModal.code);
          setDeleteGroupModal({ isOpen: false, code: null, count: 0, affectedDocs: [] });
          toast.success(`Đã xóa phiếu ${deleteGroupModal.code}`);
      }
  };

  const handleOpenDeleteSampleModal = (id: string, name: string) => {
      const associatedDocs = handoverDocs
          .filter(d => Array.isArray(d.sampleIds) && d.sampleIds.includes(id))
          .map(d => d.docNumber);
          
      setDeleteSampleModal({ isOpen: true, id, name, affectedDocs: associatedDocs });
  }

  const handleConfirmDeleteSample = () => {
      if (deleteSampleModal.id) {
          deleteRequest(deleteSampleModal.id);
          setDeleteSampleModal({ isOpen: false, id: null, name: '', affectedDocs: [] });
          toast.success(`Đã xóa mẫu ${deleteSampleModal.name}`);
      }
  };

  const handleOpenDeleteHandoverDocModal = (doc: HandoverDoc) => {
      setDeleteHandoverDocModal({ isOpen: true, doc });
  };

  const handleConfirmDeleteHandoverDoc = () => {
      if (deleteHandoverDocModal.doc) {
          const doc = deleteHandoverDocModal.doc;
          deleteHandoverDoc(doc.id);
          setDeleteHandoverDocModal({ isOpen: false, doc: null });
          toast.success(`Đã xóa biên bản số ${doc.docNumber}`);
      }
  };

  const handleViewHandoverDoc = (doc: HandoverDoc) => {
      setSelectedHandoverDoc(doc);
      setIsHandoverModalOpen(true);
  };

  const handleSelectNotification = (notification: AppNotification) => {
    if (currentUser?.role === 'office_clerk') {
      setActiveTab('kqtn');
      return;
    }
    const destination = getNotificationDestination(notification);
    if (destination.kind === 'requests') {
      setActiveTab('requests');
      setRequestSearch(destination.requestCode || '');
    } else if (destination.kind === 'handover') {
      setActiveTab('handover');
      const doc = handoverDocs.find(item => item.id === destination.entityId);
      if (doc) {
        handleViewHandoverDoc(doc);
      } else {
        setHandoverSearch(notification.docNumber || destination.entityId || '');
      }
    } else if (destination.kind === 'kqtn') {
      setActiveTab('kqtn');
    } else if (destination.kind === 'schedule_itd' || destination.kind === 'schedule_emc') {
      setActiveTab(destination.kind);
    }
  };

  const handleCloseHandoverModal = () => {
      setIsHandoverModalOpen(false);
      setSelectedHandoverDoc(null);
      setInitialRequestGroupForHandover(null);
  };

  const handleCreateHandoverFromRequestGroup = (items: TestRequest[]) => {
      setInitialRequestGroupForHandover(items);
      setIsHandoverModalOpen(true);
  };

  if (!currentUser) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <LoginScreen />
      </>
    );
  }

  return (
    <div className="ddt-compact flex flex-row h-[100dvh] bg-slate-50 font-sans overflow-hidden text-slate-800 w-full relative">
      <Toaster position="top-center" richColors />
      {isLoading && requests.length === 0 && (
        <div className="absolute inset-0 bg-slate-950/80 z-[100] flex flex-col items-center justify-center backdrop-blur-md p-6" aria-busy="true" aria-live="polite">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative">
            <Loader2 className="animate-spin text-emerald-500 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Đang đồng bộ dữ liệu</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Hệ thống đang đồng bộ dữ liệu với PostgreSQL. Quá trình này có thể mất vài giây...
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => useStore.setState({ isLoading: false })}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition-all uppercase tracking-widest active:scale-95 cursor-pointer"
              >
                Bỏ qua & Sử dụng Ngoại tuyến
              </button>
              <span className="text-[10px] text-slate-500">
                (Dữ liệu sẽ tự động lưu cục bộ và đồng bộ khi mạng ổn định)
              </span>
            </div>
          </div>
        </div>
      )}

      <aside 
        className={`ddt-compact-sidebar hidden lg:flex flex-col h-full bg-slate-900 text-slate-200 shrink-0 border-r border-slate-800 transition-all duration-300 relative ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`p-4 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white p-0.5">
            <img src={LOGO_BASE64} alt="Logo" className="w-full h-full object-contain" />
          </div>
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <h2 className="text-xs font-black uppercase text-white tracking-wide truncate">PTN Điện - Điện tử</h2>
              <p className="text-[9px] font-bold text-emerald-400 tracking-widest leading-none mt-1">TVCI LAB</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3" aria-label="Menu Sidebar">
          {[
            { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, roles: ['admin', 'tester', 'viewer'] },
            { id: 'requests', label: 'Phiếu YC', icon: ClipboardList, roles: ['admin', 'tester', 'viewer', 'guest'] },
            { id: 'summary_log', label: 'Sổ tổng hợp', icon: SearchCheck, roles: ['admin', 'tester', 'viewer'] },
            { id: 'handover', label: 'Giao nhận', icon: Truck, roles: ['admin', 'tester'] },
            { id: 'schedule_itd', label: 'Lịch ITD', icon: CalendarIcon, roles: ['admin', 'tester', 'viewer'] },
            { id: 'schedule_emc', label: 'Lịch EMC', icon: CalendarIcon, roles: ['admin', 'tester', 'viewer'] },
            { id: 'kqtn', label: 'KQTN', icon: FileSpreadsheet, roles: ['admin', 'tester', 'viewer', 'office_clerk'] },
            { id: 'report_generator', label: 'Lập báo cáo', icon: FileText, roles: ['admin', 'tester', 'viewer'] },
            { id: 'brands', label: 'Thương hiệu', icon: Tag, roles: ['admin', 'tester'] },
            { id: 'customers', label: 'Khách hàng', icon: Building, roles: ['admin', 'tester'] },
            { id: 'products', label: 'Sản phẩm', icon: Package, roles: ['admin', 'tester'] },
            { id: 'activity_log', label: 'Nhật ký hệ thống', icon: History },
            { id: 'system_settings', label: 'Thiết lập', icon: Settings }
          ]
          .filter(tab => {
            if (tab.id === 'system_settings') return canAccessSystemSettings;
            if (tab.id === 'activity_log') return canViewActivityLog;
            return !tab.roles || tab.roles.includes(currentUser.role);
          })
          .map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`w-full py-2.5 rounded-xl flex items-center transition-all ${
                  isSidebarCollapsed ? 'justify-center px-1' : 'px-3.5 gap-3'
                } ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-medium'
                }`}
                title={tab.label}
              >
                <tab.icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                {!isSidebarCollapsed && (
                  <span className="text-[11px] uppercase tracking-wider text-left truncate">{tab.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2 shrink-0 bg-slate-950/20">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-1`}>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0 uppercase overflow-hidden">
              {userPreferences[currentUser.username]?.avatarUrl ? (
                <img src={userPreferences[currentUser.username]?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                currentUser.name ? currentUser.name.split(' ').pop()?.slice(0, 2) : 'US'
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-200 truncate leading-tight">{currentUser.name}</div>
              </div>
            )}
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setIsUserSettingsModalOpen(true)}
              className="flex-1 py-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-center"
              title="Cài đặt cá nhân"
            >
              <User size={14} />
            </button>
            <button
              onClick={() => logout()}
              className="flex-1 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-center"
              title="Đăng xuất"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden relative">
        <header className="ddt-compact-header bg-white border-b px-3 md:px-4 h-14 flex items-center justify-between shrink-0 z-40 shadow-sm relative">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={toggleSidebar} 
              className="hidden lg:flex p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all cursor-pointer"
              title={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            >
              <Menu size={18} />
            </button>
            
            <div className="flex lg:hidden items-center gap-2 overflow-hidden"> 
                <div className="w-8 h-8 overflow-hidden flex items-center justify-center shrink-0 bg-slate-50 rounded-lg border border-slate-100"> 
                    <img src={LOGO_BASE64} alt="Logo" className="w-full h-full object-contain p-0.5" /> 
                </div> 
                <div className="flex flex-col min-w-0 justify-center"> 
                    <h1 className="text-[10px] font-black uppercase tracking-tight text-slate-800 leading-tight truncate">
                        PTN Điện - Điện tử
                    </h1> 
                </div> 
            </div>

            <span className="hidden lg:inline text-xs font-black uppercase text-slate-700 tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-3xs">
              {activeTab === 'dashboard' && 'Tổng quan'}
              {activeTab === 'requests' && 'Phiếu yêu cầu'}
              {activeTab === 'summary_log' && 'Sổ tổng hợp'}
              {activeTab === 'kqtn' && 'Kết quả thử nghiệm'}
              {activeTab === 'handover' && 'Giao nhận mẫu'}
              {activeTab === 'schedule_itd' && 'Lịch thử nghiệm ITD'}
              {activeTab === 'schedule_emc' && 'Lịch thử nghiệm EMC'}
              {activeTab === 'report_generator' && 'Lập báo cáo'}
              {activeTab === 'brands' && 'Quản lý thương hiệu'}
              {activeTab === 'customers' && 'Quản lý khách hàng'}
              {activeTab === 'products' && 'Quản lý loại sản phẩm'}
              {activeTab === 'activity_log' && 'Nhật ký hệ thống'}
              {activeTab === 'system_settings' && 'Thiết lập hệ thống'}
            </span>
          </div>
          <div className="flex items-center gap-1 md:gap-1.5 shrink-0 min-w-0">
            {renderSyncStatus()}

            <div className="relative shrink-0">
              <button
                onClick={() => setIsNotificationDropdownOpen(prev => !prev)}
                className="mobile-touch-target relative p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-slate-200/80 bg-slate-50/50"
                 title="Thông báo nghiệp vụ"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-white animate-pulse shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationDropdown 
                isOpen={isNotificationDropdownOpen} 
                onClose={() => setIsNotificationDropdownOpen(false)} 
                 onSelectNotification={handleSelectNotification}
               />
            </div>
            <button
              onClick={async () => {
                toast.loading("Đang tải lại toàn bộ dữ liệu từ đám mây...", { id: "cloud-reload" });
                await forceReload();
                await runDetailedSyncDiagnostic();
                toast.success("Đã tải lại toàn bộ dữ liệu từ Cloud!", { 
                  id: "cloud-reload",
                  action: {
                    label: "Xem nhật ký",
                    onClick: () => setSyncModalOpen(true)
                  }
                });
              }}
              className="mobile-touch-target flex items-center justify-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
              title="Tải lại toàn bộ dữ liệu từ đám mây và chạy chẩn đoán"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span className="hidden sm:inline-block text-[10px]">Tải lại dữ liệu</span>
            </button>
            <div className="hidden md:flex bg-slate-50 rounded-lg mr-1 border border-slate-100 scale-90">
               <button onClick={undo} disabled={past.length === 0} className="p-1.5 text-slate-500 hover:text-emerald-600 disabled:opacity-30" aria-label="Hoàn tác"><Undo2 size={14} aria-hidden="true" /></button>
               <div className="w-px bg-slate-200"></div>
               <button onClick={redo} disabled={future.length === 0} className="p-1.5 text-slate-500 hover:text-emerald-600 disabled:opacity-30" aria-label="Làm lại"><Redo2 size={14} aria-hidden="true" /></button>
            </div>
            {(activeTab === 'schedule_itd' || activeTab === 'schedule_emc') && currentUser.role === 'admin' && (
              <>
                <button 
                  onClick={() => {
                    const target = activeTab === 'schedule_emc' ? 'EMC' : 'ATD';
                    runAutoSchedule(target);
                  }} 
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors" 
                  aria-label={`Tối ưu lịch tự động`}
                >
                  <Sparkles size={14} aria-hidden="true"/>
                  <span className="hidden md:inline">Tối ưu {activeTab === 'schedule_emc' ? 'EMC' : 'An toàn điện'}</span>
                </button>
              </>
            )}
            
            <div className="flex items-center gap-1 md:gap-2 border-l pl-2 md:pl-3 ml-1 md:ml-1.5 shrink-0 border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] font-black text-slate-800 leading-tight">{currentUser.name}</div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-widest shadow-sm ${
                  currentUser.role === 'admin' ? 'bg-gradient-to-r from-red-50 to-orange-50 text-red-600 border-red-200/50' :
                  currentUser.role === 'tester' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border-blue-200/50' :
                  currentUser.role === 'office_clerk' ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200/50' :
                  currentUser.role === 'guest' ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600 border-purple-200/50' :
                  'bg-gradient-to-r from-slate-50 to-gray-50 text-slate-600 border-slate-200/50'
                }`}>
                  {currentUser.role === 'admin' ? 'Quản lý' : currentUser.role === 'tester' ? 'Thử nghiệm' : currentUser.role === 'office_clerk' ? 'Văn thư chuyên trách' : currentUser.role === 'guest' ? 'Khách hàng' : 'Quan sát'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsUserSettingsModalOpen(true)}
              className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm rounded-xl md:rounded-lg transition-all shrink-0"
              title="Cài đặt cá nhân"
            >
              {userPreferences[currentUser.username]?.avatarUrl ? (
                <img src={userPreferences[currentUser.username]?.avatarUrl} alt="Avatar" className="w-7 h-7 md:w-6 md:h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={18} className="md:size-4" strokeWidth={2.5} />
              )}
            </button>
            <button 
              onClick={() => logout()} 
              className="w-10 h-10 md:w-8 md:h-8 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:shadow-sm rounded-xl md:rounded-lg transition-all flex items-center justify-center shrink-0"
              title="Đăng xuất"
            >
              <LogOut size={18} className="md:size-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative" id="main-content">
        {activeTab === 'dashboard' && currentUser?.role !== 'guest' && currentUser?.role !== 'office_clerk' && (
          <DashboardView 
            requests={requests} 
            onReceiveRequest={() => setIsRequestModalOpen(true)} 
            onHandoverRequest={() => setIsHandoverModalOpen(true)}
            isAdmin={isAdmin} 
          />
        )}
        {activeTab === 'requests' && (
           <section className="p-3 md:p-6 h-full overflow-y-auto mobile-safe-bottom md:pb-10 bg-slate-50/50" aria-labelledby="requests-title">
              <div className="flex flex-col mb-4 md:mb-6 gap-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <h2 id="requests-title" className="text-base md:text-xl font-black text-slate-800 shrink-0">Danh sách Phiếu YC</h2>
                       {(currentUser.role === 'admin' || currentUser.role === 'tester' || currentUser.role === 'guest') && (
                          <button 
                             onClick={() => setIsRequestModalOpen(true)} 
                             className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold shadow-emerald-200 hover:bg-emerald-700 transition-colors" 
                             aria-label="Nhận phiếu yêu cầu mới"
                          > 
                             <Plus size={14} aria-hidden="true"/> 
                             <span>{currentUser.role === 'guest' ? 'Tạo Phiếu' : 'Nhận Phiếu'}</span> 
                          </button>
                       )}
                    </div>
                    <button 
                        onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
                        className={`md:hidden flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[10px] font-bold transition-all ${isMobileFilterExpanded ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}
                    >
                        <Filter size={14} />
                        Lọc
                    </button>
                 </div>
                 
                 <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all overflow-hidden md:overflow-visible ${isMobileFilterExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 md:max-h-none md:opacity-100'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <button 
                            onClick={() => setRequestCategoryFilter('ALL')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${requestCategoryFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                        >
                            Tất cả
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${requestCategoryFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{requests.length}</span>
                        </button>
                       <button 
                           onClick={() => setRequestCategoryFilter(requestCategoryFilter === 'EMC' ? 'ALL' : 'EMC')}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${requestCategoryFilter === 'EMC' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                       >
                           EMC
                           <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${requestCategoryFilter === 'EMC' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{requestStats.emc}</span>
                       </button>
                       <button 
                           onClick={() => setRequestCategoryFilter(requestCategoryFilter === 'ITD' ? 'ALL' : 'ITD')}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${requestCategoryFilter === 'ITD' ? 'bg-purple-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                       >
                           ITD
                           <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${requestCategoryFilter === 'ITD' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{requestStats.itd}</span>
                       </button>
                       <button 
                           onClick={() => setRequestCategoryFilter(requestCategoryFilter === 'ITDC' ? 'ALL' : 'ITDC')}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${requestCategoryFilter === 'ITDC' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                       >
                           ITDC
                           <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${requestCategoryFilter === 'ITDC' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{requestStats.itdc}</span>
                       </button>
                       <button 
                           onClick={() => setRequestCategoryFilter(requestCategoryFilter === 'UNENCODED' ? 'ALL' : 'UNENCODED')}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${requestCategoryFilter === 'UNENCODED' ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                       >
                           Chưa mã hoá
                           <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${requestCategoryFilter === 'UNENCODED' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{requestStats.unencoded}</span>
                       </button>
                    </div>
                    
                    <div className="flex-1 flex flex-wrap md:flex-nowrap items-center gap-3 md:justify-end">
                     <div className="relative flex-1 min-w-[150px] md:max-w-xs">
                         <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                         <input 
                             type="text" 
                             className="w-full bg-white border border-slate-200/60 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all" 
                             placeholder="Mã phiếu, số mã hóa, tem, khách, model, khác..." 
                             value={requestSearch}
                             onChange={(e) => setRequestSearch(e.target.value)}
                         />
                     </div>
                     <div className="relative min-w-[130px] shrink-0">
                         <select 
                             className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 appearance-none outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm pr-8"
                             value={requestDateFilter}
                             onChange={(e) => setRequestDateFilter(e.target.value as any)}
                         >
                             <option value="ALL">Mọi thời gian</option>
                             <option value="TODAY">Hôm nay</option>
                             <option value="THIS_WEEK">Tuần này</option>
                             <option value="THIS_MONTH">Tháng này</option>
                         </select>
                         <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     </div>
                     <div className="relative min-w-[130px] shrink-0">
                         <select 
                             className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 appearance-none outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm pr-8"
                             value={requestPriorityFilter}
                             onChange={(e) => setRequestPriorityFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                         >
                             <option value="ALL">Mọi ưu tiên</option>
                             <option value={PriorityLevel.URGENT}>Khẩn cấp</option>
                             <option value={PriorityLevel.VIP}>VIP</option>
                             <option value={PriorityLevel.HIGH}>Cao</option>
                             <option value={PriorityLevel.NORMAL}>Thường</option>
                         </select>
                         <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     </div>
                     <div className="relative min-w-[130px] shrink-0">
                         <select 
                             className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 appearance-none outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm pr-8"
                             value={requestSortOrder}
                             onChange={(e) => setRequestSortOrder(e.target.value as any)}
                         >
                             <option value="NEWEST">Mới nhất</option>
                             <option value="OLDEST">Cũ nhất</option>
                             <option value="DEADLINE">Sắp đến hạn</option>
                             <option value="LOT_DESC">Lô giảm dần</option>
                             <option value="LOT_ASC">Lô tăng dần</option>
                         </select>
                         <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     </div>
                 </div>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list"> 
                {paginatedRequests.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-200/60 shadow-sm transition-all">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            <div className="bg-white p-5 rounded-full shadow-sm border border-slate-100/50 relative z-10">
                                <ClipboardList size={48} className="text-emerald-500/80" strokeWidth={1.5} />
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-700 tracking-tight mb-2">Không tìm thấy phiếu yêu cầu</h3>
                        <p className="text-xs font-bold text-slate-500 max-w-xs text-center leading-relaxed">
                            Có thể các phiếu yêu cầu đã hoàn thành, bị xóa hoặc không khớp với bộ lọc hiện tại của bạn.
                        </p>
                        <button 
                            onClick={() => { setRequestSearch(''); setRequestCategoryFilter('ALL'); setRequestDateFilter('ALL'); }}
                            className="mt-6 px-6 py-2.5 bg-slate-50 hover:bg-white border border-slate-200/60 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                ) : (
                    paginatedRequests.map(([code, items]) => ( 
                        <div key={code} role="listitem">
                            <RequestGroupCard 
                                requestCode={code} 
                                items={items} 
                                onPrint={openPrintModal}
                                onEditGroup={handleEditGroup}
                                onDeleteGroup={handleOpenDeleteGroupModal}
                                onDeleteSample={handleOpenDeleteSampleModal}
                                onCreateHandover={handleCreateHandoverFromRequestGroup}
                                searchQuery={requestSearch}
                            />
                        </div> 
                    ))
                )}
              </div>
              
              {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-600 px-3">
                        Trang {currentPage} / {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
              )}
           </section>
        )}
        {activeTab === 'handover' && (
           <section className="p-3 md:p-6 h-full flex flex-col overflow-y-auto mobile-safe-bottom md:pb-10 bg-slate-50/50" aria-labelledby="handover-title">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-4">
                <div className="flex items-center gap-3">
                   <h2 id="handover-title" className="text-base md:text-xl font-black text-slate-800 shrink-0">Giao nhận mẫu</h2>
                   {(currentUser.role === 'admin' || currentUser.role === 'tester') && (
                      <button 
                         onClick={() => setIsHandoverModalOpen(true)} 
                         className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-blue-200 hover:bg-blue-700 transition-colors" 
                         aria-label="Lập biên bản bàn giao mẫu mới"
                      > 
                         <Plus size={14} aria-hidden="true"/> 
                         <span>Lập biên bản</span> 	
                      </button>
                   )}
                </div>
                
                <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all overflow-hidden md:overflow-visible ${isMobileFilterExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 md:max-h-none md:opacity-100'}`}>
                   <div className="flex flex-wrap items-center gap-2">
                       <button 
                           onClick={() => setHandoverTypeFilter('ALL')}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${handoverTypeFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                       >
                           Tất cả
                           <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${handoverTypeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{handoverDocs.length}</span>
                       </button>
                      <button 
                           onClick={() => setHandoverTypeFilter(HandoverType.RECEIVE)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${handoverTypeFilter === HandoverType.RECEIVE ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                      >
                          Nhận mẫu
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${handoverTypeFilter === HandoverType.RECEIVE ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{handoverReceiveCount}</span>
                      </button>
                      <button 
                           onClick={() => setHandoverTypeFilter(HandoverType.RETURN)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-95 ${handoverTypeFilter === HandoverType.RETURN ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-200/60'}`}
                      >
                          Trả mẫu
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${handoverTypeFilter === HandoverType.RETURN ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{handoverReturnCount}</span>
                      </button>
                   </div>
                   
                   <div className="flex-1 flex flex-wrap md:flex-nowrap items-center gap-3 md:justify-end">
                    <div className="relative flex-1 min-w-[150px] md:max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                             type="text" 
                             className="w-full bg-white border border-slate-200/60 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" 
                             placeholder="Số BB, khách hàng, sản phẩm, số lô..." 
                             value={handoverSearch}
                            onChange={(e) => setHandoverSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative min-w-[140px] shrink-0">
                        <select 
                             className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 appearance-none outline-none focus:ring-2 focus:ring-blue-500 shadow-sm pr-8"
                            value={handoverMonthFilter}
                            onChange={(e) => setHandoverMonthFilter(e.target.value)}
                        >
                            <option value="ALL">Tất cả thời gian</option>
                            {uniqueHandoverMonths.map(m => (
                                <option key={m} value={m}>Tháng {m.split('-')[1]}/{m.split('-')[0]}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {(handoverSearch || handoverTypeFilter !== 'ALL' || handoverMonthFilter !== 'ALL') && (
                        <button 
                            onClick={() => { setHandoverSearch(''); setHandoverTypeFilter('ALL'); setHandoverMonthFilter('ALL'); }}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white rounded-xl border border-slate-200 shadow-sm"
                            title="Xóa bộ lọc"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                </div>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
                    {filteredHandoverDocs.length === 0 ? (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-200/60 shadow-sm transition-all">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            <div className="bg-white p-5 rounded-full shadow-sm border border-slate-100/50 relative z-10">
                                <SearchCheck size={48} className="text-blue-500/80" strokeWidth={1.5} />
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-700 tracking-tight mb-2">Không tìm thấy biên bản</h3>
                        <p className="text-xs font-bold text-slate-500 max-w-xs text-center leading-relaxed">
                            Không có biên bản giao nhận nào khớp với bộ lọc hiện tại của bạn.
                        </p>
                      </div>
                    ) : (
                      filteredHandoverDocs.map(doc => (
                        <HandoverDocCard
                          key={doc.id}
                          doc={doc}
                          requests={requests}
                          handoverSearch={handoverSearch}
                          onViewDoc={handleViewHandoverDoc}
                          onDeleteDoc={handleOpenDeleteHandoverDocModal}
                          isAdmin={isAdmin}
                          expanded={!!expandedDocIds[doc.id]}
                          onToggleExpand={toggleDocExpand}
                        />
                      ))
                    )}
                  </div>
                </div>
                
                <WarehouseSidebar />
             </div>
          </section>
        )}
        {activeTab === 'summary_log' && (
          <SummaryLogView />
        )}
        {activeTab === 'kqtn' && (
          <KQTNView />
        )}
        {activeTab === 'report_generator' && (
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-sm text-slate-400">Đang tải...</div>}>
            <ReportGeneratorView />
          </Suspense>
        )}
        {activeTab === 'schedule_itd' && (
          <ATDScheduleView testCategory={TestCategory.ATD} />
        )}
        {activeTab === 'schedule_emc' && (
          <ScheduleView testCategory={TestCategory.EMC} />
        )}

        {activeTab === 'brands' && (
          <BrandsManagementView />
        )}
        {activeTab === 'customers' && (
          <CustomersManagementView />
        )}
        {activeTab === 'products' && (
          <ProductsManagementView />
        )}
        {activeTab === 'activity_log' && (
          <ActivityLogView currentUser={currentUser} systemUsers={systemUsers} />
        )}
        {activeTab === 'system_settings' && (
          <SystemSettingsView />
        )}
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-50 flex overflow-x-auto overflow-y-hidden justify-start sm:justify-around items-center pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_10px_rgba(0,0,0,0.03)] hide-scrollbar mobile-scroll-x" aria-label="Menu di động">
          {[
            {id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, roles: ['admin', 'tester', 'viewer']},
            {id: 'requests', label: 'Phiếu YC', icon: ClipboardList, roles: ['admin', 'tester', 'viewer', 'guest']},
            {id: 'summary_log', label: 'Tổng hợp', icon: SearchCheck, roles: ['admin', 'tester', 'viewer']},
            {id: 'handover', label: 'Giao nhận', icon: Truck, roles: ['admin', 'tester']},
            {id: 'schedule_itd', label: 'ITD', icon: CalendarIcon, roles: ['admin', 'tester', 'viewer']},
            {id: 'schedule_emc', label: 'EMC', icon: CalendarIcon, roles: ['admin', 'tester', 'viewer']},
            {id: 'kqtn', label: 'KQTN', icon: FileSpreadsheet, roles: ['admin', 'tester', 'viewer', 'office_clerk']},
             {id: 'report_generator', label: 'Báo cáo', icon: FileText, roles: ['admin', 'tester', 'viewer']},
             {id: 'activity_log', label: 'Nhật ký', icon: History},
             {id: 'system_settings', label: 'Thiết lập', icon: Settings}
          ]
          .filter(tab => {
            if (tab.id === 'system_settings') return canAccessSystemSettings;
            if (tab.id === 'activity_log') return canViewActivityLog;
            return !tab.roles || tab.roles.includes(currentUser.role);
          })
          .map(tab => {
              const isActive = activeTab === tab.id;
              return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as ActiveTab)} className={`mobile-touch-target relative flex flex-col items-center justify-center gap-1 p-2 shrink-0 min-w-[72px] transition-all duration-300 ${isActive ? 'text-emerald-600 scale-110 -translate-y-1' : 'text-slate-400 hover:text-slate-500'}`} aria-label={tab.label}>
                  {isActive && <div className="absolute -top-[1px] w-8 h-1 bg-emerald-500 rounded-b-full"></div>}
                  <tab.icon size={20} aria-hidden="true" className={isActive ? 'drop-shadow-sm' : ''} />
                  <span className={`text-[9px] font-black uppercase transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>{tab.label}</span>
              </button>
              )
          })}
      </nav>
    </div>
      <HandoverModal isOpen={isHandoverModalOpen} onClose={handleCloseHandoverModal} availableRequests={nonLogRequests} handoverDocs={handoverDocs} onSubmit={(doc) => { addHandoverDoc(doc); toast.success("Đã tạo biên bản thành công"); }} onAddRequests={(reqs) => { addRequests(reqs); toast.success(`Đã thêm ${reqs.length} mẫu.`); }} existingDoc={selectedHandoverDoc} initialRequestGroup={initialRequestGroupForHandover} />
      <HandoverDocsModal isOpen={isHandoverDocsModalOpen} onClose={() => setIsHandoverDocsModalOpen(false)} onSelectDoc={(doc) => handleViewHandoverDoc(doc)} onDeleteDoc={(doc) => handleOpenDeleteHandoverDocModal(doc)} />
      <RequestModal isOpen={isRequestModalOpen} onClose={() => { setIsRequestModalOpen(false); setEditingRequestGroup(undefined); }} onSubmit={(req) => { addRequest(req); toast.success(`Đã nhận phiếu ${req.requestCode}`); }} requests={nonLogRequests} existingGroup={editingRequestGroup} />
      <PrintFormModal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} requests={selectedRequestsForPrint} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      <UserSettingsModal isOpen={isUserSettingsModalOpen} onClose={() => setIsUserSettingsModalOpen(false)} />
      <SyncDiagnosticModal isOpen={isSyncModalOpen} onClose={() => setSyncModalOpen(false)} />
      <ConfirmDeleteModal isOpen={deleteGroupModal.isOpen} code={deleteGroupModal.code} count={deleteGroupModal.count} affectedDocs={deleteGroupModal.affectedDocs} onClose={() => setDeleteGroupModal({isOpen: false, code: null, count: 0, affectedDocs: []})} onConfirm={handleConfirmDeleteGroup} />
      <ConfirmDeleteModal isOpen={deleteSampleModal.isOpen} code={deleteSampleModal.name} count={1} affectedDocs={deleteSampleModal.affectedDocs} onClose={() => setDeleteSampleModal({isOpen: false, id: null, name: '', affectedDocs: []})} onConfirm={handleConfirmDeleteSample} isSingleSample={true} />
      <ConfirmDeleteHandoverModal isOpen={deleteHandoverDocModal.isOpen} doc={deleteHandoverDocModal.doc} onClose={() => setDeleteHandoverDocModal({ isOpen: false, doc: null })} onConfirm={handleConfirmDeleteHandoverDoc} />
      <AIChatBot />
    </div>
  );
}
// --- End of App.tsx ---
