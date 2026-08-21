// Author: Gemini
// OS support: Web/Node
// Description: Component displaying schedule view for EMC / ITD / ITDC test tasks

import React, { useState, useMemo, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useDroppable, 
  closestCenter, 
  PointerSensor, 
  TouchSensor, 
  MouseSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Search, 
  Filter, 
  X, 
  RotateCcw, 
  AlertTriangle, 
  Package, 
  Timer, 
  AlertOctagon, 
  PanelLeftClose, 
  PanelLeftOpen, 
  History as HistoryIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Award,
  Ban,
  GripVertical,
  Undo2,
  Redo2,
  RefreshCcw,
  Calendar,
  Info,
  AlertCircle,
  Check,
  PartyPopper,
  Clock,
  ClipboardList,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { 
  TestRequest, 
  RequestStatus, 
  PriorityLevel, 
  LAB_CONSTANTS,
  SampleStatus,
  Tester,
  TestCategory,
  HandoverType
} from '../types';
import { calculateInternalDeadline, sortPendingRequests, calculateRequestsLoad } from '../utils/scheduler'; 
import { formatDateVN, formatTestTime, removeAccents } from '../utils/formatter';

const ReturnReasonModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: (reason: string, keepHistory: boolean, isFail: boolean) => void }) => {
    const [reason, setReason] = useState('');
    const [isFail, setIsFail] = useState(false);
    const [keepHistory, setKeepHistory] = useState(false);
    
    useEffect(() => { 
        if(isOpen) { 
            setReason(''); 
            setIsFail(false); 
            setKeepHistory(false); 
        } 
    }, [isOpen]);
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-slate-100 p-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-6 text-rose-600"> 
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-2xl shadow-inner"><AlertTriangle size={24} aria-hidden="true" /></div>
                    <div>
                        <h3 id="return-modal-title" className="text-sm font-black uppercase tracking-widest text-slate-800">Trả về hàng chờ</h3> 
                        <p className="text-[11px] text-slate-500 font-bold">Cấu hình kết quả và lý do cho lần thử này</p>
                    </div>
                </div>
                
                <div className="space-y-3 mb-6">
                    <div 
                        onClick={() => setIsFail(!isFail)} 
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all shadow-sm active:scale-[0.98] ${isFail ? 'bg-red-50 border-red-200 shadow-red-100/50' : 'bg-slate-50 border-slate-200/60 hover:bg-white'}`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 shadow-sm ${isFail ? 'bg-red-500 border-red-500 text-white' : 'border-slate-300 bg-white'}`}>
                            {isFail && <Check size={10} strokeWidth={4} />}
                        </div>
                        <div className="flex-1">
                            <div className={`text-[11px] font-black uppercase tracking-wide ${isFail ? 'text-red-700' : 'text-slate-700'}`}>
                                Thử nghiệm Thất bại (Fail)
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                                {isFail 
                                    ? "Sẽ tính là 1 lần test thất bại và tăng số lần thử của mẫu thử." 
                                    : "Mẫu chưa thử xong hoặc dời lịch thông thường (không tăng số lần thử)."}
                            </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => setKeepHistory(!keepHistory)} 
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all shadow-sm active:scale-[0.98] ${keepHistory ? 'bg-amber-50 border-amber-200 shadow-amber-100/50' : 'bg-slate-50 border-slate-200/60 hover:bg-white'}`}
                    >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 shadow-sm ${keepHistory ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'}`}>
                            {keepHistory && <Check size={10} strokeWidth={4} />}
                        </div>
                        <div className="flex-1">
                            <div className={`text-[11px] font-black uppercase tracking-wide ${keepHistory ? 'text-amber-700' : 'text-slate-700'}`}>
                                Lưu lại vết để biết
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                                {keepHistory 
                                    ? "Để lại thẻ mờ (lịch sử) ở khu lịch thử nghiệm để tiện theo dõi." 
                                    : "Mặc định xóa hoàn toàn khỏi lịch thử nghiệm."}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nguyên nhân thất bại / Ghi chú (Không bắt buộc)</label>
                        <textarea 
                            className="w-full h-24 p-3.5 border border-slate-200/60 rounded-2xl text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none shadow-sm transition-all" 
                            placeholder="VD: Lỗi nguồn, không đạt tiêu chuẩn dòng rò..." 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            aria-label="Lý do hoặc ghi chú" 
                            autoFocus 
                        />
                    </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100/80">
                    <button onClick={onClose} className="px-5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-all">Bỏ qua</button>
                    <button 
                        onClick={() => onConfirm(reason, keepHistory, isFail)} 
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all" 
                    > 
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

const BufferedInput = ({ value, onCommit, className, placeholder, type = "text", ...props }: any) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => { setLocalValue(value || ''); }, [value]);
    const handleBlur = () => { if (localValue !== (value || '')) onCommit(localValue); };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
    return ( <input type={type} value={localValue} onChange={(e) => setLocalValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className={className} placeholder={placeholder} {...props} /> );
};

