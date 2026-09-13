'use client';

import { useMemo, useState } from 'react';

import type { CertificationDossier, CertificationProposal, IssuancePackage, PcnCertificationField, PcnDocumentRequirement, PcnDossierDocument, PcnSampleLot, PcnSampleRoute, PcnUserAccount, OutboundLabRequest, ReturnedTestResult, UserAccount } from '../types';
import { getPcnDossierOperatorDenial } from '../utils/pcnDossierAssignment';
import { isPcnSystemManager } from '../utils/pcnRbac';
import { buildPcnOperationsRegisterRows, filterPcnOperationsRegisterRows, getPcnSummaryCellUpdate } from '../utils/pcnOperationsRegister';
import type { SummaryGridColumn, SummaryGridRow } from '../utils/summaryRegister';
import PgdcnDossierSummaryGrid from './PgdcnDossierSummaryGrid';
import PcnDossierQueueView from './PcnDossierQueueView';
import { PgdcnPageHeader } from './PgdcnUiPrimitives';

type Props = {
  fields: PcnCertificationField[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  issuancePackages: IssuancePackage[];
  documentRequirements: PcnDocumentRequirement[];
  dossierDocuments: PcnDossierDocument[];
  users: PcnUserAccount[];
  currentUser?: UserAccount | null;
  currentUsername?: string | null;
  canEdit: boolean;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: 'documents' | 'lab' | 'results' | 'issuance') => void;
  onUpdateProposal: (proposalId: string, updates: Partial<CertificationProposal>) => Promise<unknown>;
  onUpdateDossier: (dossierId: string, updates: Partial<CertificationDossier>) => Promise<unknown>;
};

const columns: SummaryGridColumn[] = [
  { id: 'registrationCode', label: 'Mã Đề nghị', width: 130, sticky: true },
  { id: 'dossierCode', label: 'Mã hồ sơ', width: 130 },
  { id: 'receivedAt', label: 'Ngày tiếp nhận', width: 145 },
  { id: 'customerName', label: 'Khách hàng', width: 190, editable: true },
  { id: 'customerAddress', label: 'Địa chỉ KH', width: 220, editable: true },
  { id: 'customerTaxId', label: 'MST', width: 125, editable: true },
  { id: 'customerContact', label: 'Đầu mối KH', width: 150, editable: true },
  { id: 'customerPhone', label: 'ĐT KH', width: 125, editable: true },
  { id: 'customerEmail', label: 'Email KH', width: 180, editable: true },
  { id: 'productName', label: 'Tên sản phẩm', width: 190, editable: true },
  { id: 'productType', label: 'Loại sản phẩm', width: 145, editable: true },
  { id: 'model', label: 'Kiểu loại', width: 130, editable: true },
  { id: 'brand', label: 'Nhãn hiệu', width: 140, editable: true },
  { id: 'specifications', label: 'Thông số', width: 220, inputType: 'textarea', editable: true },
  { id: 'manufacturer', label: 'Nhà SX', width: 170, editable: true },
  { id: 'manufacturerAddress', label: 'Địa chỉ NSX', width: 220, editable: true },
  { id: 'warehouseAddress', label: 'Địa chỉ kho', width: 220, editable: true },
  { id: 'quantity', label: 'Số lượng', width: 95, inputType: 'number', editable: true },
  { id: 'fieldCodes', label: 'Lĩnh vực', width: 150 },
  { id: 'standardRefs', label: 'Tiêu chuẩn', width: 190 },
  { id: 'dossierStatus', label: 'Trạng thái HS', width: 155 },
  { id: 'ownerUsername', label: 'Chủ hồ sơ', width: 150, inputType: 'select', editable: true },
  { id: 'evaluatorUsername', label: 'Đánh giá viên', width: 150, inputType: 'select', editable: true },
  { id: 'reviewerUsername', label: 'Người soát xét', width: 150, inputType: 'select', editable: true },
  { id: 'targetDate', label: 'Hạn xử lý', width: 122, inputType: 'date', editable: true },
  { id: 'evaluationAt', label: 'Ngày đánh giá', width: 145, inputType: 'date', editable: true },
  { id: 'effectiveAt', label: 'Ngày hiệu lực', width: 145, inputType: 'date', editable: true },
  { id: 'exceptionReason', label: 'Lý do ngoại lệ', width: 220, inputType: 'textarea', editable: true },
  { id: 'stationTitle', label: 'Bước hiện tại', width: 180 },
  { id: 'completenessScore', label: 'Hoàn thiện', width: 95 },
  { id: 'missingRequiredCount', label: 'Thiếu bắt buộc', width: 105 },
  { id: 'sampleQuantity', label: 'SL mẫu', width: 90 },
  { id: 'sampleLocations', label: 'Địa điểm lấy mẫu', width: 190 },
  { id: 'sampleReceivedAt', label: 'Ngày nhận mẫu', width: 145 },
  { id: 'labStatuses', label: 'Trạng thái PTN', width: 180 },
  { id: 'testCriteria', label: 'Tiêu chí thử', width: 220 },
  { id: 'reportNumbers', label: 'Số phiếu KQ', width: 160 },
  { id: 'lastResultReceivedAt', label: 'Ngày nhận KQ', width: 145 },
  { id: 'lastResultOutcome', label: 'Kết quả cuối', width: 140 },
  { id: 'issuanceNumber', label: 'Số chứng nhận', width: 145 },
  { id: 'issuedAt', label: 'Ngày cấp', width: 125 },
  { id: 'sampleReturnedAt', label: 'Ngày trả mẫu', width: 145 },
];

