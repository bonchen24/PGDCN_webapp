'use client';

import { useMemo, useState } from 'react';

import type { PcnUserAccount } from '../types';
import {
  PGD_ASSESSMENT_METHOD_OPTIONS,
  PGD_GROUP_LABELS,
  PGD_WORKFLOW_STATES,
  getPgdCatalogItemLabel,
  type PgdInspectionRequest,
  type PgdInspectionRequestEditPatch,
  type PgdInspectionRequestInput,
  type PgdCatalogItem,
} from '../utils/pgdDomain';
import { buildPgdSummaryRegisterRows, filterPgdSummaryRegisterRows, getPgdSummaryCellUpdate, getPgdSummaryReceivedAtYears, type PgdSummaryCompletionFilter, type PgdSummaryReceivedYearFilter } from '../utils/pgdSummaryRegister';
import type { PgdcnSavedFilterSnapshot } from '../utils/pgdcnSavedFilters';
import type { SummaryGridColumn } from '../utils/summaryRegister';
import PgdcnDossierSummaryGrid from './PgdcnDossierSummaryGrid';
import { PgdcnPageHeader } from './PgdcnUiPrimitives';

const PGD_PRODUCT_GROUP_LABELS: Record<PgdInspectionRequestInput['productGroup'], string> = {
  STEEL_METAL: 'Thép / kim loại',
  MACHINERY_LINE: 'Dây chuyền máy móc',
  COAL: 'Than',
  OTHER: 'Khác',
};

type Props = {
  requests: PgdInspectionRequest[];
  assignments: Parameters<typeof buildPgdSummaryRegisterRows>[0]['assignments'];
  samples: Parameters<typeof buildPgdSummaryRegisterRows>[0]['samples'];
  labRequests: Parameters<typeof buildPgdSummaryRegisterRows>[0]['labRequests'];
  labResults: Parameters<typeof buildPgdSummaryRegisterRows>[0]['labResults'];
  reports: Parameters<typeof buildPgdSummaryRegisterRows>[0]['reports'];
  certificates: Parameters<typeof buildPgdSummaryRegisterRows>[0]['certificates'];
  documents?: Parameters<typeof buildPgdSummaryRegisterRows>[0]['documents'];
  catalog: PgdCatalogItem[];
  users: PcnUserAccount[];
  currentUsername?: string | null;
  canEdit: boolean;
  onOpenRequest: (requestId: string) => void;
  onUpdateRequest: (requestId: string, patch: Partial<PgdInspectionRequestInput>) => Promise<PgdInspectionRequest>;
  onAssignOwner: (requestId: string, ownerUsername: string) => Promise<PgdInspectionRequest>;
};

