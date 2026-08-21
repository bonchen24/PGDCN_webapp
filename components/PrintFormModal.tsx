// Author: Gemini
// OS support: Web/Node
// Description: Component for printing and exporting test request forms to Word documents with automatic seal stamp notes

import React, { useState, useEffect } from 'react';
import { X, Printer, FileDown, Loader2, Copy, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { TestRequest } from '../types';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import FileSaver from 'file-saver';
import { formatDateVN } from '../utils/formatter';
import { useStore } from '../store';

interface PrintFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: TestRequest[] | null;
}

export const PrintFormModal = ({ isOpen, onClose, requests }: PrintFormModalProps) => {
  const { updateRequest } = useStore();
  const [formData, setFormData] = useState<any>({});
  const [samplesData, setSamplesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (requests && requests.length > 0) {
      const firstReq = requests[0];
      
      const extractLotFromEncode = (encodeStr: string): string => {
        if (!encodeStr) return '';
        let clean = encodeStr.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '');
        clean = clean.replace(/-M\d+$/i, '');
        return clean;
      };

      let lotNumber = '';
      for (const req of requests) {
        const encode = req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || '';
        if (encode) {
          lotNumber = extractLotFromEncode(encode);
          if (lotNumber) break;
        }
      }

      const initialSamples = requests.map(req => {
        const codes: string[] = [];
        if (req.atdEncodeNumber) codes.push(req.atdEncodeNumber);
        if (req.emcEncodeNumber) codes.push(req.emcEncodeNumber);
        if (req.itdEncodeNumber) codes.push(req.itdEncodeNumber);

        return {
          id: req.id,
          san_pham: req.type || 'Thiết bị điện',
          nhan_hieu: req.brand || '',
          model: req.modelName || '',
          thong_so_ky_thuat: req.specifications || '220V~ 50Hz',
          slg: (req.quantity || 1).toString().padStart(2, '0'),
          dvt: req.unit || 'Bộ',
          tieuchuan: req.standard || '',
          gc: req.note || '',
          chitieu: req.testCriteria || req.testCategory || 'An toàn điện',
          codes: codes,
          sealStamp: req.sealStamp || '',
        };
      });
      setSamplesData(initialSamples);

      setFormData({
        so_dk: firstReq.requestCode,
        ngay_dk: firstReq.requestDate ? formatDateVN(firstReq.requestDate) : formatDateVN(new Date()),
        so_ma_hoa: lotNumber,
        ngay_nhan_mau: firstReq.receivedDate ? formatDateVN(firstReq.receivedDate) : (firstReq.requestDate ? formatDateVN(firstReq.requestDate) : formatDateVN(new Date())),
        diachiPTN: firstReq.labAddress || 'Số 3 ngõ 76 đường Trung Văn, phường Đại Mỗ, Hà Nội',
        
        kh_donvigui: firstReq.senderUnit || '',
        kh_ten: firstReq.customerName || '',
        kh_diachi: firstReq.address || '',
        kh_nguoilhe: firstReq.contactPerson || '',
        kh_dthoai: firstReq.phone || '',
        kh_email: firstReq.email || '',
        
        hd_tenvi: firstReq.invoiceCompanyName || firstReq.customerName || '',
        hd_diachi: firstReq.invoiceAddress || firstReq.address || '',
        hd_mst: firstReq.invoiceTaxId || firstReq.taxId || '',
        hd_email: firstReq.invoiceEmail || firstReq.email || '',
        
        ttg_moi: firstReq.sampleCondition !== 'Cũ',
        
        stn_luu: firstReq.postTestHandling === 'Lưu mẫu',
        stn_huy: firstReq.postTestHandling === 'Hủy',
        stn_nhan: firstReq.postTestHandling === 'Nhận lại' || !firstReq.postTestHandling,
        
        thong_tin_khac: firstReq.otherCustomerInfo || '',
        bansao_mot: firstReq.resultCopyCount === 1,
        bansao_hai: firstReq.resultCopyCount === 2 || !firstReq.resultCopyCount,
        bansao_ba: firstReq.resultCopyCount === 3,
      });
    }
  }, [requests]);

  const markRequestsAsPrinted = () => {
    if (requests && requests.length > 0) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const statusText = `Đã in ${dd}/${mm}`;
      requests.forEach(req => {
        updateRequest(req.id, { isPycPrinted: true, pycPrintStatus: statusText });
      });
    }
  };

  if (!isOpen || !requests || requests.length === 0) return null;

  const handleExportDocx = async (isDownload: boolean = true, closeAfter: boolean = true) => {
    setIsLoading(true);
    try {
      const response = await fetch('/DDT_PYC.docx');
      if (!response.ok) throw new Error("Không tìm thấy file mẫu 'DDT_PYC.docx' trong thư mục gốc!");
      
      const content = await response.arrayBuffer();
      const zip = new PizZip(content);
      
      const doc = new Docxtemplater(zip, { nullGetter: () => "", 
        paragraphLoop: true,
        linebreaks: true,
      });

      const mappedSamples = samplesData.map((sample, index) => {
        const codesStr = sample.codes && sample.codes.length > 0 ? sample.codes.join('; ') : '';
        let finalGc = sample.gc || '';
        if (sample.sealStamp) {
          finalGc = finalGc ? `${finalGc} (${sample.sealStamp})` : `(${sample.sealStamp})`;
        }
        if (codesStr) {
          finalGc = finalGc ? `${finalGc} (${codesStr})` : codesStr;
        }
        return {
          ...sample,
          tt: (index + 1).toString(),
          chitieu: sample.chitieu || '',
          gc: finalGc,
          tem_niem_phong: sample.sealStamp || '',
          seal_stamp: sample.sealStamp || '',
          sealStamp: sample.sealStamp || '',
        };
      });

      const dataToRender = {
        ...formData,
        tem_niem_phong: Array.from(new Set(samplesData.map(s => s.sealStamp ? s.sealStamp.replace(/-M\d+$/i, '') : '').filter(Boolean))).join(', ') || '',
        ttg_moi: formData.ttg_moi ? '☑' : '☐',
        ttg_cu: !formData.ttg_moi ? '☑' : '☐',
        mthu: mappedSamples,
        samples: mappedSamples,
        stn_luu: formData.stn_luu ? '☑' : '☐',
        stn_huy: formData.stn_huy ? '☑' : '☐',
        stn_nhan: formData.stn_nhan ? '☑' : '☐',
        bansao_mot: formData.bansao_mot ? '☑' : '☐',
        bansao_hai: formData.bansao_hai ? '☑' : '☐',
        bansao_ba: formData.bansao_ba ? '☑' : '☐',
        signature_lines: [{}],
      };

      doc.render(dataToRender);

      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      if (isDownload) {
        const fileName = `Phieu_DK_${formData.so_dk || 'PYC'}.docx`;
        markRequestsAsPrinted();
        if ("showSaveFilePicker" in window) {
          try {
            
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: fileName,
              types: [
                {
                  description: "Word Document",
                  accept: {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                  },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(out);
            await writable.close();
            toast.success("Xuất file Word thành công!");
          } catch (err: any) {
            if (err.name !== "AbortError") {
              FileSaver.saveAs(out, fileName);
              toast.success("Xuất file Word thành công!");
            }
          }
        } else {
          FileSaver.saveAs(out, fileName);
          toast.success("Xuất file Word thành công!");
        }
      }

      if (closeAfter) onClose();
    } catch (error: any) {
      toast.error(`Lỗi xuất file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
    markRequestsAsPrinted();
    const printWindow = window.open("", "", "height=800,width=900");
    if (!printWindow) {
      toast.error("Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.");
      return;
    }
    
    const htmlContent = `
      <html>
      <head>
        <title>In Phiếu Yêu Cầu</title>
        <base href="${window.location.origin}">
        <style>
          @media print {
            @page { margin: 15mm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { 
            font-family: 'Times New Roman', Times, serif; 
            line-height: 1.3; 
            padding: 0; 
            margin: 0;
            font-size: 13pt; 
            color: black;
          }
          .header-table { width: 100%; border: none; margin-bottom: 15px; }
          .header-table td { border: none; padding: 0; vertical-align: top; }
          .logo { width: 150px; }
          .org-info { text-align: center; font-size: 11pt; }
          .org-info .line1 { font-weight: bold; }
          .org-info .line2 { font-weight: bold; font-size: 11.5pt; margin-top: 2px; }
          .org-info .line3 { font-weight: bold; font-size: 12pt; margin-top: 2px; }
          .org-info .line-normal { text-align: right; font-size: 11pt; color: #333; margin-top: 2px; }
          .bm-code { text-align: right; font-size: 11pt; padding-bottom: 5px; color: #333; }
          
          .title { text-align: center; font-size: 16pt; font-weight: bold; margin: 20px 0; }
          
          .meta-info { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; }
          
          .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; }
          .sub-section-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; }
          
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .info-table td { padding: 4px 0; vertical-align: top; border-bottom: 1px solid #000; }
          .info-table td.label { width: 150px; }
          .info-table tr:last-child td { border-bottom: 1px solid #000; }
          
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; text-align: center; }
          .data-table th, .data-table td { border: 1px solid #000; padding: 6px; }
          .data-table th { font-weight: bold; }
          .data-table td { vertical-align: top; }
          
          .text-left { text-align: left !important; }
          
          .checkbox-group { display: flex; gap: 50px; margin-bottom: 5px; }
          .checkbox-item { display: flex; align-items: center; gap: 5px; }
          .checkbox-box { font-size: 16pt; line-height: 1; margin-top: -4px; }
          
          .footer-signatures { display: flex; justify-content: space-around; margin-top: 20px; font-weight: bold; text-align: center; }
          .footer-note { margin-top: 80px; font-style: italic; font-size: 11pt; color: #555; text-align: justify; }
        </style>
      </head>
      <body>
        <div class="bm-code">BM-02/TT-04</div>
        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center; vertical-align: middle;">
              <img src="/tvci_logo.jpg" class="logo" alt="TVCI Logo" onerror="this.style.display='none'" />
            </td>
            <td class="org-info" style="width: 75%;">
              <div class="line1">VIỆN CƠ KHÍ NĂNG LƯỢNG VÀ MỎ-VINACOMIN</div>
              <div class="line2">TRUNG TÂM THỬ NGHIỆM KIỂM ĐỊNH CÔNG NGHIỆP</div>
              <div class="line3">PHÒNG THỬ NGHIỆM ĐIỆN - ĐIỆN TỬ</div>
              <div class="line-normal">Trụ sở: Số 565 đường Nguyễn Trãi, phường Thanh Liệt, Hà Nội</div>
              <div class="line-normal">PTN: Số 3 ngõ 76 đường Trung Văn, phường Đại Mỗ, Hà Nội</div>
              <div class="line-normal">Tel:+84-24-3552 5553 / 3854 2142; Fax:+84-24-3854 3154</div>
              <div class="line-normal">Email: tvcicenter@gmail.com; Website:tvci.com.vn</div>
            </td>
          </tr>
        </table>

        <div class="title">PHIẾU ĐĂNG KÝ THỬ NGHIỆM ĐIỆN - ĐIỆN TỬ</div>

        <div class="meta-info">
          <div>Số đăng ký: ${formData.so_dk || ''}</div>
          <div>Ngày: ${formData.ngay_dk || ''}</div>
          <div>Số mã hóa: ${formData.so_ma_hoa || ''}</div>
        </div>

        <div class="section-title">1. Thông tin khách hàng</div>
        <table class="info-table">
          <tr><td class="label">- Khách hàng:</td><td colspan="3">${formData.kh_ten || ''}</td></tr>
          <tr><td class="label">- Địa chỉ:</td><td colspan="3">${formData.kh_diachi || ''}</td></tr>
          <tr><td class="label">- Người liên hệ:</td><td colspan="3">${formData.kh_nguoilhe || ''}</td></tr>
          <tr><td class="label">- Điện thoại:</td><td style="width: 35%;">${formData.kh_dthoai || ''}</td><td class="label" style="width: 80px;">Email:</td><td>${formData.kh_email || ''}</td></tr>
        </table>

        <div class="section-title">2. Thông tin viết hóa đơn</div>
        <table class="info-table">
          <tr><td class="label">- Tên đơn vị:</td><td colspan="3">${formData.hd_tenvi || ''}</td></tr>
          <tr><td class="label">- Địa chỉ:</td><td colspan="3">${formData.hd_diachi || ''}</td></tr>
          <tr><td class="label">- Mã số thuế:</td><td style="width: 35%;">${formData.hd_mst || ''}</td><td class="label" style="width: 80px;">Email:</td><td>${formData.hd_email || ''}</td></tr>
        </table>

        <div class="section-title">3. Nội dung đăng ký thử nghiệm</div>
        <div class="sub-section-title">3.1. Phần dành cho khách hàng</div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 5%">TT</th>
              <th style="width: 40%">Tên mẫu thử</th>
              <th style="width: 10%">Số lượng</th>
              <th style="width: 15%">Chỉ tiêu<br/>TN</th>
              <th style="width: 15%">Tiêu chuẩn<br/>áp dụng</th>
              <th style="width: 15%">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${samplesData.map((s, i) => {
              const codesStr = s.codes && s.codes.length > 0 ? '(' + s.codes.join('; ') + ')' : '';
              const sealStr = s.sealStamp ? `(${s.sealStamp})` : '';
              let finalGc = s.gc || '';
              if (sealStr) {
                finalGc = finalGc ? `${finalGc}<br/>${sealStr}` : sealStr;
              }
              if (codesStr) {
                finalGc = finalGc ? `${finalGc}<br/>${codesStr}` : codesStr;
              }
              return `
                <tr>
                  <td>${i+1}</td>
                  <td class="text-left" style="line-height: 1.4;">
                    <div>Sản phẩm: ${s.san_pham || ''}</div>
                    <div>Nhãn hiệu: ${s.nhan_hieu || ''}</div>
                    <div>Model: ${s.model || ''}</div>
                    <div>Thông số kỹ thuật: ${s.thong_so_ky_thuat || ''}</div>
                  </td>
                  <td>${s.slg || '01'}${s.dvt || 'Cái'}</td>
                  <td>${s.chitieu || 'Tương<br/>thích điện<br/>từ'}</td>
                  <td>${s.tieuchuan || 'TCVN<br/>7492-1:<br/>2018'}</td>
                  <td class="text-left">${finalGc}</td>
                </tr>
              `;
            }).join('')}
            <tr>
              <td colspan="6" style="font-style: italic; text-align: center;">Phiếu đăng ký này có giá trị sử dụng trong thời gian 45 ngày kể từ ngày đăng ký.</td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; margin-bottom: 5px;">
          <div style="width: 200px; font-weight: bold;">- Tình trạng mẫu thử nghiệm:</div>
          <div class="checkbox-group" style="flex: 1; padding-left: 20px;">
            <div class="checkbox-item"><div class="checkbox-box">${formData.ttg_moi ? '&#9745;' : '&#9744;'}</div> Mới</div>
            <div class="checkbox-item" style="margin-left: 40px;"><div class="checkbox-box">${!formData.ttg_moi ? '&#9745;' : '&#9744;'}</div> Đã sử dụng</div>
          </div>
        </div>

        <div style="margin-bottom: 5px;"><span style="font-weight: bold;">- Thông tin khác của khách hàng:</span> ${formData.thong_tin_khac || ''}</div>
        
        <div style="margin-bottom: 5px;"><span style="font-weight: bold;">- Số tem niêm phong:</span> ${Array.from(new Set(samplesData.map(s => s.sealStamp ? s.sealStamp.replace(/-M\d+$/i, '') : '').filter(Boolean))).join(', ')}</div>

        <div style="display: flex; margin-bottom: 5px;">
          <div style="width: 200px; font-weight: bold;">- Mẫu sau thử nghiệm:</div>
          <div class="checkbox-group" style="flex: 1; padding-left: 20px;">
            <div class="checkbox-item"><div class="checkbox-box">${formData.stn_luu ? '&#9745;' : '&#9744;'}</div> Lưu mẫu</div>
            <div class="checkbox-item" style="margin-left: 40px;"><div class="checkbox-box">${formData.stn_huy ? '&#9745;' : '&#9744;'}</div> Hủy</div>
            <div class="checkbox-item" style="margin-left: 40px;"><div class="checkbox-box">${formData.stn_nhan ? '&#9745;' : '&#9744;'}</div> Nhận lại</div>
          </div>
        </div>

        <div class="sub-section-title">3.2. Phần dành cho Phòng Thử nghiệm</div>
        
        <div style="margin-bottom: 5px;"><span style="font-weight: bold;">- Ngày nhận mẫu thử nghiệm:</span> ${formData.ngay_nhan_mau || ''}</div>
        <div style="margin-bottom: 5px;"><span style="font-weight: bold;">- Địa chỉ PTN:</span> ${formData.diachiPTN || 'Số 3 ngõ 76 đường Trung Văn, phường Đại Mỗ, Hà Nội'}</div>
        
        <div style="display: flex; margin-bottom: 5px;">
          <div style="width: 320px; font-weight: bold;">- Số lượng bản sao kết quả thử nghiệm:</div>
          <div class="checkbox-group" style="flex: 1;">
            <div class="checkbox-item"><div class="checkbox-box">${formData.bansao_mot ? '&#9745;' : '&#9744;'}</div> 01</div>
            <div class="checkbox-item"><div class="checkbox-box">${formData.bansao_hai ? '&#9745;' : '&#9744;'}</div> 02</div>
            <div class="checkbox-item"><div class="checkbox-box">${formData.bansao_ba ? '&#9745;' : '&#9744;'}</div> 03</div>
          </div>
        </div>
        
        <div style="margin-bottom: 5px;"><span style="font-weight: bold;">- Thời gian thử nghiệm:</span> ${formData.thoi_gian_tn || '2-5 ngày cho 01 mẫu kể từ ngày nhận được mẫu thử nghiệm'}</div>

        <div class="footer-signatures">
          <div>KHÁCH HÀNG</div>
          <div>PHÒNG THỬ NGHIỆM ĐIỆN - ĐIỆN TỬ</div>
        </div>

        <div class="footer-note">
          PTN cam kết bảo mật kết quả thử nghiệm cho khách hàng, không cung cấp thông tin về công việc thử nghiệm cho bên thứ ba nào biết nếu không có sự đồng ý bằng văn bản của khách hàng, ngoại trừ các quy định khác của pháp luật.
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      onClose();
    }, 500);
  };

  const InputField = ({ label, field, placeholder, className = "" }: any) => (
    <div className={className}>
      <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">{label}</label>
      <input 
        type="text" 
        className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
        value={formData[field] || ''} 
        onChange={e => setFormData({...formData, [field]: e.target.value})}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end md:items-center justify-center p-2 md:p-4 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[calc(100dvh-1rem)] md:max-h-[90vh] rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {}
        <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileDown className="text-emerald-500" size={18} /> Xuất Phiếu Yêu Cầu
            </h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Kiểm tra thông tin trước khi xuất file docx</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><X size={18}/></button>
        </div>

        {}
        <div className="mobile-scroll-x flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-3">
          
          {}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <h4 className="text-[11px] font-bold text-emerald-600 uppercase mb-2">Thông tin Đăng ký</h4>
             <div className="grid grid-cols-4 gap-2">
                <InputField label="Số đăng ký" field="so_dk" className="col-span-2 sm:col-span-1" />
                <InputField label="Ngày ĐK" field="ngay_dk" className="col-span-2 sm:col-span-1" />
                <InputField label="Số mã hóa" field="so_ma_hoa" className="col-span-2 sm:col-span-1" />
                <InputField label="Ngày nhận mẫu" field="ngay_nhan_mau" className="col-span-2 sm:col-span-1" />
                <InputField label="Địa chỉ PTN" field="diachiPTN" className="col-span-4" />
             </div>
          </div>

          {}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <h4 className="text-[11px] font-bold text-emerald-600 uppercase mb-2">Khách hàng</h4>
             <div className="grid grid-cols-4 gap-2">
                <InputField label="Khách hàng" field="kh_ten" className="col-span-4" />
                <InputField label="Địa chỉ" field="kh_diachi" className="col-span-4" />
                <InputField label="Người liên hệ" field="kh_nguoilhe" className="col-span-2 sm:col-span-1" />
                <InputField label="Điện thoại" field="kh_dthoai" className="col-span-2 sm:col-span-1" />
                <InputField label="Email" field="kh_email" className="col-span-4 sm:col-span-2" />
             </div>
          </div>

          {}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-[11px] font-bold text-emerald-600 uppercase">Xuất hóa đơn</h4>
             </div>
             <div className="grid grid-cols-4 gap-2">
                <InputField label="Tên đơn vị (HĐ)" field="hd_tenvi" className="col-span-4 sm:col-span-2" />
                <InputField label="Địa chỉ (HĐ)" field="hd_diachi" className="col-span-4 sm:col-span-2" />
                <InputField label="Mã số thuế" field="hd_mst" className="col-span-2 sm:col-span-1" />
                <InputField label="Email nhận HĐ" field="hd_email" className="col-span-4 sm:col-span-3" />
             </div>
          </div>

          {}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <h4 className="text-[11px] font-bold text-emerald-600 uppercase mb-2">Danh sách mẫu thử ({samplesData.length} mẫu)</h4>
             <div className="overflow-hidden border border-slate-200 rounded-lg">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-slate-200 bg-slate-50">
                     <th className="p-2.5 text-[10px] font-bold text-slate-500 uppercase text-center rounded-tl-md w-8">STT</th>
                     <th className="p-2.5 text-[10px] font-bold text-slate-500 uppercase w-1/4">Sản phẩm & Model</th>
                     <th className="p-2.5 text-[10px] font-bold text-slate-500 uppercase w-1/5">Thông số & Tiêu chuẩn</th>
                     <th className="p-2.5 text-[10px] font-bold text-slate-500 uppercase w-1/5">Chỉ tiêu & Mã hóa</th>
                     <th className="p-2.5 text-[10px] font-bold text-slate-500 uppercase text-center w-24">Số lượng</th>
                     <th className="p-2.5 text-[10px] font-bold text-slate-500 uppercase rounded-tr-md w-1/5">Ghi chú</th>
                   </tr>
                 </thead>
                 <tbody>
                   {samplesData.map((sample, index) => (
                     <tr key={sample.id} className="border-b border-slate-100 last:border-0 hover:bg-white">
                        {}
                        <td className="p-2 text-xs font-bold text-emerald-700 text-center align-top pt-3">{index + 1}</td>
                        
                        {}
                        <td className="p-2 space-y-1.5 align-top">
                          <div>
                            <input 
                              type="text" 
                              placeholder="Tên sản phẩm"
                              className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                              value={sample.san_pham} 
                              onChange={e => { const newS = [...samplesData]; newS[index].san_pham = e.target.value; setSamplesData(newS); }} 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <input 
                                type="text" 
                                placeholder="Nhãn hiệu"
                                className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                                value={sample.nhan_hieu} 
                                onChange={e => { const newS = [...samplesData]; newS[index].nhan_hieu = e.target.value; setSamplesData(newS); }} 
                              />
                            </div>
                            <div>
                              <input 
                                type="text" 
                                placeholder="Model"
                                className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                                value={sample.model} 
                                onChange={e => { const newS = [...samplesData]; newS[index].model = e.target.value; setSamplesData(newS); }} 
                              />
                            </div>
                          </div>
                          <div>
                            <input 
                              type="text" 
                              placeholder="Tem niêm phong"
                              className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400" 
                              value={sample.sealStamp || ''} 
                              onChange={e => {
                                const newVal = e.target.value;
                                const newS = [...samplesData];
                                newS[index].sealStamp = newVal;
                                setSamplesData(newS);
                                updateRequest(sample.id, { sealStamp: newVal });
                              }} 
                            />
                          </div>
                        </td>

                        {}
                        <td className="p-2 space-y-1.5 align-top">
                          <div>
                            <input 
                              type="text" 
                              placeholder="Thông số KT"
                              className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                              value={sample.thong_so_ky_thuat} 
                              onChange={e => { const newS = [...samplesData]; newS[index].thong_so_ky_thuat = e.target.value; setSamplesData(newS); }} 
                            />
                          </div>
                          <div>
                            <input 
                              type="text" 
                              placeholder="Tiêu chuẩn"
                              className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                              value={sample.tieuchuan} 
                              onChange={e => { const newS = [...samplesData]; newS[index].tieuchuan = e.target.value; setSamplesData(newS); }} 
                            />
                          </div>
                        </td>

                        {}
                        <td className="p-2 space-y-1.5 align-top">
                          <div>
                            <input 
                              type="text" 
                              placeholder="Chỉ tiêu TN"
                              className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                              value={sample.chitieu || ''} 
                              onChange={e => { const newS = [...samplesData]; newS[index].chitieu = e.target.value; setSamplesData(newS); }} 
                            />
                          </div>
                          <div className="pt-0.5">
                            <div className="space-y-0.5 max-h-[50px] overflow-y-auto">
                              {sample.codes && sample.codes.length > 0 ? (
                                sample.codes.map((code, cIdx) => (
                                  <span key={cIdx} className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold leading-tight uppercase block text-center">
                                    {code}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[9px] text-slate-400 italic block text-center">Chưa mã hóa</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {}
                        <td className="p-2 align-top">
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <input 
                                type="text" 
                                placeholder="SL"
                                className="w-full border border-slate-200 rounded px-1 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-center" 
                                value={sample.slg} 
                                onChange={e => { const newS = [...samplesData]; newS[index].slg = e.target.value; setSamplesData(newS); }} 
                              />
                            </div>
                            <div>
                              <input 
                                type="text" 
                                placeholder="ĐVT"
                                className="w-full border border-slate-200 rounded px-1 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-center" 
                                value={sample.dvt} 
                                onChange={e => { const newS = [...samplesData]; newS[index].dvt = e.target.value; setSamplesData(newS); }} 
                              />
                            </div>
                          </div>
                        </td>

                        {}
                        <td className="p-2 align-top">
                          <textarea 
                            rows={3}
                            placeholder="Ghi chú"
                            className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none leading-tight" 
                            value={sample.gc} 
                            onChange={e => { const newS = [...samplesData]; newS[index].gc = e.target.value; setSamplesData(newS); }} 
                          />
                        </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>

          {}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Tình trạng mẫu:</label>
                   <div className="flex gap-3">
                     <label className="flex items-center gap-1.5 cursor-pointer">
                       <input type="radio" checked={!!formData.ttg_moi} onChange={() => setFormData({...formData, ttg_moi: true})} className="w-3.5 h-3.5 text-emerald-600"/>
                       <span className="text-[11px] font-semibold text-slate-700">Mới</span>
                     </label>
                     <label className="flex items-center gap-1.5 cursor-pointer">
                       <input type="radio" checked={!formData.ttg_moi} onChange={() => setFormData({...formData, ttg_moi: false})} className="w-3.5 h-3.5 text-emerald-600"/>
                       <span className="text-[11px] font-semibold text-slate-700">Đã sử dụng</span>
                     </label>
                   </div>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Xử lý mẫu sau TN:</label>
                   <div className="flex flex-wrap gap-2.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!formData.stn_luu} onChange={e => setFormData({...formData, stn_luu: e.target.checked, stn_huy: false, stn_nhan: false})} className="w-3.5 h-3.5 rounded text-emerald-600"/>
                        <span className="text-[11px] font-semibold text-slate-700">Lưu</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!formData.stn_huy} onChange={e => setFormData({...formData, stn_huy: e.target.checked, stn_luu: false, stn_nhan: false})} className="w-3.5 h-3.5 rounded text-emerald-600"/>
                        <span className="text-[11px] font-semibold text-slate-700">Hủy</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!formData.stn_nhan} onChange={e => setFormData({...formData, stn_nhan: e.target.checked, stn_luu: false, stn_huy: false})} className="w-3.5 h-3.5 rounded text-emerald-600"/>
                        <span className="text-[11px] font-semibold text-slate-700">Nhận lại</span>
                      </label>
                   </div>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Bản sao kết quả:</label>
                   <div className="flex flex-wrap gap-2.5">
                      {['bansao_mot', 'bansao_hai', 'bansao_ba'].map((key, idx) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={!!formData[key]} onChange={e => setFormData({...formData, [key]: e.target.checked})} className="w-3.5 h-3.5 rounded text-emerald-600"/>
                          <span className="text-[11px] font-semibold text-slate-700">{idx + 1} bản</span>
                        </label>
                      ))}
                   </div>
                </div>
                <InputField label="Thông tin khác" field="thong_tin_khac" className="col-span-1 md:col-span-3" />
             </div>
          </div>
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors uppercase">Hủy</button>
          
          <button onClick={handlePrint} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Printer size={14} />}
            In Phiếu
          </button>
          
          <button onClick={() => handleExportDocx(true)} disabled={isLoading} className="px-4 py-2 bg-emerald-600 text-white rounded text-xs font-bold uppercase hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {isLoading ? <Loader2 className="animate-spin" size={14}/> : <FileDown size={14} />}
            Xuất PYC docx
          </button>
        </div>
      </div>
    </div>
  );
};

// --- End of PrintFormModal.tsx ---
