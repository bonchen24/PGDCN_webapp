import type {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierDocument,
  OutboundLabRequest,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { buildPcnDossierCompleteness, type PcnDossierMissingDocumentGroup, type PcnPipelineStationKey } from './pcnDossierPipeline.ts';
import { isPcnInternalSampleRequest } from './pcnLabOperations.ts';
export type { SummaryCellValue, SummaryGridColumn, SummaryGridRow } from './summaryRegister';

export type PcnSummaryCellUpdate =
  | { target: 'proposal'; updates: Record<string, unknown> }
  | { target: 'dossier'; updates: Record<string, unknown> };

export function getPcnSummaryCellUpdate(
  _proposal: CertificationProposal,
  _dossier: CertificationDossier,
  columnId: string,
  rawValue: string,
): PcnSummaryCellUpdate {
  const value = rawValue.trim();
  const proposalFields = new Set([
    'channel', 'productName', 'productType', 'model', 'brand', 'specifications',
    'manufacturer', 'manufacturerAddress', 'warehouseAddress', 'quantity',
  ]);
  const dossierFields = new Set([
    'ownerUsername', 'evaluatorUsername', 'reviewerUsername', 'targetDate',
    'evaluationAt', 'effectiveAt', 'exceptionReason',
  ]);
  if (proposalFields.has(columnId)) {
    if (columnId === 'quantity') {
      const quantity = Number(value.replace(',', '.'));
      if (!Number.isFinite(quantity)) throw new Error('Số lượng phải là số hợp lệ.');
      return { target: 'proposal', updates: { quantity } };
    }
    return { target: 'proposal', updates: { [columnId]: value || undefined } };
  }
  if (dossierFields.has(columnId)) return { target: 'dossier', updates: { [columnId]: value || undefined } };
  const customerField = ({
    customerName: 'name',
    customerAddress: 'address',
    customerTaxId: 'taxId',
    customerPhone: 'phone',
    customerEmail: 'email',
    customerContact: 'contactPerson',
  } as const)[columnId as 'customerName' | 'customerAddress' | 'customerTaxId' | 'customerPhone' | 'customerEmail' | 'customerContact'];
  if (customerField) return { target: 'proposal', updates: { customerSnapshot: { [customerField]: value || undefined } } };
  throw new Error(`Cell ${columnId} không được phép chỉnh sửa trong Sổ tổng hợp PCN.`);
}

export interface PcnOperationsRegisterInput {
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  issuancePackages: IssuancePackage[];
  fields?: PcnCertificationField[];
  documentRequirements?: PcnDocumentRequirement[];
  dossierDocuments?: PcnDossierDocument[];
}

export interface PcnOperationsRegisterRow {
  dossierId: string;
  dossierCode: string;
  registrationCode: string;
  customerName: string;
  customerAddress?: string;
  sampleQuantity?: number;
  sampleLocations: string[];
  productName: string;
  model?: string;
  brand?: string;
  standardRefs: string[];
  evaluatorUsername?: string;
  ownerUsername?: string;
  evaluationAt?: string;
  effectiveAt?: string;
  fieldCodes: string[];
  receivedAt?: string;
  sampleReceivedAt?: string;
  lastResultReceivedAt?: string;
  lastResultOutcome?: ReturnedTestResult['outcome'];
  reportNumbers: string[];
  testCriteria: string[];
  labStatuses: string[];
  dossierStatus: CertificationDossier['status'];
  issuanceNumber?: string;
  issuedAt?: string;
  sampleReturnedAt?: string;
  stationKey: PcnPipelineStationKey;
  stationTitle: string;
  stationActionLabel: string;
  completenessScore: number;
  requiredDocumentTotal: number;
  requiredDocumentPresent: number;
  missingRequiredCount: number;
  stationDocumentTotal: number;
  stationDocumentPresent: number;
  missingRequiredByStage: PcnDossierMissingDocumentGroup[];
  stationMissingLabels: string[];
}

export interface PcnOperationsRegisterFilter {
  query?: string;
  year?: string;
  fieldCode?: string;
  status?: CertificationDossier['status'];
  completeness?: 'ALL' | 'INCOMPLETE' | 'COMPLETE';
  assignment?: 'ALL' | 'ASSIGNED' | 'UNASSIGNED';
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function byLatest(value: { updatedAt?: string; createdAt?: string; issuedAt?: string }, fallback = ''): string {
  return value.updatedAt || value.issuedAt || value.createdAt || fallback;
}

function includesDossier<T extends { id: string; dossierId: string }>(items: T[], dossier: CertificationDossier, linkedIds: string[] | undefined): T[] {
  const ids = new Set(linkedIds || []);
  return items.filter((item) => item.dossierId === dossier.id || ids.has(item.id));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'vi'));
}

