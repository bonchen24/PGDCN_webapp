'use client';

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';

import { establishPcnSession } from '../utils/pcnAuthApi';
import {
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
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPasswordCredential(getBrowserPasswordCredentialManager()).then((credential) => {
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
      usePcnSessionStore.getState().setCurrentUser(session.user);
      if (rememberMe) {
        await storePasswordCredential(
          getBrowserPasswordCredentialManager(),
          getBrowserPasswordCredentialConstructor(),
          normalizedUsername,
          password,
        );
      }
    } catch (sessionError: any) {
      console.error('PCN server session initialization failed:', sessionError);
      setError(sessionError?.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-slate-900 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.05),transparent_40%)]" />

      <div className="z-10 mx-auto w-full max-w-md px-4 sm:px-0">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/icons/iemm-logo-32.png"
            alt="IEMM • TVCI"
            className="h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-xl shadow-emerald-900/30 ring-1 ring-emerald-400/30"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">IEMM • TVCI</span>
        </div>
        <h1 className="mt-6 text-center text-2xl font-black uppercase tracking-tight text-white">Hệ thống chứng nhận</h1>
        <p className="mt-2 text-center text-xs font-medium text-slate-400">Phòng Giám định - Chứng nhận • Miền PCN (Phòng Chứng nhận)</p>

        <div className="mt-8 rounded-3xl border border-slate-700/50 bg-slate-800/80 px-6 py-8 shadow-2xl backdrop-blur-md">
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="pcn-username" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">Tên đăng nhập</label>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500"><User size={18} /></div>
                <input
                  id="pcn-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-700 bg-slate-900/60 py-3.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Tên đăng nhập..."
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="pcn-password" className="block text-xs font-bold uppercase tracking-wider text-slate-300">Mật khẩu</label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-400" title="Lưu trong trình quản lý mật khẩu của trình duyệt">
                  <input
                    id="pcn-remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-slate-700 bg-slate-900/60 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  Lưu mật khẩu
                </label>
              </div>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500"><Lock size={18} /></div>
                <input
                  id="pcn-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-700 bg-slate-900/60 py-3.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Mật khẩu của bạn"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-900/40 p-3.5 text-xs font-medium text-red-200">{error}</div>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-emerald-600 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 active:scale-95 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
              </button>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-500"><ShieldCheck size={12} className="text-emerald-500" /> Phiên làm việc được bảo vệ riêng cho PCN</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- End of PcnLoginScreen.tsx ---
