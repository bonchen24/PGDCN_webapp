'use client';

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';

import { establishPcnSession } from '../utils/pcnAuthApi';
import {
  isPasswordCredentialStorageAvailable,
  loadPasswordCredential,
  storePasswordCredential,
  type PasswordCredentialConstructor,
  type PasswordCredentialManager,
} from '../utils/passwordCredential';
import { usePcnSessionStore } from '../utils/pcnSessionState';

function getBrowserPasswordCredentialManager(): PasswordCredentialManager | null {
  if (typeof navigator === 'undefined' || !navigator.credentials) return null;
  return navigator.credentials as unknown as PasswordCredentialManager;
}

function getBrowserPasswordCredentialConstructor(): PasswordCredentialConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential || null;
}

export default function PcnLoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [canRememberPassword, setCanRememberPassword] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const manager = getBrowserPasswordCredentialManager();
    const CredentialConstructor = getBrowserPasswordCredentialConstructor();
    setCanRememberPassword(isPasswordCredentialStorageAvailable(manager, CredentialConstructor));
    void loadPasswordCredential(manager).then((credential) => {
      if (cancelled || !credential) return;
      setUsername(credential.username);
      setPassword(credential.password);
      setRememberMe(true);
    });
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setError('Vui lòng nhập tên tài khoản.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const session = await establishPcnSession(normalizedUsername, password);
      if (rememberMe) {
        await storePasswordCredential(
          getBrowserPasswordCredentialManager(),
          getBrowserPasswordCredentialConstructor(),
          normalizedUsername,
          password,
        );
      }
      usePcnSessionStore.getState().setCurrentUser(session.user);
    } catch (sessionError: any) {
      console.error('PCN server session initialization failed:', sessionError);
      setError(sessionError?.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/icons/iemm-logo-32.png"
            alt="IEMM • TVCI"
            className="h-16 w-16 rounded-xl border border-slate-200/20 bg-white object-contain p-1.5"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">IEMM • TVCI</span>
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold text-white">Hệ thống chứng nhận</h1>
        <p className="mt-2 text-center text-sm text-slate-400">Giám định - Chứng nhận • Miền PCN (Phòng Chứng nhận)</p>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 px-6 py-8 shadow-sm">
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="pcn-username" className="mb-2 block text-sm font-medium text-slate-200">Tên đăng nhập</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500"><User aria-hidden="true" size={18} /></div>
                <input
                  id="pcn-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'pcn-login-error' : undefined}
                  className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  placeholder="Tên đăng nhập..."
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="pcn-password" className="block text-sm font-medium text-slate-200">Mật khẩu</label>
                <label
                  className={`flex min-h-11 items-center gap-2 text-xs font-medium ${canRememberPassword === false ? 'cursor-not-allowed text-slate-600' : 'cursor-pointer text-slate-400'}`}
                  title={canRememberPassword === false ? 'Trình duyệt này không hỗ trợ lưu mật khẩu tự động' : 'Lưu trong trình quản lý mật khẩu của trình duyệt'}
                >
                  <input
                    id="pcn-remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    disabled={canRememberPassword !== true}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    aria-label="Lưu mật khẩu"
                    className="h-4 w-4 cursor-pointer rounded border-slate-700 bg-slate-950 text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  />
                  Lưu mật khẩu
                </label>
              </div>
              {canRememberPassword === false && <p className="mt-1 text-right text-xs text-slate-500">Trình duyệt chưa hỗ trợ lưu tự động</p>}
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500"><Lock aria-hidden="true" size={18} /></div>
                <input
                  id="pcn-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'pcn-login-error' : undefined}
                  className="block min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-12 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  placeholder="Mật khẩu của bạn"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
                </button>
              </div>
            </div>

            {error && <div id="pcn-login-error" role="alert" className="rounded-lg border border-red-400/40 bg-red-950/50 p-3 text-sm font-medium text-red-200">{error}</div>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                {isSubmitting && <Loader2 aria-hidden="true" size={14} className="animate-spin" />}
                {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
              </button>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck aria-hidden="true" size={12} className="text-emerald-500" /> Phiên làm việc được bảo vệ riêng cho PCN</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- End of PcnLoginScreen.tsx ---