const EditableTestTime = ({ value, onCommit, className }: { value: number, onCommit: (val: number) => void, className?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(String(value || 0));

    useEffect(() => {
        if (!isEditing) setLocalValue(String(value || 0));
    }, [value, isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(localValue);
        if (!isNaN(parsed) && parsed !== value) {
            onCommit(parsed);
        } else {
            setLocalValue(String(value || 0));
        }
    };

    if (isEditing) {
        return (
            <input 
                type="number"
                autoFocus
                className={className}
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onPointerDown={e => e.stopPropagation()}
            />
        );
    }

    return (
        <span 
            className={`cursor-pointer ${className}`}
            onClick={() => setIsEditing(true)}
            onPointerDown={e => e.stopPropagation()}
        >
            {formatTestTime(value)}
        </span>
    );
};

interface RequestItemProps {
    request: TestRequest;
    testers: Tester[];
    isOverlay?: boolean;
    viewMode?: 'week' | 'month';
    onUnschedule?: (id: string) => void;
    onUpdateTester?: (id: string, name: string) => void;
    onUpdateEmc?: (id: string, emc: string) => void;
    onUpdateRequestCode?: (id: string, code: string) => void;
    onUpdateTestTime?: (id: string, time: number) => void;
    index?: number;
    totalItems?: number;
    onReorder?: (id: string, direction: 'up' | 'down') => void;
    listeners?: any;
    attributes?: any;
    style?: React.CSSProperties;
    isDragging?: boolean;
    timeRange?: string;
    isHighlighted?: boolean;
    isDimmed?: boolean;
    calendarDays?: string[];
    isScrolledTo?: boolean;
}

const EditableDeadline = ({ request, internalDeadline, onCommit, disabled }: { request: any, internalDeadline: Date | null, onCommit: (updates: any) => void, disabled: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const initialDateStr = useMemo(() => {
        if (!internalDeadline) return '';
        const y = internalDeadline.getFullYear();
        const m = String(internalDeadline.getMonth() + 1).padStart(2, '0');
        const d = String(internalDeadline.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, [internalDeadline]);
    const [localValue, setLocalValue] = useState(initialDateStr);
    
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(initialDateStr);
        }
    }, [initialDateStr, isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (localValue !== initialDateStr) {
            if (localValue) {
                const parts = localValue.split('-');
                if (parts.length === 3) {
                    const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    onCommit({ deadlineDate: formattedDate });
                }
            } else {
                onCommit({ deadlineDate: '' });
            }
        }
    };

    if (isEditing && !disabled) {
        return (
            <input 
                type="date"
                autoFocus
                className="text-[7px] font-bold text-blue-600 bg-white border border-blue-200 rounded px-1 py-0 outline-none"
                style={{ fontSize: '7px', padding: '0px 2px' }}
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onPointerDown={e => e.stopPropagation()}
            />
        );
    }

    return (
        <span 
            className={`text-[7px] font-black uppercase tracking-widest flex items-center gap-0.5 ${!disabled ? 'cursor-pointer hover:text-blue-600 hover:bg-slate-100 p-0.5 rounded' : ''}`}
            onClick={() => { if (!disabled) setIsEditing(true); }}
            onPointerDown={e => e.stopPropagation()}
        >
            <Timer size={6} /> {internalDeadline ? formatDateVN(internalDeadline).split('/').slice(0, 2).join('/') : 'Hạn: Chưa có'}
        </span>
    );
};

const RequestItem = React.memo(React.forwardRef<HTMLDivElement, RequestItemProps>(({ 
    request, testers, isOverlay, viewMode = 'week', onUnschedule, onUpdateTester, onUpdateEmc, onUpdateRequestCode, onUpdateTestTime, index, totalItems, onReorder, listeners, attributes, style, isDragging, timeRange, isHighlighted, isDimmed, calendarDays, isScrolledTo
}, ref) => {
    const { currentUser, updateRequest, settings, products, moveRequest } = useStore();
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    
    const matchedProduct = React.useMemo(() => {
        return products.find(p => String(p.name || '').trim().toLowerCase() === String(request.type || '').trim().toLowerCase());
    }, [products, request.type]);
    
    const defaultTestTime = matchedProduct ? (matchedProduct.testTimeATD || 0) : 0;
    const currentTestTime = request.testTimeATD !== undefined ? request.testTimeATD : defaultTestTime;
    
    const isAdminUser = currentUser?.role === 'admin' || 
                        currentUser?.position?.toLowerCase().includes('quản lý') || 
                        currentUser?.position?.toLowerCase().includes('trưởng phòng');
    const isTester = currentUser?.role === 'tester';
    
    const isAtdTester = React.useMemo(() => {
        if (!currentUser) return false;
        return !!settings?.defaultTestersAtd?.includes(currentUser.name);
    }, [currentUser, testers, settings]);
    
    const isAtdRequest = request.testCategory === TestCategory.ATD || request.testCategory === TestCategory.BOTH;
    const canEdit = isAdminUser || (isTester && isAtdTester && isAtdRequest);
    const canUnschedule = isAdminUser || (isTester && isAtdTester && isAtdRequest);
    const canEditTester = canEdit;
    const canEditTime = isAdminUser || (isTester && isAtdTester && isAtdRequest);
    
    const isClaimedByMe = !!(currentUser?.name && request.testerName === currentUser.name);
    const canDrag = isAdminUser || (
        isTester && isAtdTester && isAtdRequest && (
            request.scheduledDate ? true : isClaimedByMe
        )
    );
    
    const typeStr = String(request.type);
    const isRetry = (request.retryCount || 0) > 0;
    const isCancelled = request.status === RequestStatus.CANCELLED;
    const today = new Date(); today.setHours(0,0,0,0);
    const internalDeadline = calculateInternalDeadline(request);
    const isOverdue = internalDeadline ? (internalDeadline < today && request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.RESULTS_APPROVED) : false;
    const isDueToday = internalDeadline ? (internalDeadline.getTime() === today.getTime()) : false;
    
    const safeTesters = Array.isArray(testers) ? testers.filter(t => t && t.name) : [];
    const currentTester = safeTesters.find(t => t.name === request.testerName) || 
        (request.testerName ? { name: request.testerName, shortName: request.testerName.split(' ').pop() || request.testerName, colorClass: 'bg-slate-100 text-slate-700 border-slate-300 font-bold' } : { name: 'Chưa giao', shortName: '??', colorClass: 'bg-slate-100 text-slate-500' });
    
    const dropdownTesters = [...safeTesters];
    if (request.testerName && !dropdownTesters.some(t => t.name === request.testerName)) {
        dropdownTesters.push({
            name: request.testerName,
            shortName: request.testerName.split(' ').pop() || request.testerName,
            colorClass: 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
        });
    }
    
    const hasRealTester = !!(request.scheduledDate && request.testerName && request.testerName !== 'Chưa giao' && request.testerName !== 'Khác');
    const testerBgClass = currentTester?.colorClass 
        ? currentTester.colorClass.split(' ').find(cls => cls.startsWith('bg-')) || '' 
        : '';
    const testerTextClass = currentTester?.colorClass 
        ? currentTester.colorClass.split(' ').find(cls => cls.startsWith('text-')) || '' 
        : '';
    const testerBorderClass = currentTester?.colorClass 
        ? currentTester.colorClass.split(' ').find(cls => cls.startsWith('border-')) || '' 
        : '';
    
    const isFirst = index === 0;
    const isLast = totalItems !== undefined && index === totalItems - 1;
    const canSort = onReorder && !isOverlay && request.scheduledDate && !isCancelled;

    const hasNote = !!request.note;
    const handleShowNote = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (request.note) {
            toast(
                <div className="flex flex-col gap-1">
                    <div className="font-bold text-amber-600 flex items-center gap-2">
                        <Info size={16} /> Ghi chú: {request.modelName}
                    </div>
                    <div className="text-sm text-slate-600 bg-amber-50 p-2 rounded border border-amber-100">
                        {request.note}
                    </div>
                </div>, 
                { duration: 4000 }
            );
        }
    };

    const displayReason = isCancelled && request.note ? String(request.note).replace(/\[.*?\]/g, '').trim() : '';

    const handlePrintEncodeNumber = (e: React.MouseEvent) => {
        e.stopPropagation();
        const encodeNumber = request.atdEncodeNumber || request.itdEncodeNumber || request.encodeNumber || request.emcEncodeNumber || request.requestCode;
        const seal = request.sealStamp || '';
        const productType = request.type || '';
        const brand = request.brand || '';
        const modelName = request.modelName || '';
        const productInfo = [productType, brand, modelName].filter(Boolean).join(' - ');
        
        const isLargeProduct = (pType: string, bName: string, mName: string): boolean => {
            const text = [pType, bName, mName].filter(Boolean).join(' ').toLowerCase();
            if (!text) return false;
            const largeKeywords = [
                'điều hòa', 'điều hoà', 'dieu hoa',
                'tủ lạnh', 'tu lanh',
                'bếp từ', 'bep tu',
                'bếp điện từ', 'bep dien tu',
                'bếp hồng ngoại', 'bep hong ngoai',
                'bếp điện', 'bep dien',
                'bếp', 'bep',
                'máy giặt', 'may giat',
                'tủ đông', 'tu dong',
                'tủ mát', 'tu mat',
                'tủ sấy', 'tu say',
                'tivi', 'tv'
            ];
            return largeKeywords.some(kw => text.includes(kw));
        };

        const isLarge = isLargeProduct(productType, brand, modelName);
        const codeFontSize = isLarge ? '100px' : '40px';
        const codeMarginBottom = isLarge ? '6px' : '3px';

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title></title>
                        <style>
                            @page { 
                                size: portrait; 
                                margin: 0; 
                            }
                            body { 
                                font-family: 'Calibri', sans-serif; 
                                margin: 0; 
                                padding: 4.2mm 4.3mm 4.3mm 4.2mm; 
                                box-sizing: border-box;
                                width: 100vw;
                                overflow: hidden;
                            }
                            .code { font-size: ${codeFontSize}; font-weight: bold; margin-bottom: ${codeMarginBottom}; line-height: 1; white-space: nowrap; letter-spacing: -2px; }
                            .footer { font-size: 28px; font-weight: bold; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; width: 100%; }
                            .footer-seal, .footer-product { display: block; width: 100%; white-space: nowrap; overflow: hidden; }
                            .footer-product { font-style: italic; }
                            @media print {
                                body { -webkit-print-color-adjust: exact; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="code">${encodeNumber}</div>
                        <div class="code">${encodeNumber}</div>
                        <div class="code">${encodeNumber}</div>
                        <div class="code">${encodeNumber}</div>
                        <div class="footer">
                            <span class="footer-seal">${seal}</span>
                            <span class="footer-product">${productInfo}</span>
                        </div>
                        <script>
                            const adjustFontSize = (el) => {
                                let fontSize = 28;
                                el.style.fontSize = fontSize + 'px';
                                while (el.scrollWidth > el.clientWidth && fontSize > 10) {
                                    fontSize -= 1;
                                    el.style.fontSize = fontSize + 'px';
                                }
                            };
                            document.querySelectorAll('.footer-seal, .footer-product').forEach(adjustFontSize);
                            setTimeout(() => {
                                window.print();
                                setTimeout(() => window.close(), 500);
                            }, 50);
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    if (viewMode === 'month' && !isOverlay) {
        const stripColor = isCancelled 
            ? 'bg-slate-100 text-slate-400 border-slate-200' 
            : isOverdue 
                ? 'bg-status-overdue text-status-overdue-fg border-status-overdue-fg/20' 
                : hasRealTester
                    ? `${testerBgClass} ${testerTextClass} ${testerBorderClass}`
                    : 'bg-slate-100 text-slate-600 border-slate-200';
        return (
            <div id={`request-card-${request.id}`} ref={ref} style={style} {...listeners} {...attributes} className={`flex items-center gap-1 p-0.5 mb-0.5 rounded border text-[9px] cursor-grab active:cursor-grabbing hover:brightness-95 transition-all ${stripColor} ${isCancelled ? 'opacity-60 grayscale' : ''} ${isDimmed ? 'opacity-20 grayscale pointer-events-none' : ''} ${isHighlighted ? 'ring-2 ring-emerald-500 bg-emerald-100 font-black z-10' : ''} ${isScrolledTo ? 'ring-4 ring-rose-500 border-rose-500 scale-[1.05] z-30 animate-pulse bg-rose-100 shadow-lg' : ''}`}>
                <div className={`w-1 h-1 rounded-full shrink-0 ${isCancelled ? 'bg-slate-400' : (isOverdue ? 'bg-status-overdue-fg' : (hasRealTester ? 'bg-current' : 'bg-slate-500'))}`}></div>
                <span className={`font-bold truncate flex-1 leading-none ${isCancelled ? 'line-through decoration-slate-400' : ''}`}>
                    {request.modelName} {request.isNewSampleNoPYC ? '(Chưa PYC)' : ''}
                </span>
                {!isCancelled && <span className="text-[7px] font-black uppercase opacity-70">{currentTester?.shortName}</span>}
            </div>
        );
    }

    let typeLabel = typeStr;
    const idx = index || 0;
    const borderLeftColor = isCancelled ? 'border-l-slate-300' : (isOverdue ? 'border-l-status-overdue-fg' : 'border-l-blue-400');
    const bgClass = isCancelled 
        ? 'bg-slate-50/40 border-dashed border-slate-200/60' 
        : isOverdue 
            ? (idx % 2 === 0 ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/40' : 'bg-rose-100/40 border-rose-300 hover:bg-rose-100/60')
            : hasRealTester
                ? `${testerBgClass} ${testerTextClass} hover:brightness-[0.98] shadow-xs`
                : (idx % 2 === 0 ? 'bg-white border-blue-200 hover:bg-slate-50/50' : 'bg-blue-50 border-blue-300/80 hover:bg-blue-100/60 shadow-xs');
    const shadowClass = isCancelled ? 'shadow-none' : (isOverlay ? 'shadow-2xl scale-105 rotate-1 z-50 ring-2 ring-emerald-400 opacity-95' : 'shadow-sm');
    const vipEffect = !isCancelled && request.priority >= PriorityLevel.VIP ? 'ring-1 ring-purple-300' : '';
    const cancelledEffect = isCancelled ? 'opacity-30 grayscale hover:opacity-60 transition-opacity duration-200' : '';

    const dimEffect = isDimmed ? 'opacity-20 grayscale pointer-events-none' : '';
    const highlightEffect = isHighlighted ? 'ring-2 ring-emerald-500 shadow-md z-10 scale-[1.01]' : '';
    const finalBgClass = isHighlighted ? 'bg-emerald-50/90 border-emerald-400' : bgClass;
    const scrollHighlightEffect = isScrolledTo ? 'ring-4 ring-rose-500 border-rose-500 scale-[1.04] z-30 shadow-2xl animate-pulse bg-rose-50' : '';

    const cardBorderClass = isCancelled 
        ? 'border-slate-200/60' 
        : hasRealTester && !isOverdue
            ? testerBorderClass
            : 'border-slate-300/80';

    return (
        <div id={`request-card-${request.id}`} ref={ref} style={style} className={`relative rounded-lg p-1 border ${cardBorderClass} border-l-[3px] transition-all mb-1 flex gap-1 ${borderLeftColor} ${finalBgClass} shadow-sm hover:shadow ${vipEffect} ${cancelledEffect} ${dimEffect} ${highlightEffect} ${scrollHighlightEffect} touch-manipulation group/item`} role="listitem" {...attributes} >
            {canEdit && (
                <div className="flex flex-col items-center justify-center gap-0 border-r border-slate-200/60 pr-1 mr-0.5">
                    {canSort && canDrag && ( <button onClick={(e) => { e.stopPropagation(); onReorder(request.id, 'up'); }} onPointerDown={(e) => e.stopPropagation()} disabled={isFirst} className={`p-0.5 rounded hover:bg-slate-200 hover:text-emerald-600 text-slate-400 transition-colors ${isFirst ? 'opacity-0 pointer-events-none' : ''}`}> <ChevronUp size={10} strokeWidth={4} /> </button> )}
                    {canDrag ? (
                        <div {...listeners} className={`text-slate-400 p-1 -m-0.5 ${!isCancelled ? 'cursor-grab active:cursor-grabbing hover:text-emerald-600' : 'cursor-default'}`}> <GripVertical size={12} /> </div>
                    ) : (
                        <div className="text-slate-200 p-1 -m-0.5 cursor-not-allowed opacity-40"> <GripVertical size={12} /> </div>
                    )}
                    {canSort && canDrag && ( <button onClick={(e) => { e.stopPropagation(); onReorder(request.id, 'down'); }} onPointerDown={(e) => e.stopPropagation()} disabled={isLast} className={`p-0.5 rounded hover:bg-slate-200 hover:text-emerald-600 text-slate-400 transition-colors ${isLast ? 'opacity-0 pointer-events-none' : ''}`}> <ChevronDown size={10} strokeWidth={4} /> </button> )}
                </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5" {...(canEdit && canDrag && !isCancelled ? listeners : {})}>
                <div className="grid grid-cols-[1fr_auto] items-start gap-1">
                    <div className="flex items-center flex-wrap gap-1 min-w-0">
                        {isCancelled || !canEdit ? (
                            <>
                                <span className="text-[8px] font-black text-slate-500 px-1 py-0.5 uppercase tracking-widest bg-slate-100 rounded border border-slate-200">{request.requestCode}</span>
                                {request.emcEncodeNumber && <span className="text-[8px] font-black text-blue-700 bg-blue-50 px-1 py-0.5 rounded uppercase border border-blue-100 shadow-sm" title="Mã EMC">{request.emcEncodeNumber}</span>}
                                {request.atdEncodeNumber && <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded uppercase border border-emerald-100 shadow-sm" title="Mã ITDC">{request.atdEncodeNumber}</span>}
                                {request.itdEncodeNumber && <span className="text-[8px] font-black text-purple-700 bg-purple-50 px-1 py-0.5 rounded uppercase border border-purple-100 shadow-sm" title="Mã ITD">{request.itdEncodeNumber}</span>}
                            </>
                        ) : (
                            <>
                                <div className="relative w-fit min-w-[50px] shrink-0" onPointerDown={(e) => e.stopPropagation()}> <BufferedInput className="w-full text-[8px] font-black text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none uppercase transition-all text-center shadow-sm" value={request.requestCode} onCommit={(val: string) => onUpdateRequestCode && onUpdateRequestCode(request.id, val)} /> </div>
                                {request.emcEncodeNumber && (
                                    <div className="relative w-fit min-w-[60px]" onPointerDown={(e) => e.stopPropagation()}> <BufferedInput className="w-full bg-blue-50 text-[8px] font-black text-blue-700 placeholder:text-blue-300 outline-none px-1 py-0.5 rounded border border-blue-100 uppercase focus:bg-white focus:ring-1 ring-blue-500 transition-all shadow-sm" value={request.emcEncodeNumber || ''} placeholder="Mã EMC" onCommit={(val: string) => onUpdateEmc && onUpdateEmc(request.id, val)} /> </div>
                                )}
                                {request.atdEncodeNumber && <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded uppercase border border-emerald-100 shadow-sm" title="Mã ITDC">{request.atdEncodeNumber}</span>}
                                {request.itdEncodeNumber && <span className="text-[8px] font-black text-purple-700 bg-purple-50 px-1 py-0.5 rounded uppercase border border-purple-100 shadow-sm" title="Mã ITD">{request.itdEncodeNumber}</span>}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                        {hasNote && (
                            <button 
                                onClick={handleShowNote} 
                                onPointerDown={(e) => e.stopPropagation()}
                                className="text-amber-500 hover:text-amber-600 transition-colors p-0.5" 
                                title="Xem ghi chú"
                            >
                                <AlertCircle size={10} fill="currentColor" className="text-amber-100" />
                            </button>
                        )}
                        {!isCancelled && (isRetry || canEdit) && (
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!canEdit) return;
                                    const currentCount = request.retryCount || 0;
                                    const val = window.prompt(`[Admin] Thay đổi số lần test Fail (tích tụ) cho mẫu ${request.modelName}:`, String(currentCount));
                                    if (val !== null) {
                                        const num = parseInt(val, 10);
                                        if (!isNaN(num) && num >= 0) {
                                            updateRequest(request.id, { retryCount: num });
                                            toast.success(`Đã cập nhật số lần test Fail = ${num}`);
                                        } else {
                                            toast.error("Vui lòng nhập số nguyên không âm (>= 0)");
                                        }
                                    }
                                }}
                                className={`w-4 h-4 rounded-full font-black text-[8px] flex items-center justify-center border border-white shadow-sm shrink-0 transition-transform hover:scale-110 active:scale-95 ${
                                    (request.retryCount || 0) > 0 
                                        ? 'bg-red-600 text-white cursor-pointer' 
                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer'
                                }`}
                                title={canEdit ? `Số lần test Fail: ${request.retryCount || 0} (Click để Admin thay đổi)` : `Số lần thất bại: ${request.retryCount || 0}`}
                            >
                                {request.retryCount || 0}
                            </button>
                        )}
                        {!isCancelled && isOverdue && <AlertOctagon size={10} className="text-status-overdue-fg animate-pulse" />} 
                        {!isCancelled && request.priority >= PriorityLevel.VIP && <Award size={10} className="text-purple-500" />} 
                        {!isCancelled && (
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handlePrintEncodeNumber}
                                className="text-slate-400 hover:text-blue-500 transition-colors p-0.5 active:scale-90"
                                title="In mã hóa"
                            >
                                <Printer size={10} strokeWidth={3} />
                            </button>
                        )}
                        {!isCancelled && canDrag && calendarDays && calendarDays.length > 0 && (
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setIsMoveModalOpen(true); }}
                                className="text-slate-400 hover:text-emerald-500 transition-colors p-0.5 active:scale-90"
                                title="Xếp lịch nhanh"
                            >
                                <Calendar size={10} strokeWidth={3} />
                            </button>
                        )}
                        {onUnschedule && !isOverlay && canUnschedule && ( <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onUnschedule(request.id); }} className="text-slate-400 hover:text-red-500 transition-colors p-0.5 active:scale-90" title={isCancelled ? "Xóa vết lịch sử" : (!request.scheduledDate ? "Gỡ bỏ mẫu" : "Gỡ lịch")}> <X size={10} strokeWidth={4} /> </button> )}
                    </div>
                </div>
                
                <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="flex items-baseline gap-1">
                        {isCancelled && <span className="text-[7px] font-black text-slate-400 uppercase mr-0.5 shrink-0 tracking-widest">[LS]</span>}
                        <h4 className={`font-black text-[9px] leading-tight truncate flex items-center gap-1 min-w-0 ${isCancelled ? 'text-slate-500 italic' : 'text-slate-800'}`} title={request.modelName}>
                            <span className="truncate">{request.modelName}</span>
                            {request.isNewSampleNoPYC && (
                                <span className="text-[7px] font-black text-amber-700 bg-amber-100 px-1 py-0 rounded border border-amber-200 uppercase tracking-wider shrink-0 animate-pulse">
                                    Chưa PYC
                                </span>
                            )}
                        </h4> 
                        {request.brand && ( <span className="text-[7px] font-bold text-slate-500 uppercase truncate shrink-0 max-w-[60px]">{request.brand}</span> )} 
                    </div>
                    {isCancelled && displayReason && (
                        <div className="text-[7px] font-bold text-orange-600 italic truncate w-full flex items-center gap-1" title={displayReason}>
                            <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0"></span>
                            {displayReason}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center gap-1 mt-0.5">
                    <div className="flex flex-wrap items-center gap-1 min-w-0">
                        {!isCancelled && (
                            <div className="flex items-center shrink-0 max-w-full" onPointerDown={(e) => e.stopPropagation()}>
                                {canEdit ? (
                                    <input 
                                        type="text" 
                                        placeholder="Tem NP..."
                                        className="w-[145px] sm:w-[175px] md:w-[210px] text-[7px] font-black tracking-wider uppercase text-slate-700 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded px-1.5 py-0 outline-none transition-all shadow-sm"
                                        value={request.sealStamp || ''}
                                        onChange={(e) => {
                                            updateRequest(request.id, { sealStamp: e.target.value });
                                        }}
                                    />
                                ) : (
                                    request.sealStamp ? (
                                        <span className="text-[7px] font-black tracking-wider uppercase text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0 shadow-sm inline-block whitespace-nowrap">
                                            {request.sealStamp}
                                        </span>
                                    ) : null
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-0.5 shrink-0 max-w-[130px] md:max-w-[170px]">
                        {!isCancelled && (
                            <span className="text-[7px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0 rounded tracking-widest shadow-sm">
                                {formatTestTime(currentTestTime)}
                            </span>
                        )}
                        <span className={`text-[7px] font-black uppercase px-1 py-0 rounded tracking-widest shadow-sm border ${isCancelled ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{typeLabel}</span>
                    </div>
                </div>

                <div className="grid grid-cols-[auto_auto] justify-between items-center gap-1 mt-0.5 pt-0.5 border-t border-slate-100/60">
                    <div className="flex items-center gap-1 shrink-0"> 
                        {!request.scheduledDate ? (
                            (!request.testerName || request.testerName === 'Khác' || request.testerName === 'Chưa giao') && isTester && isAtdTester && (
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateTester && onUpdateTester(request.id, currentUser.name);
                                    }}
                                    className="flex items-center gap-0.5 px-1 py-0 rounded text-[7px] font-black bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 uppercase tracking-widest shadow-sm active:scale-95 shrink-0"
                                    title="Nhận công việc này cho bản thân"
                                >
                                    Nhận
                                </button>
                            )
                        ) : (
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!canEdit) return;
                                    const isCompleted = [
                                        RequestStatus.COMPLETED,
                                        RequestStatus.RESULTS_APPROVED,
                                        RequestStatus.RESULTS_SUBMITTED
                                    ].includes(request.status);
                                    if (isCompleted) {
                                        updateRequest(request.id, { status: RequestStatus.SCHEDULED });
                                        toast.success("Đã chuyển trạng thái: Chờ thử nghiệm");
                                    } else {
                                        updateRequest(request.id, { status: RequestStatus.COMPLETED });
                                        toast.success("Đã thử nghiệm xong");
                                    }
                                }}
                                className={`flex items-center gap-0.5 px-1 py-0 rounded text-[7px] font-black uppercase tracking-widest border transition-all shadow-sm active:scale-95 ${
                                    [
                                        RequestStatus.COMPLETED,
                                        RequestStatus.RESULTS_APPROVED,
                                        RequestStatus.RESULTS_SUBMITTED
                                    ].includes(request.status)
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                                } ${!canEdit ? 'opacity-75 cursor-default' : ''}`}
                            >
                                <span className="w-1 h-1 rounded-full shrink-0 animate-pulse bg-current"></span>
                                {[
                                    RequestStatus.COMPLETED,
                                    RequestStatus.RESULTS_APPROVED,
                                    RequestStatus.RESULTS_SUBMITTED
                                ].includes(request.status) ? "Xong" : "Chờ thử"}
                            </button> 
                        )}
                        {request.receivedDate && (
                            <div className="flex items-center gap-0.5 px-1 py-0 rounded text-[7px] font-black uppercase tracking-widest border border-slate-200 shadow-sm bg-slate-50 text-slate-500" title="Ngày nhận mẫu">
                                <Calendar size={6} /> {formatDateVN(request.receivedDate).split('/').slice(0, 2).join('/')}
                            </div>
                        )}
                        {internalDeadline && (
                            <div className={`flex items-center rounded text-[7px] font-black uppercase tracking-widest border shadow-sm ${isCancelled ? 'bg-slate-100 border-slate-200 text-slate-400' : (isOverdue ? 'bg-status-overdue-fg text-white border-status-overdue-fg' : isDueToday ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'border-slate-200 bg-slate-50 text-slate-500')}`}>
                                <EditableDeadline 
                                    request={request}
                                    internalDeadline={internalDeadline}
                                    disabled={!(isAdminUser || (isTester && isAtdTester && isAtdRequest))}
                                    onCommit={(updates: any) => updateRequest(request.id, updates)}
                                />
                            </div>
                        )} 
                    </div>
                    <div className="relative min-w-[50px] max-w-[70px]" onPointerDown={(e) => e.stopPropagation()}> 
                        {!isCancelled && canEditTester ? (
                            <>
                                <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" value={request.testerName || ''} onChange={(e) => onUpdateTester && onUpdateTester(request.id, e.target.value)}> <option value="">Chưa giao</option> {dropdownTesters.map(t => <option key={t.name} value={t.name}>{t.name}</option>)} </select> 
                                <div className={`flex items-center justify-between gap-0.5 text-[7px] font-black tracking-widest uppercase px-1 py-0 rounded border transition-all truncate shadow-sm ${currentTester?.colorClass}`}> <span className="truncate">{currentTester?.shortName}</span> <ChevronDown size={6} className="opacity-60" /> </div>
                            </>
                        ) : (
                            <div className={`flex items-center justify-center gap-0.5 text-[7px] font-black tracking-widest uppercase px-1 py-0 rounded border transition-all truncate shadow-sm ${currentTester?.colorClass || 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                <span className="truncate">{currentTester?.shortName}</span>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
            {isMoveModalOpen && calendarDays && (
                <QuickMoveModal
                    isOpen={isMoveModalOpen}
                    onClose={() => setIsMoveModalOpen(false)}
                    request={request}
                    calendarDays={calendarDays}
                    testCategory={request.testCategory || TestCategory.ATD}
                    onMove={(targetDate, chamber) => {
                        moveRequest(request.id, targetDate, undefined, undefined, undefined, chamber);
                        toast.success("Đã di chuyển lịch thành công");
                    }}
                />
            )}
        </div>
    );
}),
(prevProps, nextProps) => {
    if (prevProps.request !== nextProps.request) return false;
    if (prevProps.isOverlay !== nextProps.isOverlay) return false;
    if (prevProps.viewMode !== nextProps.viewMode) return false;
    if (prevProps.index !== nextProps.index) return false;
    if (prevProps.totalItems !== nextProps.totalItems) return false;
    if (prevProps.isDragging !== nextProps.isDragging) return false;
    if (prevProps.timeRange !== nextProps.timeRange) return false;
    if (prevProps.isHighlighted !== nextProps.isHighlighted) return false;
    if (prevProps.isDimmed !== nextProps.isDimmed) return false;
    if (prevProps.isScrolledTo !== nextProps.isScrolledTo) return false;
    if (prevProps.calendarDays !== nextProps.calendarDays) {
        if (prevProps.calendarDays?.join(',') !== nextProps.calendarDays?.join(',')) return false;
    }
    if (prevProps.style !== nextProps.style) {
        if (JSON.stringify(prevProps.style) !== JSON.stringify(nextProps.style)) return false;
    }
    return true;
});
RequestItem.displayName = 'RequestItem';

const SortableRequest = (props: any) => {
    const { currentUser, testers, settings } = useStore();
    const isAdminUser = currentUser?.role === 'admin' || 
                        currentUser?.position?.toLowerCase().includes('quản lý') || 
                        currentUser?.position?.toLowerCase().includes('trưởng phòng');
    const isTester = currentUser?.role === 'tester';
    
    const isAtdTester = React.useMemo(() => {
        if (!currentUser) return false;
        return !!settings?.defaultTestersAtd?.includes(currentUser.name);
    }, [currentUser, testers, settings]);

    const isAtdRequest = props.request.testCategory === TestCategory.ATD || props.request.testCategory === TestCategory.BOTH;
    const canEdit = isAdminUser || (isTester && isAtdTester && isAtdRequest);
    const isClaimedByMe = !!(currentUser?.name && props.request.testerName === currentUser.name);
    const canDrag = isAdminUser || (
        isTester && isAtdTester && isAtdRequest && (
            props.request.scheduledDate ? true : isClaimedByMe
        )
    );

    const disabled = props.request.status === RequestStatus.CANCELLED || !canEdit || !canDrag;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.request.id, disabled, data: { request: props.request } });
    const style = { transform: transform ? CSS.Translate.toString(transform) : undefined, transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 999 : 'auto' };
    return ( <RequestItem ref={setNodeRef} style={style} listeners={listeners} attributes={attributes} isDragging={isDragging} {...props} /> );
};

const SortablePendingZone: React.FC<{ children: React.ReactNode, id: string, items: string[] }> = ({ children, id, items }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'pending-zone' });
  return (
     <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
       <div className="relative group/pending flex flex-col h-auto md:h-full min-h-[60px] md:min-h-[300px] max-h-[180px] md:max-h-none transition-all" role="region" aria-label="Danh sách hàng chờ">
         <div ref={setNodeRef} className={`flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-1 pb-2 px-1 md:px-0 transition-colors rounded-xl border-2 ${isOver ? 'bg-emerald-50/50 border-emerald-400 border-dashed' : 'border-transparent'}`}>
           {children}
           {items.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full min-h-[60px] text-slate-400 opacity-60">
               <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-1"><ClipboardList size={16}/></div>
              <span className="text-[9px] font-black uppercase tracking-wider">Hàng chờ trống</span>
             </div>
           )}
         </div>
       </div>
     </SortableContext>
   );
};

const SortableDroppableDay: React.FC<any> = ({ date, dayName, isPeak, isHoliday, holidayName, capacity, usedHours, children, isDisabled, viewMode, items, requests = [], testers = [] }) => {
  const { setNodeRef, isOver } = useDroppable({ id: date || 'disabled', disabled: isDisabled });
  
  const stats = React.useMemo(() => {
      let total = 0;
      const testerCounts: Record<string, number> = {};
      requests.forEach((r: TestRequest) => {
         if (r.status === RequestStatus.CANCELLED) return;
         total += r.quantity || 1;
         const tName = r.testerName || 'Chưa giao';
         testerCounts[tName] = (testerCounts[tName] || 0) + 1;
      });
      return { total, testerCounts };
  }, [requests]);

  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const fullDayName = dateObj.toLocaleDateString('vi-VN', { weekday: 'long' });
  const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
  
  let headerClass = 'bg-white border-b border-slate-100'; 
  let titleClass = 'text-slate-500'; 
  let containerClass = '';
  
  const visualPeak = isPeak || (usedHours > LAB_CONSTANTS.CAPACITY_NORMAL);
  const displayCapacity = visualPeak ? LAB_CONSTANTS.CAPACITY_PEAK : LAB_CONSTANTS.CAPACITY_NORMAL;
  
  if (isHoliday) {
      headerClass = 'bg-red-100 border-b border-red-200';
      titleClass = 'text-red-600';
      containerClass = 'bg-red-50/50';
  } else if (dayOfWeek === 0) { 
      headerClass = 'bg-rose-50 border-b border-rose-100'; titleClass = 'text-rose-500'; 
  } else if (dayOfWeek === 6) { 
      headerClass = 'bg-blue-50 border-b border-blue-100'; titleClass = 'text-blue-500'; 
  } else if (visualPeak) { 
      headerClass = 'bg-orange-50 border-b border-orange-100'; titleClass = 'text-orange-500'; 
  }
  
  const activeTesters = (testers || []).filter((t: Tester) => t && t.name && (stats.testerCounts[t.name] || 0) > 0);
  const displayedTesters = activeTesters.slice(0, 4);
  const remainingTestersCount = activeTesters.length - 4;

  return (
    <SortableContext id={date} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`flex flex-col h-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative transition-all ${isOver && !isDisabled ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''} ${isDisabled && !isHoliday ? 'opacity-60 bg-slate-50' : ''} ${containerClass}`} role="region">
        <div className={`px-3 py-2 flex flex-col gap-1 relative z-10 ${headerClass}`}>
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase ${titleClass}`}>{fullDayName}</span>
                <span className={`text-[10px] font-bold text-slate-400 ${isToday ? 'bg-indigo-600 text-white px-1.5 py-0.5 rounded-md shadow-sm' : ''}`}> {dateStr} </span>
              </div>
             <div className="flex items-center gap-1.5">
                {!isHoliday && <div className={`text-[9px] font-black ${usedHours > displayCapacity ? 'text-red-500' : 'text-slate-400'}`}>{usedHours.toFixed(1)}/{displayCapacity}h</div>}
             </div>
          </div>
          {isHoliday && (
            <div className="flex items-center gap-1 mt-0.5">
              <PartyPopper size={10} className="text-red-500"/>
              <span className="text-[9px] font-black text-red-500 uppercase truncate">{holidayName || 'Nghỉ lễ'}</span>
            </div>
          )}
          {!isHoliday && viewMode === 'week' && (stats.total > 0) && (
            <div className="flex justify-between items-center mt-0.5">
              <div className="flex gap-1">
                {stats.total > 0 && <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded border border-slate-200">Tổng mẫu: {stats.total}</span>}
              </div>
              <div className="flex items-center pl-2">
                {displayedTesters.map((t: Tester) => (
                  <div key={t.name} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border border-white -ml-1.5 first:ml-0 ${t.colorClass}`} title={`${t.shortName}: ${stats.testerCounts[t.name]} mẫu`}>
                    {stats.testerCounts[t.name]}
                  </div>
                ))}
                {remainingTestersCount > 0 && (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border border-white -ml-1.5 bg-slate-200 text-slate-600">
                    +{remainingTestersCount}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 p-1 relative z-10 space-y-1 overflow-y-auto scrollbar-thin pb-4">
          {children}
        </div>
      </div>
    </SortableContext>
  );
};


const SortableDroppableChamber: React.FC<any> = ({ id, chamberName, capacity, usedHours, children, isDisabled, viewMode, items, requests = [], testers = [] }) => {
  const { setNodeRef, isOver } = useDroppable({ id: id || 'disabled', disabled: isDisabled });
  
  const stats = React.useMemo(() => {
      let total = 0;
      const testerCounts: Record<string, number> = {};
      requests.forEach((r: TestRequest) => {
         if (r.status === RequestStatus.CANCELLED) return;
         total += r.quantity || 1;
         const tName = r.testerName || 'Chưa giao';
         testerCounts[tName] = (testerCounts[tName] || 0) + 1;
      });
      return { total, testerCounts };
  }, [requests]);

  let headerClass = 'bg-white border-b border-slate-100'; 
  let titleClass = 'text-slate-500'; 
  let containerClass = '';
  
  const visualPeak = (usedHours > LAB_CONSTANTS.CAPACITY_NORMAL);
  const displayCapacity = visualPeak ? LAB_CONSTANTS.CAPACITY_PEAK : LAB_CONSTANTS.CAPACITY_NORMAL;
  
  if (visualPeak) { 
      headerClass = 'bg-orange-50 border-b border-orange-100'; titleClass = 'text-orange-500'; 
  }
  
  const minHeight = viewMode === 'month' ? 'min-h-[100px]' : 'min-h-[140px] md:min-h-full';
  
  const activeTesters = (testers || []).filter((t: Tester) => t && t.name && (stats.testerCounts[t.name] || 0) > 0);
  const displayedTesters = activeTesters.slice(0, 4);
  const remainingTestersCount = activeTesters.length - 4;

  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative transition-all ${minHeight} ${isOver && !isDisabled ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''} ${isDisabled ? 'opacity-60 bg-slate-50' : ''} ${containerClass}`} role="region">
        <div className={`px-3 py-2 flex flex-col gap-1 relative z-10 ${headerClass}`}>
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase ${titleClass}`}>{chamberName}</span>
              </div>
             <div className="flex items-center gap-1.5">
               <div className={`text-[9px] font-black ${usedHours > displayCapacity ? 'text-red-500' : 'text-slate-400'}`}>{usedHours.toFixed(1)}/{displayCapacity}h</div>
             </div>
          </div>
          {viewMode === 'week' && (stats.total > 0) && (
            <div className="flex justify-between items-center mt-0.5">
              <div className="flex gap-1">
                {stats.total > 0 && <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded border border-slate-200">Tổng mẫu: {stats.total}</span>}
              </div>
              <div className="flex items-center pl-2">
                {displayedTesters.map((t: Tester) => (
                  <div key={t.name} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border border-white -ml-1.5 first:ml-0 ${t.colorClass}`} title={`${t.shortName}: ${stats.testerCounts[t.name]} mẫu`}>
                    {stats.testerCounts[t.name]}
                  </div>
                ))}
                {remainingTestersCount > 0 && (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border border-white -ml-1.5 bg-slate-200 text-slate-600">
                    +{remainingTestersCount}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 p-1 relative z-10 space-y-0.5 pb-8 md:pb-1">
          {children}
        </div>
      </div>
    </SortableContext>
  );
};

const calculateTimeline = (requests: TestRequest[], isAtd = false) => {
    let currentHour = 8;
    return requests.map(req => {
        const timeNeeded = isAtd ? (req.testTimeATD || 0) : (req.testTimeATD || 0);
        const startHour = Math.floor(currentHour);
        const startMin = Math.round((currentHour - startHour) * 60);
        const endHourVal = currentHour + timeNeeded;
        const endHour = Math.floor(endHourVal);
        const endMin = Math.round((endHourVal - endHour) * 60);
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const start = `${pad(startHour)}:${pad(startMin)}`;
        const end = `${pad(endHour)}:${pad(endMin)}`;
        
        currentHour = endHourVal;
        return { start, end };
    });
};

const calculateUsedHours = (requests: TestRequest[], dateStr: string) => {
    return requests
        .filter(r => r.scheduledDate && r.scheduledDate.startsWith(dateStr) && r.status !== RequestStatus.CANCELLED)
        .reduce((sum, req) => sum + (req.testTimeATD || 0), 0);
};

const QuickMoveModal = ({
    isOpen,
    onClose,
    request,
    calendarDays,
    testCategory,
    onMove
}: {
    isOpen: boolean;
    onClose: () => void;
    request: TestRequest;
    calendarDays: string[];
    testCategory: TestCategory;
    onMove: (date: string | null, chamber?: 'Chamber 1' | 'Chamber 2') => void;
}) => {
    const [selectedDate, setSelectedDate] = useState<string | null>(request.scheduledDate ? request.scheduledDate.split('T')[0] : null);
    const [selectedChamber, setSelectedChamber] = useState<'Chamber 1' | 'Chamber 2'>(request.chamberId as 'Chamber 1' | 'Chamber 2' || 'Chamber 1');

    if (!isOpen) return null;

    const handleConfirm = () => {
        onMove(selectedDate, testCategory === TestCategory.EMC ? selectedChamber : undefined);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Xếp lịch nhanh</h3>
                        <p className="text-[11px] text-slate-500 font-bold">{request.modelName} - {request.requestCode}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Chọn Ngày thử nghiệm</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-emerald-500"
                            value={selectedDate || ''}
                            onChange={(e) => setSelectedDate(e.target.value || null)}
                        >
                            <option value="">-- Trả về hàng chờ (Gỡ lịch) --</option>
                            {calendarDays.map(date => {
                                const d = new Date(date);
                                const dayStr = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
                                return (
                                    <option key={date} value={date}>
                                        {dayStr}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {(testCategory === TestCategory.EMC || request.testCategory === TestCategory.EMC || request.testCategory === TestCategory.BOTH) && selectedDate && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Chọn buồng thử nghiệm</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedChamber('Chamber 1')}
                                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all text-center ${selectedChamber === 'Chamber 1' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                >
                                    Buồng EMC 1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedChamber('Chamber 2')}
                                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all text-center ${selectedChamber === 'Chamber 2' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                >
                                    Buồng EMC 2
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all border border-emerald-700 shadow-sm"
                    >
                        Cập nhật
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ATDScheduleView = ({ testCategory }: { testCategory?: TestCategory }) => {
    const { requests, handoverDocs, moveRequest, deleteRequest, dayConfigs, settings, updateTester, updateRequestCode, updateRequest, undo, redo, past, future, testers, currentUser, brands } = useStore();
    const isAdminUser = currentUser?.role === 'admin' || 
                        currentUser?.position?.toLowerCase().includes('quản lý') || 
                        currentUser?.position?.toLowerCase().includes('trưởng phòng');
    const isTester = currentUser?.role === 'tester';
    
    const isAtdTester = React.useMemo(() => {
        if (!currentUser) return false;
        return !!settings?.defaultTestersAtd?.includes(currentUser.name);
    }, [currentUser, testers, settings]);

    const isAdmin = isAdminUser || (isTester && isAtdTester);
  const hasGlobalEditRight = isAdmin;

  const canEditRequest = (req: TestRequest) => {
      if (isAdminUser) return true;
      if (isTester && isAtdTester) {
          const isAtdRequest = req.testCategory === TestCategory.ATD || req.testCategory === TestCategory.BOTH;
          if (!req.scheduledDate) {
              return req.testerName === currentUser?.name;
          }
          return !req.testerName || req.testerName === currentUser?.name || isAtdRequest;
      }
      return false;
  };

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [returnModal, setReturnModal] = useState<{ isOpen: boolean, requestId: string | null }>({ isOpen: false, requestId: null });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'FAIL'>('ALL');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMobileDate, setSelectedMobileDate] = useState<string | null>(null);

  const [scrolledToRequestId, setScrolledToRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (scrolledToRequestId) {
      const timer = setTimeout(() => {
        setScrolledToRequestId(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [scrolledToRequestId]);

  const handleScrollToRequest = (id: string, dateStr: string) => {
    if (!dateStr) return;
    const cleanDateStr = dateStr.split('T')[0];
    const parts = cleanDateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      if (!isNaN(dateObj.getTime())) {
        if (!calendarDays.includes(cleanDateStr)) {
          setCurrentDate(dateObj);
        }
      }
    }
    if (isMobile) {
      setSelectedMobileDate(cleanDateStr);
    }
    setScrolledToRequestId(id);
    
    const attemptScroll = (attemptsLeft = 5) => {
      const element = document.getElementById(`request-card-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attemptsLeft > 0) {
        setTimeout(() => attemptScroll(attemptsLeft - 1), 100);
      }
    };
    
    setTimeout(() => attemptScroll(), 150);
  };

  const calendarDays = useMemo(() => {
    const days = [];
    if (viewMode === 'week') {
        const monday = new Date(currentDate);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1); 
        monday.setDate(diff);
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            days.push(`${yyyy}-${mm}-${dd}`);
        }
    } else {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        while (date.getMonth() === month) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            days.push(`${yyyy}-${mm}-${dd}`);
            date.setDate(date.getDate() + 1);
        }
    }
    return days;
  }, [currentDate, viewMode]);

  useEffect(() => {
    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (calendarDays && calendarDays.length > 0) {
        if (!selectedMobileDate || !calendarDays.includes(selectedMobileDate)) {
            setSelectedMobileDate(calendarDays[0]);
        }
    }
  }, [calendarDays, selectedMobileDate]);

  const updateTestTimeATD = (id: string, time: number) => {
      const req = requests.find(r => r.id === id);
      if (!req || !canEditRequest(req)) return;
      updateRequest(id, { testTimeATD: time });
  };

  const sensors = useSensors( useSensor(MouseSensor, { activationConstraint: { distance: 8, }, }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5, }, }) );

  useEffect(() => {
    if (!isAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); if (e.shiftKey) { if (future.length > 0) { redo(); toast.success("Đã làm lại (Redo)"); } } else { if (past.length > 0) { undo(); toast.success("Đã hoàn tác (Undo)"); } } } else if (e.key === 'y') { e.preventDefault(); if (future.length > 0) { redo(); toast.success("Đã làm lại (Redo)"); } }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, past.length, future.length, isAdmin]);

  const activeLoadCount = useMemo(() => requests.filter(r => !r.id.includes('-log-') && (r.testCategory === TestCategory.ATD || r.testCategory === TestCategory.BOTH) && r.sampleStatus === SampleStatus.IN_LAB && [RequestStatus.PENDING, RequestStatus.SAMPLES_RECEIVED, RequestStatus.SCHEDULED, RequestStatus.REQ_SUPPLEMENT].includes(r.status)).length, [requests]);
  const isPeakLoad = testCategory === TestCategory.ATD && activeLoadCount > LAB_CONSTANTS.PEAK_LOAD_THRESHOLD;

  const displayTesters = useMemo(() => {
    const generalList = settings.defaultTestersAtd || [];
    if (generalList.length > 0) {
      return testers.filter(t => generalList.includes(t.name));
    }
    return testers.filter(t => (t.responsibilities && (t.responsibilities.toUpperCase().includes('ATD') || t.responsibilities.toUpperCase().includes('ITD') || t.responsibilities.toUpperCase().includes('TẤT CẢ'))) || (t.position && (t.position.toUpperCase().includes('ATD') || t.position.toUpperCase().includes('ITD'))));
  }, [testers, settings.defaultTestersAtd]);

  const displayTestersChamber1 = useMemo(() => {
    if (settings.defaultTestersChamber1 && settings.defaultTestersChamber1.length > 0) {
      return testers.filter(t => settings.defaultTestersChamber1?.includes(t.name));
    }
    return displayTesters;
  }, [testers, settings.defaultTestersChamber1, displayTesters]);

  const displayTestersChamber2 = useMemo(() => {
    if (settings.defaultTestersChamber2 && settings.defaultTestersChamber2.length > 0) {
      return testers.filter(t => settings.defaultTestersChamber2?.includes(t.name));
    }
    return displayTesters;
  }, [testers, settings.defaultTestersChamber2, displayTesters]);

  const visibleDays = useMemo(() => {
    return calendarDays.filter(date => {
      const d = new Date(date);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 6 && !settings.workOnSaturday) return false;
      if (dayOfWeek === 0 && !settings.workOnSunday) return false;
      return true;
    });
  }, [calendarDays, settings.workOnSaturday, settings.workOnSunday]);

  const uniqueCustomers = useMemo(() => Array.from(new Set(requests.filter(r => !r.id.includes('-log-')).map(r => r.customerName).filter(Boolean))).sort() as string[], [requests]);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    if (brands && Array.isArray(brands)) {
      brands.forEach(b => { if (b) set.add(b.trim()); });
    }
    requests.forEach(r => {
      if (r.brand) set.add(r.brand.trim());
    });
    return Array.from(set).sort();
  }, [brands, requests]);

  const filterRequestBase = (req: TestRequest) => {
      const category = req.testCategory || TestCategory.ATD;
      const isAtd = category === TestCategory.ATD || category === TestCategory.BOTH || !!req.atdEncodeNumber;
      if (testCategory === TestCategory.ATD && !isAtd) return false;
      return true;
  };

  const filterRequestSearch = (req: TestRequest) => {
      if (selectedCustomer && req.customerName !== selectedCustomer) return false;
      if (selectedBrand && req.brand !== selectedBrand) return false;
      if (searchTerm) {
          const query = removeAccents(searchTerm).toLowerCase().trim();
          if (query) {
              const code = removeAccents(req.requestCode || '').toLowerCase();
              const customer = removeAccents(req.customerName || '').toLowerCase();
              const product = removeAccents(req.type || '').toLowerCase();
              const model = removeAccents(req.modelName || '').toLowerCase();
              const itdEncode = removeAccents(req.itdEncodeNumber || '').toLowerCase();
              const atdEncode = removeAccents(req.atdEncodeNumber || '').toLowerCase();
              const emcEncode = removeAccents(req.emcEncodeNumber || '').toLowerCase();
              const sealStamp = removeAccents(req.sealStamp || '').toLowerCase();
              const otherInfo = removeAccents(req.otherCustomerInfo || '').toLowerCase();
              const pycCode = removeAccents((req as any).pycCode || '').toLowerCase();
              const sampleCode = removeAccents((req as any).sampleCode || '').toLowerCase();
              const note = removeAccents(req.note || '').toLowerCase();
              const testerName = removeAccents(req.testerName || '').toLowerCase();
              const brand = removeAccents(req.brand || '').toLowerCase();
              const reqId = removeAccents(req.id || '').toLowerCase();
              
              if (!code.includes(query) && 
                  !customer.includes(query) && 
                  !product.includes(query) && 
                  !model.includes(query) && 
                  !itdEncode.includes(query) && 
                  !atdEncode.includes(query) && 
                  !emcEncode.includes(query) &&
                  !sealStamp.includes(query) &&
                  !otherInfo.includes(query) &&
                  !pycCode.includes(query) &&
                  !sampleCode.includes(query) &&
                  !note.includes(query) &&
                  !testerName.includes(query) &&
                  !brand.includes(query) &&
                  !reqId.includes(query)) return false;
          }
      }
      
      const isCompleted = [RequestStatus.COMPLETED, RequestStatus.RESULTS_APPROVED, RequestStatus.RESULTS_SUBMITTED].includes(req.status);
      if (statusFilter === 'COMPLETED' && !isCompleted) return false;
      if (statusFilter === 'PENDING' && isCompleted) return false;
      if (statusFilter === 'FAIL' && (req.retryCount || 0) <= 0) return false;

      return true;
  };

  const filterRequest = (req: TestRequest) => {
      if (!filterRequestBase(req)) return false;
      if (!filterRequestSearch(req)) return false;
      return true;
  };

  const isSearchActive = !!(searchTerm || selectedCustomer || selectedBrand || statusFilter !== 'ALL');

  const scheduledMatchedRequests = useMemo(() => {
    if (!isSearchActive) return [];
    return requests
      .filter(r => 
        filterRequestBase(r) && 
        filterRequestSearch(r) && 
        Boolean(r.scheduledDate)
      )
      .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
  }, [requests, isSearchActive, selectedCustomer, selectedBrand, searchTerm, statusFilter]);

  const scheduleByDate = useMemo(() => {
    const map: Record<string, TestRequest[]> = {};
    requests.forEach(req => {
      if (!filterRequestBase(req)) return;
      if (req.scheduledDate) {
        const d = req.scheduledDate.split('T')[0];
        if (!map[d]) map[d] = [];
        map[d].push(req);
      }
    });
    Object.keys(map).forEach(date => {
        map[date].sort((a, b) => {
            if ((a.order || 0) !== (b.order || 0)) {
                return (a.order || 0) - (b.order || 0);
            }
            if (a.status === RequestStatus.CANCELLED && b.status !== RequestStatus.CANCELLED) return -1;
            if (a.status !== RequestStatus.CANCELLED && b.status === RequestStatus.CANCELLED) return 1;
            return 0;
        });
    });
    return map;
  }, [requests, testCategory]);

  const dailyLoadMap = useMemo(() => {
      const map: Record<string, number> = {};
      const dates = Object.keys(scheduleByDate);
      dates.forEach(date => {
          const reqs = scheduleByDate[date] || [];
          map[date] = calculateRequestsLoad(reqs, testCategory || TestCategory.ATD);
      });
      return map;
  }, [scheduleByDate, testCategory]);

  const pendingRequests = useMemo(() => {
      const receiveDocsMap = new Set(
          (handoverDocs || [])
              .filter(d => d.type === HandoverType.RECEIVE)
              .flatMap(d => d.sampleIds || [])
      );
      const rawPending = requests.filter(r => 
          filterRequestBase(r) && 
          r.sampleStatus === SampleStatus.IN_LAB && 
          receiveDocsMap.has(r.id) &&
          [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.SAMPLES_RECEIVED, RequestStatus.REQ_SUPPLEMENT].includes(r.status) && 
          !r.scheduledDate
      );
      const filtered = isSearchActive 
          ? rawPending.filter(r => filterRequestSearch(r))
          : rawPending;
      return sortPendingRequests(filtered);
  }, [requests, handoverDocs, testCategory, isSearchActive, selectedCustomer, selectedBrand, searchTerm, statusFilter]);

  const handlePrevTime = () => { const d = new Date(currentDate); if (viewMode === 'week') d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1); setCurrentDate(d); };
  const handleNextTime = () => { const d = new Date(currentDate); if (viewMode === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1); setCurrentDate(d); };
  const handleToday = () => setCurrentDate(new Date());

  const handleUnschedule = (id: string) => {
      const request = requests.find(r => r.id === id);
      if (!request) return;
      if (request.status === RequestStatus.CANCELLED) {
          deleteRequest(id);
          toast.success("Đã xóa hoàn toàn vết lịch sử thử nghiệm.");
          return;
      }
      if (!request.scheduledDate) {
          const isFailedSample = (request.retryCount || 0) > 0 || request.status === RequestStatus.REQ_SUPPLEMENT;
          if (isFailedSample) {
              const confirmGomau = window.confirm(`Bạn có chắc chắn muốn gỡ bỏ mẫu thử nghiệm thất bại này (${request.modelName}) khỏi hàng chờ và lập kết quả thử nghiệm FAIL không?\nMẫu này sẽ dừng thử nghiệm tiếp, tất cả thông tin liên quan (phiếu yêu cầu, biên bản giao nhận) vẫn sẽ được giữ nguyên.`);
              if (confirmGomau) {
                  updateRequest(id, { status: RequestStatus.COMPLETED });
                  toast.success("Đã gỡ mẫu khỏi hàng chờ và lập kết quả thử nghiệm FAIL thành công.");
              }
          } else {
              const confirmDelete = window.confirm(`Bạn có chắc chắn muốn gỡ bỏ mẫu (${request.modelName}) khỏi hàng chờ không?`);
              if (confirmDelete) {
                  deleteRequest(id);
                  toast.success("Đã gỡ bỏ mẫu khỏi hàng chờ.");
              }
          }
          return;
      }
      setReturnModal({ isOpen: true, requestId: id });
  };
  
  const handleConfirmReturn = (reason: string, keepHistory: boolean, isFail: boolean) => { if (returnModal.requestId) { moveRequest(returnModal.requestId, null, undefined, reason, keepHistory, undefined, isFail); setReturnModal({ isOpen: false, requestId: null }); toast.success(keepHistory ? "Đã trả về hàng chờ & lưu vết." : "Đã trả về hàng chờ."); } };
  
  const handleReorder = (requestId: string, direction: 'up' | 'down') => { 
      const request = requests.find(r => r.id === requestId); 
      if (!request || !request.scheduledDate) return; 
      const dayRequests = scheduleByDate[request.scheduledDate] || []; 
      const currentIndex = dayRequests.findIndex(r => r.id === requestId); 
      if (currentIndex === -1) return; 
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1; 
      moveRequest(requestId, request.scheduledDate, newIndex); 
  };

  const handleReorderChamber = (requestId: string, direction: 'up' | 'down', chamber: 'Chamber 1' | 'Chamber 2') => {
      const request = requests.find(r => r.id === requestId);
      if (!request || !request.scheduledDate) return;
      const dayRequests = (scheduleByDate[request.scheduledDate] || []).filter(r => (r.chamberId || 'Chamber 1') === chamber);
      const currentIndex = dayRequests.findIndex(r => r.id === requestId);
      if (currentIndex === -1) return;
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      moveRequest(requestId, request.scheduledDate, newIndex, undefined, undefined, chamber);
  };

  const handleDragStart = (e: DragStartEvent) => { 
      const req = requests.find(r => r.id === e.active.id);
      if (!req || !canEditRequest(req)) return;
      setActiveDragId(e.active.id as string); 
  };
  
  const handleDragEnd = (e: DragEndEvent) => { 
      const { active, over } = e; 
      setActiveDragId(null); 
      if (!over) return; 
      const reqId = active.id as string; 
      const req = requests.find(r => r.id === reqId);
      if (!req || !canEditRequest(req)) return;

      const overId = over.id as string; 
      
      if (overId === 'pending-zone') { 
          handleUnschedule(reqId); 
          return; 
      } 
      
      let targetDate: string | null = null; 
      let targetChamber: 'Chamber 1' | 'Chamber 2' | undefined = undefined;
      let newIndex: number | undefined = undefined; 
      
      if (overId.includes('_chamber')) {
          const parts = overId.split('_chamber');
          targetDate = parts[0];
          targetChamber = parts[1] === '1' ? 'Chamber 1' : 'Chamber 2';
          const itemsInChamber = (scheduleByDate[targetDate] || []).filter(r => (r.chamberId || 'Chamber 1') === targetChamber);
          newIndex = itemsInChamber.length;
      } else if (calendarDays.includes(overId)) { 
          targetDate = overId; 
          const itemsInDay = scheduleByDate[targetDate] || []; 
          newIndex = itemsInDay.length; 
      } else { 
          const overRequest = requests.find(r => r.id === overId); 
          if (overRequest && overRequest.scheduledDate) { 
              targetDate = overRequest.scheduledDate; 
              targetChamber = overRequest.chamberId || 'Chamber 1';
              const dayChamberRequests = (scheduleByDate[targetDate] || []).filter(r => {
                  
                  return true;
              });
              const overIndex = dayChamberRequests.findIndex(r => r.id === overId); 
              if (overIndex !== -1) newIndex = overIndex; 
          } 
      } 
      
      if (targetDate) moveRequest(reqId, targetDate, newIndex, undefined, undefined, targetChamber); 
  };
  
  const activeRequest = activeDragId ? requests.find(r => r.id === activeDragId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} >
        <div className="flex flex-col md:flex-row h-full mobile-safe-bottom md:pb-0 relative">
            <aside className={`relative flex flex-col shrink-0 z-10 transition-all duration-300 ${isSidebarOpen ? 'w-full md:w-80 h-auto md:h-full border-r' : 'w-full md:w-0 h-0 md:h-full border-0'}`} aria-label="Bộ lọc và Hàng chờ">
                <div className={`w-full h-full bg-white flex flex-col overflow-hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 md:invisible pointer-events-none'}`}>
                <div className="p-3 border-b border-slate-100 space-y-2">
                    <div className="relative"> <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" aria-hidden="true"/> <input type="text" className="w-full bg-slate-50 border-none text-[10px] font-medium text-slate-700 rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Tìm mã, khách, sản phẩm, model, tem..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /> </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative"> <select className="w-full bg-slate-50 border-none text-[10px] font-medium text-slate-700 rounded-lg pl-2 pr-6 py-2 appearance-none outline-none focus:ring-1 focus:ring-emerald-500 truncate" value={selectedCustomer || ''} onChange={(e) => setSelectedCustomer(e.target.value || null)}> <option value="">-- Khách hàng --</option> {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)} </select> <Filter size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" aria-hidden="true"/> </div>
                        <div className="relative"> <select className="w-full bg-slate-50 border-none text-[10px] font-medium text-slate-700 rounded-lg pl-2 pr-6 py-2 appearance-none outline-none focus:ring-1 focus:ring-emerald-500 truncate" value={selectedBrand || ''} onChange={(e) => setSelectedBrand(e.target.value || null)}> <option value="">-- Thương hiệu --</option> {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)} </select> <Filter size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" aria-hidden="true"/> </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                        <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl gap-1 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('ALL')}
                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center truncate ${statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Tất cả
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('PENDING')}
                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center truncate ${statusFilter === 'PENDING' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Chưa hoàn thành"
                            >
                                Chưa HT
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('COMPLETED')}
                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center truncate ${statusFilter === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Đã hoàn thành"
                            >
                                Đã HT
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('FAIL')}
                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center truncate ${statusFilter === 'FAIL' ? 'bg-red-100 text-red-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Mẫu Fail"
                            >
                                Fail
                            </button>
                        </div>
                    </div>
                </div>
                {isSearchActive && (
                    <div className="px-3 py-2 border-b border-slate-100 bg-emerald-50/40">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Mẫu khớp trên lịch ({scheduledMatchedRequests.length})</span>
                        </div>
                        {scheduledMatchedRequests.length === 0 ? (
                            <div className="text-[10px] text-slate-400 font-bold italic py-1">Không tìm thấy mẫu nào được xếp lịch.</div>
                        ) : (
                            <div className="max-h-28 overflow-y-auto scrollbar-thin space-y-1">
                                {scheduledMatchedRequests.map(req => {
                                    const dateStr = req.scheduledDate ? req.scheduledDate.split('T')[0] : '';
                                    const d = new Date(dateStr);
                                    const formattedDate = dateStr ? `${d.toLocaleDateString('vi-VN', { weekday: 'short' })} ${d.getDate()}/${d.getMonth() + 1}` : '';
                                    return (
                                        <button
                                            key={req.id}
                                            onClick={() => handleScrollToRequest(req.id, dateStr)}
                                            className="w-full text-left p-1.5 bg-white border border-slate-200/60 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex justify-between items-center text-[10px] shadow-xs active:scale-[0.98]"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-black text-slate-700 truncate">{req.modelName}</div>
                                                <div className="text-[8px] font-bold text-slate-400 mt-0.5">{req.requestCode} {req.emcEncodeNumber ? `| ${req.emcEncodeNumber}` : ''}</div>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <div className="text-[8px] font-black text-emerald-700 bg-emerald-100/60 px-1 py-0.5 rounded tracking-wide uppercase">{formattedDate}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex-1 flex flex-col p-3 overflow-hidden bg-slate-50"> 
                    <div className="flex justify-between items-center mb-2"> 
                        <h3 className="text-[10px] font-black text-slate-500 uppercase">Hàng chờ ({pendingRequests.length})</h3> 
                        {isAdmin && (
                            <div className="flex gap-1"> 
                                <button onClick={undo} disabled={past.length === 0} className="p-1 rounded bg-white text-slate-400 hover:text-emerald-600 disabled:opacity-30 border border-slate-200" title="Hoàn tác (Ctrl+Z)"><Undo2 size={12} /></button> 
                                <button onClick={redo} disabled={future.length === 0} className="p-1 rounded bg-white text-slate-400 hover:text-emerald-600 disabled:opacity-30 border border-slate-200" title="Làm lại (Ctrl+Y)"><Redo2 size={12} /></button> 
                            </div>
                        )} 
                    </div>
                    <SortablePendingZone id="pending-zone" items={pendingRequests.map(r => r.id)}> {pendingRequests.map(req => ( <div key={req.id} className="w-full" role="listitem"> <SortableRequest request={req} isHighlighted={isSearchActive ? filterRequestSearch(req) : false} isDimmed={false} testers={displayTesters} onUpdateTester={updateTester} onUpdateEmc={(id, val) => updateRequest(id, { emcEncodeNumber: val })} onUpdateRequestCode={updateRequestCode} onUpdateTestTime={updateTestTimeATD} calendarDays={calendarDays} onUnschedule={handleUnschedule} isScrolledTo={req.id === scrolledToRequestId} /> </div> ))} </SortablePendingZone> 
                </div>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border border-slate-200 shadow-md rounded-lg hidden md:flex items-center justify-center z-20 hover:text-emerald-600 transition-all group"> {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />} </button>
            </aside>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden flex items-center justify-center py-2 bg-white border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 gap-1.5 transition-colors active:bg-slate-50"> {isSidebarOpen ? <><PanelLeftClose size={14}/> Ẩn Bộ Lọc</> : <><PanelLeftOpen size={14}/> Hiện Bộ Lọc</>} </button>
            <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
                <div className="p-2 border-b border-slate-200 bg-white flex justify-between items-center h-10 shrink-0">
                <div className="flex items-center gap-1"> <button onClick={handlePrevTime} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={16}/></button> <button onClick={handleToday} className="px-2 py-1 hover:bg-slate-100 rounded text-xs font-black text-slate-700"> {viewMode === 'week' ? `Tuần ${formatDateVN(currentDate).split('/')[0]}/${formatDateVN(currentDate).split('/')[1]}` : `Tháng ${currentDate.getMonth() + 1}`} </button> <button onClick={handleNextTime} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={16}/></button> </div>
                <div className="flex bg-slate-100 p-0.5 rounded-md scale-90 origin-right"> <button onClick={() => setViewMode('week')} className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${viewMode === 'week' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}> Tuần </button> <button onClick={() => setViewMode('month')} className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${viewMode === 'month' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}> Tháng </button> </div>
                </div>
                {isMobile && viewMode === 'week' && (
                    <div className="flex md:hidden gap-1.5 overflow-x-auto py-2 px-3 border-b border-slate-200 bg-white sticky top-0 z-20 scrollbar-none select-none shrink-0">
                        {calendarDays.map(date => {
                            const d = new Date(date);
                            const isSel = selectedMobileDate === date;
                            const isToday = new Date().toDateString() === d.toDateString();
                            const dayLabel = d.toLocaleDateString('vi-VN', { weekday: 'short' });
                            const dateStr = d.getDate();
                            return (
                                <button
                                    key={date}
                                    onClick={() => setSelectedMobileDate(date)}
                                    className={`mobile-touch-target flex flex-col items-center justify-center shrink-0 w-12 py-1.5 rounded-xl border transition-all ${isSel ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm font-black' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">{dayLabel}</span>
                                    <span className="text-xs font-black">{dateStr}</span>
                                    {isToday && !isSel && <span className="w-1 h-1 rounded-full bg-indigo-600 mt-0.5"></span>}
                                </button>
                            );
                        })}
                    </div>
                )}
                <div className="mobile-scroll-x flex-1 min-w-0 overflow-y-hidden p-2 schedule-scrollarea"> 
                
                    <div className="flex flex-row gap-3 h-full pb-2 select-none items-stretch"> 
                        {visibleDays
                            .filter(date => !isMobile || selectedMobileDate === date)
                            .map(date => { 
                            const d = new Date(date); 
                            const dayOfWeek = d.getDay(); 
                            const isToday = new Date().toDateString() === d.toDateString();
                            
                            let isPeak = isPeakLoad; 
                            let isHoliday = false;
                            let holidayName = '';

                            if (dayConfigs[date]) {
                                isPeak = dayConfigs[date].isPeakDay;
                                isHoliday = dayConfigs[date].isHoliday || false;
                                holidayName = dayConfigs[date].note || '';
                            }

                            const isDisabled = (dayOfWeek === 0 && !settings.workOnSunday) || (dayOfWeek === 6 && !settings.workOnSaturday) || isHoliday; 
                            const dayReqs = scheduleByDate[date] || []; 
                            const used = dailyLoadMap[date] || 0;
                            const capacity = isPeak ? LAB_CONSTANTS.CAPACITY_PEAK : LAB_CONSTANTS.CAPACITY_NORMAL; 
                            
                            const colWidth = isMobile ? 'w-full' : viewMode === 'week' ? 'w-[280px] md:w-[320px]' : 'w-[220px] md:w-[240px]';

                            return ( <div key={date} role="gridcell" className={`h-full shrink-0 ${colWidth}`}> <SortableDroppableDay date={date} dayName={d.toLocaleDateString('vi-VN', { weekday: 'short' })} isPeak={isPeak} isHoliday={isHoliday} holidayName={holidayName} usedHours={used} capacity={capacity} isDisabled={isDisabled} viewMode={viewMode} items={dayReqs.map(r => r.id)} requests={dayReqs} testers={displayTesters} > {dayReqs.map((req, index) => ( <SortableRequest
                                                            key={req.id}
                                                            request={req}
                                                            isHighlighted={isSearchActive ? filterRequestSearch(req) : false}
                                                            isDimmed={isSearchActive ? !filterRequestSearch(req) : false}
                                                            isScrolledTo={req.id === scrolledToRequestId} testers={displayTesters} index={index} totalItems={dayReqs.length} onReorder={handleReorder} viewMode={viewMode} onUnschedule={handleUnschedule} onUpdateTester={updateTester} onUpdateEmc={(id, val) => updateRequest(id, { emcEncodeNumber: val })} onUpdateRequestCode={updateRequestCode} onUpdateTestTime={updateTestTimeATD} calendarDays={calendarDays} /> ))} </SortableDroppableDay> </div> ); 
                        })} 
                    </div> 
                </div>
            </div>
        </div>
        <DragOverlay  className="pointer-events-none"> {activeRequest ? ( <RequestItem request={activeRequest} testers={testers} isOverlay viewMode={viewMode} onUnschedule={undefined} /> ) : null} </DragOverlay>
        <ReturnReasonModal isOpen={returnModal.isOpen} onClose={() => setReturnModal({ isOpen: false, requestId: null })} onConfirm={handleConfirmReturn} />
    </DndContext>
  );
};

export default ATDScheduleView;
// --- End of ATDScheduleView.tsx ---