const columns: SummaryGridColumn[] = [
  { id: 'requestCode', label: 'Mã PYC', width: 120, sticky: true },
  { id: 'registrationNumber', label: 'Số đăng ký', width: 130, editable: true },
  { id: 'receivedAt', label: 'Ngày nhận', width: 122, inputType: 'date', editable: true },
  { id: 'status', label: 'Trạng thái', width: 160 },
  { id: 'currentStepLabel', label: 'Bước hiện tại', width: 190 },
  { id: 'currentStationLabel', label: 'Trạm PGD', width: 180 },
  { id: 'intakeChannel', label: 'Kênh nhận', width: 120, editable: true, inputType: 'select', options: [{ value: 'DIRECT', label: 'Trực tiếp' }, { value: 'PHONE', label: 'Điện thoại' }, { value: 'ONLINE_ZALO', label: 'Zalo' }, { value: 'EMAIL', label: 'Email' }, { value: 'OTHER', label: 'Khác' }] },
  { id: 'customerName', label: 'Khách hàng', width: 190, editable: true },
  { id: 'customerTaxId', label: 'MST', width: 125, editable: true },
  { id: 'customerAddress', label: 'Địa chỉ KH', width: 220, editable: true },
  { id: 'customerContact', label: 'Đầu mối KH', width: 150, editable: true },
  { id: 'customerPhone', label: 'ĐT KH', width: 125, editable: true },
  { id: 'customerEmail', label: 'Email KH', width: 180, editable: true },
  { id: 'requesterName', label: 'Người yêu cầu', width: 160, editable: true },
  { id: 'requesterAddress', label: 'Địa chỉ người yêu cầu', width: 210, editable: true },
  { id: 'requesterContact', label: 'Đầu mối yêu cầu', width: 150, editable: true },
  { id: 'requesterPhone', label: 'ĐT người yêu cầu', width: 135, editable: true },
  { id: 'requesterEmail', label: 'Email người yêu cầu', width: 180, editable: true },
  { id: 'productGroup', label: 'Nhóm SP', width: 135 },
  { id: 'pgdGroupCode', label: 'Nhóm NV PGD', width: 180 },
  { id: 'catalogItemId', label: 'Loại hồ sơ', width: 230 },
  { id: 'productName', label: 'Tên sản phẩm', width: 190, editable: true },
  { id: 'productCode', label: 'Mã sản phẩm', width: 130, editable: true },
  { id: 'brand', label: 'Nhãn hiệu', width: 140, editable: true },
  { id: 'productForm', label: 'Dạng SP', width: 130, editable: true },
  { id: 'productGrade', label: 'Mác / cấp', width: 120, editable: true },
  { id: 'productDimensions', label: 'Kích thước', width: 150, editable: true },
  { id: 'productStandard', label: 'Tiêu chuẩn SP', width: 160, editable: true },
  { id: 'origin', label: 'Xuất xứ', width: 130, editable: true },
  { id: 'manufacturer', label: 'Nhà SX', width: 170, editable: true },
  { id: 'manufacturerLotCode', label: 'Mã lô NSX', width: 130, editable: true },
  { id: 'importer', label: 'Nhà nhập khẩu', width: 170, editable: true },
  { id: 'hsCode', label: 'Mã HS', width: 120, editable: true },
  { id: 'steelLotSize', label: 'Quy mô lô thép', width: 120 },
  { id: 'steelSameGradeMultiProduct', label: 'Nhiều SP cùng mác', width: 135 },
  { id: 'machineType', label: 'Loại máy', width: 140 },
  { id: 'machineModel', label: 'Kiểu loại máy', width: 140 },
  { id: 'machineSerialNumber', label: 'Số máy', width: 130 },
  { id: 'manufacturingYear', label: 'Năm SX', width: 90 },
  { id: 'coalType', label: 'Loại than', width: 130 },
  { id: 'coalSource', label: 'Nguồn than', width: 140 },
  { id: 'calorificValue', label: 'Nhiệt trị', width: 100 },
  { id: 'quantity', label: 'Số lượng', width: 95, inputType: 'number', editable: true },
  { id: 'unit', label: 'Đơn vị', width: 90, editable: true },
  { id: 'weight', label: 'Khối lượng', width: 105, inputType: 'number', editable: true },
  { id: 'weightUnit', label: 'ĐV khối lượng', width: 110, editable: true },
  { id: 'lotCode', label: 'Mã lô', width: 125, editable: true },
  { id: 'transportName', label: 'Đơn vị vận chuyển', width: 170, editable: true },
  { id: 'inspectionScope', label: 'Phạm vi GĐ', width: 190, editable: true },
  { id: 'inspectionLocation', label: 'Địa điểm GĐ', width: 180, editable: true },
  { id: 'inspectionScheduledAt', label: 'Lịch GĐ', width: 122, inputType: 'date', editable: true },
  { id: 'standards', label: 'Tiêu chuẩn áp dụng', width: 220, inputType: 'textarea', editable: true },
  { id: 'method', label: 'Phương pháp', width: 145, editable: true },
  { id: 'assessmentMethod', label: 'PT đánh giá', width: 140, inputType: 'select', editable: true, options: [{ value: '', label: 'Chưa chọn' }, ...PGD_ASSESSMENT_METHOD_OPTIONS.map((item) => ({ value: item.code, label: item.name }))] },
  { id: 'priority', label: 'Mức ưu tiên', width: 110 },
  { id: 'urgentReason', label: 'Lý do khẩn', width: 200 },
  { id: 'invoiceStatus', label: 'Trạng thái hóa đơn', width: 140 },
  { id: 'invoiceNumber', label: 'Số hóa đơn PYC', width: 140 },
  { id: 'pricingBasis', label: 'Cơ sở báo giá', width: 140 },
  { id: 'pricingNote', label: 'Ghi chú báo giá', width: 200 },
  { id: 'targetDate', label: 'Hạn xử lý', width: 122, inputType: 'date', editable: true },
  { id: 'ownerUsername', label: 'Chủ hồ sơ', width: 150, inputType: 'select', editable: true },
  { id: 'assignmentStatus', label: 'Phân công', width: 140 },
  { id: 'ownerAssignedAt', label: 'Ngày phân công', width: 145 },
  { id: 'sampleCount', label: 'Số mẫu', width: 80 },
  { id: 'sampleQuantity', label: 'SL mẫu', width: 90 },
  { id: 'sampledAt', label: 'Lấy mẫu từ', width: 160, sortType: 'date' },
  { id: 'lastSampledAt', label: 'Lấy mẫu gần nhất', width: 160, sortType: 'date' },
  { id: 'sampledBy', label: 'Người lấy mẫu', width: 160 },
  { id: 'labSampleCount', label: 'Mẫu gửi PTN', width: 95 },
  { id: 'retainedSampleCount', label: 'Mẫu lưu', width: 85 },
  { id: 'labRequestCount', label: 'PYC PTN', width: 85 },
  { id: 'laboratoryNames', label: 'Đơn vị PTN', width: 180 },
  { id: 'labSenderUnits', label: 'Đơn vị gửi PTN', width: 180 },
  { id: 'labHandoverAt', label: 'Ngày giao mẫu PTN', width: 155, sortType: 'date' },
  { id: 'labResultCount', label: 'KQTN', width: 75 },
  { id: 'latestLabReportNumber', label: 'Số phiếu KQ', width: 140 },
  { id: 'latestLabReceivedAt', label: 'Ngày nhận KQTN', width: 155, sortType: 'date' },
  { id: 'latestLabAcceptedAt', label: 'Ngày chấp nhận KQTN', width: 165, sortType: 'date' },
  { id: 'reportCount', label: 'Báo cáo', width: 80 },
  { id: 'latestReportNumber', label: 'Số báo cáo gần nhất', width: 160 },
  { id: 'latestReportStatus', label: 'Trạng thái báo cáo', width: 145 },
  { id: 'latestReportDate', label: 'Ngày cập nhật báo cáo', width: 165, sortType: 'date' },
  { id: 'decisionNumber', label: 'Số quyết định', width: 145 },
  { id: 'decisionDate', label: 'Ngày quyết định', width: 145, sortType: 'date' },
  { id: 'certificateNumber', label: 'Số chứng thư', width: 140 },
  { id: 'certificateSignedAt', label: 'Ngày ký/cấp', width: 145, sortType: 'date' },
  { id: 'certificateReturnedAt', label: 'Ngày trả kết quả', width: 155, sortType: 'date' },
  { id: 'contractNumber', label: 'Số hợp đồng', width: 140, editable: true },
  { id: 'packingListNumber', label: 'Số danh sách đóng gói', width: 150, editable: true },
  { id: 'billOfLadingNumber', label: 'Số vận đơn', width: 140, editable: true },
  { id: 'customsDeclarationNumber', label: 'Số tờ khai HQ', width: 150, editable: true },
  { id: 'certificateOfOriginNumber', label: 'Số C/O', width: 120, editable: true },
  { id: 'invoiceDocumentNumber', label: 'Số hóa đơn chứng từ', width: 160, editable: true },
  { id: 'documentCount', label: 'Số tài liệu', width: 95 },
  { id: 'checklistItemCount', label: 'Số mục tài liệu', width: 105 },
  { id: 'requiredDocumentCount', label: 'Mục bắt buộc', width: 105 },
  { id: 'satisfiedRequiredDocumentCount', label: 'Đã đủ / miễn', width: 105 },
  { id: 'missingRequiredCount', label: 'Mục bắt buộc thiếu', width: 130 },
  { id: 'completionPercent', label: 'Hoàn thiện (%)', width: 110 },
  { id: 'completionLabel', label: 'Tình trạng hồ sơ', width: 135 },
  { id: 'checklistMissingCount', label: 'Tài liệu còn thiếu', width: 125 },
  { id: 'technicalDossierNote', label: 'Ghi chú HS kỹ thuật', width: 220, inputType: 'textarea', editable: true },
  { id: 'deficiencyNote', label: 'Ghi chú thiếu HS', width: 220, inputType: 'textarea', editable: true },
  { id: 'returnedPackageNote', label: 'Ghi chú hoàn trả', width: 220, inputType: 'textarea', editable: true },
  { id: 'courierName', label: 'Đơn vị chuyển phát', width: 180, editable: true },
  { id: 'note', label: 'Ghi chú hồ sơ', width: 240, inputType: 'textarea', editable: true },
  { id: 'createdAt', label: 'Ngày tạo', width: 145 },
  { id: 'updatedAt', label: 'Cập nhật cuối', width: 145 },
];

