import type {
  CertificationDossier,
  CertificationProposal,
  CustomerRef,
  IssuancePackage,
  OutboundLabRequest,
  PcnSampleLot,
  PcnSampleItem,
  PcnSampleRoute,
  PcnTemplateDefinition,
  ReturnedTestResult,
} from '../types.ts';
import { PCN_CUSTOMER_FIELDS } from './pcnCustomerReconciliation.ts';

export type PcnDataIntegrityCollection =
  | 'customers'
  | 'certificationProposals'
  | 'certificationDossiers'
  | 'pcnSampleLots'
  | 'pcnSampleItems'
  | 'pcnSampleRoutes'
  | 'labRequests'
  | 'returnedResults'
  | 'issuancePackages'
  | 'pcnTemplateDefinitions';

export type PcnDataIntegrityIssueCode =
  | 'MISSING_ID'
  | 'DUPLICATE_ID'
  | 'EMPTY_CUSTOMER_RECORD'
  | 'MISSING_PROPOSAL_CODE'
  | 'MISSING_CUSTOMER_NAME'
  | 'MISSING_PRODUCT_NAME'
  | 'MISSING_DOSSIER_CODE'
  | 'MISSING_FIELD_LINK'
  | 'MISSING_PROPOSAL_LINK'
  | 'MISSING_DOSSIER_LINK'
  | 'DUPLICATE_PROPOSAL_LINK'
  | 'MISSING_LOT_CODE'
  | 'MISSING_SAMPLE_NAME'
  | 'MISSING_SAMPLE_ITEM_CODE'
  | 'MISSING_SAMPLE_TYPE'
  | 'MISSING_SAMPLE_MODEL'
  | 'MISSING_SAMPLE_ITEM_LINK'
  | 'INVALID_QUANTITY'
  | 'MISSING_CURRENT_LOCATION'
  | 'MISSING_SAMPLE_LOT_LINK'
  | 'MISSING_SAMPLE_ROUTE_LINK'
  | 'MISSING_LAB_NAME'
  | 'MISSING_PYC_NUMBER'
  | 'MISSING_LAB_REQUEST_LINK'
  | 'MISSING_RESULT_LINK'
  | 'MISSING_ISSUANCE_LINK'
  | 'INVALID_ROUND'
  | 'MISSING_RESULT_OUTCOME'
  | 'INVALID_RECEIVED_AT'
  | 'MISSING_ISSUANCE_STATUS'
  | 'MISSING_TEMPLATE_ASSET'
  | 'INVALID_TEMPLATE_ASSET_POINTER';

export interface PcnDataIntegrityIssue {
  collection: PcnDataIntegrityCollection;
  entityId: string;
  code: PcnDataIntegrityIssueCode;
  message: string;
}

export interface PcnDataIntegritySnapshot {
  customers?: CustomerRef[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  sampleLots: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  issuancePackages: IssuancePackage[];
  templates?: PcnTemplateDefinition[];
}

export interface PcnDataIntegrityReport {
  issueCount: number;
  affectedRecordCount: number;
  issues: PcnDataIntegrityIssue[];
}

export const PCN_DATA_INTEGRITY_COLLECTION_LABELS: Record<PcnDataIntegrityCollection, string> = {
  customers: 'Danh sách khách hàng',
  certificationProposals: 'Đề nghị',
  certificationDossiers: 'Hồ sơ',
  pcnSampleLots: 'Lô mẫu',
  pcnSampleItems: 'Mẫu thử/model',
  pcnSampleRoutes: 'Tuyến mẫu',
  labRequests: 'PYC',
  returnedResults: 'KQTN',
  issuancePackages: 'Phát hành',
  pcnTemplateDefinitions: 'Biểu mẫu PCN',
};

export type PcnIntegrityDossierTab = 'proposal' | 'lab' | 'results' | 'issuance';

export function getPcnIntegrityDossierTab(collection: PcnDataIntegrityCollection): PcnIntegrityDossierTab | undefined {
  switch (collection) {
    case 'certificationProposals':
      return 'proposal';
    case 'pcnSampleLots':
    case 'pcnSampleItems':
    case 'pcnSampleRoutes':
    case 'labRequests':
      return 'lab';
    case 'returnedResults':
      return 'results';
    case 'issuancePackages':
      return 'issuance';
    case 'pcnTemplateDefinitions':
      return undefined;
    case 'customers':
    case 'certificationDossiers':
    default:
      return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function isValidUtcTimestamp(value: unknown): boolean {
  const candidate = text(value);
  const match = candidate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/);
  if (!match) return false;
  const date = new Date(candidate);
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3])
    && date.getUTCHours() === Number(match[4])
    && date.getUTCMinutes() === Number(match[5])
    && date.getUTCSeconds() === Number(match[6])
    && date.getUTCMilliseconds() === Number(match[7] || 0);
}

