'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';

import { establishPcnSession } from '../utils/pcnAuthApi';
import { usePcnSessionStore } from '../utils/pcnSessionState';

export default function PgdLoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await establishPcnSession(username.trim(), password);
      usePcnSessionStore.getState().setCurrentUser(session.user);
    } catch (loginError: any) {
      setError(loginError?.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-7 shadow-sm">
        <div className="flex flex-col items-center gap-2"><img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-16 w-16 rounded-xl border border-slate-200/20 bg-white p-1.5" /><span className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">IEMM • TVCI</span></div>
        <h1 className="mt-6 text-center text-2xl font-semibold text-white">Không gian giám định</h1>
        <p className="mt-2 text-center text-sm text-slate-400">Phòng Giám định - Chứng nhận • Phiên PGD riêng</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <div>
            <label htmlFor="pgd-username" className="mb-2 block text-sm font-medium text-slate-200">Tên đăng nhập</label>
            <div className="relative"><User aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input id="pgd-username" name="username" required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" aria-invalid={Boolean(error)} aria-describedby={error ? 'pgd-login-error' : undefined} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" /></div>
          </div>
          <div>
            <label htmlFor="pgd-password" className="mb-2 block text-sm font-medium text-slate-200">Mật khẩu</label>
            <div className="relative"><Lock aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input id="pgd-password" name="password" required type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" aria-invalid={Boolean(error)} aria-describedby={error ? 'pgd-login-error' : undefined} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-12 text-sm text-white outline-none transition-colors focus:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}</button></div>
          </div>
          {error && <div id="pgd-login-error" role="alert" className="rounded-lg border border-rose-400/40 bg-rose-950/50 p-3 text-sm font-medium text-rose-200">{error}</div>}
          <button type="submit" disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">{busy && <Loader2 aria-hidden="true" size={14} className="animate-spin" />}{busy ? 'Đang xác thực...' : 'Đăng nhập PGD'}</button>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck aria-hidden="true" size={12} className="text-blue-400" /> Dữ liệu PGD và PCN được phân quyền theo miền</div>
        </form>
      </div>
    </div>
  );
}