function userOptions(users: PcnUserAccount[]) {
  return [{ value: '', label: 'Chưa phân công' }, ...users.filter((user) => user.active && user.systemRole !== 'viewer' && user.role !== 'viewer').map((user) => ({ value: user.username, label: `${user.name || 'Người dùng hệ thống'} · ${user.username}` }))];
}

export default function PcnOperationsRegisterView(props: Props) {
  const [viewMode, setViewMode] = useState<'QUEUE' | 'DATA'>('QUEUE');
  const [completeness, setCompleteness] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETE'>('ALL');
  const [assignment, setAssignment] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [fieldCode, setFieldCode] = useState('');
  const [status, setStatus] = useState('ALL');
  const [year, setYear] = useState('ALL');
  const registerRows = useMemo(() => buildPcnOperationsRegisterRows(props), [props]);
  const dossierById = useMemo(() => new Map(props.dossiers.map((dossier) => [dossier.id, dossier])), [props.dossiers]);
  const proposalById = useMemo(() => new Map(props.proposals.map((proposal) => [proposal.id, proposal])), [props.proposals]);
  const rows = useMemo<SummaryGridRow[]>(() => registerRows.map((row) => {
    const dossier = dossierById.get(row.dossierId);
    const proposal = dossier ? proposalById.get(dossier.proposalId) : undefined;
    const customer = (dossier?.customerSnapshot ?? proposal?.customerSnapshot ?? {}) as { name?: string; address?: string; taxId?: string; contactPerson?: string; phone?: string; email?: string };
    const cells = {
      registrationCode: row.registrationCode,
      dossierCode: row.dossierCode,
      receivedAt: row.receivedAt,
      customerName: customer.name ?? row.customerName,
      customerAddress: customer.address ?? row.customerAddress,
      customerTaxId: customer.taxId,
      customerContact: customer.contactPerson,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      productName: proposal?.productName ?? row.productName,
      productType: proposal?.productType,
      model: proposal?.model ?? row.model,
      brand: proposal?.brand ?? row.brand,
      specifications: proposal?.specifications,
      manufacturer: proposal?.manufacturer,
      manufacturerAddress: proposal?.manufacturerAddress,
      warehouseAddress: proposal?.warehouseAddress,
      quantity: proposal?.quantity ?? row.sampleQuantity,
      fieldCodes: row.fieldCodes.join('; '),
      standardRefs: row.standardRefs.join('; '),
      dossierStatus: row.dossierStatus,
      ownerUsername: row.ownerUsername,
      evaluatorUsername: row.evaluatorUsername,
      reviewerUsername: dossier?.reviewerUsername,
      targetDate: dossier?.targetDate,
      evaluationAt: row.evaluationAt,
      effectiveAt: row.effectiveAt,
      exceptionReason: dossier?.exceptionReason,
      stationTitle: row.stationTitle,
      completenessScore: `${row.completenessScore}%`,
      missingRequiredCount: row.missingRequiredCount,
      sampleQuantity: row.sampleQuantity,
      sampleLocations: row.sampleLocations.join('; '),
      sampleReceivedAt: row.sampleReceivedAt,
      labStatuses: row.labStatuses.join('; '),
      testCriteria: row.testCriteria.join('; '),
      reportNumbers: row.reportNumbers.join('; '),
      lastResultReceivedAt: row.lastResultReceivedAt,
      lastResultOutcome: row.lastResultOutcome,
      issuanceNumber: row.issuanceNumber,
      issuedAt: row.issuedAt,
      sampleReturnedAt: row.sampleReturnedAt,
    };
    const userNames = new Map(props.users.map((user) => [user.username, user.name || 'Người dùng hệ thống']));
    return { id: row.dossierId, cells, displayCells: { ownerUsername: row.ownerUsername ? userNames.get(row.ownerUsername) : undefined, evaluatorUsername: row.evaluatorUsername ? userNames.get(row.evaluatorUsername) : undefined, reviewerUsername: dossier?.reviewerUsername ? userNames.get(dossier.reviewerUsername) : undefined }, searchText: Object.values(cells).map((value) => Array.isArray(value) ? value.join(' ') : String(value ?? '')).join(' ') };
  }), [dossierById, proposalById, props.users, registerRows]);
  const configuredColumns = useMemo(() => columns.map((column) => ['ownerUsername', 'evaluatorUsername', 'reviewerUsername'].includes(column.id) ? { ...column, options: userOptions(props.users) } : column), [props.users]);
  const filterRows = useMemo(() => (items: SummaryGridRow[]) => items.filter((row) => {
    const source = registerRows.find((item) => item.dossierId === row.id);
    if (!source) return false;
    return (completeness === 'ALL' || (completeness === 'COMPLETE' ? source.missingRequiredCount === 0 : source.missingRequiredCount > 0))
      && (assignment === 'ALL' || (assignment === 'ASSIGNED' ? Boolean(source.ownerUsername) : !source.ownerUsername))
      && (!fieldCode || source.fieldCodes.includes(fieldCode))
      && (status === 'ALL' || source.dossierStatus === status)
      && (year === 'ALL' || (source.receivedAt && source.receivedAt.slice(0, 4) === year));
  }), [assignment, completeness, fieldCode, registerRows, status, year]);
  const queueRows = useMemo(() => filterPcnOperationsRegisterRows(registerRows, {
    completeness,
    assignment,
    fieldCode: fieldCode || undefined,
    status: status === 'ALL' ? undefined : status as CertificationDossier['status'],
    year: year === 'ALL' ? undefined : year,
  }), [assignment, completeness, fieldCode, registerRows, status, year]);

  const commitCell = async (rowId: string, columnId: string, rawValue: string) => {
    const dossier = dossierById.get(rowId);
    const proposal = dossier ? proposalById.get(dossier.proposalId) : undefined;
    if (!dossier || !proposal) throw new Error('Không tìm thấy hồ sơ PCN để cập nhật.');
    const update = getPcnSummaryCellUpdate(proposal, dossier, columnId, rawValue);
    if (update.target === 'proposal') await props.onUpdateProposal(proposal.id, update.updates as Partial<CertificationProposal>);
    else await props.onUpdateDossier(dossier.id, update.updates as Partial<CertificationDossier>);
  };
  const canEditRow = (rowId: string) => {
    const dossier = dossierById.get(rowId);
    const actor = props.currentUser;
    if (!dossier || !actor) return false;
    return getPcnDossierOperatorDenial({
      ownerUsername: dossier.ownerUsername,
      actorUsername: actor.username,
      actorIsSystemManager: isPcnSystemManager(actor),
    }) === null;
  };

  const filterControls = <>
    <select aria-label="Lọc hoàn thiện Sổ tổng hợp PCN" value={completeness} onChange={(event) => setCompleteness(event.target.value as typeof completeness)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="ALL">Tất cả hoàn thiện</option><option value="INCOMPLETE">Còn thiếu tài liệu</option><option value="COMPLETE">Đủ tài liệu bắt buộc</option></select>
    <select aria-label="Lọc phân công Sổ tổng hợp PCN" value={assignment} onChange={(event) => setAssignment(event.target.value as typeof assignment)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="ALL">Tất cả chủ hồ sơ</option><option value="ASSIGNED">Đã phân công</option><option value="UNASSIGNED">Chưa phân công</option></select>
    <select aria-label="Lọc lĩnh vực Sổ tổng hợp PCN" value={fieldCode} onChange={(event) => setFieldCode(event.target.value)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="">Tất cả lĩnh vực</option>{props.fields.map((field) => <option key={field.code} value={field.code}>{field.code} · {field.name}</option>)}</select>
    <select aria-label="Lọc trạng thái Sổ tổng hợp PCN" value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="ALL">Tất cả trạng thái</option>{Array.from(new Set(registerRows.map((row) => row.dossierStatus))).map((value) => <option key={value} value={value}>{value}</option>)}</select>
    <select aria-label="Lọc năm Sổ tổng hợp PCN" value={year} onChange={(event) => setYear(event.target.value)} className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="ALL">Tất cả năm</option>{Array.from(new Set(registerRows.map((row) => row.receivedAt?.slice(0, 4)).filter(Boolean))).sort().reverse().map((value) => <option key={value} value={value}>{value}</option>)}</select>
  </>;

  return (
    <div className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
      <PgdcnPageHeader eyebrow="Quản lý PCN" title="Sổ tổng hợp PCN" description="Bắt đầu từ hàng đợi công việc; chuyển sang Sổ dữ liệu khi cần rà soát hoặc chỉnh sửa nhiều cột." />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2" role="tablist" aria-label="Chế độ xem Sổ tổng hợp PCN">
        <div className="flex flex-wrap gap-2">
          <button type="button" role="tab" aria-selected={viewMode === 'QUEUE'} className={`mobile-touch-target min-h-11 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === 'QUEUE' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`} onClick={() => setViewMode('QUEUE')}>Hàng đợi hồ sơ</button>
          <button type="button" role="tab" aria-selected={viewMode === 'DATA'} className={`mobile-touch-target min-h-11 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === 'DATA' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`} onClick={() => setViewMode('DATA')}>Sổ dữ liệu</button>
        </div>
        <p className="px-2 text-xs text-slate-500">{viewMode === 'QUEUE' ? `${queueRows.length} hồ sơ theo bộ lọc` : `${rows.length} dòng dữ liệu`}</p>
      </div>
      {viewMode === 'QUEUE' ? <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Bộ lọc hàng đợi hồ sơ">{filterControls}</div> : null}
      {viewMode === 'QUEUE' ? <PcnDossierQueueView rows={queueRows} onOpenDossier={(dossierId) => { const dossier = dossierById.get(dossierId); if (dossier) props.onOpenDossier(dossier, 'documents'); }} /> : <PgdcnDossierSummaryGrid domain="PCN" columns={configuredColumns} rows={rows} currentUsername={props.currentUsername} canEdit={props.canEdit} canEditRow={canEditRow} filterRows={filterRows} filterControls={filterControls} onOpenRow={(rowId) => { const dossier = dossierById.get(rowId); if (dossier) props.onOpenDossier(dossier, 'documents'); }} onCommitCell={commitCell} searchPlaceholder="Tìm mã đề nghị, mã hồ sơ, khách hàng, sản phẩm, lĩnh vực..." emptyTitle="Không có hồ sơ PCN phù hợp" emptyDescription="Hãy điều chỉnh từ khóa hoặc các bộ lọc Sổ tổng hợp." />}
    </div>
  );
}
