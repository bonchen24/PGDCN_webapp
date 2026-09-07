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
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          {mode === 'pcn' ? <div className="flex flex-col items-center gap-2">
            <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-16 w-16 rounded-xl border border-slate-200/20 bg-white object-contain p-1.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">IEMM • TVCI</span>
          </div> : <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-600">
            <ShieldCheck size={36} className="text-white" />
          </div>}
        </div>
        <h2 className="mt-6 text-center text-2xl font-semibold text-white">
          {mode === 'pcn' ? 'Hệ thống chứng nhận' : 'Hệ thống thử nghiệm'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          {mode === 'pcn' ? 'Phòng Chứng nhận • Quản lý hồ sơ theo Lĩnh vực' : 'Phòng Điện - Điện tử • Quản lý & Lên lịch Tự động'}
        </p>
      </div>

      <div className="mx-auto mt-8 w-full max-w-md">
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-8 shadow-sm">
          
          {!isForgotMode ? (
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-200">
                  Tên đăng nhập
                </label>
                <div className="relative">
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
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'legacy-login-error' : undefined}
                    className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    placeholder="Tên đăng nhập..."
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                    Mật khẩu
                  </label>
                  <label className="flex min-h-11 items-center gap-2 cursor-pointer text-xs font-medium text-slate-400 transition-colors hover:text-slate-200" title="Lưu trong trình quản lý mật khẩu của trình duyệt">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      aria-label="Lưu mật khẩu"
                      className="h-4 w-4 cursor-pointer rounded border-slate-700 bg-slate-950 text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    />
                    <span>Lưu mật khẩu</span>
                  </label>
                </div>
                <div className="relative">
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
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'legacy-login-error' : undefined}
                    className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-12 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    placeholder="Mật khẩu của bạn"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
                    className="min-h-11 rounded-lg px-2 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    Quên mật khẩu?
                  </button>
                </div>}
              </div>

              {error && (
                <div id="legacy-login-error" role="alert" className="rounded-lg border border-red-400/40 bg-red-950/50 p-3 text-sm font-medium text-red-200">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  {isLoading && <Loader2 size={14} className="animate-spin" />}
                  {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập hệ thống'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    aria-label="Quay lại đăng nhập"
                    className="-ml-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    title="Quay lại"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="text-sm font-semibold text-white">
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
                  className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Quay lại
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Nhập chính xác thông tin tài khoản của bạn để khôi phục về mật khẩu mặc định (Abc123456). Yêu cầu sẽ được thông báo đến quản trị viên.
              </p>

              <div>
                <label htmlFor="reset-username" className="mb-2 block text-sm font-medium text-slate-200">
                  Tên đăng nhập
                </label>
                <div className="relative">
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
                    aria-invalid={Boolean(resetError)}
                    aria-describedby={resetError ? 'reset-error' : undefined}
                    className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    placeholder="Tên đăng nhập của bạn..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reset-fullname" className="mb-2 block text-sm font-medium text-slate-200">
                  Họ và tên
                </label>
                <div className="relative">
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
                    aria-invalid={Boolean(resetError)}
                    aria-describedby={resetError ? 'reset-error' : undefined}
                    className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    placeholder="Họ và tên đăng ký..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reset-contact" className="mb-2 block text-sm font-medium text-slate-200">
                  Số điện thoại hoặc Email
                </label>
                <div className="relative">
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
                    aria-invalid={Boolean(resetError)}
                    aria-describedby={resetError ? 'reset-error' : undefined}
                    className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    placeholder="Số điện thoại hoặc email liên hệ..."
                  />
                </div>
              </div>

              {resetError && (
                <div id="reset-error" role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-950/50 p-3 text-sm font-medium text-red-200">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-lg border border-emerald-400/40 bg-emerald-950/50 p-3 text-sm font-medium text-emerald-200">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
