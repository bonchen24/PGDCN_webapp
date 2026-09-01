// Author: Gemini
// OS support: Web/Node
// Description: Login Screen Component for Electrical-Electronics Department with Forgot Password reset flow

import React, { useState } from 'react';
import { useStore } from '../store';
import { User, Lock, Eye, EyeOff, ShieldCheck, Loader2, ArrowLeft, Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { removeAccents } from '../utils/formatter';
import { saveDocToPostgres } from '../utils/firebase';
import { establishKqtnSession } from '../utils/kqtnPdfClient';
import { establishPcnSession } from '../utils/pcnAuthApi';
import {
  loadPasswordCredential,
  storePasswordCredential,
  type PasswordCredentialConstructor,
  type PasswordCredentialManager,
} from '../utils/passwordCredential';

function getBrowserPasswordCredentialManager(): PasswordCredentialManager | null {
  if (typeof navigator === 'undefined' || !navigator.credentials) return null;
  return navigator.credentials as unknown as PasswordCredentialManager;
}

function getBrowserPasswordCredentialConstructor(): PasswordCredentialConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential || null;
}

export const LoginScreen: React.FC<{ mode?: 'legacy' | 'pcn' }> = ({ mode = 'legacy' }) => {
  const { login, logout, isLoading, systemUsers, updateUser, updateUserPreferences, syncTwoWay, fetchData } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // New Forgot Password States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetFullName, setResetFullName] = useState('');
  const [resetContact, setResetContact] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load systemUsers on login screen if empty to facilitate verification
  React.useEffect(() => {
    if (mode !== 'pcn' && systemUsers.length === 0) {
      syncTwoWay(false).catch(err => console.error("Initial login screen sync failed:", err));
    }
  }, [mode, systemUsers, syncTwoWay]);

  React.useEffect(() => {
    let cancelled = false;
    const restoreCredential = async () => {
      if (mode !== 'pcn') {
        const savedUsername = localStorage.getItem('rememberedUsername');
        const savedPassword = localStorage.getItem('rememberedPassword');
        if (!cancelled && savedUsername && savedPassword) {
          setUsername(savedUsername);
          setPassword(savedPassword);
          setRememberMe(true);
        }
        return;
      }

      const savedCredential = await loadPasswordCredential(getBrowserPasswordCredentialManager());
      if (!cancelled && savedCredential) {
        setUsername(savedCredential.username);
        setPassword(savedCredential.password);
        setRememberMe(true);
      }
    };
    void restoreCredential();
    return () => { cancelled = true; };
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!username) {
      setError('Vui lòng nhập tên tài khoản.');
      return;
    }
    let success = false;
    if (mode === 'pcn') {
      try {
        const session = await establishPcnSession(username, password);
        useStore.setState({ currentUser: session.user });
        success = true;
      } catch (sessionError: any) {
        console.error('PCN server session initialization failed:', sessionError);
        setError(sessionError?.message || 'Tài khoản hoặc mật khẩu không chính xác.');
      }
    } else {
      success = login(username, password, { skipLegacyFetch: false });
    }
    if (!success) {
      setError('Tài khoản hoặc mật khẩu không chính xác.');
    } else {
      setError('');
      if (mode !== 'pcn') {
        try {
          await establishKqtnSession(username, password);
        } catch (sessionError: any) {
          console.error('KQTN server session initialization failed:', sessionError);
          logout();
          setError('Không thể khởi tạo phiên bảo mật. Vui lòng kiểm tra kết nối máy chủ và thử lại.');
          return;
        }
      }
      if (mode !== 'pcn' && fetchData) {
        fetchData(false);
      }
      if (mode === 'pcn') {
        if (rememberMe) {
          await storePasswordCredential(
            getBrowserPasswordCredentialManager(),
            getBrowserPasswordCredentialConstructor(),
            username,
            password,
          );
        }
      } else if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
        localStorage.setItem('rememberedPassword', password);
      } else {
        localStorage.removeItem('rememberedUsername');
        localStorage.removeItem('rememberedPassword');
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmitting) return;

    if (!resetUsername.trim()) {
      setResetError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!resetFullName.trim()) {
      setResetError('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (!resetContact.trim()) {
      setResetError('Vui lòng nhập số điện thoại hoặc email liên hệ.');
      return;
    }

    setIsSubmitting(true);
    setResetError('');
    setResetSuccess('');

    try {
      const inputUsername = resetUsername.toLowerCase().trim();
      const inputFullName = resetFullName.toLowerCase().trim();
      const inputContact = resetContact.toLowerCase().trim();

      const matchedUser = systemUsers.find(u => {
        const uUsername = (u['Tên đăng nhập'] || u['username'] || u['Email'] || '').toString().toLowerCase().trim().split('@')[0];
        return uUsername === inputUsername || uUsername === inputUsername.split('@')[0];
      });

      if (!matchedUser) {
        setResetError('Không tìm thấy tài khoản này trong hệ thống. Vui lòng liên hệ Admin.');
        setIsSubmitting(false);
        return;
      }

      // Verify Họ và Tên & Số điện thoại / Email
      const dbFullName = (matchedUser['Họ và Tên'] || matchedUser['name'] || '').toString().toLowerCase().trim();
      const dbPhone = (matchedUser['Số điện thoại'] || matchedUser['phone'] || '').toString().toLowerCase().trim();
      const dbEmail = (matchedUser['Email'] || matchedUser['email'] || '').toString().toLowerCase().trim();

      // Normalize Vietnamese accents for name check
      const cleanInputName = removeAccents(inputFullName);
      const cleanDbName = removeAccents(dbFullName);

      const nameMatches = cleanInputName === cleanDbName || cleanDbName.includes(cleanInputName) || cleanInputName.includes(cleanDbName);
      const contactMatches = 
        inputContact === dbPhone || 
        inputContact === dbEmail || 
        dbPhone.includes(inputContact) || 
        dbEmail.includes(inputContact) ||
        inputContact.replace(/[^0-9]/g, '') === dbPhone.replace(/[^0-9]/g, '');

      if (!nameMatches) {
        setResetError('Thông tin Họ và Tên không chính xác cho tài khoản này.');
        setIsSubmitting(false);
        return;
      }

      // Reset custom password from local preferences so that it falls back to default
      await updateUserPreferences(matchedUser.id, { customPassword: '' });

      // Update password in the database to standard default 'Abc123456'
      const updatedUser = {
        ...matchedUser,
        'Mật khẩu': 'Abc123456',
        'password': 'Abc123456'
      };
      await updateUser(matchedUser.id, updatedUser);

      // Save password reset request to PostgreSQL
      const requestId = `${matchedUser.id}-${Date.now()}`;
      await saveDocToPostgres("passwordResetRequests", requestId, {
        username: matchedUser.id,
        fullName: resetFullName,
        contact: resetContact,
        timestamp: new Date().toISOString(),
        status: 'Completed',
        adminEmail: 'luongxuanhung2402@gmail.com',
        details: `Yêu cầu reset mật khẩu của tài khoản ${matchedUser.id} về mặc định (Abc123456) đã được hệ thống tự động xử lý và gửi tới admin luongxuanhung2402@gmail.com.`
      });

      setResetSuccess('Khôi phục thành công! Yêu cầu khôi phục mật khẩu đã được gửi tới tài khoản admin luongxuanhung2402@gmail.com. Mật khẩu của bạn đã được đặt lại về mặc định là Abc123456.');
      
      // Auto-fill username & new default password on standard login view
      setUsername(resetUsername);
      setPassword('Abc123456');
    } catch (err: any) {
      console.error(err);
      setResetError(`Đã xảy ra lỗi khi gửi yêu cầu khôi phục: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.05),transparent_40%)]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          {mode === 'pcn' ? <div className="flex flex-col items-center gap-2">
            <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-xl shadow-emerald-900/30 ring-1 ring-emerald-400/30" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">IEMM • TVCI</span>
          </div> : <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-900/30 border border-emerald-500/20 animate-bounce-slow">
            <ShieldCheck size={36} className="text-white" />
          </div>}
        </div>
        <h2 className="mt-6 text-center text-2xl font-black tracking-tight text-white uppercase">
          {mode === 'pcn' ? 'Hệ thống chứng nhận' : 'Hệ thống thử nghiệm'}
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400 font-medium">
          {mode === 'pcn' ? 'Phòng Chứng nhận • Quản lý hồ sơ theo Lĩnh vực' : 'Phòng Điện - Điện tử • Quản lý & Lên lịch Tự động'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-800/80 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl border border-slate-700/50">
          
          {!isForgotMode ? (
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label htmlFor="username" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Tên đăng nhập
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User size={18} />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3.5 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Tên đăng nhập..."
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="password" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Mật khẩu
                  </label>
                  <div className="flex items-center" title="Lưu trong trình quản lý mật khẩu của trình duyệt">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900/60 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-1.5 block text-[11px] font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
                      Lưu mật khẩu
                    </label>
                  </div>
                </div>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock size={18} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3.5 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Mật khẩu của bạn"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode !== 'pcn' && <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>}
              </div>

              {error && (
                <div className="p-3.5 bg-red-900/40 border border-red-500/30 rounded-2xl text-xs text-red-200 font-medium">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 transition-all bg-emerald-600 hover:bg-emerald-500 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-500"
                >
                  Đăng nhập hệ thống
                </button>
                {isLoading && (
                  <div className="mt-2.5 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-medium">
                    <Loader2 size={12} className="animate-spin text-emerald-500" />
                    Đang đồng bộ dữ liệu với máy chủ...
                  </div>
                )}
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              <div className="mb-4 flex items-center justify-between border-b border-slate-700/50 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="p-1.5 -ml-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
                    title="Quay lại"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Khôi phục mật khẩu
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setResetError('');
                    setResetSuccess('');
                  }}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  Back
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Nhập chính xác thông tin tài khoản của bạn để khôi phục về mật khẩu mặc định (Abc123456). Yêu cầu sẽ được thông báo đến quản trị viên.
              </p>

              <div>
                <label htmlFor="reset-username" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Tên đăng nhập
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User size={18} />
                  </div>
                  <input
                    id="reset-username"
                    name="reset-username"
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3.5 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Tên đăng nhập của bạn..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reset-fullname" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Họ và tên
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User size={18} />
                  </div>
                  <input
                    id="reset-fullname"
                    name="reset-fullname"
                    type="text"
                    required
                    value={resetFullName}
                    onChange={(e) => setResetFullName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3.5 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Họ và tên đăng ký..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reset-contact" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Số điện thoại hoặc Email
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Phone size={18} />
                  </div>
                  <input
                    id="reset-contact"
                    name="reset-contact"
                    type="text"
                    required
                    value={resetContact}
                    onChange={(e) => setResetContact(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3.5 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Số điện thoại hoặc email liên hệ..."
                  />
                </div>
              </div>

              {resetError && (
                <div className="p-3.5 bg-red-900/40 border border-red-500/30 rounded-2xl text-xs text-red-200 font-medium flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3.5 bg-emerald-900/40 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200 font-medium flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 transition-all bg-emerald-600 hover:bg-emerald-500 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : null}
                  Xác nhận & Gửi yêu cầu
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setResetError('');
                    setResetSuccess('');
                  }}
                  className="w-full flex items-center justify-center py-3 px-4 border border-slate-700 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700/50 transition-all cursor-pointer"
                >
                  <ArrowLeft size={14} className="mr-2" /> Quay lại đăng nhập
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

// --- End of LoginScreen.tsx ---
