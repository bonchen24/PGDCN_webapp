import fs from 'fs';

let content = fs.readFileSync('components/SystemManagementViews.tsx', 'utf-8');

// 1. Add uploadConfirmOpen state
content = content.replace(
  'const [restoreConfirmData, setRestoreConfirmData] = useState<{data: any, requestsCount: number, handoverDocsCount: number, kqtnRecordsCount: number, customersCount: number, productsCount: number, brandsCount: number} | null>(null);',
  `const [restoreConfirmData, setRestoreConfirmData] = useState<{data: any, requestsCount: number, handoverDocsCount: number, kqtnRecordsCount: number, customersCount: number, productsCount: number, brandsCount: number} | null>(null);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);`
);

// 2. Change handleConfirmRestore to load into buffer instead of pushing to Firebase
content = content.replace(
  `const toastId = toast.loading("Đang đẩy dữ liệu lên Firebase, vui lòng không tắt trình duyệt...");
    try {
      await useStore.getState().restoreFromBackup(data);
      toast.success("Khôi phục và lưu toàn bộ dữ liệu lên Firebase thành công!", { id: toastId });
    } catch (err: any) {
      toast.error("Lỗi phục hồi dữ liệu: " + (err.message || err), { id: toastId });
    }`,
  `const toastId = toast.loading("Đang tải dữ liệu vào bộ đệm...");
    try {
      await useStore.getState().restoreFromBackup(data);
      toast.success("Tải dữ liệu vào bộ đệm thành công! Vui lòng bấm 'Xác nhận & Lưu lên Cloud' để đẩy dữ liệu.", { id: toastId });
    } catch (err: any) {
      toast.error("Lỗi phục hồi dữ liệu: " + (err.message || err), { id: toastId });
    }`
);

// 3. Add handleConfirmUpload
content = content.replace(
  'const handleCancelRestore = () => {',
  `const handleConfirmUpload = async () => {
    setUploadConfirmOpen(false);
    const toastId = toast.loading("Đang đẩy toàn bộ dữ liệu lên Firebase, vui lòng không tắt trình duyệt...");
    try {
      await useStore.getState().uploadToFirebase();
      toast.success("Đẩy dữ liệu lên Firebase thành công!", { id: toastId });
    } catch (err: any) {
      toast.error("Lỗi đẩy dữ liệu: " + (err.message || err), { id: toastId });
    }
  };

  const handleCancelUpload = () => {
    setUploadConfirmOpen(false);
  };

  const handleCancelRestore = () => {`
);

// 4. Add the button next to "Khôi phục từ file JSON"
// Look for the "Khôi phục từ file JSON" button block
content = content.replace(
  `<Upload size={14} /> Khôi phục từ file JSON
                </button>
              </div>`,
  `<Upload size={14} /> Khôi phục từ file JSON
                </button>
              </div>
              
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setUploadConfirmOpen(true)}
                  disabled={!isAuthorized}
                  className={\`w-full py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 \${
                    !isAuthorized ? 'bg-slate-300 cursor-not-allowed opacity-60' : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
                  }\`}
                >
                  <CloudUpload size={14} /> Xác nhận & Lưu lên Cloud
                </button>
              </div>`
);

// 5. Add the Upload Confirmation Modal at the bottom
// Look for {restoreConfirmData && ( ... )} block and add the upload modal below it
const uploadModal = `

      {uploadConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-blue-50 border-b border-blue-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-blue-800 text-sm flex items-center gap-2">
                <CloudUpload size={18} className="text-blue-600" />
                Xác nhận lưu lên Cloud
              </h3>
              <button onClick={handleCancelUpload} className="text-blue-500 hover:text-blue-700 bg-blue-100/50 hover:bg-blue-200/50 p-1.5 rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-slate-700 font-medium leading-relaxed mb-4">
                Bạn có chắc chắn muốn đẩy toàn bộ dữ liệu từ bộ đệm hiện tại lên Firebase? 
              </p>
              
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border border-blue-100 text-xs font-bold flex items-start gap-2 mb-4">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p>Hành động này sẽ ghi đè dữ liệu hiện tại trên Cloud bằng dữ liệu trong ứng dụng của bạn.</p>
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
                <Check size={14} /> LƯU LÊN CLOUD
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(
  '      {restoreConfirmData && (',
  uploadModal + '\n      {restoreConfirmData && ('
);

// We need to import CloudUpload if not imported
if (!content.includes('CloudUpload')) {
    content = content.replace('Upload,', 'Upload, CloudUpload,');
}

fs.writeFileSync('components/SystemManagementViews.tsx', content);
console.log("Patched SystemManagementViews.tsx");
