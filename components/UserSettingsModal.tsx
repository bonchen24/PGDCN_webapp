// Author: Gemini
// OS support: Web/Node
// Description: User specific settings modal

import React, { useState, useEffect } from 'react';
import { X, Save, User, Key, ShieldCheck, Eye, EyeOff, Image as ImageIcon, Upload, Bot, CheckCircle2, AlertCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { toast } from 'sonner';
import { findUserPreference } from '../utils/userIdentity';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, userPreferences, settings, updateUserPreferences } = useStore();
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [availableGeminiModels, setAvailableGeminiModels] = useState<{ id: string; name: string; displayName: string; description?: string; inputTokenLimit?: number; outputTokenLimit?: number }[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [lastFetchedTime, setLastFetchedTime] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      const prefs = findUserPreference(userPreferences, [currentUser.username]) || {};
      setPassword(prefs.customPassword || '');
      setApiKey(prefs.geminiApiKey || '');
      const hasPersonalModel = Object.prototype.hasOwnProperty.call(prefs, 'geminiModel');
      setGeminiModel(hasPersonalModel ? prefs.geminiModel || '' : settings?.geminiModel || '');
      setAvatarUrl(prefs.avatarUrl || '');
    }
  }, [isOpen, currentUser, userPreferences, settings]);

  const fetchGoogleGeminiModels = async (showToast = true) => {
    setIsLoadingModels(true);
    setModelFetchError(null);
    try {
      const state = useStore.getState();
      const activeUser = state.currentUser;
      const activePrefs = activeUser
        ? findUserPreference(state.userPreferences, [activeUser.username])
        : undefined;
      const userApiKey = activePrefs?.geminiApiKey;
      const headers: Record<string, string> = {};
      if (userApiKey) headers['X-Gemini-API-Key'] = userApiKey;

      const res = await fetch('/api/gemini/models', { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableGeminiModels(data.models);
        setLastFetchedTime(new Date().toLocaleTimeString('vi-VN'));
        if (showToast) {
          toast.success(`Đã kiểm tra thành công: Tìm thấy ${data.models.length} phiên bản mô hình từ Google!`);
        }
      } else {
        throw new Error('Không nhận được danh sách mô hình từ máy chủ Google.');
      }
    } catch (err: any) {
      console.error('Fetch models error:', err);
      setModelFetchError(err.message);
      if (showToast) {
        toast.error('Không thể lấy danh sách mô hình từ Google: ' + err.message);
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 256;
          const MAX_HEIGHT = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setAvatarUrl(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      await updateUserPreferences(currentUser.username, {
        customPassword: password,
        geminiApiKey: apiKey,
        geminiModel: geminiModel.trim(),
        avatarUrl: avatarUrl,
      });
      toast.success('Đã lưu cấu hình cá nhân!');
      onClose();
    } catch (error: any) {
      console.error('Lỗi khi lưu cấu hình cá nhân:', error);
      toast.error(`Không thể lưu cấu hình cá nhân: ${error?.message || error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
          <div>
            <h3 className="text-lg font-black uppercase flex items-center gap-3 tracking-widest">
              <div className="p-2 bg-slate-700 rounded-xl"><User className="text-emerald-400" size={20} /></div> Cài đặt cá nhân
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-2">Cấu hình riêng cho {currentUser.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Mật khẩu */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-500" /> Đổi mật khẩu
            </h4>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full border border-slate-200/60 rounded-2xl p-3.5 text-[11px] font-bold font-mono text-slate-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none pr-10 shadow-sm transition-all"
                  placeholder="Để trống nếu không đổi..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-2">
                * Mật khẩu này sẽ ghi đè mật khẩu mặc định của hệ thống.
              </p>
            </div>
          </div>

          {/* Avatar URL */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <ImageIcon size={16} className="text-pink-500" /> Avatar Image
            </h4>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tải ảnh đại diện</label>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Chọn ảnh từ thiết bị"
                  />
                  <button type="button" className="h-11 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl flex items-center gap-2 text-[11px] font-black tracking-widest uppercase transition-all shadow-sm">
                    <Upload size={14} /> Chọn ảnh từ thiết bị
                  </button>
                </div>
              </div>
              {avatarUrl && (
                <div className="mt-3 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-fit">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shadow-sm shrink-0">
                    <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">Ảnh xem trước</span>
                </div>
              )}
              <p className="text-[10px] text-slate-400 italic mt-2">
                * Hình ảnh sẽ được dùng làm ảnh đại diện cho tài khoản của bạn.
              </p>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <Key size={16} className="text-purple-500" /> Gemini API Key
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">API Key (Tuỳ chọn)</label>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-500 hover:text-blue-600 underline">Lấy API Key tại đây</a>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="w-full border border-slate-200/60 rounded-2xl p-3.5 text-[11px] font-bold font-mono text-slate-700 bg-slate-50 focus:ring-2 focus:ring-purple-500 outline-none pr-10 shadow-sm transition-all"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-2">
                * Khóa API chỉ cần thiết khi sử dụng các tính năng AI.
              </p>
            </div>
          </div>

          {/* Gemini model */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Bot size={16} className="text-blue-500" /> Mô hình AI Gemini
              </h4>
              {isLoadingModels ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <Loader2 size={10} className="animate-spin" /> Đang kiểm tra...
                </span>
              ) : availableGeminiModels.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 size={10} className="text-emerald-500" /> Google Live ({availableGeminiModels.length})
                </span>
              ) : (
                <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Chưa kiểm tra</span>
              )}
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Chọn mô hình AI riêng cho tài khoản này. Nếu không chọn, hệ thống sẽ tự động tối ưu.
            </p>

            <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-[10px] text-slate-600">
                <span className="font-bold">Trạng thái kết nối Google:</span>
                <div className="text-slate-400 mt-0.5">{lastFetchedTime ? `Đã kiểm tra lúc ${lastFetchedTime}` : 'Chưa kiểm tra trực tiếp'}</div>
              </div>
              <button
                type="button"
                onClick={() => fetchGoogleGeminiModels(true)}
                disabled={isLoadingModels}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw size={11} className={isLoadingModels ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                {isLoadingModels ? 'Đang lấy...' : 'Kiểm tra Google'}
              </button>
            </div>

            {modelFetchError && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 flex items-center gap-1.5">
                <AlertCircle size={12} className="shrink-0 text-amber-600" />
                <span>{modelFetchError} (Có thể dùng danh sách mặc định)</span>
              </div>
            )}

            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-xl outline-none text-[11px] font-medium text-slate-700 bg-white"
            >
              <option value="">✨ Tự động (Khuyên dùng)</option>
              {availableGeminiModels.length > 0 ? (
                <optgroup label="Danh sách phiên bản từ máy chủ Google">
                  {availableGeminiModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName || model.id}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <optgroup label="Danh sách mô hình phổ biến">
                  <option value="gemini-flash-latest">Gemini Flash Latest (Nhanh nhất)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Tiêu chuẩn)</option>
                  <option value="gemini-pro-latest">Gemini Pro Latest (Thông minh nhất)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Độ chính xác cao)</option>
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                </optgroup>
              )}
            </select>

            {geminiModel && (
              <div className="p-2 bg-blue-50/60 border border-blue-100 rounded-xl text-[10px] text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles size={11} className="text-blue-600" /> Mô hình riêng đang chọn: <span className="font-mono text-blue-700">{geminiModel}</span>
                </div>
                {availableGeminiModels.find(model => model.id === geminiModel)?.description && (
                  <p className="text-[10px] text-slate-600 line-clamp-2">
                    {availableGeminiModels.find(model => model.id === geminiModel)?.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 bg-slate-50/80 border-t border-slate-100/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all">
            Hủy
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md hover:shadow-lg hover:bg-emerald-700 active:scale-95 flex items-center gap-2 transition-all">
            <Save size={16} /> Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};
// --- End of UserSettingsModal.tsx ---
