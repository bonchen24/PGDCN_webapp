'use client';

import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from '../utils/formatter';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileBadge2, FlaskConical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { usePgdStore } from '../store-pgd';
import type { PgdInspectionRequest, PgdSample } from '../utils/pgdDomain';
import { buildPgdSampleRegister, getPgdDossierRequirementStationKey } from '../utils/pgdDossier';
import type { PgdDossierDocument, PgdDossierRequirement, PgdDossierRequirementGroup } from '../utils/pgdDossier';
import { getPgdDossierDocumentDownloadUrl } from '../utils/pgdApi';
import { getPgdOperationalStepAccess } from '../utils/pgdWorkflow';
import PgdDossierOperationsPanel from './PgdDossierOperationsPanel';
import { PgdcnDateInput } from './PgdcnDateInput';

const REQUIREMENT_GROUP_LABELS: Record<PgdDossierRequirementGroup, string> = {
  REQUEST: 'Tiếp nhận yêu cầu',
  COMMERCIAL_CUSTOMS: 'Thương mại và hải quan',
  TECHNICAL: 'Hồ sơ kỹ thuật',
  FIELD: 'Hiện trường',
  LAB_SUBCONTRACTOR: 'PTN và giao nhận',
  RESULT_ISSUANCE: 'Kết quả và phát hành',
  ARCHIVE: 'Lưu trữ',
};

type DocumentFormState = {
  requirementCode: string;
  title: string;
  documentNumber: string;
  documentDate: string;
  note: string;
  file: File | null;
};

const initialForm: DocumentFormState = {
  requirementCode: '',
  title: '',
  documentNumber: '',
  documentDate: '',
  note: '',
  file: null,
};

const formatDate = (value?: string): string => {
  return formatDateTimeDdMmYyyy(value) || 'Chưa có';
};

const formatDateOnly = (value?: string): string => {
  return formatDateDdMmYyyy(value) || 'Chưa có';
};

const formatBytes = (value?: number): string => {
  if (!Number.isFinite(value) || Number(value) <= 0) return 'Không có dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(value);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const joinSampleQuantity = (sample: PgdSample): string => {
  return `${sample.quantity} ${sample.unit || 'mẫu'}`.trim();
};

const describeSampleScope = (sample: PgdSample): string => {
  if (sample.sampleSize?.trim()) return sample.sampleSize.trim();
  if (Number.isFinite(sample.lotQuantity) && sample.lotQuantity) {
    return `${sample.lotQuantity} ${sample.lotUnit || ''}`.trim();
  }
  return 'Chưa có cỡ mẫu / quy mô lô';
};

const retentionStatusLabel = (sample: PgdSample): string => {
  if (sample.disposition === 'LAB') {
    return sample.handedOverAt
      ? `Đã bàn giao ${formatDate(sample.handedOverAt)}`
      : 'Chưa bàn giao PTN';
  }
  if (sample.retentionStatus === 'DESTROYED') {
    return `Đã hủy ${formatDate(sample.destroyedAt)}`;
  }
  return sample.retainedUntil
    ? `Đang lưu đến ${formatDateOnly(sample.retainedUntil)}`
    : 'Đang lưu';
};

export type PgdCaseEvidencePanelProps = {
  request: PgdInspectionRequest;
  requirements: PgdDossierRequirement[];
  dossierDocuments: PgdDossierDocument[];
  samples: PgdSample[];
  canMutate: boolean;
  editable: boolean;
  initialRequirementCode?: string;
  lockedReason?: string | null;
  loadError?: string | null;
};

