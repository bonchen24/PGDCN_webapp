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
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_45%)]" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center gap-2"><img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-16 w-16 rounded-2xl bg-white p-1.5 shadow-xl" /><span className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">IEMM • TVCI</span></div>
        <h1 className="mt-6 text-center text-2xl font-black uppercase tracking-tight text-white">Không gian Giám định</h1>
        <p className="mt-2 text-center text-xs font-medium text-slate-400">Phòng Giám định - Chứng nhận • Phiên PGD riêng</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">Tên đăng nhập</span><div className="relative"><User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 py-3.5 pl-10 pr-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" /></div></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">Mật khẩu</span><div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input required type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 py-3.5 pl-10 pr-11 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-900/30 p-3 text-xs font-medium text-rose-200">{error}</div>}
          <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />}{busy ? 'Đang xác thực...' : 'Đăng nhập PGD'}</button>
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-500"><ShieldCheck size={12} className="text-blue-400" /> Dữ liệu PGD và PCN được phân quyền theo miền</div>
        </form>
      </div>
    </div>
  );
}
