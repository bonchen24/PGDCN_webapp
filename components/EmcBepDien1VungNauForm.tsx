// Author: Gemini
// OS support: Web/Node
// Description: Component form nhập liệu và báo cáo EMC bếp điện và thiết bị gia dụng

import React, { useState, useRef, useEffect, DragEvent, ClipboardEvent } from 'react';
import { UploadCloud, X, Crop, Upload, Sparkles, AlertTriangle, Check, CheckCircle2, Loader2, Info, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter';
import CropperModal from "./CropperModal";
import { useStore } from '../store';
import { getVectorCompositeDimensions, isCompleteVectorComposite, shouldPreferBrowserVectorComposite } from '../utils/radimationLayers';
import { resolveGeminiModel } from '../utils/geminiSettings';
import { normalizeNameplateOcrValues } from '../lib/reportFormatting';

export interface TablePhaseRow {
  peakNumber: string;
  frequency: string;
  peak?: string;
  average: string;
  averageLimit: string;
  quasiPeak: string;
  quasiPeakLimit: string;
  quasiPeakDiff: string;
  averageDiff: string;
  status: string;
}

export interface TablePowerRow {
  nr: string;
  frequency: string;
  pkValue: string;
  avgValue: string;
  qpValue: string;
  avgLimit: string;
  qpLimit: string;
  result: string;
  distance: string;
}

export interface EmcData {
  brand: string;
  model: string;
  power: string;
  voltage: string;
  current: string;
  frequency: string;
  clockFreq: string;
  ambientTemp: string;
  ambientHumidity: string;
    ambientTemp_2?: string;
    ambientHumidity_2?: string;
    coolingHeatingPower?: string;
  images: {
    label: string | null;
    label2?: string | null;
    phaseL: string | null;
    phaseN: string | null;
    powerDisturbance: string | null;
    discontinuousPhaseN: string | null;
    sample: string | null;
    sample2?: string | null;
    setupVoltage: string | null;
    setupPower: string | null;
    setupRadiated?: string | null;
    phaseL_2?: string | null;
    phaseN_2?: string | null;
    powerDisturbance_2?: string | null;
    discontinuousPhaseN_2?: string | null;
    phaseL_3?: string | null;
    phaseN_3?: string | null;
    powerDisturbance_3?: string | null;
    discontinuousPhaseN_3?: string | null;
    mag1_A?: string | null;
    mag1_B?: string | null;
    mag1_C?: string | null;
    mag2_A?: string | null;
    mag2_B?: string | null;
    mag2_C?: string | null;
    mag3_A?: string | null;
    mag3_B?: string | null;
    mag3_C?: string | null;
    phaseL_4?: string | null;
    phaseN_4?: string | null;
    powerDisturbance_4?: string | null;
    discontinuousPhaseN_4?: string | null;
    mag4_A?: string | null;
    mag4_B?: string | null;
    mag4_C?: string | null;
    [key: string]: any;
  };
  tablePhaseL: TablePhaseRow[];
  tablePhaseN: TablePhaseRow[];
  tablePower: TablePowerRow[];
  tablePhaseL_2?: TablePhaseRow[];
  tablePhaseN_2?: TablePhaseRow[];
  tablePower_2?: TablePowerRow[];
  tablePhaseL_3?: TablePhaseRow[];
  tablePhaseN_3?: TablePhaseRow[];
  tablePower_3?: TablePowerRow[];
  tableMag1_A?: TablePhaseRow[];
  tableMag1_B?: TablePhaseRow[];
  tableMag1_C?: TablePhaseRow[];
  tableMag2_A?: TablePhaseRow[];
  tableMag2_B?: TablePhaseRow[];
  tableMag2_C?: TablePhaseRow[];
  tableMag3_A?: TablePhaseRow[];
  tableMag3_B?: TablePhaseRow[];
  tableMag3_C?: TablePhaseRow[];
  tablePhaseL_4?: TablePhaseRow[];
  tablePhaseN_4?: TablePhaseRow[];
  tablePower_4?: TablePowerRow[];
  [key: string]: any;
  tableMag4_A?: TablePhaseRow[];
  tableMag4_B?: TablePhaseRow[];
  tableMag4_C?: TablePhaseRow[];
}

export const emptyPhaseRow = (): TablePhaseRow => ({
  peakNumber: '', frequency: '', peak: '', average: '', averageLimit: '', quasiPeak: '', quasiPeakLimit: '', quasiPeakDiff: '', averageDiff: '', status: 'Pass'
});

export const emptyPowerRow = (): TablePowerRow => ({
  nr: '', frequency: '', pkValue: '', avgValue: '', qpValue: '', avgLimit: '', qpLimit: '', result: 'Pass', distance: ''
});

interface Props {
  data: EmcData;
  setData: React.Dispatch<React.SetStateAction<EmcData>>;
  title?: string;
  standardId?: string;
  onNameplateOcr?: (values: { manufacturer: string; countryOfOrigin: string }) => void;
}

  const ImageUploader = ({ 
    field, 
    label, 
    data, 
    setData, 
    handleImageUpload,
    onExtractOcr,
    isOcrExtracting
  }: { 
    field: keyof EmcData['images'], 
    label: string, 
    data: any, 
    setData: any, 
    handleImageUpload: any,
    onExtractOcr?: (imgSrc: string) => void,
    isOcrExtracting?: boolean
  }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const imgSrc = data.images[field];

    const onDragOver = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageUpload(field, e.dataTransfer.files[0]);
      }
    };

    const onPaste = (e: React.ClipboardEvent<HTMLDivElement> | globalThis.ClipboardEvent) => {
      if (e.clipboardData) {
        // Try getting image from items first (more reliable for MS Word/Snipping Tool)
        if (e.clipboardData.items) {
          for (let i = 0; i < e.clipboardData.items.length; i++) {
            if (e.clipboardData.items[i].type.indexOf('image') !== -1) {
              const file = e.clipboardData.items[i].getAsFile();
              if (file) {
                e.preventDefault();
                handleImageUpload(field, file);
                return;
              }
            }
          }
        }
        
        // Fallback to files array
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          const file = e.clipboardData.files[0];
          if (file.type.startsWith('image/')) {
            e.preventDefault();
            handleImageUpload(field, file);
          }
        }
      }
    };

    const [isHovered, setIsHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
      const handleGlobalPaste = (e: globalThis.ClipboardEvent) => {
        if (isHovered) {
          e.stopImmediatePropagation();
          onPaste(e as any);
        }
      };
      
      if (isHovered) {
        document.addEventListener('paste', handleGlobalPaste, true);
      }
      return () => document.removeEventListener('paste', handleGlobalPaste, true);
    }, [isHovered, field]);

    return (
      <div 
        className="mt-1 mb-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
        {imgSrc ? (
          <div>
            <div className="relative inline-block border rounded overflow-hidden group">
              <img src={imgSrc} alt={label} className="max-h-40 object-contain" />
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Chỉnh sửa (Cắt / Xoay ảnh)"
                  className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-md cursor-pointer"
                >
                  <Crop size={14} />
                </button>
                <button 
                  type="button"
                  onClick={() => setData((prev: EmcData) => ({ ...prev, images: { ...prev.images, [field]: null, [String(field) + '_vector']: null } }))}
                  title="Xóa ảnh"
                  className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition shadow-md cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              {isEditing && (
                <CropperModal
                  imageSrc={imgSrc}
                  onCropComplete={(croppedBase64) => {
                    setData((prev: EmcData) => ({
                      ...prev,
                      images: {
                        ...prev.images,
                        [field]: croppedBase64,
                        [String(field) + '_vector']: null
                      }
                    }));
                    setIsEditing(false);
                  }}
                  onCancel={() => setIsEditing(false)}
                />
              )}
            </div>
            {String(field).startsWith('label') && onExtractOcr && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onExtractOcr(imgSrc)}
                  disabled={isOcrExtracting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  title="Trích xuất các thông số kỹ thuật (điện áp, công suất, tần số, dòng điện, nhãn hiệu, kiểu loại...) từ ảnh tem nhãn"
                >
                  {isOcrExtracting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Đang trích xuất thông số...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} className="text-yellow-200" />
                      <span>Trích xuất dữ liệu tem nhãn (AI OCR)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div 
            className={`border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition outline-none ${isDragging || isHovered ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onPaste={onPaste}
            tabIndex={0}
          >
            <UploadCloud className={`${isDragging || isHovered ? 'text-green-500' : 'text-slate-400'} mb-1`} size={24} />
            <span className="text-xs text-slate-500 font-medium text-center">Bấm, kéo thả, hoặc dán ảnh (Ctrl+V)</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleImageUpload(field, e.target.files[0]);
                }
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const compositeVectorsInBrowser = async (allVectors: string[], vectorType: string = 'emf'): Promise<string | null> => {
    if (!allVectors || allVectors.length === 0) return null;
    try {
      const images = await Promise.all(
        allVectors.map(async (vecBase64) => {
          try {
            const raw = vecBase64.includes(',') ? vecBase64.split(',')[1] : vecBase64;
            const bin = atob(raw);
            const len = bin.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
            if (vectorType === 'wmf' || vecBase64.includes('image/x-wmf')) {
              return await convertWmfToDataUrl(bytes.buffer, { maxWidth: 2000, dpiScale: 2 });
            } else {
              return await convertEmfToDataUrl(bytes.buffer, { maxWidth: 2000, dpiScale: 2 });
            }
          } catch (e) {
            return null;
          }
        })
      );

      const validImages = images.filter(Boolean) as string[];
      if (!isCompleteVectorComposite(allVectors.length, validImages.length)) return null;
      if (validImages.length === 1) return validImages[0];

      const loadedImgs = await Promise.all(
        validImages.map((src) => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          });
        })
      );

      const sourceW = loadedImgs[0].naturalWidth || loadedImgs[0].width || 1800;
      const sourceH = loadedImgs[0].naturalHeight || loadedImgs[0].height || 1080;
      const { width: masterW, height: masterH } = getVectorCompositeDimensions(sourceW, sourceH);

      const canvas = document.createElement('canvas');
      canvas.width = masterW;
      canvas.height = masterH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return validImages[0];

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, masterW, masterH);

      for (const img of loadedImgs) {
        ctx.drawImage(img, 0, 0, masterW, masterH);
      }

      return canvas.toDataURL('image/png');
    } catch (err) {
      return null;
    }
  };

  const RadimationUploader = ({ field, tableName, setData, extractPage4Data }: { field: string, tableName?: string, setData: any, extractPage4Data?: boolean }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      if (extractPage4Data) formData.append('extractPage4Data', 'true');

      try {
        const res = await fetch('/api/extract-radimation', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        if (result.success) {
          setFileName(file.name);
          
          const rawVectors = Array.isArray(result.allVectors) ? result.allVectors.filter(Boolean) : [];
          const preferBrowserVectorComposite = shouldPreferBrowserVectorComposite(rawVectors.length, result.vectorCompositeComplete);
          let finalImageBase64: string | null = null;
          let usedVector = false;

          if (preferBrowserVectorComposite) {
            try {
              const browserComposite = await compositeVectorsInBrowser(rawVectors, result.vectorType);
              if (browserComposite) {
                finalImageBase64 = browserComposite;
                usedVector = true;
              }
            } catch (cErr) {
            }
          }

          if (!finalImageBase64) {
            finalImageBase64 = (field && result.images && result.images[field]) || result.imageBase64 || null;
          }

          if (!finalImageBase64 && result.vectorBase64) {
            try {
              const rawBase64 = result.vectorBase64.includes(',') ? result.vectorBase64.split(',')[1] : result.vectorBase64;
              const binaryStr = atob(rawBase64);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              if (result.vectorType === 'wmf') {
                finalImageBase64 = await convertWmfToDataUrl(bytes.buffer, { maxWidth: 2000, dpiScale: 2 });
              } else {
                finalImageBase64 = await convertEmfToDataUrl(bytes.buffer, { maxWidth: 2000, dpiScale: 2 });
              }
              usedVector = true;
            } catch (convErr) {
            }
          }

          setData((prev: EmcData) => {
             let newData = { ...prev };
             
             if (field) {
               if (finalImageBase64) {
                 newData.images = {
                   ...newData.images,
                   [field]: finalImageBase64,
                 };
                 if (usedVector && result.vectorBase64) {
                   newData.images[field + '_vector'] = result.vectorBase64;
                 } else {
                   newData.images[field + '_vector'] = null;
                 }
               }
             } else if (result.images) {
               newData.images = {
                 ...newData.images,
                 ...result.images
               };
             }

             const normalizePhaseRow = (row: any) => {
               if (!row) return { peakNumber: '', frequency: '', peak: '', average: '', averageLimit: '', quasiPeak: '', quasiPeakLimit: '', quasiPeakDiff: '', averageDiff: '', status: 'Pass' };
               if (Array.isArray(row)) {
                 if (row.length >= 10) {
                   return {
                     peakNumber: row[0] || '',
                     frequency: row[1] || '',
                     peak: row[2] || '',
                     average: row[3] || '',
                     averageLimit: row[4] || '',
                     quasiPeak: row[5] || '',
                     quasiPeakLimit: row[6] || '',
                     quasiPeakDiff: row[7] || '',
                     averageDiff: row[8] || '',
                     status: row[9] || 'Pass'
                   };
                 }
                 return {
                   peakNumber: row[0] || '',
                   frequency: row[1] || '',
                   peak: '',
                   average: row[2] || '',
                   averageLimit: row[3] || '',
                   quasiPeak: row[4] || '',
                   quasiPeakLimit: row[5] || '',
                   quasiPeakDiff: row[6] || '',
                   averageDiff: row[7] || '',
                   status: row[8] || 'Pass'
                 };
               }
               return {
                 peakNumber: row.peakNumber || row.nr || row.stt || row.no || '',
                 frequency: row.frequency || row.freq || '',
                 peak: row.peak || row.pk || row.pkValue || '',
                 average: row.average || row.avg || row.avgValue || '',
                 averageLimit: row.averageLimit || row.avgLimit || '',
                 quasiPeak: row.quasiPeak || row.qp || row.qpValue || '',
                 quasiPeakLimit: row.quasiPeakLimit || row.qpLimit || '',
                 quasiPeakDiff: row.quasiPeakDiff || row.qpDiff || row.qpMargin || '',
                 averageDiff: row.averageDiff || row.avgDiff || row.avgMargin || '',
                 status: row.status || row.result || 'Pass'
               };
             };

             const normalizePowerRow = (row: any) => {
               if (!row) return { nr: '', frequency: '', pkValue: '', avgValue: '', qpValue: '', avgLimit: '', qpLimit: '', result: 'Pass', distance: '' };
               if (Array.isArray(row)) {
                 return {
                   nr: row[0] || '',
                   frequency: row[1] || '',
                   pkValue: row[2] || '',
                   avgValue: row[3] || '',
                   qpValue: row[4] || '',
                   avgLimit: row[5] || '',
                   qpLimit: row[6] || '',
                   result: row[7] || 'Pass',
                   distance: row[8] || ''
                 };
               }
               return {
                 nr: row.nr || row.stt || row.peakNumber || row.no || '',
                 frequency: row.frequency || row.freq || '',
                 pkValue: row.pkValue || row.pk || row.peak || '',
                 avgValue: row.avgValue || row.avg || row.average || '',
                 qpValue: row.qpValue || row.qp || row.quasiPeak || '',
                 avgLimit: row.avgLimit || row.averageLimit || '',
                 qpLimit: row.qpLimit || row.quasiPeakLimit || '',
                 result: row.result || row.status || 'Pass',
                 distance: row.distance || ''
               };
             };

             if (tableName) {
               let targetRows: any[] = [];
               if (tableName.startsWith('tablePhaseL')) {
                 if (result.tablePhaseL && result.tablePhaseL.length > 0) targetRows = result.tablePhaseL;
                 else if (result.tableData && result.tableData.length > 0) targetRows = result.tableData;
               } else if (tableName.startsWith('tablePhaseN')) {
                 if (result.tablePhaseN && result.tablePhaseN.length > 0) targetRows = result.tablePhaseN;
                 else if (result.tableData && result.tableData.length > 0) targetRows = result.tableData;
               } else if (tableName.startsWith('tableMag')) {
                 if (result.tablePhaseL && result.tablePhaseL.length > 0) targetRows = result.tablePhaseL;
                 else if (result.tableData && result.tableData.length > 0) targetRows = result.tableData;
               } else if (tableName.startsWith('tablePower')) {
                 if (result.tablePower && result.tablePower.length > 0) targetRows = result.tablePower;
                 else if (result.tableData && result.tableData.length > 0) targetRows = result.tableData;
               } else {
                 if (result.tableData && result.tableData.length > 0) targetRows = result.tableData;
                 else if (result.tablePhaseL && result.tablePhaseL.length > 0) targetRows = result.tablePhaseL;
               }

               if (targetRows.length > 0) {
                 let currentTable = [...((((newData as any)[tableName]) as any[]) || [])];
                 
                 let startIndex = 0;
                 if (Array.isArray(targetRows[0]) && targetRows[0].length > 0 && isNaN(Number(targetRows[0][0]))) {
                   startIndex = 1;
                 }
                 
                 const isPower = tableName.startsWith('tablePower');
                 let rowIdx = 0;
                 
                 for (let i = startIndex; i < targetRows.length; i++) {
                   const row = targetRows[i];
                   const mappedObj = isPower ? normalizePowerRow(row) : normalizePhaseRow(row);
                   
                   if (rowIdx < currentTable.length) {
                     currentTable[rowIdx] = { ...currentTable[rowIdx], ...mappedObj };
                   } else {
                     currentTable.push(mappedObj);
                   }
                   rowIdx++;
                 }
                 (newData as any)[tableName] = currentTable;
               }
             } else {
               if (result.tablePhaseL && result.tablePhaseL.length > 0) {
                 newData.tablePhaseL = result.tablePhaseL.map(normalizePhaseRow);
               }
               if (result.tablePhaseN && result.tablePhaseN.length > 0) {
                 newData.tablePhaseN = result.tablePhaseN.map(normalizePhaseRow);
               }
               if (result.tablePower && result.tablePower.length > 0) {
                 newData.tablePower = result.tablePower.map(normalizePowerRow);
               }
             }

             if (result.info) {
               newData.info = {
                 ...newData.info,
                 ...result.info
               };
             }

             return newData;
          });
        } else {
          alert('Lỗi: ' + result.error);
        }
      } catch (err) {
        alert('Lỗi kết nối đến server');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="flex items-center gap-2 mb-2">
        {fileName ? (
           <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded border border-green-300 shadow-sm flex items-center gap-1 cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Bấm để tải lại file khác">
             📄 {fileName}
           </span>
        ) : (
           <button
             onClick={() => fileInputRef.current?.click()}
             disabled={loading}
             className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100 transition flex items-center gap-1 font-medium shadow-sm"
           >
             {loading ? '⏳ Đang xử lý...' : '📥 Tải file gốc DOCX'}
           </button>
        )}
        <input type="file" accept=".docx" className="hidden" ref={fileInputRef} onChange={handleUpload} />
      </div>
    );
  };

  const TablePhaseLN = ({ tableName, data, handleTableChange, handlePaste, unit = "dBµV", showPeak = false }: { tableName: string, data: any, handleTableChange: any, handlePaste: any, unit?: string, showPeak?: boolean }) => (
    <div className="overflow-x-auto mb-4 border border-slate-200 bg-white">
      <table className="min-w-full text-xs border-collapse bg-white">
        <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-tight">
          <tr>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Peak Number</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Freq<br/>(MHz)</th>
            {showPeak && (
              <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Peak<br/>({unit})</th>
            )}
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Avg<br/>({unit})</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Avg Limit<br/>({unit})</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Q.P<br/>({unit})</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Q.P Limit<br/>({unit})</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Q.P Diff<br/>(dB)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Avg Diff<br/>(dB)</th>
            <th className="border-b border-slate-200 px-1 py-1 text-center font-semibold">Result</th>
          </tr>
        </thead>
        <tbody>
          {((data[tableName] && data[tableName].length > 0) ? data[tableName] : Array.from({ length: 6 }, () => ({ peakNumber: '', frequency: '', peak: '', average: '', quasiPeak: '', averageLimit: '', quasiPeakLimit: '', quasiPeakDiff: '', averageDiff: '', status: 'Pass' }))).map((row: TablePhaseRow, idx: number) => (
            <tr key={idx} className="text-center hover:bg-slate-50/50 transition-colors">
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.peakNumber || ''} onChange={e => handleTableChange(tableName, idx, 'peakNumber', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'peakNumber')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.frequency || ''} onChange={e => handleTableChange(tableName, idx, 'frequency', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'frequency')} /></td>
              {showPeak && (
                <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.peak || ''} onChange={e => handleTableChange(tableName, idx, 'peak', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'peak')} /></td>
              )}
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.average || ''} onChange={e => handleTableChange(tableName, idx, 'average', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'average')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.averageLimit || ''} onChange={e => handleTableChange(tableName, idx, 'averageLimit', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'averageLimit')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.quasiPeak || ''} onChange={e => handleTableChange(tableName, idx, 'quasiPeak', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'quasiPeak')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.quasiPeakLimit || ''} onChange={e => handleTableChange(tableName, idx, 'quasiPeakLimit', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'quasiPeakLimit')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.quasiPeakDiff || ''} onChange={e => handleTableChange(tableName, idx, 'quasiPeakDiff', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'quasiPeakDiff')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.averageDiff || ''} onChange={e => handleTableChange(tableName, idx, 'averageDiff', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'averageDiff')} /></td>
              <td className="border-b border-slate-200 p-0">
                <select className={`w-full text-center outline-none py-1 px-0.5 font-bold text-[10px] uppercase tracking-wider bg-transparent focus:bg-emerald-50 transition-colors ${row.status === 'Pass' ? 'text-emerald-600' : row.status === 'Fail' ? 'text-red-600' : 'text-slate-400'}`} value={row.status || ''} onChange={e => handleTableChange(tableName, idx, 'status', e.target.value)}>
                  <option value="">-</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const TableMagnetic = ({ tableName, data, handleTableChange, handlePaste }: { tableName: string, data: any, handleTableChange: any, handlePaste: any }) => (
    <div className="overflow-x-auto mb-4 border border-slate-200 bg-white">
      <table className="min-w-full text-xs border-collapse bg-white">
        <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-tight">
          <tr>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Peak<br/>Number</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Frequency<br/>(MHz)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Average<br/>(dBµA)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Quasi-<br/>Peak<br/>(dBµA)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Quasi-<br/>Peak<br/>Limit<br/>(dBµA)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Quasi-Peak<br/>Difference<br/>(dB)</th>
            <th className="border-b border-slate-200 px-1 py-1 text-center font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {((data[tableName] && data[tableName].length > 0) ? data[tableName] : Array.from({ length: 6 }, () => ({ peakNumber: '', frequency: '', peak: '', average: '', quasiPeak: '', averageLimit: '', quasiPeakLimit: '', quasiPeakDiff: '', averageDiff: '', status: 'Pass' }))).map((row: TablePhaseRow, idx: number) => (
            <tr key={idx} className="text-center hover:bg-slate-50/50 transition-colors">
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.peakNumber || ''} onChange={e => handleTableChange(tableName, idx, 'peakNumber', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'peakNumber')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.frequency || ''} onChange={e => handleTableChange(tableName, idx, 'frequency', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'frequency')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.average || ''} onChange={e => handleTableChange(tableName, idx, 'average', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'average')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.quasiPeak || ''} onChange={e => handleTableChange(tableName, idx, 'quasiPeak', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'quasiPeak')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.quasiPeakLimit || ''} onChange={e => handleTableChange(tableName, idx, 'quasiPeakLimit', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'quasiPeakLimit')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.quasiPeakDiff || ''} onChange={e => handleTableChange(tableName, idx, 'quasiPeakDiff', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'quasiPeakDiff')} /></td>
              <td className="border-b border-slate-200 p-0">
                <select className={`w-full text-center outline-none py-1 px-0.5 font-bold text-[10px] uppercase tracking-wider bg-transparent focus:bg-emerald-50 transition-colors ${row.status === 'Pass' ? 'text-emerald-600' : row.status === 'Fail' ? 'text-red-600' : 'text-slate-400'}`} value={row.status || ''} onChange={e => handleTableChange(tableName, idx, 'status', e.target.value)}>
                  <option value="">-</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const TablePowerDisturbance = ({ tableName, data, handleTableChange, handlePaste }: { tableName: string, data: any, handleTableChange: any, handlePaste: any }) => (
    <div className="overflow-x-auto mb-4 border border-slate-200 bg-white">
      <table className="min-w-full text-xs border-collapse bg-white">
        <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-tight">
          <tr>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Nr</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Freq<br/>(MHz)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">PK<br/>(dBpW)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">AVG<br/>(dBpW)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">QP<br/>(dBpW)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">AVG Lmt<br/>(dBpW)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">QP Lmt<br/>(dBpW)</th>
            <th className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Result</th>
            <th className="border-b border-slate-200 px-1 py-1 text-center font-semibold">Dist<br/>(m)</th>
          </tr>
        </thead>
        <tbody>
          {((data[tableName] && data[tableName].length > 0) ? data[tableName] : [{ nr: '', frequency: '', pkValue: '', avgValue: '', qpValue: '', avgLimit: '', qpLimit: '', result: 'Pass', distance: '' }]).map((row: TablePowerRow, idx: number) => (
            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.nr || ''} onChange={e => handleTableChange(tableName, idx, 'nr', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'nr')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.frequency || ''} onChange={e => handleTableChange(tableName, idx, 'frequency', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'frequency')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.pkValue || ''} onChange={e => handleTableChange(tableName, idx, 'pkValue', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'pkValue')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.avgValue || ''} onChange={e => handleTableChange(tableName, idx, 'avgValue', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'avgValue')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.qpValue || ''} onChange={e => handleTableChange(tableName, idx, 'qpValue', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'qpValue')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.avgLimit || ''} onChange={e => handleTableChange(tableName, idx, 'avgLimit', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'avgLimit')} /></td>
              <td className="border-b border-r border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.qpLimit || ''} onChange={e => handleTableChange(tableName, idx, 'qpLimit', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'qpLimit')} /></td>
              <td className="border-b border-r border-slate-200 p-0">
                 <select className={`w-full text-center outline-none py-1 px-0.5 font-bold text-[10px] uppercase tracking-wider bg-transparent focus:bg-emerald-50 transition-colors cursor-pointer ${row.result === 'Pass' ? 'text-emerald-600' : row.result === 'Fail' ? 'text-red-600' : 'text-slate-400'}`} value={row.result || ''} onChange={e => handleTableChange(tableName, idx, 'result', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'result')}>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="N/A">N/A</option>
                 </select>
              </td>
              <td className="border-b border-slate-200 p-0"><input type="text" className="w-full text-center outline-none py-1 px-0.5 bg-transparent font-mono focus:bg-emerald-50 focus:text-emerald-900 transition-colors" value={row.distance || ''} onChange={e => handleTableChange(tableName, idx, 'distance', e.target.value)} onPaste={(e) => handlePaste(e, tableName, idx, 'distance')} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

export default function EmcBepDien1VungNauForm({ data, setData, title, standardId, onNameplateOcr }: Props) {
  const isDieuHoa = title?.toLowerCase().includes('điều hòa');

  const [isOcrExtracting, setIsOcrExtracting] = useState<boolean>(false);
  const [extraLabelFields, setExtraLabelFields] = useState<string[]>([]);
  const [extractedOcrData, setExtractedOcrData] = useState<{
    brand?: string;
    model?: string;
    voltage?: string;
    power?: string;
    current?: string;
    frequency?: string;
    clockFreq?: string;
    coolingHeatingPower?: string;
    origin?: string;
    countryOfOrigin?: string;
    manufacturer?: string;
  } | null>(null);
  const [dismissedBrandMismatch, setDismissedBrandMismatch] = useState<boolean>(false);
  const [dismissedModelMismatch, setDismissedModelMismatch] = useState<boolean>(false);

  const defaultLabelFields = standardId === 'emc_dieu_hoa' ? ['label', 'label2'] : ['label'];
  const existingExtraInImages = Object.keys(data.images || {})
    .filter(k => /^label\d+$/.test(k) && (standardId !== 'emc_dieu_hoa' || k !== 'label2') && (data.images as any)[k]);
  const labelFieldNumber = (field: string) => field === 'label' ? 1 : Number(field.slice('label'.length));
  const allLabelFields = Array.from(new Set([...defaultLabelFields, ...existingExtraInImages, ...extraLabelFields]))
    .sort((left, right) => labelFieldNumber(left) - labelFieldNumber(right));

  const handleAddLabelField = () => {
    let nextNum = 2;
    while (allLabelFields.includes(`label${nextNum}`) || (nextNum === 1 && allLabelFields.includes('label'))) {
      nextNum++;
    }
    const newField = `label${nextNum}`;
    setExtraLabelFields(prev => [...prev, newField]);
  };

  const handleRemoveLabelField = (fieldKey: string) => {
    setExtraLabelFields(prev => prev.filter(k => k !== fieldKey));
    setData(prev => {
      const nextImages: any = { ...(prev.images || {}) };
      delete nextImages[fieldKey];
      return { 
        ...prev, 
        images: {
          ...nextImages,
          label: nextImages.label !== undefined ? nextImages.label : (prev.images?.label ?? null)
        } as any
      };
    });
  };

  const isDifference = (valA?: string, valB?: string) => {
    if (!valA || !valB) return false;
    const cleanA = valA.trim().toLowerCase().replace(/\s+/g, ' ');
    const cleanB = valB.trim().toLowerCase().replace(/\s+/g, ' ');
    return cleanA !== cleanB;
  };

  const handleExtractOcrFromImage = async (imgSrc: string | string[]) => {
    const isArr = Array.isArray(imgSrc);
    const list = isArr ? imgSrc.filter(Boolean) : [imgSrc].filter(Boolean);
    if (list.length === 0) return;
    setIsOcrExtracting(true);
    try {
      const state = useStore.getState();
      const currentUser = state.currentUser;
      const userApiKey = currentUser ? state.userPreferences[currentUser.username]?.geminiApiKey : undefined;
      const geminiModel = resolveGeminiModel(state);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userApiKey) headers["X-Gemini-API-Key"] = userApiKey;
      if (geminiModel) headers["x-gemini-model"] = geminiModel;

      const cleanList = list.map(img => img.includes(',') ? img.split(',')[1] : img);
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          action: "ocr", 
          base64s: cleanList,
          base64: cleanList[0] 
        })
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Lỗi kết nối máy chủ khi trích xuất OCR");
      }
      
      const json = await res.json();
      const parsed = JSON.parse(json.text || "{}");
      
      const extracted = {
        brand: (parsed.brand || '').trim(),
        model: (parsed.model || '').trim(),
        voltage: (parsed.voltage || '').trim(),
        power: (parsed.power || '').trim(),
        current: (parsed.current || '').trim(),
        frequency: (parsed.frequency || '').trim(),
        clockFreq: (parsed.clockFreq || '').trim(),
        coolingHeatingPower: (parsed.coolingHeatingPower || '').trim(),
        origin: (parsed.origin || '').trim(),
        countryOfOrigin: (parsed.countryOfOrigin || parsed.origin || '').trim(),
        manufacturer: (parsed.manufacturer || '').trim()
      };

      const normalizedNameplate = normalizeNameplateOcrValues(extracted);
      const normalizedExtracted = { ...extracted, ...normalizedNameplate };

      setExtractedOcrData(normalizedExtracted);
      setDismissedBrandMismatch(false);
      setDismissedModelMismatch(false);

      setData(prev => {
        const next = { ...prev };
        next.voltage = normalizedNameplate.voltage;
        next.power = normalizedNameplate.power;
        next.current = normalizedNameplate.current;
        next.frequency = normalizedNameplate.frequency;
        next.clockFreq = normalizedNameplate.clockFreq;
        if (extracted.coolingHeatingPower) next.coolingHeatingPower = extracted.coolingHeatingPower;
        
        if (!next.brand?.trim() && extracted.brand) {
          next.brand = extracted.brand;
        }
        if (!next.model?.trim() && extracted.model) {
          next.model = extracted.model;
        }
        return next;
      });

      onNameplateOcr?.({
        manufacturer: normalizedNameplate.manufacturer,
        countryOfOrigin: normalizedNameplate.countryOfOrigin,
      });

      const countFilled = [extracted.voltage, extracted.power, extracted.current, extracted.frequency, extracted.clockFreq, extracted.coolingHeatingPower].filter(Boolean).length;
      if (list.length > 1) {
        toast.success(`Đã phân tích tổng hợp ${list.length} ảnh tem nhãn và điền ${countFilled} thông số thành công!`);
      } else {
        toast.success(`Đã trích xuất ${countFilled} thông số từ tem nhãn vào form thành công!`);
      }
    } catch (err: any) {
      console.error("OCR Extraction failed:", err);
      toast.error("Không thể trích xuất dữ liệu từ ảnh tem nhãn. Vui lòng kiểm tra lại ảnh.");
    } finally {
      setIsOcrExtracting(false);
    }
  };

  const handleTextChange = (field: keyof Omit<EmcData, 'images' | 'tablePhaseL' | 'tablePhaseN' | 'tablePower'>, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleTableChange = (tableName: string, rowIndex: number, field: string, value: string) => {
    setData(prev => {
      const currentTable = (prev as any)[tableName] || [];
      const newTable = [...currentTable];
      newTable[rowIndex] = { ...newTable[rowIndex], [field]: value };
      return { ...prev, [tableName]: newTable };
    });
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>,
    tableName: string,
    startRowIndex: number,
    startColName: string
  ) => {
    const clipboardData = e.clipboardData.getData('text');
    // Bỏ qua nếu chỉ là text bình thường (không có tab hoặc xuống dòng)
    if (!clipboardData.includes('\t') && !clipboardData.includes('\n')) {
      return;
    }
    
    e.preventDefault();
    
    // Tách các dòng (bỏ qua dòng trống ở cuối)
    const rows = clipboardData.split(/\r?\n/).filter(r => r.trim() !== '');
    // Tách các cột theo dấu tab
    const dataGrid = rows.map(r => r.split('\t'));
    
    const colOrderPhase = ['peakNumber', 'frequency', 'average', 'averageLimit', 'quasiPeak', 'quasiPeakLimit', 'quasiPeakDiff', 'averageDiff', 'status'];
    const colOrderPower = ['nr', 'frequency', 'pkValue', 'avgValue', 'qpValue', 'avgLimit', 'qpLimit', 'result', 'distance'];
    const colOrder = tableName.startsWith('tablePower') ? colOrderPower : colOrderPhase;
    
    const startColIndex = colOrder.indexOf(startColName);
    if (startColIndex === -1) return;

    setData(prev => {
      const currentTable = (prev as any)[tableName] || [];
      const newTable = [...currentTable];
      
      dataGrid.forEach((rowValues, i) => {
        const targetRowIndex = startRowIndex + i;
        if (targetRowIndex < newTable.length) {
          const updatedRow = { ...newTable[targetRowIndex] };
          rowValues.forEach((val, j) => {
            const targetColIndex = startColIndex + j;
            if (targetColIndex < colOrder.length) {
               const field = colOrder[targetColIndex];
               updatedRow[field] = val.trim();
            }
          });
          newTable[targetRowIndex] = updatedRow;
        }
      });
      
      return { ...prev, [tableName]: newTable };
    });
  };

  const handleImageUpload = (field: keyof EmcData['images'], file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setData(prev => {
        const newData = {
          ...prev,
          images: {
            ...prev.images,
            [field]: reader.result as string,
            [String(field) + '_vector']: null
          }
        };
        return newData;
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h2 className="text-lg font-bold mb-4 text-green-800 border-b pb-2">Form Đánh Giá: {title || 'EMC'}</h2>

      {(() => {
        const safeTitle = title || '';
        const is4Zone = safeTitle === 'Bếp từ 4 vùng nấu';
        const is3Zone = safeTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || safeTitle === 'Bếp từ 3 vùng nấu';
        const is1T1HN = safeTitle === 'Bếp từ + hồng ngoại';
        const is2Zone = safeTitle === 'Bếp điện 2 vùng nấu' || safeTitle === 'Bếp từ 2 vùng nấu';
        const isAirCon2Way = standardId === 'emc_dieu_hoa' && safeTitle.toLowerCase().includes('hai chiều');
        const isAirCon1Way = standardId === 'emc_dieu_hoa' && safeTitle.toLowerCase().includes('một chiều');
        const isAirConNoLoad = standardId === 'emc_dieu_hoa' && safeTitle.toLowerCase().includes('không có đầu nối tải');
        const isAirCon1Khoi = standardId === 'emc_dieu_hoa' && safeTitle.toLowerCase().includes('1 khối');
        const hasMagnetic = safeTitle.toLowerCase().includes('từ');
        const numMagZones = safeTitle.includes('4 vùng nấu') ? 4 : (safeTitle.includes('3 vùng nấu') ? 3 : (safeTitle.includes('2 vùng nấu') ? 2 : 1));
        const isWashingMachineWithDryer = standardId === 'emc_may_giat' && safeTitle === 'Có chức năng sấy';
        const isWashingMachineWithoutDryer = standardId === 'emc_may_giat' && safeTitle === 'Không có chức năng sấy';
        const isVacuumWithHand = ((standardId === 'emc_may_hut_bui' || standardId === 'emc_may_xay') && safeTitle === 'Có dùng tay giả') || standardId === 'emc_may_say_toc';
        const isVacuumWithoutHand = (standardId === 'emc_may_hut_bui' || standardId === 'emc_may_xay') && safeTitle === 'Không dùng tay giả';
        const isDrill = standardId === 'emc_may_khoan';
        const isVacuum = isVacuumWithHand || isVacuumWithoutHand || isDrill;
        
        let zones = [{ id: 1, name: 'Vùng 1', suffix: '' }];
        if (isAirCon2Way) {
          zones = [
            { id: 1, name: 'chế độ lạnh', suffix: ' - Đo tại chế độ lạnh' },
            { id: 2, name: 'chế độ nóng', suffix: ' - Đo tại chế độ nóng' }
          ];
        } else if (isAirCon1Way) {
          zones = [
            { id: 1, name: 'chế độ lạnh', suffix: ' - Đo tại chế độ lạnh' }
          ];
        } else if (is4Zone) {
          zones = [
            { id: 1, name: 'vùng nấu thứ nhất', suffix: ' - vùng nấu thứ nhất' },
            { id: 2, name: 'vùng nấu thứ hai', suffix: ' - vùng nấu thứ hai' },
            { id: 3, name: 'vùng nấu thứ ba', suffix: ' - vùng nấu thứ ba' },
            { id: 4, name: 'vùng nấu thứ tư', suffix: ' - vùng nấu thứ tư' }
          ];
        } else if (is3Zone) {
          zones = [
            { id: 1, name: 'vùng nấu thứ nhất', suffix: ' - vùng nấu thứ nhất' },
            { id: 2, name: 'vùng nấu thứ hai', suffix: ' - vùng nấu thứ hai' },
            { id: 3, name: 'vùng nấu thứ ba', suffix: ' - vùng nấu thứ ba' }
          ];
        } else if (is1T1HN) {
          zones = [
            { id: 1, name: 'vùng nấu thứ nhất', suffix: ' - vùng nấu thứ nhất' },
            { id: 2, name: 'vùng nấu thứ hai', suffix: ' - vùng nấu thứ hai' }
          ];
        } else if (is2Zone) {
          zones = [
            { id: 1, name: 'Vùng 1', suffix: ' - Vùng 1' },
            { id: 2, name: 'Vùng 2', suffix: ' - Vùng 2' }
          ];
        } else if (isWashingMachineWithDryer) {
          zones = [
            { id: 1, name: 'chế độ giặt', suffix: ' - Chế độ giặt' },
            { id: 2, name: 'chế độ vắt', suffix: ' - Chế độ vắt' },
            { id: 3, name: 'chế độ sấy', suffix: ' - Chế độ sấy' }
          ];
        } else if (isWashingMachineWithoutDryer) {
          zones = [
            { id: 1, name: 'chế độ giặt', suffix: ' - Chế độ giặt' },
            { id: 2, name: 'chế độ vắt', suffix: ' - Chế độ vắt' }
          ];
        } else if (isDrill) {
          zones = [
            { id: 1, name: 'quay cùng chiều kim đồng hồ và không sử dụng tay giả', suffix: '' },
            { id: 2, name: 'quay ngược chiều kim đồng hồ và không sử dụng tay giả', suffix: '_2' },
            { id: 3, name: 'quay cùng chiều kim đồng hồ và sử dụng tay giả', suffix: '_3' },
            { id: 4, name: 'quay ngược chiều kim đồng hồ và sử dụng tay giả', suffix: '_4' }
          ];
        } else if (isVacuumWithHand) {
          zones = [
            { id: 1, name: 'chế độ không sử dụng tay giả', suffix: ' - Chế độ không sử dụng tay giả' },
            { id: 2, name: 'chế độ sử dụng tay giả', suffix: ' - Chế độ sử dụng tay giả' }
          ];
        } else if (isVacuumWithoutHand) {
          zones = [
            { id: 1, name: 'chế độ không sử dụng tay giả', suffix: ' - Chế độ không sử dụng tay giả' }
          ];
        }
        
        const getField = (base: string, id: number) => (id === 1 ? base : `${base}_${id}`) as any;
        const getSectionNum = (base: number) => hasMagnetic ? (base === 6 ? 7 : (base === 7 ? 8 : base)) : base;

          let extraVoltageTables = [
            { key: 'phaseL_outdoor', label: 'Pha L cục nóng' },
            { key: 'phaseN_outdoor', label: 'Pha N cục nóng' },
            { key: 'phaseL_indoor', label: 'Pha L cục lạnh' },
            { key: 'phaseN_indoor', label: 'Pha N cục lạnh' },
            { key: 'S1_outdoor', label: 'S1 cục nóng' },
            { key: 'S1_indoor', label: 'S1 cục lạnh' },
            { key: 'PE_outdoor', label: 'PE cục nóng' },
            { key: 'PE_indoor', label: 'PE cục lạnh' },
          ];

          if (isAirCon1Khoi) {
            extraVoltageTables = [];
          } else if (isAirConNoLoad) {
            extraVoltageTables = extraVoltageTables.filter(t => t.key !== 'S1_outdoor' && t.key !== 'S1_indoor');
          }

          let extraPowerTables = [
            { key: 'powerDisturbance_indoor', label: 'dây nối hai khối phía cục lạnh' },
            { key: 'powerDisturbance_outdoor', label: 'dây nối hai khối phía cục nóng' },
          ];

          if (isAirCon1Khoi) {
            extraPowerTables = [];
          }

        const hasBrandMismatch = Boolean(extractedOcrData?.brand && !dismissedBrandMismatch && isDifference(data.brand, extractedOcrData.brand));
        const isBrandMatched = Boolean(extractedOcrData?.brand && !isDifference(data.brand, extractedOcrData.brand));

        const hasModelMismatch = Boolean(extractedOcrData?.model && !dismissedModelMismatch && isDifference(data.model, extractedOcrData.model));
        const isModelMatched = Boolean(extractedOcrData?.model && !isDifference(data.model, extractedOcrData.model));

        return (
          <>
            {/* 3.1 */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-1">
          <h3 className="text-base font-semibold text-slate-800">3.1. Thông tin EUT (EUT info)</h3>
          {extractedOcrData && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles size={12} className="text-emerald-600" />
              <span>Đã trích xuất thông số từ tem nhãn</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Nhãn hiệu (Brand name)</label>
              {hasBrandMismatch && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-300 animate-pulse" title="Nhãn hiệu khác với tem nhãn">
                  <AlertTriangle size={11} className="text-amber-600" />
                  <span>Khác tem nhãn</span>
                </span>
              )}
              {isBrandMatched && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  <span>Khớp tem nhãn</span>
                </span>
              )}
            </div>
            <div className="relative">
              <input 
                type="text" 
                value={data.brand || ''} 
                onChange={e => handleTextChange('brand', e.target.value)} 
                className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 transition-colors ${
                  hasBrandMismatch 
                    ? 'border-amber-400 bg-amber-50/60 focus:ring-amber-500 pr-8' 
                    : 'border-yellow-400 bg-yellow-50 focus:ring-yellow-500 hover:border-yellow-500'
                }`} 
                placeholder="Nhập nhãn hiệu..." 
              />
              {hasBrandMismatch && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" title="Cảnh báo: Khác với giá trị OCR tem nhãn">
                  <AlertTriangle size={16} />
                </div>
              )}
            </div>

            {hasBrandMismatch && (
              <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-900 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-1 font-bold text-amber-800 mb-1">
                  <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                  <span>Khác biệt giữa CSDL và Tem nhãn:</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] bg-white/90 p-1.5 rounded border border-amber-200 mb-1.5">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Hiện tại (DB):</span>
                    <span className="font-semibold">{data.brand || '(Trống)'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[10px]">Tem nhãn (AI):</span>
                    <span className="font-semibold text-emerald-800">{extractedOcrData!.brand}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleTextChange('brand', extractedOcrData!.brand!);
                      setDismissedBrandMismatch(true);
                    }}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
                  >
                    <Check size={12} /> Dùng từ tem nhãn
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedBrandMismatch(true)}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-medium transition cursor-pointer"
                  >
                    Giữ nguyên DB
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Kiểu loại (Model)</label>
              {hasModelMismatch && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-300 animate-pulse" title="Kiểu loại khác với tem nhãn">
                  <AlertTriangle size={11} className="text-amber-600" />
                  <span>Khác tem nhãn</span>
                </span>
              )}
              {isModelMatched && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  <span>Khớp tem nhãn</span>
                </span>
              )}
            </div>
            <div className="relative">
              <input 
                type="text" 
                value={data.model || ''} 
                onChange={e => handleTextChange('model', e.target.value)} 
                className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 transition-colors ${
                  hasModelMismatch 
                    ? 'border-amber-400 bg-amber-50/60 focus:ring-amber-500 pr-8' 
                    : 'border-yellow-400 bg-yellow-50 focus:ring-yellow-500 hover:border-yellow-500'
                }`} 
                placeholder="Nhập kiểu loại..." 
              />
              {hasModelMismatch && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" title="Cảnh báo: Khác với giá trị OCR tem nhãn">
                  <AlertTriangle size={16} />
                </div>
              )}
            </div>

            {hasModelMismatch && (
              <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-900 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-1 font-bold text-amber-800 mb-1">
                  <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                  <span>Khác biệt giữa CSDL và Tem nhãn:</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] bg-white/90 p-1.5 rounded border border-amber-200 mb-1.5">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Hiện tại (DB):</span>
                    <span className="font-semibold">{data.model || '(Trống)'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[10px]">Tem nhãn (AI):</span>
                    <span className="font-semibold text-emerald-800">{extractedOcrData!.model}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleTextChange('model', extractedOcrData!.model!);
                      setDismissedModelMismatch(true);
                    }}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
                  >
                    <Check size={12} /> Dùng từ tem nhãn
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedModelMismatch(true)}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-medium transition cursor-pointer"
                  >
                    Giữ nguyên DB
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5 block">Điện áp danh nghĩa (Rated voltage)</label>
            <input type="text" value={data.voltage || ''} onChange={e => handleTextChange('voltage', e.target.value)} className="w-full border-b border-slate-300 py-1 px-0 bg-transparent text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="VD: 220-240V" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5 block">Công suất danh nghĩa (Rated power)</label>
            <input type="text" value={data.power || ''} onChange={e => handleTextChange('power', e.target.value)} className="w-full border-b border-slate-300 py-1 px-0 bg-transparent text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="VD: 2000W" />
          </div>
          {standardId === 'emc_dieu_hoa' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5 block">Công suất lạnh/sưởi (Cooling/Heating)</label>
              <input type="text" value={data.coolingHeatingPower || ''} onChange={e => handleTextChange('coolingHeatingPower' as any, e.target.value)} className="w-full border-b border-slate-300 py-1 px-0 bg-transparent text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="VD: 1.5 HP" />
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5 block">Dòng điện danh nghĩa (Rated current)</label>
            <input type="text" value={data.current || ''} onChange={e => handleTextChange('current', e.target.value)} className="w-full border-b border-slate-300 py-1 px-0 bg-transparent text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="Nhập dòng điện..." />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5 block">Tần số danh nghĩa (Rated frequency)</label>
            <input type="text" value={data.frequency} onChange={e => handleTextChange('frequency', e.target.value)} className="w-full border-b border-slate-300 py-1 px-0 bg-transparent text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="VD: 50/60Hz" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5 block">Tần số xung nhịp lớn nhất (&lt; 30 MHz)</label>
            <input type="text" value={data.clockFreq} onChange={e => handleTextChange('clockFreq', e.target.value)} className="w-full border-b border-slate-300 py-1 px-0 bg-transparent text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="Nhập tần số xung nhịp..." />
          </div>
        </div>
        
        {/* Dynamic Multi-Label Section */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">Ảnh tem nhãn thông số (Label photos)</span>
              <span className="text-[10px] text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {allLabelFields.filter(f => Boolean((data.images as any)?.[f])).length}/{allLabelFields.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddLabelField}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded border border-blue-200 shadow-2xs cursor-pointer transition"
              title="Thêm ô ảnh tem nhãn (cho thiết bị nhiều tem: dàn nóng, dàn lạnh, máy nén, tem niêm phong...)"
            >
              <Plus size={13} />
              <span>Thêm tem</span>
            </button>
          </div>

          <div className={`grid ${allLabelFields.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {allLabelFields.map((f, idx) => (
              <div key={f} className="relative">
                <ImageUploader 
                  data={data} 
                  setData={setData} 
                  handleImageUpload={handleImageUpload} 
                  onExtractOcr={handleExtractOcrFromImage} 
                  isOcrExtracting={isOcrExtracting} 
                  field={f} 
                  label={`Ảnh tem nhãn ${idx + 1} (Label photo ${idx + 1})`} 
                />
                {idx >= (standardId === 'emc_dieu_hoa' ? 2 : 1) && !(data.images as any)?.[f] && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLabelField(f)}
                    title="Xóa ô tem này"
                    className="absolute top-1 right-1 bg-slate-200 hover:bg-red-500 hover:text-white text-slate-600 p-1 rounded-full text-[10px] transition cursor-pointer shadow-2xs z-10"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {allLabelFields.map(f => (data.images as any)?.[f]).filter(Boolean).length >= 2 && (
            <div className="mt-3 p-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-md flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-950">
                    OCR Tổng Hợp {allLabelFields.map(f => (data.images as any)?.[f]).filter(Boolean).length} Tem Nhãn
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    Tự động gộp và phân tích các thông số từ tất cả ảnh tem nhãn
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleExtractOcrFromImage(allLabelFields.map(f => (data.images as any)?.[f]).filter(Boolean))}
                disabled={isOcrExtracting}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 transition shrink-0"
              >
                {isOcrExtracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-yellow-200" />}
                <span>Chạy OCR tổng hợp</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Điều kiện môi trường */}
      <section className="mb-4">
        <h3 className="text-[13px] font-bold text-emerald-800 mb-3 border-b border-slate-300 pb-1 uppercase tracking-wide">Điều kiện môi trường (Ambient condition)</h3>
        {zones.length > 1 && standardId === 'emc_dieu_hoa' ? (
          <div className="space-y-4">
            <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
              <h4 className="font-semibold text-blue-800 mb-2">Chế độ lạnh (Cooling mode)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                  <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Nhiệt độ (Temperature):</label>
                  <input type="text" value={data.ambientTemp || ''} onChange={e => handleTextChange('ambientTemp', e.target.value)} className="w-24 border-b border-slate-300 w-24 px-1 py-0.5 outline-none bg-transparent focus:border-emerald-500 font-bold text-emerald-800 text-center transition-colors" />
                  <span className="text-sm font-medium text-slate-700">°C</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                  <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Độ ẩm (Humidity):</label>
                  <input type="text" value={data.ambientHumidity || ''} onChange={e => handleTextChange('ambientHumidity', e.target.value)} className="w-24 border-b border-slate-300 w-24 px-1 py-0.5 outline-none bg-transparent focus:border-emerald-500 font-bold text-emerald-800 text-center transition-colors" />
                  <span className="text-sm font-medium text-slate-700">%</span>
                </div>
              </div>
            </div>
            <div className="bg-orange-50/50 p-3 rounded border border-orange-100">
              <h4 className="font-semibold text-orange-800 mb-2">Chế độ nóng (Heating mode)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                  <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Nhiệt độ (Temperature):</label>
                  <input type="text" value={data.ambientTemp_2 || ''} onChange={e => handleTextChange('ambientTemp_2' as any, e.target.value)} className="w-24 border-b border-slate-300 w-24 px-1 py-0.5 outline-none bg-transparent focus:border-emerald-500 font-bold text-emerald-800 text-center transition-colors" />
                  <span className="text-sm font-medium text-slate-700">°C</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                  <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Độ ẩm (Humidity):</label>
                  <input type="text" value={data.ambientHumidity_2 || ''} onChange={e => handleTextChange('ambientHumidity_2' as any, e.target.value)} className="w-24 border-b border-slate-300 w-24 px-1 py-0.5 outline-none bg-transparent focus:border-emerald-500 font-bold text-emerald-800 text-center transition-colors" />
                  <span className="text-sm font-medium text-slate-700">%</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Nhiệt độ (Temperature):</label>
              <input type="text" value={data.ambientTemp || ''} onChange={e => handleTextChange('ambientTemp', e.target.value)} className="w-24 border-b border-slate-300 w-24 px-1 py-0.5 outline-none bg-transparent focus:border-emerald-500 font-bold text-emerald-800 text-center transition-colors" />
              <span className="text-sm font-medium text-slate-700">°C</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Độ ẩm (Humidity):</label>
              <input type="text" value={data.ambientHumidity || ''} onChange={e => handleTextChange('ambientHumidity', e.target.value)} className="w-24 border-b border-slate-300 w-24 px-1 py-0.5 outline-none bg-transparent focus:border-emerald-500 font-bold text-emerald-800 text-center transition-colors" />
              <span className="text-sm font-medium text-slate-700">%</span>
            </div>
          </div>
        )}
      </section>

      {/* 5.3 */}
      <section className="mb-4">
        <h3 className="text-[13px] font-bold text-emerald-800 mb-3 border-b border-slate-300 pb-1 uppercase tracking-wide">5.3. Kết quả thử nghiệm (Testing result)</h3>
        
        {zones.map((zone, idx) => (
          <React.Fragment key={zone.id}>
            {zones.length > 1 && (
              <h4 className={`font-bold text-slate-700 ml-1 mb-2 ${idx > 0 ? 'mt-4 border-t pt-4' : ''}`}>
                5.3.{idx + 1}. Kết quả thử nghiệm {hasMagnetic ? `tại ${zone.name}` : zone.name}
              </h4>
            )}
            
            {standardId === 'emc_dieu_hoa' ? (
              <div className="ml-1">
                <h5 className="font-semibold text-slate-700 text-sm mb-2">5.3.{idx + 1}.1. Điện áp nhiễu tại đầu nối nguồn lưới</h5>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 pl-2 border-l-2 border-slate-100 mb-4">
                  <div className="mb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-slate-700 text-xs">
                        5.3.{idx + 1}.1.1. Kết quả điện áp nhiễu tại đầu nối nguồn lưới pha L
                      </h4>
                      <RadimationUploader setData={setData} field={getField('phaseL', zone.id)} tableName={getField('tablePhaseL', zone.id)} extractPage4Data={isDieuHoa} />
                    </div>
                    <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('phaseL', zone.id)} label={`Ảnh kết quả (Pha L)`} />
                    <TablePhaseLN showPeak={true} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} tableName={getField('tablePhaseL', zone.id)} />
                  </div>
                  <div className="mb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-slate-700 text-xs">
                        5.3.{idx + 1}.1.2. Kết quả điện áp nhiễu tại đầu nối nguồn lưới pha N
                      </h4>
                      <RadimationUploader setData={setData} field={getField('phaseN', zone.id)} tableName={getField('tablePhaseN', zone.id)} extractPage4Data={isDieuHoa} />
                    </div>
                    <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('phaseN', zone.id)} label={`Ảnh kết quả (Pha N)`} />
                    <TablePhaseLN showPeak={true} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} tableName={getField('tablePhaseN', zone.id)} />
                  </div>
                </div>

                {extraVoltageTables.length > 0 && (
                  <>
                    <h5 className="font-semibold text-slate-700 text-sm mb-2 mt-4">5.3.{idx + 1}.2. Điện áp nhiễu tại đầu nối tải/ đầu nối bổ sung</h5>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 pl-2 border-l-2 border-slate-100">
                      {extraVoltageTables.map((t, tIdx) => {
                        const tField = getField(t.key, zone.id);
                        const tblName = getField(`table${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`, zone.id);
                        return (
                          <div key={t.key} className="mb-1 bg-slate-50/30 p-2 rounded border border-slate-50">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <h4 className="font-bold text-slate-700 text-xs">
                                5.3.{idx + 1}.2.{tIdx + 1}. Kết quả điện áp nhiễu tại đầu nối tải {t.label.toLowerCase()}
                              </h4>
                              <RadimationUploader setData={setData} field={tField} tableName={tblName} extractPage4Data={isDieuHoa} />
                            </div>
                            <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={tField} label={`Ảnh kết quả (${t.label})`} />
                            <TablePhaseLN showPeak={true} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} tableName={tblName} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 ml-1">
                <div className="mb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-slate-700 text-xs">
                      {zones.length > 1 ? `5.3.${idx + 1}.1` : '5.3.1'}. Nhiễu điện áp (Pha L){hasMagnetic ? ` - ${zone.name}` : zone.suffix}
                    </h4>
                    <div className="flex gap-2">
                      <RadimationUploader setData={setData} field={getField('phaseL', zone.id)} tableName={getField('tablePhaseL', zone.id)} />
                    </div>
                  </div>
                  <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('phaseL', zone.id)} label={`Ảnh kết quả (Pha L)${hasMagnetic ? ` - ${zone.name}` : zone.suffix}`} />
                  <TablePhaseLN showPeak={false} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} tableName={getField('tablePhaseL', zone.id)} />
                </div>

                <div className="mb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-slate-700 text-xs">
                      {zones.length > 1 ? `5.3.${idx + 1}.2` : '5.3.2'}. Nhiễu điện áp (Pha N){hasMagnetic ? ` - ${zone.name}` : zone.suffix}
                    </h4>
                    <RadimationUploader setData={setData} field={getField('phaseN', zone.id)} tableName={getField('tablePhaseN', zone.id)} />
                  </div>
                  <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('phaseN', zone.id)} label={`Ảnh kết quả (Pha N)${hasMagnetic ? ` - ${zone.name}` : zone.suffix}`} />
                  <TablePhaseLN showPeak={false} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} tableName={getField('tablePhaseN', zone.id)} />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </section>

      {/* 6.3 Magnetic Induction */}
      {hasMagnetic && (
        <section className="mb-4">
          <h3 className="text-[13px] font-bold text-emerald-800 mb-3 border-b border-slate-300 pb-1 uppercase tracking-wide">6.3. Kết quả thử nghiệm (Testing result)</h3>
          
          {zones.slice(0, numMagZones).map((zone, idx) => (
            <React.Fragment key={zone.id}>
               <h4 className={`font-bold text-slate-700 ml-1 mb-2 ${idx > 0 ? 'mt-4 border-t pt-4' : ''}`}>
                  6.3.{idx + 1}. Kết quả thử nghiệm tại {zone.name}
               </h4>
               
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 ml-1">
                 {['A', 'B', 'C'].map((anten, aIdx) => {
                   const fieldImage = `mag${zone.id}_${anten}`;
                   const fieldTable = `tableMag${zone.id}_${anten}`;
                   return (
                     <div key={anten} className="mb-2">
                       <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                         <h4 className="font-bold text-slate-700 text-xs">6.3.{idx + 1}.{aIdx + 1}. Kết quả của dòng điện cảm ứng trường từ của anten vòng {anten}</h4>
                         <RadimationUploader setData={setData} field={fieldImage as any} tableName={fieldTable as any} />
                       </div>
                       <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={fieldImage as any} label={`Ảnh kết quả anten vòng ${anten} - ${zone.name}`} />
                       <TableMagnetic data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} tableName={fieldTable as any} />
                     </div>
                   );
                 })}
               </div>
            </React.Fragment>
          ))}
        </section>
      )}

      {/* 6.3 (or 7.3) */}
      <section className="mb-4">
        <h3 className="text-[13px] font-bold text-emerald-800 mb-3 border-b border-slate-300 pb-1 uppercase tracking-wide">{getSectionNum(6)}.3. Kết quả thử nghiệm (Testing result)</h3>
        
        {standardId === 'emc_dieu_hoa' ? (
          <div className={`grid grid-cols-1 ${zones.length > 1 ? 'xl:grid-cols-2' : ''} gap-4 ml-1`}>
            {zones.map((zone, idx) => (
              <div key={zone.id} className="pl-3 border-l-2 border-emerald-500 py-1 mb-4 h-full">
                <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">
                  {getSectionNum(6)}.3.{idx + 1}. Kết quả thử nghiệm tại {zone.name}
                </h4>
                
                <div className={`grid grid-cols-1 ${extraPowerTables.length > 0 ? 'lg:grid-cols-2' : ''} gap-3 mt-3`}>
                  <div className="mb-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-slate-700 text-xs">{getSectionNum(6)}.3.{idx + 1}.1. Kết quả công suất nhiễu của dây dẫn nguồn</h4>
                      <RadimationUploader setData={setData} field={getField('powerDisturbance', zone.id)} tableName={getField('tablePower', zone.id)} />
                    </div>
                    <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('powerDisturbance', zone.id)} label={`Ảnh kết quả dây dẫn nguồn`} />
                    <TablePowerDisturbance tableName={getField('tablePower', zone.id)} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} />
                  </div>

                  {extraPowerTables.map((t, tIdx) => {
                    const tField = getField(t.key, zone.id);
                    const tblName = getField(`table${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`, zone.id);
                    return (
                      <div key={t.key} className="mb-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <h4 className="font-bold text-slate-700 text-xs">{getSectionNum(6)}.3.{idx + 1}.{tIdx + 2}. Kết quả công suất nhiễu của {t.label.toLowerCase()}</h4>
                          <RadimationUploader setData={setData} field={tField} tableName={tblName} />
                        </div>
                        <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={tField} label={`Ảnh kết quả ${t.label}`} />
                        <TablePowerDisturbance tableName={tblName} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : hasMagnetic ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 ml-1">
            {zones.map((zone, idx) => (
              <div key={zone.id} className="mb-2 pl-3 border-l-2 border-emerald-500 py-1 mb-4">
                <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">
                  {getSectionNum(6)}.3.{idx + 1}. Kết quả thử nghiệm tại {zone.name}
                </h4>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1 mt-2">
                  <h4 className="font-bold text-slate-700 text-xs">{getSectionNum(6)}.3.{idx + 1}.1. Kết quả công suất nhiễu của dây dẫn nguồn</h4>
                  <RadimationUploader setData={setData} field={getField('powerDisturbance', zone.id)} tableName={getField('tablePower', zone.id)} />
                </div>
                <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('powerDisturbance', zone.id)} label={`Ảnh kết quả công suất nhiễu - ${zone.name}`} />
                <TablePowerDisturbance tableName={getField('tablePower', zone.id)} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} />
              </div>
            ))}
          </div>
        ) : (
          <div className={(isVacuum ? 1 : zones.length) > 1 ? "grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 ml-1" : "ml-1 mb-2"}>
            {(isVacuum ? zones.filter(z => z.id === 1) : zones).map((zone, idx) => (
              <div key={zone.id} className="mb-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h4 className="font-bold text-slate-700 text-xs">6.3.{idx + 1}. {isVacuum ? 'Kết quả công suất nhiễu' : `Kết quả công suất nhiễu${zone.suffix}`}</h4>
                  <RadimationUploader setData={setData} field={getField('powerDisturbance', zone.id)} tableName={getField('tablePower', zone.id)} />
                </div>
                <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('powerDisturbance', zone.id)} label={isVacuum ? 'Ảnh kết quả công suất nhiễu' : `Ảnh kết quả công suất nhiễu${zone.suffix}`} />
                <TablePowerDisturbance tableName={getField('tablePower', zone.id)} data={data} handleTableChange={handleTableChange} handlePaste={handlePaste} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7.3 (or 8.3) */}
      {!isVacuum && (
      <section className="mb-4">
        <h3 className="text-[13px] font-bold text-emerald-800 mb-3 border-b border-slate-300 pb-1 uppercase tracking-wide">{getSectionNum(7)}.3. Kết quả thử nghiệm (Testing result)</h3>
        
        {hasMagnetic ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 ml-1">
            {zones.map((zone, idx) => (
              <div key={zone.id} className="mb-2 pl-3 border-l-2 border-emerald-500 py-1 mb-4">
                <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">
                  {getSectionNum(7)}.3.{idx + 1}. Kết quả thử nghiệm tại {zone.name}
                </h4>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1 mt-2">
                  <h4 className="font-bold text-slate-700 text-xs">{getSectionNum(7)}.3.{idx + 1}.1. Kết quả nhiễu không liên tục tại đầu nối nguồn lưới đường dây pha N</h4>
                  <RadimationUploader setData={setData} field={getField('discontinuousPhaseN', zone.id)} />
                </div>
                <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('discontinuousPhaseN', zone.id)} label={`Ảnh kết quả nhiễu không liên tục - ${zone.name}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className={zones.length > 1 ? "grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 ml-1" : "ml-1 mb-2"}>
            {(standardId === 'emc_may_giat' || isVacuum ? zones.filter(z => z.id === 1) : zones).map((zone, idx) => (
              <div key={zone.id} className="mb-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h4 className="font-bold text-slate-700 text-xs">7.3.{idx + 1}. Nhiễu không liên tục (Pha N){zone.suffix}</h4>
                  <RadimationUploader setData={setData} field={getField('discontinuousPhaseN', zone.id)} />
                </div>
                <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field={getField('discontinuousPhaseN', zone.id)} label={`Ảnh kết quả nhiễu không liên tục${zone.suffix}`} />
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* VIII. PHỤ LỤC */}
      <section className="mb-4">
        <h3 className="text-[13px] font-bold text-emerald-800 mb-3 border-b border-slate-300 pb-1 uppercase tracking-wide">VIII. PHỤ LỤC (Appendix)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 ml-1">
          <div className="mb-1">
            <h4 className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">8.1. Mẫu thử nghiệm {standardId === 'emc_dieu_hoa' ? '(Ảnh 1)' : ''}</h4>
            <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field="sample" label={standardId === 'emc_dieu_hoa' ? "Ảnh 3: Mẫu thử nghiệm" : "Ảnh 2: Mẫu thử nghiệm"} />
          </div>

          {standardId === 'emc_dieu_hoa' && (
            <div className="mb-1">
              <h4 className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">8.1. Mẫu thử nghiệm (Ảnh 2)</h4>
              <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field="sample2" label="Ảnh 4: Mẫu thử nghiệm" />
            </div>
          )}

          <div className="mb-1">
            <h4 className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">8.2. Điện áp nhiễu</h4>
            <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field="setupVoltage" label={standardId === 'emc_dieu_hoa' ? "Ảnh 5: Thử nghiệm điện áp nhiễu" : "Ảnh 3: Thử nghiệm điện áp nhiễu"} />
          </div>

          <div className="mb-1">
            <h4 className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">8.3. Công suất nhiễu</h4>
            <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field="setupPower" label={standardId === 'emc_dieu_hoa' ? "Ảnh 6: Thử nghiệm công suất nhiễu" : "Ảnh 4: Thử nghiệm công suất nhiễu"} />
          </div>
          
          {standardId !== 'emc_dieu_hoa' && (<div className="mb-1">
            <h4 className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">8.4. Nhiễu bức xạ</h4>
            <ImageUploader data={data} setData={setData} handleImageUpload={handleImageUpload} field="setupRadiated" label="Ảnh 5: Thử nghiệm nhiễu bức xạ" />
          </div>)}
        </div>
      </section>

      </>
        );
      })()}

    </div>
  );
}

// --- End of EmcBepDien1VungNauForm.tsx ---