export function buildPcnOperationsRegisterRows(input: PcnOperationsRegisterInput): PcnOperationsRegisterRow[] {
  const proposalsById = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));

  return input.dossiers.map((dossier) => {
    const proposal = proposalsById.get(dossier.proposalId);
    const sampleLots = includesDossier(input.sampleLots, dossier, dossier.sampleLotIds);
    const sampleLotIds = new Set(sampleLots.map((lot) => lot.id));
    const sampleRoutes = input.sampleRoutes.filter((route) => sampleLotIds.has(route.sampleLotId));
    const labRequests = includesDossier(input.labRequests, dossier, dossier.labRequestIds).filter((request) => isPcnInternalSampleRequest(request, input.sampleRoutes));
    const labRequestIds = new Set(labRequests.map((request) => request.id));
    const results = input.returnedResults.filter((result) => result.dossierId === dossier.id || labRequestIds.has(result.labRequestId));
    const issuance = input.issuancePackages
      .filter((item) => item.dossierId === dossier.id)
      .sort((left, right) => byLatest(right).localeCompare(byLatest(left)))[0];
    const customer = dossier.customerSnapshot || proposal?.customerSnapshot;
    const latestResult = [...results].sort((left, right) => byLatest(right, right.receivedAt).localeCompare(byLatest(left, left.receivedAt)))[0];
    const routeStatuses = sampleRoutes.map((route) => `${route.labName || route.labCode}: ${route.status}`);
    const requestStatuses = labRequests.map((request) => `${request.laboratoryName}: ${request.status}`);
    const fieldCodes = uniqueSorted(dossier.fieldCodes.length > 0 ? dossier.fieldCodes : proposal?.fieldCodes || []);
    const fieldRecords = (input.fields || []).filter((field) => fieldCodes.includes(field.code));
    const completeness = buildPcnDossierCompleteness({
      dossier,
      proposal,
      requirements: input.documentRequirements,
      documents: input.dossierDocuments,
    });

    return {
      dossierId: dossier.id,
      dossierCode: dossier.dossierCode,
      registrationCode: proposal?.proposalCode || dossier.dossierCode,
      customerName: customer?.name || 'Chưa cập nhật',
      customerAddress: customer?.address,
      sampleQuantity: sampleLots.length > 0
        ? sampleLots.reduce((total, lot) => total + (Number.isFinite(lot.quantity) ? lot.quantity : 0), 0)
        : undefined,
      sampleLocations: uniqueSorted(sampleLots.map((lot) => lot.currentLocation)),
      productName: proposal?.productName || 'Chưa cập nhật',
      model: proposal?.model,
      brand: proposal?.brand,
      standardRefs: uniqueSorted(fieldRecords.flatMap((field) => field.standardRefs || [])),
      evaluatorUsername: dossier.evaluatorUsername,
      ownerUsername: dossier.ownerUsername,
      evaluationAt: dossier.evaluationAt,
      effectiveAt: dossier.effectiveAt,
      fieldCodes,
      receivedAt: proposal?.receivedAt,
      sampleReceivedAt: latestIso(sampleLots.map((lot) => lot.receivedAt)),
      lastResultReceivedAt: latestIso(results.map((result) => result.receivedAt)),
      lastResultOutcome: latestResult?.outcome,
      reportNumbers: uniqueSorted(results.map((result) => result.reportNumber || '')),
      testCriteria: uniqueSorted(labRequests.map((request) => request.criteria || '')),
      labStatuses: uniqueSorted(routeStatuses.length > 0 ? routeStatuses : requestStatuses),
      dossierStatus: dossier.status,
      issuanceNumber: issuance?.issuanceNumber,
      issuedAt: issuance?.issuedAt,
      sampleReturnedAt: latestIso(sampleRoutes.map((route) => route.returnedAt)),
      stationKey: completeness.station.key,
      stationTitle: completeness.station.title,
      stationActionLabel: completeness.station.actionLabel,
      completenessScore: completeness.score,
      requiredDocumentTotal: completeness.requiredDocumentTotal,
      requiredDocumentPresent: completeness.requiredDocumentPresent,
      missingRequiredCount: completeness.missingRequirementIds.length,
      stationDocumentTotal: completeness.stationDocumentTotal,
      stationDocumentPresent: completeness.stationDocumentPresent,
      missingRequiredByStage: completeness.missingRequiredByStage,
      stationMissingLabels: completeness.stationMissingLabels,
    };
  }).sort((left, right) => {
    const dateCompare = Date.parse(right.receivedAt || '') - Date.parse(left.receivedAt || '');
    return Number.isNaN(dateCompare) || dateCompare === 0
      ? left.registrationCode.localeCompare(right.registrationCode, 'vi')
      : dateCompare;
  });
}