function userOptions(users: PcnUserAccount[]) {
  return users
    .filter((user) => user.active && user.systemRole !== 'viewer' && user.role !== 'viewer' && (user.departmentScopes?.includes('PGD') || user.pgdRole))
    .map((user) => ({ value: user.username, label: `${user.name || 'Người dùng hệ thống'} · ${user.username}` }));
}

export default function PgdSummaryRegisterView(props: Props) {
  const [group, setGroup] = useState<'ALL' | PgdInspectionRequestInput['productGroup']>('ALL');
  const [status, setStatus] = useState<'ALL' | PgdInspectionRequest['status']>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [catalogItemId, setCatalogItemId] = useState<'ALL' | string>('ALL');
  const [completion, setCompletion] = useState<PgdSummaryCompletionFilter>('ALL');
  const [receivedYear, setReceivedYear] = useState<PgdSummaryReceivedYearFilter>('ALL');
  const rawRows = useMemo(() => buildPgdSummaryRegisterRows({
    requests: props.requests,
    assignments: props.assignments,
    samples: props.samples,
    labRequests: props.labRequests,
    labResults: props.labResults,
    reports: props.reports,
    certificates: props.certificates,
    documents: props.documents,
  }), [props.assignments, props.certificates, props.documents, props.labRequests, props.labResults, props.reports, props.requests, props.samples]);
  const ownerNames = useMemo(() => new Map(props.users.map((user) => [user.username, user.name || 'Người dùng hệ thống'])), [props.users]);
  const rows = useMemo(() => rawRows.map((row) => ({ ...row, displayCells: { pgdGroupCode: row.cells.pgdGroupCode === 'QC20' ? PGD_GROUP_LABELS.QC20 : row.cells.pgdGroupCode, catalogItemId: getPgdCatalogItemLabel(row.cells.catalogItemId, props.catalog), ownerUsername: row.cells.ownerUsername ? ownerNames.get(String(row.cells.ownerUsername)) : undefined, sampledBy: row.cells.sampledBy ? String(row.cells.sampledBy).split('; ').map((username) => ownerNames.get(username) || username).join('; ') : undefined, completionPercent: row.cells.completionPercent === undefined ? undefined : String(row.cells.completionPercent)+'%', latestReportStatus: ({ DRAFT: 'Bản nháp', APPROVED: 'Đã duyệt', RETURNED: 'Trả lại' } as Record<string, string>)[String(row.cells.latestReportStatus)] || row.cells.latestReportStatus } })), [ownerNames, props.catalog, rawRows]);
  const configuredColumns = useMemo(() => columns.map((column) => column.id === 'ownerUsername' ? { ...column, options: [{ value: '', label: 'Chưa phân công' }, ...userOptions(props.users)] } : column), [props.users]);
  const receivedYears = useMemo(() => getPgdSummaryReceivedAtYears(rows), [rows]);
  const filterRows = useMemo(() => (items: typeof rows) => filterPgdSummaryRegisterRows(items, { completion, receivedYear }).filter((row) => (group === 'ALL' || row.cells.productGroup === group) && (status === 'ALL' || row.cells.status === status) && (catalogItemId === 'ALL' || row.cells.catalogItemId === catalogItemId) && (ownerFilter === 'ALL' || (ownerFilter === 'ASSIGNED' ? Boolean(row.cells.ownerUsername) : !row.cells.ownerUsername))), [catalogItemId, completion, group, ownerFilter, receivedYear, status]);

  const savedFilterState = { values: { group, status, ownerFilter, catalogItemId, completion, receivedYear }, onApply: (snapshot: PgdcnSavedFilterSnapshot) => { const values = snapshot.values; setGroup((values.group as typeof group) || 'ALL'); setStatus((values.status as typeof status) || 'ALL'); setOwnerFilter((values.ownerFilter as typeof ownerFilter) || 'ALL'); setCatalogItemId(values.catalogItemId || 'ALL'); setCompletion(values.completion === 'COMPLETE' || values.completion === 'INCOMPLETE' ? values.completion : 'ALL'); setReceivedYear(values.receivedYear || 'ALL'); } };

  const commitCell = async (rowId: string, columnId: string, rawValue: string) => {
    const request = props.requests.find((item) => item.id === rowId);
    if (!request) throw new Error('Không tìm thấy hồ sơ PGD để cập nhật.');
    const update = getPgdSummaryCellUpdate(request, columnId, rawValue);
    if (update.kind === 'owner') {
      if (!update.ownerUsername) throw new Error('Sổ tổng hợp PGD yêu cầu chọn chủ hồ sơ cụ thể.');
      await props.onAssignOwner(rowId, update.ownerUsername);
      return;
    }
    await props.onUpdateRequest(rowId, update.patch as Partial<PgdInspectionRequestEditPatch>);
  };

  const filterControls = <>
    <select aria-label="Lọc nhóm sản phẩm Sổ tổng hợp PGD" value={group} onChange={(event) => setGroup(event.target.value as typeof group)} className="pgdcn-toolbar-filter min-w-0 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><option value="ALL">Tất cả nhóm</option>{Object.entries(PGD_PRODUCT_GROUP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <select aria-label="Lọc loại hồ sơ Sổ tổng hợp PGD" value={catalogItemId} onChange={(event) => setCatalogItemId(event.target.value)} className="pgdcn-toolbar-filter min-w-0 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><option value="ALL">Tất cả loại hồ sơ</option>{props.catalog.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select>
    <select aria-label="Lọc trạng thái Sổ tổng hợp PGD" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="pgdcn-toolbar-filter min-w-0 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><option value="ALL">Tất cả trạng thái</option>{PGD_WORKFLOW_STATES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
    <select aria-label="Lọc phân công Sổ tổng hợp PGD" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value as typeof ownerFilter)} className="pgdcn-toolbar-filter min-w-0 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><option value="ALL">Tất cả chủ hồ sơ</option><option value="ASSIGNED">Đã phân công</option><option value="UNASSIGNED">Chưa phân công</option></select>
    <select aria-label="Lọc mức hoàn thiện Sổ tổng hợp PGD" value={completion} onChange={(event) => setCompletion(event.target.value as PgdSummaryCompletionFilter)} className="pgdcn-toolbar-filter min-w-0 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><option value="ALL">Tất cả mức hoàn thiện</option><option value="COMPLETE">Đủ hồ sơ</option><option value="INCOMPLETE">Còn thiếu</option></select>
    <select aria-label="Lọc năm tiếp nhận Sổ tổng hợp PGD" value={receivedYear} onChange={(event) => setReceivedYear(event.target.value as PgdSummaryReceivedYearFilter)} className="pgdcn-toolbar-filter min-w-0 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><option value="ALL">Tất cả năm tiếp nhận</option>{receivedYears.map((year) => <option key={year} value={year}>{year}</option>)}<option value="NO_DATE">Chưa có ngày tiếp nhận</option></select>
  </>;

  return <div className="min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5"><PgdcnPageHeader eyebrow="Quản lý PGD" title="Sổ tổng hợp PGD" description="Mỗi dòng là một hồ sơ PGD, mỗi cột là một trường dữ liệu. Các ô được phép chỉnh sửa trực tiếp theo đúng ranh giới hồ sơ." /><div className="min-w-0 max-w-full"><p className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 sm:hidden">Vuốt ngang để xem thêm cột. Cột đầu tiên và thao tác luôn được ghim.</p><PgdcnDossierSummaryGrid domain="PGD" columns={configuredColumns} rows={rows} currentUsername={props.currentUsername} canEdit={props.canEdit} filterRows={filterRows} filterControls={filterControls} onOpenRow={props.onOpenRequest} onCommitCell={commitCell} savedFilterState={savedFilterState} searchPlaceholder="Tìm mã PYC, số đăng ký, khách hàng, sản phẩm, chứng từ..." emptyTitle="Không có hồ sơ PGD phù hợp" emptyDescription="Hãy điều chỉnh từ khóa, nhóm sản phẩm hoặc trạng thái." /></div></div>;
}
