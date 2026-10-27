'use client';

import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Loader2, RefreshCw, Save, Sparkles, UserRound, X } from 'lucide-react';

import type { OrganizationManagementRoleCode, ProfessionalRoleCode, UserAccount } from '../types';
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS, PROFESSIONAL_ROLE_OPTIONS } from '../types';
import {
  checkPcnGeminiModels,
  fetchPcnPersonalSettings,
  updatePcnPersonalSettings,
  type PcnGeminiModel,
  type PcnGeminiModelCheckResult,
  type PcnPersonalSettings,
} from '../utils/pcnPersonalSettingsApi';
import PcnCatalogCombobox from './PcnCatalogCombobox';

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên PCN',
  staff: 'Nhân viên PCN',
  viewer: 'Chỉ xem',
};

function managementRoleLabel(code?: OrganizationManagementRoleCode): string {
  return ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === code)?.name || 'Chưa phân công chức danh quản lý';
}

function professionalRoleLabel(codes?: ProfessionalRoleCode[]): string {
  return (codes || []).map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code).join(', ') || 'Chưa gán vai trò chuyên môn';
}

export default function PcnPersonalSettingsPanel({ currentUser, onClose }: { currentUser: UserAccount; onClose: () => void }) {
  const [compactCards, setCompactCards] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('pcn_compact_cards') !== 'false';
  });
  const [personalSettings, setPersonalSettings] = useState<PcnPersonalSettings>({ geminiApiKeyConfigured: false });
  const [apiKey, setApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [geminiModels, setGeminiModels] = useState<PcnGeminiModel[]>([]);
  const [modelCheck, setModelCheck] = useState<PcnGeminiModelCheckResult | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [clearGeminiApiKey, setClearGeminiApiKey] = useState(false);
  const [loadingAiSettings, setLoadingAiSettings] = useState(true);
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [aiError, setAiError] = useState('');
  const geminiModelOptions = [
    { value: '', label: 'Dùng mô hình mặc định của ứng dụng', searchText: 'mac dinh ung dung default' },
    ...geminiModels.map((model) => ({
      value: model.id,
      label: model.displayName && model.displayName !== model.id ? `${model.displayName} · ${model.id}` : model.id,
      searchText: [model.id, model.displayName].filter(Boolean).join(' '),
    })),
  ];
  const unmatchedGeminiModelOption = geminiModel && !geminiModels.some((model) => model.id === geminiModel)
    ? { value: geminiModel, label: geminiModel }
    : undefined;

  useEffect(() => {
    window.localStorage.setItem('pcn_compact_cards', String(compactCards));
  }, [compactCards]);

  useEffect(() => {
    let active = true;
    setLoadingAiSettings(true);
    setAiError('');
    void fetchPcnPersonalSettings()
      .then((settings) => {
        if (!active) return;
        setPersonalSettings(settings);
        setGeminiModel(settings.geminiModel || '');
        setGeminiModels([]);
        setModelCheck(null);
      })
      .catch((error: any) => {
        if (active) setAiError(error?.message || 'Không thể tải thiết lập AI cá nhân.');
      })
      .finally(() => {
        if (active) setLoadingAiSettings(false);
      });
    return () => { active = false; };
  }, [currentUser.username]);

  const saveAiSettings = async () => {
    if (savingAiSettings) return;
    setSavingAiSettings(true);
    setAiError('');
    setAiNotice('');
    try {
      const nextSettings = await updatePcnPersonalSettings({
        ...(apiKey.trim() ? { geminiApiKey: apiKey.trim() } : {}),
        ...(clearGeminiApiKey ? { clearGeminiApiKey: true } : {}),
        geminiModel: geminiModel.trim(),
      });
      setPersonalSettings(nextSettings);
      setApiKey('');
      setClearGeminiApiKey(false);
      setShowApiKey(false);
      setModelCheck(null);
      setAiNotice('Đã lưu thiết lập Gemini cá nhân.');
    } catch (error: any) {
      setAiError(error?.message || 'Không thể lưu thiết lập AI cá nhân.');
    } finally {
      setSavingAiSettings(false);
    }
  };

  const testGeminiConnection = async () => {
    if (testingGemini) return;
    if (!personalSettings.geminiApiKeyConfigured || apiKey.trim()) {
      setAiError(apiKey.trim() ? 'Hãy lưu API Key mới trước khi kiểm tra kết nối Google.' : 'Chưa có Gemini API Key cá nhân để kiểm tra.');
      return;
    }
    setTestingGemini(true);
    setAiError('');
    setAiNotice('');
    try {
      const result = await checkPcnGeminiModels(geminiModel);
      setGeminiModels(result.models);
      setModelCheck(result);
      const selectedModelNotice = result.selectedModel
        ? result.selectedModelAvailable
          ? ` · ${result.selectedModel} khả dụng`
          : ` · ${result.selectedModel} không khả dụng với key này`
        : '';
      setAiNotice(`Kết nối Google thành công${result.models.length ? ` · ${result.models.length} mô hình khả dụng` : ''}${selectedModelNotice}.`);
    } catch (error: any) {
      setAiError(error?.message || 'Không thể kết nối tới Google Gemini.');
    } finally {
      setTestingGemini(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-end bg-slate-950/30 p-0 backdrop-blur-[1px] sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex min-h-0 max-h-[calc(100dvh-0.5rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-emerald-600 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="pcn-personal-settings-title">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UserRound size={17} /></span><div><h2 id="pcn-personal-settings-title" className="text-sm font-black text-slate-900">Thiết lập cá nhân</h2><p className="mt-0.5 text-[11px] text-slate-500">Thông tin phiên làm việc, AI hỗ trợ và tùy chọn hiển thị.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Đóng thiết lập cá nhân" className="min-h-11 min-w-11 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button>
        </div>

        <main className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto">
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-black uppercase text-emerald-700">{currentUser.name.split(' ').pop()?.slice(0, 2) || 'PC'}</span><div className="min-w-0"><div className="truncate text-sm font-black text-slate-900">{currentUser.name || 'Người dùng PCN'}</div><div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">@{currentUser.username}</div><div className="mt-1 text-[10px] text-slate-500">{currentUser.position || 'Nhân sự PCN'}</div></div></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Vai trò hệ thống</div><div className="mt-1 text-[11px] font-black text-slate-700">{SYSTEM_ROLE_LABELS[currentUser.systemRole || currentUser.role] || currentUser.role}</div></div><div className="rounded-lg bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Chức danh quản lý</div><div className="mt-1 text-[11px] font-black text-slate-700">{managementRoleLabel(currentUser.managementRoleCode)}</div></div></div>
          <div className="mt-2 rounded-lg bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Vai trò chuyên môn</div><div className="mt-1 text-[11px] font-bold text-violet-700">{professionalRoleLabel(currentUser.professionalRoleCodes)}</div></div>
          <div className="mt-2 rounded-lg bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Lĩnh vực được phân công</div><div className="mt-1 flex flex-wrap gap-1">{currentUser.fieldCodes?.length ? currentUser.fieldCodes.map((fieldCode) => <span key={fieldCode} className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{fieldCode}</span>) : <span className="text-[11px] font-bold text-slate-500">Theo quyền PCN và phân công hồ sơ</span>}</div></div>
        </div>

        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Sparkles size={15} /></span><div><div className="text-[11px] font-black uppercase tracking-wider text-violet-800">Gemini cho OCR và trợ lý AI</div><p className="mt-0.5 text-[11px] leading-4 text-violet-700">Key cá nhân được mã hóa ở máy chủ PCN; không lưu trong trình duyệt.</p></div></div>{personalSettings.geminiApiKeyConfigured && <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Đã cấu hình</span>}</div>
          {loadingAiSettings ? <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/80 p-2.5 text-[11px] text-slate-500"><Loader2 size={14} className="animate-spin" /> Đang tải thiết lập AI...</div> : <>
            <div className="mt-3 rounded-lg border border-violet-100 bg-white/80 p-2.5 text-[11px] leading-4 text-slate-600"><p className="font-black text-violet-800">Quota riêng theo project Google</p><p className="mt-0.5">Để mỗi người dùng có quota riêng, hãy tạo API key trong một project Google AI Studio/Cloud riêng của anh/chị. Google áp dụng quota theo project; dùng nhiều key trong cùng project vẫn có thể dùng chung quota.</p><div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-black"><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-violet-700 underline decoration-violet-300 underline-offset-2">Tạo API key trên Google AI Studio</a><a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noreferrer" className="text-blue-700 underline decoration-blue-300 underline-offset-2">Xem hướng dẫn bảo mật key</a><a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-emerald-700 underline decoration-emerald-300 underline-offset-2">Mở AI Studio để xem Usage</a></div></div>
            <label className="mt-3 block text-[11px] font-black text-slate-700" htmlFor="pcn-gemini-api-key">Gemini API Key cá nhân</label>
            <div className="mt-1 flex gap-1.5"><div className="relative min-w-0 flex-1"><input id="pcn-gemini-api-key" type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setClearGeminiApiKey(false); setAiError(''); }} autoComplete="new-password" className="min-h-11 w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 pr-9 text-[11px] outline-none focus:border-violet-400" />{apiKey && <button type="button" onClick={() => setShowApiKey((value) => !value)} aria-label={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'} className="absolute right-1 top-1 min-h-11 min-w-11 rounded-md p-1.5 text-slate-400 hover:bg-slate-100">{showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>}</div>{personalSettings.geminiApiKeyConfigured && <button type="button" onClick={() => { setApiKey(''); setClearGeminiApiKey((value) => !value); setAiError(''); }} className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-black ${clearGeminiApiKey ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><KeyRound size={12} /> {clearGeminiApiKey ? 'Sẽ xóa' : 'Xóa key'}</button>}</div>
            {clearGeminiApiKey && <p className="mt-1 text-[11px] font-bold text-rose-700">Bấm “Lưu thiết lập” để xóa key cá nhân khỏi máy chủ.</p>}
            <label className="mt-3 block text-[11px] font-black text-slate-700" htmlFor="pcn-gemini-model">Mô hình Gemini</label>
            <div className="mt-1 flex gap-1.5"><div className="min-w-0 flex-1"><PcnCatalogCombobox id="pcn-gemini-model" label="Mô hình Gemini" hideLabel value={geminiModel} onChange={(value) => { setGeminiModel(value); setModelCheck(null); setAiError(''); }} options={geminiModelOptions} unmatchedOption={unmatchedGeminiModelOption} disabled={loadingAiSettings || testingGemini} /></div><button type="button" onClick={() => void testGeminiConnection()} disabled={testingGemini || loadingAiSettings || Boolean(apiKey.trim())} aria-label="Kiểm tra Google và mô hình" title={apiKey.trim() ? 'Hãy lưu key mới trước' : 'Kiểm tra key đã lưu'} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-2 text-[11px] font-black text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">{testingGemini ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Kiểm tra kết nối mô hình</button></div>
            {modelCheck && modelCheck.selectedModel && <p className={`mt-2 text-[11px] font-bold ${modelCheck.selectedModelAvailable ? 'text-emerald-700' : 'text-rose-700'}`}>{modelCheck.selectedModelAvailable ? `Mô hình ${modelCheck.selectedModel} đang khả dụng theo nhà cung cấp.` : `Mô hình ${modelCheck.selectedModel} không được nhà cung cấp cấp cho khóa/dự án này.`} Kiểm tra lúc {new Date(modelCheck.checkedAt).toLocaleString('vi-VN')}.</p>}
            {aiNotice && <p role="status" className="mt-2 text-[11px] font-bold text-emerald-700">{aiNotice}</p>}
            {aiError && <p role="alert" className="mt-2 text-[11px] font-bold text-rose-700">{aiError}</p>}
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => void saveAiSettings()} disabled={savingAiSettings} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{savingAiSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {savingAiSettings ? 'Đang lưu...' : 'Lưu thiết lập AI'}</button></div>
          </>}
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 p-3"><div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Tùy chọn hiển thị</div><label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={compactCards} onChange={(event) => setCompactCards(event.target.checked)} className="accent-emerald-600" /><span>Ưu tiên card hồ sơ gọn</span>{compactCards && <Check size={14} className="text-emerald-600" />}</label><p className="mt-1 pl-5 text-[11px] text-slate-400">Tùy chọn này được lưu trên thiết bị; key Gemini không lưu tại đây.</p></div>
        </main>
        <footer className="mt-4 flex shrink-0 justify-end border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-black text-white hover:bg-emerald-700">Đóng</button></footer>
      </section>
    </div>
  );
}
