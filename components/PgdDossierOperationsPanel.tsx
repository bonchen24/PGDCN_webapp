'use client';

import { ClipboardList, Download, PackageOpen, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { usePcnSessionStore } from '../utils/pcnSessionState';
import { usePgdStore } from '../store-pgd';
import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdDossierPackageUrl, type PgdDossierPackageManifest } from '../utils/pgdApi';
import { getPgdDossierRequirementForTemplate } from '../utils/pgdDossier';
import type { PgdDossierDocument, PgdDossierRequirement } from '../utils/pgdDossier';
import { getPgdPostSignatureMutationDenial } from '../utils/pgdWorkflow';
import PgdDocumentGenerationPanel from './PgdDocumentGenerationPanel';

type Props = {
  request: PgdInspectionRequest;
  requirements: PgdDossierRequirement[];
  dossierDocuments: PgdDossierDocument[];
  canMutate: boolean;
  editable: boolean;
};

export default function PgdDossierOperationsPanel({ request, requirements, dossierDocuments, canMutate, editable }: Props) {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pgd = usePgdStore();
  const [ownerInput, setOwnerInput] = useState(request.ownerUsername || currentUser?.username || '');
  const [busy, setBusy] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageManifest, setPackageManifest] = useState<PgdDossierPackageManifest | null>(null);

  const isManager = Boolean(currentUser && (
    currentUser.systemRole === 'admin'
    || currentUser.role === 'admin'
    || currentUser.pgdRole === 'PGD_ADMIN'
    || currentUser.pgdRole === 'PGD_MANAGER'
  ));
  const ownerUsername = request.ownerUsername || currentUser?.username || '';
  const isOwner = Boolean(currentUser && ownerUsername.toLowerCase() === currentUser.username.toLowerCase());
  const ownerEditable = Boolean(isManager && editable && currentUser);
  const dossierEditable = Boolean(canMutate && editable && (isManager || isOwner));
  const generatedDocuments = useMemo(() => pgd.documents.filter((document) => document.requestId === request.id), [pgd.documents, request.id]);
  const attachedGeneratedIds = useMemo(() => new Set(dossierDocuments.map((document) => document.originDocumentId).filter(Boolean)), [dossierDocuments]);
  const requiredTotal = requirements.filter((requirement) => requirement.required).length;
  const requiredPresent = requirements.filter((requirement) => requirement.required && dossierDocuments.some((document) => document.requirementCode === requirement.code)).length;
  const lockedReason = getPgdPostSignatureMutationDenial(request.status);

  useEffect(() => {
    setOwnerInput(request.ownerUsername || currentUser?.username || '');
  }, [currentUser?.username, request.id, request.ownerUsername]);

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(message);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật bộ hồ sơ PGD.');
    } finally {
      setBusy(false);
    }
  };

  const saveOwner = () => run(async () => {
    if (!ownerInput.trim()) throw new Error('Cần chọn người phụ trách hồ sơ PGD.');
    await pgd.assignOwner(request.id, ownerInput.trim());
  }, 'Đã cập nhật người phụ trách hồ sơ PGD.');

  const attachGenerated = (document: PgdGeneratedDocument) => run(async () => {
    const requirement = getPgdDossierRequirementForTemplate(document.kind as Parameters<typeof getPgdDossierRequirementForTemplate>[0], request.productGroup);
    if (!requirement) throw new Error('Không xác định được checklist cho loại biểu mẫu PGD.');
    await pgd.attachGeneratedDocument(request.id, { documentId: document.id, requirementCode: requirement.code });
  }, `Đã đưa ${document.fileName} vào bộ hồ sơ.`);

  const downloadPackage = async () => {
    setPackageBusy(true);
    setPackageManifest(null);
    try {
      const response = await fetch(getPgdDossierPackageUrl(request.id), { credentials: 'same-origin' });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const payload = contentType.includes('application/json') ? await response.json() : undefined;
        if (payload?.manifest) setPackageManifest(payload.manifest as PgdDossierPackageManifest);
        throw new Error(payload?.error || `Không thể đóng gói hồ sơ (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${request.requestCode}-bo-ho-so.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success('Đã tải gói hồ sơ PGD.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đóng gói hồ sơ PGD.');
    } finally {
      setPackageBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-sm" aria-label="Bộ hồ sơ và thao tác PGD">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-black text-blue-950"><ClipboardList size={15} className="text-blue-600" /> Bộ hồ sơ & đóng gói</h3>
          <p className="mt-1 text-[10px] leading-4 text-blue-900/70">Làm việc trực tiếp trên hồ sơ trong app: chọn chủ hồ sơ, điền cell, sinh DOCX/PDF, đưa biểu mẫu vào checklist và đóng gói bản phát hành.</p>
        </div>
        <button type="button" onClick={() => void downloadPackage()} disabled={packageBusy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 text-[9px] font-black text-blue-700 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"><PackageOpen size={13} /> {packageBusy ? 'Đang đóng gói...' : 'Tải gói hồ sơ'}</button>
      </div>

      {packageManifest && !packageManifest.complete && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[9px] text-amber-900"><div className="font-black">Bộ hồ sơ chưa sẵn sàng để trình lãnh đạo.</div>{packageManifest.missingRequirementCodes.length > 0 && <div className="mt-1">Thiếu checklist: <span className="font-mono">{packageManifest.missingRequirementCodes.join(', ')}</span></div>}{packageManifest.missingAssetIds.length > 0 && <div className="mt-1">Thiếu file private: <span className="font-mono">{packageManifest.missingAssetIds.join(', ')}</span></div>}</div>}

      <div className="rounded-lg border border-blue-100 bg-white p-2.5" aria-label="Chủ hồ sơ PGD">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700"><UserRound size={13} className="text-blue-600" /> Người phụ trách hồ sơ PGD: <span className="font-mono text-blue-700">{ownerUsername || 'Chưa gán'}</span></div><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">{isOwner ? 'Bạn đang phụ trách' : 'Chủ hồ sơ'}</span></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><select aria-label="Chọn người phụ trách hồ sơ PGD" value={ownerInput} onChange={(event) => setOwnerInput(event.target.value)} disabled={!ownerEditable || busy || Boolean(lockedReason)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400"><option value={ownerUsername}>{ownerUsername || 'Chưa gán'}</option>{pgd.users.filter((user) => user.active !== false && user.departmentScopes?.includes('PGD') && user.pgdRole !== 'PGD_VIEWER' && user.username !== ownerUsername).map((user) => <option key={user.username} value={user.username}>{user.username} · {user.name}</option>)}</select><button type="button" onClick={() => void saveOwner()} disabled={!ownerEditable || busy || !ownerInput.trim() || ownerInput.trim() === ownerUsername || Boolean(lockedReason)} className="min-h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[9px] font-black text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Lưu chủ hồ sơ</button></div>
        {!isManager && <p className="mt-1 text-[9px] text-slate-400">Chỉ Admin/Quản lý PGD được thay đổi chủ hồ sơ.</p>}
        {lockedReason && <p className="mt-1 text-[9px] font-bold text-amber-700">{lockedReason}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-white bg-white p-2"><div className="text-[9px] font-black uppercase text-slate-400">Bắt buộc hiện hành</div><div className="mt-1 text-lg font-black text-blue-700">{requiredPresent}/{requiredTotal}</div></div><div className="rounded-lg border border-white bg-white p-2"><div className="text-[9px] font-black uppercase text-slate-400">Biểu mẫu đã sinh</div><div className="mt-1 text-lg font-black text-slate-800">{generatedDocuments.length}</div></div><div className="rounded-lg border border-white bg-white p-2"><div className="text-[9px] font-black uppercase text-slate-400">Đã đưa vào checklist</div><div className="mt-1 text-lg font-black text-emerald-700">{dossierDocuments.length}</div></div></div>

      <PgdDocumentGenerationPanel request={request} templates={pgd.documentTemplates} documents={generatedDocuments} canMutate={dossierEditable} />

      <div className="rounded-lg border border-white bg-white p-2.5">
        <div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-black text-slate-700">Biểu mẫu liên quan</div><p className="mt-0.5 text-[9px] text-slate-500">Gắn bản DOCX/PDF vừa sinh vào đúng mục checklist để khi trình lãnh đạo không bỏ sót hồ sơ.</p></div><span className="font-mono text-[9px] text-slate-400">{generatedDocuments.length} file</span></div>
        <div className="mt-2 space-y-1.5">{generatedDocuments.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-2 py-3 text-[9px] text-slate-400">Chưa có biểu mẫu. Chọn loại biểu mẫu và nhập các cell ở khối trên.</p> : generatedDocuments.map((document) => { const requirement = getPgdDossierRequirementForTemplate(document.kind as Parameters<typeof getPgdDossierRequirementForTemplate>[0], request.productGroup); const attached = attachedGeneratedIds.has(document.id); return <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"><div className="min-w-0"><div className="break-all text-[10px] font-bold text-slate-700">{document.fileName}</div><div className="text-[9px] text-slate-400">{requirement?.code || document.kind} · {document.status} · SHA {document.sha256.slice(0, 12)}</div></div><div className="flex shrink-0 items-center gap-1.5">{document.fileAssetId && <a href={`/api/pgd/documents/${encodeURIComponent(document.id)}/download`} download={document.fileName} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 text-[9px] font-black text-blue-700"><Download size={12} /> Tải</a>}{attached ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Đã vào checklist</span> : <button type="button" onClick={() => void attachGenerated(document)} disabled={!dossierEditable || busy || !requirement} className="min-h-8 rounded-lg bg-blue-600 px-2 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Đưa vào bộ hồ sơ</button>}</div></div>; })}</div>
      </div>
    </section>
  );
}
