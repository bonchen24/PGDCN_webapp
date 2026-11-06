'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

import { establishPcnSession } from '@/utils/pcnAuthApi';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import {
  isPasswordCredentialStorageAvailable,
  loadPasswordCredential,
  storePasswordCredential,
  type PasswordCredentialConstructor,
  type PasswordCredentialManager,
} from '@/utils/passwordCredential';

function getCredentialManager(): PasswordCredentialManager | null {
  if (typeof navigator === 'undefined' || !navigator.credentials) return null;
  return navigator.credentials as unknown as PasswordCredentialManager;
}

function getCredentialConstructor(): PasswordCredentialConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential || null;
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const returnTo = searchParams.get('returnTo');
  const setCurrentUser = usePcnSessionStore((state) => state.setCurrentUser);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [canRemember, setCanRemember] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load browser stored password credential if available
  useEffect(() => {
    const manager = getCredentialManager();
    const constructor = getCredentialConstructor();
    setCanRemember(isPasswordCredentialStorageAvailable(manager, constructor));

    void loadPasswordCredential(manager).then((cred) => {
      if (cred) {
        setUsername(cred.username);
        setPassword(cred.password);
        setRememberMe(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await establishPcnSession(trimmedUser, password);
      if (rememberMe) {
        await storePasswordCredential(getCredentialManager(), getCredentialConstructor(), trimmedUser, password);
      }
      setCurrentUser(response.user);

      const safeReturnTo =
        returnTo &&
        returnTo.startsWith('/') &&
        !returnTo.startsWith('//') &&
        !returnTo.startsWith('/\\')
          ? returnTo
          : '/';
      router.replace(safeReturnTo);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="mx-auto w-full max-w-md">
        {/* Header Unit Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/icons/iemm-logo-192.png"
              alt="Logo IEMM"
              width={56}
              height={56}
              className="h-14 w-14 rounded-xl border border-slate-700 bg-white object-contain p-1 shadow-sm"
            />
            <span className="h-8 w-px bg-slate-800" aria-hidden="true" />
            <img
              src="/tvci_logo.jpg"
              alt="Logo TVCI"
              width={56}
              height={56}
              className="h-14 w-14 rounded-xl border border-slate-700 bg-white object-contain p-1 shadow-sm"
            />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-white">Đăng nhập hệ thống</h1>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Phòng Giám định - Chứng nhận và Phát triển thị trường · TVCI
          </p>
        </div>

        {/* Login Form Container */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
          {/* Session Expiry Banner */}
          {reason === 'session-expired' && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-xs font-medium text-amber-200"
            >
              Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại để tiếp tục.
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Username Input */}
            <div>
              <label htmlFor="login-username" className="mb-1.5 block text-xs font-semibold text-slate-200">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User size={16} />
                </div>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: luongxuanhung"
                  className="block h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white placeholder-slate-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-200">
                  Mật khẩu
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={canRemember === false}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Lưu mật khẩu</span>
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="block h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-10 text-xs text-white placeholder-slate-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs font-medium text-rose-300"
              >
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <span>Đăng nhập hệ thống</span>
                )}
              </button>
            </div>
          </form>

          {/* Security Badge */}
          <div className="mt-5 border-t border-slate-800/80 pt-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              <span>Phiên làm việc bảo mật độc quyền hệ thống PGDCN</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginFormContent />
    </Suspense>
  );
}