export function getPcnDataIntegrityReport(snapshot: PcnDataIntegritySnapshot): PcnDataIntegrityReport {
  const issues: PcnDataIntegrityIssue[] = [];
  const add = (collection: PcnDataIntegrityCollection, record: unknown, code: PcnDataIntegrityIssueCode, message: string) => {
    const entityId = text(asRecord(record).id) || '(không có ID)';
    issues.push({ collection, entityId, code, message });
  };

  const proposalIds = new Set<string>();
  const dossierIds = new Set<string>();
  const lotIds = new Set<string>();
  const routeIds = new Set<string>();
  const resultIds = new Set<string>();

  for (const proposal of snapshot.proposals) { const id = text(asRecord(proposal).id); if (id) proposalIds.add(id); }
  for (const dossier of snapshot.dossiers) { const id = text(asRecord(dossier).id); if (id) dossierIds.add(id); }
  for (const lot of snapshot.sampleLots) { const id = text(asRecord(lot).id); if (id) lotIds.add(id); }
  for (const route of snapshot.sampleRoutes) { const id = text(asRecord(route).id); if (id) routeIds.add(id); }
  for (const result of snapshot.returnedResults) { const id = text(asRecord(result).id); if (id) resultIds.add(id); }

  const reportDuplicateIds = (collection: PcnDataIntegrityCollection, records: unknown[]) => {
    const seen = new Set<string>();
    for (const record of records) {
      const id = text(asRecord(record).id);
      if (id && seen.has(id)) add(collection, record, 'DUPLICATE_ID', 'ID bị trùng trong cùng collection.');
      if (id) seen.add(id);
    }
  };

  if (snapshot.customers) {
    reportDuplicateIds('customers', snapshot.customers);
    for (const customer of snapshot.customers) {
      const record = asRecord(customer);
      if (!text(record.id)) add('customers', customer, 'MISSING_ID', 'Thiếu ID khách hàng.');
      const hasBusinessData = PCN_CUSTOMER_FIELDS.some((field) => Boolean(text(record[field])));
      if (!hasBusinessData) add('customers', customer, 'EMPTY_CUSTOMER_RECORD', 'Bản ghi khách hàng không có dữ liệu nghiệp vụ.');
    }
  }

  reportDuplicateIds('certificationProposals', snapshot.proposals);
  reportDuplicateIds('certificationDossiers', snapshot.dossiers);
  reportDuplicateIds('pcnSampleLots', snapshot.sampleLots);
  reportDuplicateIds('pcnSampleItems', snapshot.sampleItems || []);
  reportDuplicateIds('pcnSampleRoutes', snapshot.sampleRoutes);
  reportDuplicateIds('labRequests', snapshot.labRequests);
  reportDuplicateIds('returnedResults', snapshot.returnedResults);
  reportDuplicateIds('issuancePackages', snapshot.issuancePackages);
  if (snapshot.templates) reportDuplicateIds('pcnTemplateDefinitions', snapshot.templates);

  for (const template of snapshot.templates || []) {
    const record = asRecord(template);
    const id = text(record.id);
    if (!id) add('pcnTemplateDefinitions', template, 'MISSING_ID', 'Thiếu ID biểu mẫu PCN.');
    if (!text(record.fileAssetId)) {
      add('pcnTemplateDefinitions', template, 'MISSING_TEMPLATE_ASSET', 'Biểu mẫu chưa có asset private để mở hoặc dùng trong luồng tạo tài liệu.');
    } else if (record.privateAssetVerified !== true) {
      const reason = text(record.privateAssetVerificationIssue);
      add('pcnTemplateDefinitions', template, 'INVALID_TEMPLATE_ASSET_POINTER', `Asset private của biểu mẫu chưa được server xác minh đúng provenance${reason ? ` (${reason})` : ''}.`);
    }
  }

  for (const proposal of snapshot.proposals) {
    const record = asRecord(proposal);
    const id = text(record.id);
    if (!id) add('certificationProposals', proposal, 'MISSING_ID', 'Thiếu ID Đề nghị.'); else proposalIds.add(id);
    if (!text(record.proposalCode)) add('certificationProposals', proposal, 'MISSING_PROPOSAL_CODE', 'Thiếu mã Đề nghị.');
    if (!text(asRecord(record.customerSnapshot).name)) add('certificationProposals', proposal, 'MISSING_CUSTOMER_NAME', 'Thiếu tên khách hàng trong snapshot.');
    if (!text(record.productName)) add('certificationProposals', proposal, 'MISSING_PRODUCT_NAME', 'Thiếu tên sản phẩm.');
    if (stringArray(record.fieldCodes).length === 0) add('certificationProposals', proposal, 'MISSING_FIELD_LINK', 'Chưa liên kết Lĩnh vực.');
    const dossierId = text(record.dossierId);
    if (!dossierId) {
      add('certificationProposals', proposal, 'MISSING_DOSSIER_LINK', 'Đề nghị chưa liên kết hồ sơ chứng nhận.');
    } else {
      const linkedDossier = snapshot.dossiers.find((item) => text(asRecord(item).id) === dossierId);
      if (!linkedDossier) add('certificationProposals', proposal, 'MISSING_DOSSIER_LINK', 'Không tìm thấy hồ sơ chứng nhận được Đề nghị tham chiếu.');
      else if (text(asRecord(linkedDossier).proposalId) !== id) add('certificationProposals', proposal, 'MISSING_DOSSIER_LINK', `Hồ sơ ${dossierId} không trỏ ngược về Đề nghị này.`);
    }
  }

  for (const dossier of snapshot.dossiers) {
    const record = asRecord(dossier);
    const id = text(record.id);
    if (!id) add('certificationDossiers', dossier, 'MISSING_ID', 'Thiếu ID hồ sơ.'); else dossierIds.add(id);
    if (!text(record.dossierCode)) add('certificationDossiers', dossier, 'MISSING_DOSSIER_CODE', 'Thiếu mã hồ sơ.');
    if (stringArray(record.fieldCodes).length === 0) add('certificationDossiers', dossier, 'MISSING_FIELD_LINK', 'Hồ sơ chưa liên kết Lĩnh vực.');
    if (!proposalIds.has(text(record.proposalId))) add('certificationDossiers', dossier, 'MISSING_PROPOSAL_LINK', 'Không tìm thấy Đề nghị được hồ sơ tham chiếu.');
  }

  const firstDossierByProposalId = new Map<string, CertificationDossier>();
  for (const dossier of snapshot.dossiers) {
    const proposalId = text(asRecord(dossier).proposalId);
    if (!proposalId) continue;
    const firstDossier = firstDossierByProposalId.get(proposalId);
    if (firstDossier) {
      add('certificationDossiers', dossier, 'DUPLICATE_PROPOSAL_LINK', `Đề nghị ${proposalId} đang được liên kết với nhiều hồ sơ.`);
    } else {
      firstDossierByProposalId.set(proposalId, dossier);
    }
  }

  for (const lot of snapshot.sampleLots) {
    const record = asRecord(lot);
    const id = text(record.id);
    if (!id) add('pcnSampleLots', lot, 'MISSING_ID', 'Thiếu ID lô mẫu.'); else lotIds.add(id);
    if (!text(record.lotCode)) add('pcnSampleLots', lot, 'MISSING_LOT_CODE', 'Thiếu mã lô mẫu.');
    const linkedItems = (snapshot.sampleItems || []).filter((item) => text(asRecord(item).sampleLotId) === id);
    if (!text(record.sampleName) && linkedItems.length === 0) add('pcnSampleLots', lot, 'MISSING_SAMPLE_NAME', 'Lô mẫu chưa có mẫu/model chi tiết.');
    if ((typeof record.quantity !== 'number' || !Number.isFinite(record.quantity) || record.quantity <= 0) && linkedItems.length === 0) add('pcnSampleLots', lot, 'INVALID_QUANTITY', 'Số lượng mẫu không hợp lệ.');
    if (!text(record.currentLocation)) add('pcnSampleLots', lot, 'MISSING_CURRENT_LOCATION', 'Thiếu nơi đang giữ mẫu.');
    if (!dossierIds.has(text(record.dossierId))) add('pcnSampleLots', lot, 'MISSING_DOSSIER_LINK', 'Không tìm thấy hồ sơ được lô mẫu tham chiếu.');
    for (const sampleItemId of stringArray(record.sampleItemIds)) {
      const item = (snapshot.sampleItems || []).find((candidate) => text(asRecord(candidate).id) === sampleItemId);
      if (!item || text(asRecord(item).sampleLotId) !== id) add('pcnSampleLots', lot, 'MISSING_SAMPLE_ITEM_LINK', `Mẫu/model ${sampleItemId} không thuộc lô này.`);
    }
  }

  for (const item of snapshot.sampleItems || []) {
    const record = asRecord(item);
    const id = text(record.id);
    if (!id) add('pcnSampleItems', item, 'MISSING_ID', 'Thiếu ID mẫu/model.');
    if (!text(record.sampleCode)) add('pcnSampleItems', item, 'MISSING_SAMPLE_ITEM_CODE', 'Thiếu mã mẫu/model.');
    if (!text(record.sampleType)) add('pcnSampleItems', item, 'MISSING_SAMPLE_TYPE', 'Thiếu loại mẫu.');
    if (!text(record.model)) add('pcnSampleItems', item, 'MISSING_SAMPLE_MODEL', 'Thiếu model.');
    if (typeof record.quantity !== 'number' || !Number.isInteger(record.quantity) || record.quantity < 1) add('pcnSampleItems', item, 'INVALID_QUANTITY', 'Số lượng mẫu/model phải là số nguyên dương.');
    if (!lotIds.has(text(record.sampleLotId))) add('pcnSampleItems', item, 'MISSING_SAMPLE_LOT_LINK', 'Mẫu/model chưa liên kết với lô mẫu tồn tại.');
  }

  for (const route of snapshot.sampleRoutes) {
    const record = asRecord(route);
    const id = text(record.id);
    if (!id) add('pcnSampleRoutes', route, 'MISSING_ID', 'Thiếu ID tuyến mẫu.'); else routeIds.add(id);
    if (!text(record.labName)) add('pcnSampleRoutes', route, 'MISSING_LAB_NAME', 'Thiếu tên phòng thử nghiệm.');
    if (!lotIds.has(text(record.sampleLotId))) add('pcnSampleRoutes', route, 'MISSING_SAMPLE_LOT_LINK', 'Không tìm thấy lô mẫu được tuyến tham chiếu.');
    for (const sampleItemId of stringArray(record.sampleItemIds)) {
      const item = (snapshot.sampleItems || []).find((candidate) => text(asRecord(candidate).id) === sampleItemId);
      if (!item || text(asRecord(item).sampleLotId) !== text(record.sampleLotId)) add('pcnSampleRoutes', route, 'MISSING_SAMPLE_ITEM_LINK', `Tuyến không thể tham chiếu mẫu/model ${sampleItemId} ngoài lô.`);
    }
  }

  for (const request of snapshot.labRequests) {
    const record = asRecord(request);
    const id = text(record.id);
    if (!id) add('labRequests', request, 'MISSING_ID', 'Thiếu ID PYC.');
    if (!text(record.pycNumber)) add('labRequests', request, 'MISSING_PYC_NUMBER', 'Thiếu số PYC.');
    if (!text(record.laboratoryName)) add('labRequests', request, 'MISSING_LAB_NAME', 'Thiếu tên phòng thử nghiệm.');
    const linkedDossier = snapshot.dossiers.find((item) => text(asRecord(item).id) === text(record.dossierId));
    if (!linkedDossier) add('labRequests', request, 'MISSING_DOSSIER_LINK', 'Không tìm thấy hồ sơ được PYC tham chiếu.');
    else if (id && !stringArray(asRecord(linkedDossier).labRequestIds).includes(id)) add('labRequests', request, 'MISSING_DOSSIER_LINK', `Hồ sơ ${text(record.dossierId)} không trỏ ngược về PYC này.`);
    if (record.sampleLotId !== undefined && !lotIds.has(text(record.sampleLotId))) add('labRequests', request, 'MISSING_SAMPLE_LOT_LINK', 'PYC tham chiếu lô mẫu không tồn tại.');
    if (record.sampleRouteId !== undefined && !routeIds.has(text(record.sampleRouteId))) add('labRequests', request, 'MISSING_SAMPLE_ROUTE_LINK', 'PYC tham chiếu tuyến mẫu không tồn tại.');
    if (record.returnedResultId !== undefined && !resultIds.has(text(record.returnedResultId))) add('labRequests', request, 'MISSING_RESULT_LINK', 'PYC tham chiếu KQTN không tồn tại.');
  }

  for (const result of snapshot.returnedResults) {
    const record = asRecord(result);
    const id = text(record.id);
    if (!id) add('returnedResults', result, 'MISSING_ID', 'Thiếu ID KQTN.'); else resultIds.add(id);
    const linkedDossier = snapshot.dossiers.find((item) => text(asRecord(item).id) === text(record.dossierId));
    if (!linkedDossier) add('returnedResults', result, 'MISSING_DOSSIER_LINK', 'Không tìm thấy hồ sơ được KQTN tham chiếu.');
    else if (id && !stringArray(asRecord(linkedDossier).returnedResultIds).includes(id)) add('returnedResults', result, 'MISSING_DOSSIER_LINK', `Hồ sơ ${text(record.dossierId)} không trỏ ngược về KQTN này.`);
    const labRequestId = text(record.labRequestId);
    const linkedRequest = snapshot.labRequests.find((item) => text(asRecord(item).id) === labRequestId);
    if (!labRequestId || !linkedRequest) add('returnedResults', result, 'MISSING_LAB_REQUEST_LINK', 'Không tìm thấy PYC được KQTN tham chiếu.');
    else if (text(asRecord(linkedRequest).returnedResultId) !== id) add('returnedResults', result, 'MISSING_RESULT_LINK', `PYC ${labRequestId} không trỏ ngược về KQTN này.`);
    if (typeof record.round !== 'number' || !Number.isInteger(record.round) || record.round < 1) add('returnedResults', result, 'INVALID_ROUND', 'Vòng KQTN phải là số nguyên dương.');
    if (!['PASS', 'FAIL', 'PENDING'].includes(text(record.outcome))) add('returnedResults', result, 'MISSING_RESULT_OUTCOME', 'Thiếu hoặc sai kết quả KQTN.');
    if (!isValidUtcTimestamp(record.receivedAt)) add('returnedResults', result, 'INVALID_RECEIVED_AT', 'Ngày nhận KQTN phải là timestamp UTC hợp lệ.');
  }

  for (const issuance of snapshot.issuancePackages) {
    const record = asRecord(issuance);
    const id = text(record.id);
    if (!id) add('issuancePackages', issuance, 'MISSING_ID', 'Thiếu ID bộ phát hành.');
    if (!dossierIds.has(text(record.dossierId))) add('issuancePackages', issuance, 'MISSING_DOSSIER_LINK', 'Không tìm thấy hồ sơ được bộ phát hành tham chiếu.');
    if (!text(record.status)) add('issuancePackages', issuance, 'MISSING_ISSUANCE_STATUS', 'Thiếu trạng thái bộ phát hành.');
  }

  for (const dossier of snapshot.dossiers) {
    const record = asRecord(dossier);
    for (const requestId of stringArray(record.labRequestIds)) {
      const request = snapshot.labRequests.find((item) => text(asRecord(item).id) === requestId);
      if (!request) add('certificationDossiers', dossier, 'MISSING_RESULT_LINK', `Hồ sơ tham chiếu PYC ${requestId} không tồn tại.`);
      else if (text(asRecord(request).dossierId) !== text(record.id)) add('certificationDossiers', dossier, 'MISSING_DOSSIER_LINK', `PYC ${requestId} không thuộc hồ sơ này.`);
    }
    for (const resultId of stringArray(record.returnedResultIds)) {
      const result = snapshot.returnedResults.find((item) => text(asRecord(item).id) === resultId);
      if (!result) add('certificationDossiers', dossier, 'MISSING_RESULT_LINK', `Hồ sơ tham chiếu KQTN ${resultId} không tồn tại.`);
      else if (text(asRecord(result).dossierId) !== text(record.id)) add('certificationDossiers', dossier, 'MISSING_DOSSIER_LINK', `KQTN ${resultId} không thuộc hồ sơ này.`);
    }
    for (const sampleLotId of stringArray(record.sampleLotIds)) {
      const lot = snapshot.sampleLots.find((item) => text(asRecord(item).id) === sampleLotId);
      if (!lot) add('certificationDossiers', dossier, 'MISSING_DOSSIER_LINK', `Hồ sơ tham chiếu lô mẫu ${sampleLotId} không tồn tại.`);
      else if (text(asRecord(lot).dossierId) !== text(record.id)) add('certificationDossiers', dossier, 'MISSING_DOSSIER_LINK', `Lô mẫu ${sampleLotId} không thuộc hồ sơ này.`);
    }
  }

  for (const lot of snapshot.sampleLots) {
    const record = asRecord(lot);
    for (const routeId of stringArray(record.routeIds)) {
      const route = snapshot.sampleRoutes.find((item) => text(asRecord(item).id) === routeId);
      if (!route) add('pcnSampleLots', lot, 'MISSING_SAMPLE_ROUTE_LINK', `Lô mẫu tham chiếu tuyến ${routeId} không tồn tại.`);
      else if (text(asRecord(route).sampleLotId) !== text(record.id)) add('pcnSampleLots', lot, 'MISSING_SAMPLE_LOT_LINK', `Tuyến ${routeId} không thuộc lô mẫu này.`);
    }
  }

  for (const route of snapshot.sampleRoutes) {
    const record = asRecord(route);
    if (record.labRequestId !== undefined) {
      const request = snapshot.labRequests.find((item) => text(asRecord(item).id) === text(record.labRequestId));
      if (request && text(asRecord(request).sampleRouteId) !== text(record.id)) add('pcnSampleRoutes', route, 'MISSING_SAMPLE_ROUTE_LINK', 'PYC liên kết không trỏ ngược về tuyến mẫu này.');
    }
  }

  for (const request of snapshot.labRequests) {
    const record = asRecord(request);
    if (record.returnedResultId !== undefined) {
      const result = snapshot.returnedResults.find((item) => text(asRecord(item).id) === text(record.returnedResultId));
      if (result && text(asRecord(result).labRequestId) !== text(record.id)) add('labRequests', request, 'MISSING_RESULT_LINK', 'KQTN liên kết không trỏ ngược về PYC này.');
    }
  }

  for (const dossier of snapshot.dossiers) {
    const record = asRecord(dossier);
    if (record.issuancePackageId !== undefined) {
      const issuance = snapshot.issuancePackages.find((item) => text(asRecord(item).id) === text(record.issuancePackageId));
      if (!issuance) add('certificationDossiers', dossier, 'MISSING_ISSUANCE_LINK', 'Hồ sơ tham chiếu bộ phát hành không tồn tại.');
      else if (text(asRecord(issuance).dossierId) !== text(record.id)) add('certificationDossiers', dossier, 'MISSING_ISSUANCE_LINK', `Bộ phát hành ${text(record.issuancePackageId)} không thuộc hồ sơ này.`);
    }
  }

  const affectedRecords = new Set(issues.map((issue) => `${issue.collection}:${issue.entityId}`));
  return { issueCount: issues.length, affectedRecordCount: affectedRecords.size, issues };
}