export default ({
  request,
  requirements,
  dossierDocuments,
  samples,
  canMutate,
  editable,
  initialRequirementCode,
  lockedReason,
  loadError,
}: PgdCaseEvidencePanelProps) => {
  const saveDossierDocument = usePgdStore((state) => state.saveDossierDocument);
  const destroyPgdSample = usePgdStore((state) => state.destroySample);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<DocumentFormState>(() => ({
    ...initialForm,
    requirementCode: initialRequirementCode || requirements[0]?.code || '',
    title: requirements.find((requirement) => requirement.code === initialRequirementCode)?.title || requirements[0]?.title || '',
  }));
  const [busy, setBusy] = useState(false);
  const register = useMemo(() => buildPgdSampleRegister(samples), [samples]);
  const requirementAccess = useMemo(() => new Map(requirements.map((requirement) => [
    requirement.code,
    getPgdOperationalStepAccess({ status: request.status, targetStationKey: getPgdDossierRequirementStationKey(requirement.code) }),
  ] as const)), [request.status, requirements]);
  const selectedRequirementAccess = requirementAccess.get(form.requirementCode);
  const sampleAccess = useMemo(() => getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'FIELD_SAMPLING' }), [request.status]);
  const groupedRequirements = useMemo(() => {
    const grouped = new Map<PgdDossierRequirementGroup, PgdDossierRequirement[]>();
    for (const requirement of requirements) {
      const group = grouped.get(requirement.group) || [];
      group.push(requirement);
      grouped.set(requirement.group, group);
    }
    return Array.from(grouped.entries());
  }, [requirements]);

  useEffect(() => {
    if (!initialRequirementCode) return;
    const selected = requirements.find((requirement) => requirement.code === initialRequirementCode);
    if (!selected) return;
    setForm((current) => current.requirementCode === selected.code && current.title === selected.title
      ? current
      : { ...current, requirementCode: selected.code, title: selected.title });
  }, [initialRequirementCode, requirements]);

  const documentsByRequirement = useMemo(() => {
    const map = new Map<string, PgdDossierDocument[]>();
    for (const document of dossierDocuments) {
      const items = map.get(document.requirementCode) || [];
      items.push(document);
      map.set(document.requirementCode, items);
    }
    for (const items of map.values()) {
      items.sort((left, right) => right.version - left.version || right.uploadedAt.localeCompare(left.uploadedAt));
    }
    return map;
  }, [dossierDocuments]);

  const updateForm = <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onRequirementChange = (requirementCode: string) => {
    const selected = requirements.find((item) => item.code === requirementCode);
    setForm((current) => ({
      ...current,
      requirementCode,
      title: selected && (!current.title.trim() || current.title === (requirements.find((item) => item.code === current.requirementCode)?.title || ''))
        ? selected.title
        : current.title,
    }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.requirementCode.trim()) {
      toast.error('Cần chọn tài liệu cần bổ sung.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Cần nhập tiêu đề chứng từ.');
      return;
    }
    if (!selectedRequirementAccess?.editable) {
      toast.error(selectedRequirementAccess?.reason || 'Tài liệu này đang bị khóa theo bước hồ sơ.');
      return;
    }
    setBusy(true);
    try {
      await saveDossierDocument(request.id, {
        requirementCode: form.requirementCode.trim(),
        title: form.title.trim(),
        documentNumber: form.documentNumber.trim() || undefined,
        documentDate: form.documentDate.trim() || undefined,
        note: form.note.trim() || undefined,
        file: form.file || undefined,
        fileName: form.file?.name,
      });
      toast.success('Đã lưu hồ sơ chứng từ PGD.');
      const selected = requirements.find((item) => item.code === form.requirementCode);
      setForm({
        ...initialForm,
        requirementCode: form.requirementCode,
        title: selected?.title || '',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu hồ sơ chứng từ.');
    } finally {
      setBusy(false);
    }
  };

  const destroySample = async (sample: PgdSample) => {
    const reason = globalThis.prompt(`Nhập lý do Hủy mẫu cho ${sample.sampleCode}`)?.trim() || '';
    if (!reason) {
      toast.error('Cần nhập lý do hủy mẫu.');
      return;
    }
    setBusy(true);
    try {
      await destroyPgdSample(sample.id, reason);
      toast.success(`Đã ghi nhận Hủy mẫu ${sample.sampleCode}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể hủy mẫu lưu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0 space-y-3 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-blue-500">
      <PgdDossierOperationsPanel request={request} requirements={requirements} dossierDocuments={dossierDocuments} canMutate={canMutate} editable={editable} />
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-black text-slate-800">
              <FileBadge2 size={15} className="text-blue-600" />
              Hồ sơ chứng từ
            </h3>
            {/* Source boundary: pgdDossierDocuments. Keep storage vocabulary out of the user-facing copy. */}
            <p className="mt-1 text-[11px] text-slate-600">Danh sách tài liệu đi theo đúng hồ sơ PGD, tách riêng với tài liệu đầu ra đã sinh.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {loadError ? <span role="alert" className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">{loadError}</span> : null}
            {lockedReason ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">{lockedReason}</span> : null}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {groupedRequirements.map(([group, items]) => (
            <div key={group} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">{REQUIREMENT_GROUP_LABELS[group]}</div>
              <div className="space-y-2">
                {items.map((requirement) => {
                  const documents = documentsByRequirement.get(requirement.code) || [];
                  const current = documents[0];
                  return (
                    <article key={requirement.code} className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-black text-slate-800">{requirement.title}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${requirement.required ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{requirement.required ? 'Bắt buộc' : 'Tùy chọn'}</span>
                            <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black ${current ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{current ? 'Đã có' : 'Thiếu'}</span>
                          </div>
                          {requirement.description ? <p className="mt-1 text-[11px] text-slate-600">{requirement.description}</p> : null}
                        </div>
                        <span className="font-mono text-[9px] text-slate-400">{requirement.code}</span>
                      </div>
                      {current ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1.5 text-[9px] text-slate-600">
                          <div className="min-w-0">
                            <div className="overflow-hidden text-ellipsis whitespace-nowrap font-bold text-slate-700" title={current.fileName}>{current.title} · v{current.version}</div>
                            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span title={current.fileName}>{current.fileName}</span>
                              <span>{formatBytes(current.byteSize)}</span>
                              <span>Tải lên {formatDate(current.uploadedAt)}</span>
                              {current.documentNumber ? <span>Số: {current.documentNumber}</span> : null}
                              {current.documentDate ? <span>Ngày: {formatDateOnly(current.documentDate)}</span> : null}
                            </div>
                            {current.note ? <div className="mt-0.5 text-slate-500">{current.note}</div> : null}
                          </div>
                          {current.fileAssetId ? (
                            <a
                              href={getPgdDossierDocumentDownloadUrl(current.id)}
                              download={current.fileName}
                              target="_blank"
                              rel="noreferrer"
                              title={`Tải ${current.fileName}`}
                              className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
                            >
                              <Download size={12} />
                              Tải tệp
                            </a>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400">Chỉ có thông tin tệp</span>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] font-bold text-amber-700">Chưa có tài liệu hiện hành cho mục này.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black text-slate-500">Tài liệu cần bổ sung<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span>
              <select
                aria-label="Chọn tài liệu cần bổ sung PGD"
                value={form.requirementCode}
                onChange={(event) => onRequirementChange(event.target.value)}
                disabled={!canMutate || !editable || busy}
                className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold outline-none focus:border-blue-400"
              >
                <option value="">Chọn loại tài liệu...</option>
                {requirements.map((requirement) => (
                  <option key={requirement.code} value={requirement.code} disabled={!requirementAccess.get(requirement.code)?.editable}>{requirement.title}{requirementAccess.get(requirement.code)?.editable ? '' : ' · Đang khóa'}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black text-slate-500">Tiêu đề chứng từ<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span>
              <input
                aria-label="Tiêu đề chứng từ PGD"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                required

                disabled={!canMutate || !editable || busy || !selectedRequirementAccess?.editable}
                className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-blue-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black text-slate-500">Số chứng từ</span>
              <input
                aria-label="Số chứng từ PGD"
                value={form.documentNumber}
                onChange={(event) => updateForm('documentNumber', event.target.value)}

                disabled={!canMutate || !editable || busy || !selectedRequirementAccess?.editable}
                className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-blue-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black text-slate-500">Ngày chứng từ</span>
              <PgdcnDateInput
                aria-label="Ngày chứng từ PGD"
                value={form.documentDate}
                onChange={(value) => updateForm('documentDate', value)}

                disabled={!canMutate || !editable || busy || !selectedRequirementAccess?.editable}
                className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-blue-400"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[11px] font-black text-slate-500">Ghi chú</span>
              <textarea
                rows={2}
                aria-label="Ghi chú chứng từ PGD"
                value={form.note}
                onChange={(event) => updateForm('note', event.target.value)}

                disabled={!canMutate || !editable || busy || !selectedRequirementAccess?.editable}
                className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-blue-400"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[11px] font-black text-slate-500">Tệp đính kèm tùy chọn</span>
              <input
                type="file"
                aria-label="Tải tệp chứng từ PGD"
                onChange={(event) => updateForm('file', event.target.files?.[0] || null)}
                ref={fileInputRef}
                disabled={!canMutate || !editable || busy || !selectedRequirementAccess?.editable}
                className="block mobile-touch-target min-h-11 w-full rounded-lg border border-dashed border-slate-300 bg-white px-2 py-2 text-[11px] text-slate-500"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-600">Có thể lưu thông tin tệp trước khi vùng lưu trữ riêng sẵn sàng; khi có tệp, liên kết tải sẽ dùng đường dẫn riêng của hồ sơ.</p>
            <button
              type="submit"
              title="Lưu chứng từ dossier PGD"
              disabled={!canMutate || !editable || busy || !selectedRequirementAccess?.editable}
              className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Đang lưu...' : 'Lưu chứng từ'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-black text-slate-800">
              <FlaskConical size={15} className="text-blue-600" />
              Sổ mẫu
            </h3>
            <p className="mt-1 text-[11px] text-slate-600">Theo dõi riêng Mẫu PTN và Mẫu lưu; hủy mẫu chỉ là mutation trạng thái, không xóa dòng khỏi sổ.</p>
          </div>
          <div className="flex flex-wrap gap-1 text-[9px] font-black">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">PTN {register.counts.lab}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Lưu {register.counts.retained}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Đã hủy {register.counts.destroyed}</span>
          </div>
        </div>

        {([
          ['Mẫu PTN', register.lab],
          ['Mẫu lưu', register.retained],
        ] as const).map(([label, items]) => (
          <div key={label} className="mt-3">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-[11px] text-slate-500">Chưa có {label.toLowerCase()} cho hồ sơ này.</div>
              ) : items.map((sample) => {
                const canDestroy = sample.disposition === 'RETAINED'
                  && sample.retentionStatus !== 'DESTROYED'
                  && Boolean(sample.retainedUntil)
                  && new Date(sample.retainedUntil as string).getTime() <= Date.now();
                return (
                  <article key={sample.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-black text-slate-800">{sample.sampleCode}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${sample.retentionStatus === 'DESTROYED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{sample.retentionStatus === 'DESTROYED' ? 'Đã hủy' : 'Đang theo dõi'}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-slate-700">{sample.description}</div>
                      </div>
                      {canDestroy ? (
                        <button
                          type="button"
                          title={`Hủy mẫu ${sample.sampleCode}`}
                          disabled={!canMutate || !editable || busy || !sampleAccess.editable}
                          onClick={() => void destroySample(sample)}
                          className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                        >
                          <Trash2 size={12} />
                          Hủy mẫu
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                      <div><span className="block text-slate-400">Niêm phong</span><b className="text-slate-700">{sample.sealNumber || 'Chưa có'}</b></div>
                      <div><span className="block text-slate-400">Số lượng</span><b className="text-slate-700">{joinSampleQuantity(sample)}</b></div>
                      <div><span className="block text-slate-400">Cỡ mẫu / quy mô lô</span><b className="text-slate-700">{describeSampleScope(sample)}</b></div>
                      <div><span className="block text-slate-400">Trạng thái</span><b className="text-slate-700">{retentionStatusLabel(sample)}</b></div>
                      <div><span className="block text-slate-400">Ngày lấy mẫu</span><b className="text-slate-700">{formatDate(sample.sampledAt)}</b></div>
                      <div><span className="block text-slate-400">Địa điểm</span><b className="text-slate-700">{sample.samplingLocation || 'Chưa có'}</b></div>
                      <div><span className="block text-slate-400">Người lấy mẫu</span><b className="text-slate-700">{sample.sampledByUsername || 'Chưa có'}</b></div>
                      <div><span className="block text-slate-400">Ghi chú</span><b className="text-slate-700">{sample.destructionNote || sample.note || 'Không có'}</b></div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </section>
  );
};