export function filterPcnOperationsRegisterRows(rows: PcnOperationsRegisterRow[], filter: PcnOperationsRegisterFilter = {}): PcnOperationsRegisterRow[] {
  const query = String(filter.query || '').trim().toLocaleLowerCase('vi-VN');
  return rows.filter((row) => {
    if (filter.year && !String(row.receivedAt || '').startsWith(filter.year)) return false;
    if (filter.fieldCode && !row.fieldCodes.includes(filter.fieldCode)) return false;
    if (filter.status && row.dossierStatus !== filter.status) return false;
    if (filter.completeness === 'INCOMPLETE' && row.missingRequiredCount === 0) return false;
    if (filter.completeness === 'COMPLETE' && row.missingRequiredCount > 0) return false;
    const isAssigned = Boolean(String(row.ownerUsername || '').trim());
    if (filter.assignment === 'ASSIGNED' && !isAssigned) return false;
    if (filter.assignment === 'UNASSIGNED' && isAssigned) return false;
    if (!query) return true;
    const haystack = [
      row.registrationCode,
      row.dossierCode,
      row.customerName,
      row.customerAddress,
      row.productName,
      row.model,
      row.brand,
      row.sampleLocations.join(' '),
      row.standardRefs.join(' '),
      row.fieldCodes.join(' '),
      row.reportNumbers.join(' '),
      row.issuanceNumber,
      row.stationTitle,
      row.ownerUsername,
      row.stationMissingLabels.join(' '),
      row.missingRequiredByStage.map((group) => `${group.label} ${group.labels.join(' ')}`).join(' '),
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');
    return haystack.includes(query);
  });
}

function csvCell(value: unknown): string {
  let text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toPcnOperationsRegisterCsv(rows: PcnOperationsRegisterRow[]): string {
  const headers = [
    'Mã đăng ký',
    'Mã hồ sơ',
    'Khách hàng',
    'Địa chỉ',
    'Số lượng mẫu',
    'Sản phẩm',
    'Model',
    'Nhãn hiệu',
    'Tiêu chuẩn',
    'Trưởng đoàn đánh giá',
    'Ngày đánh giá',
    'Ngày hiệu lực',
    'Lĩnh vực',
    'Ngày nhận hồ sơ',
    'Ngày nhận mẫu',
    'Nơi nhận/đang giữ mẫu',
    'Ngày nhận KQTN gần nhất',
    'Kết quả gần nhất',
    'Số báo cáo KQTN',
    'Chỉ tiêu thử',
    'Tình trạng tuyến PTN',
    'Trạng thái hồ sơ',
    'Số phát hành',
    'Ngày phát hành',
    'Ngày trả mẫu',
    'Trạm hiện tại',
    'Chủ hồ sơ',
    'Mức hoàn thiện',
    'Tài liệu bắt buộc',
    'Mục bắt buộc còn thiếu',
    'Tài liệu bắt buộc còn thiếu theo giai đoạn',
    'Thiếu tại trạm',
  ];
  const lines = rows.map((row) => [
    row.registrationCode,
    row.dossierCode,
    row.customerName,
    row.customerAddress,
    row.sampleQuantity,
    row.productName,
    row.model,
    row.brand,
    row.standardRefs,
    row.evaluatorUsername,
    row.evaluationAt,
    row.effectiveAt,
    row.fieldCodes,
    row.receivedAt,
    row.sampleReceivedAt,
    row.sampleLocations,
    row.lastResultReceivedAt,
    row.lastResultOutcome,
    row.reportNumbers,
    row.testCriteria,
    row.labStatuses,
    row.dossierStatus,
    row.issuanceNumber,
    row.issuedAt,
    row.sampleReturnedAt,
    row.stationTitle,
    row.ownerUsername,
    `${row.completenessScore}%`,
    `${row.requiredDocumentPresent}/${row.requiredDocumentTotal}`,
    row.missingRequiredCount,
    row.missingRequiredByStage.map((group) => `${group.label}: ${group.labels.join(', ')}`),
    row.stationMissingLabels,
  ].map(csvCell).join(','));
  return `\uFEFF${headers.map(csvCell).join(',')}\r\n${lines.join('\r\n')}${lines.length > 0 ? '\r\n' : ''}`;
}

// --- End of pcnOperationsRegister.ts ---
