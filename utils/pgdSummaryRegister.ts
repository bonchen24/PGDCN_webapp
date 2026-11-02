import type {
  PgdInspectionCertificate,
  PgdGeneratedDocument,
  PgdInspectionAssignment,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from './pgdDomain';
import { getPgdGroupCodeForCatalogItem, getPgdStatusLabel } from './pgdDomain';
import { getPgdOperationalStation } from './pgdWorkflow';
import type { SummaryGridRow } from './summaryRegister';

export interface PgdSummaryRegisterInput {
  requests: PgdInspectionRequest[];
  assignments: PgdInspectionAssignment[];
  samples: PgdSample[];
  labRequests: PgdLabRequest[];
  labResults: PgdLabResult[];
  reports: PgdInspectionReport[];
  certificates: PgdInspectionCertificate[];
  documents?: PgdGeneratedDocument[];
}

export type PgdSummaryCellUpdate =
  | { kind: 'owner'; ownerUsername?: string }
  | { kind: 'request'; patch: Record<string, unknown> };

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function firstDocumentNumber(request: PgdInspectionRequest, kind: string): string {
  return text(request.registryMetadata?.documents?.find((document) => document.kind === kind)?.number);
}

function requestRelated<T extends { requestId: string }>(items: T[], requestId: string): T[] {
  return items.filter((item) => item.requestId === requestId);
}

function parseActualTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function compareStableId(left: { id: string }, right: { id: string }): number {
  const localized = left.id.localeCompare(right.id, 'vi-VN', { numeric: true, sensitivity: 'base' });
  return localized || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function earliestByTimestamp<T extends { id: string }>(items: T[], valueOf: (item: T) => string | undefined): T | undefined {
  return items
    .filter((item) => parseActualTimestamp(valueOf(item)) !== undefined)
    .sort((left, right) => (parseActualTimestamp(valueOf(left))! - parseActualTimestamp(valueOf(right))!) || compareStableId(left, right))[0];
}

function latestByTimestamp<T extends { id: string }>(items: T[], valueOf: (item: T) => string | undefined): T | undefined {
  return items
    .filter((item) => parseActualTimestamp(valueOf(item)) !== undefined)
    .sort((left, right) => (parseActualTimestamp(valueOf(right))! - parseActualTimestamp(valueOf(left))!) || compareStableId(left, right))[0];
}

function compareStableText(left: string, right: string): number {
  const localized = left.localeCompare(right, 'vi-VN', { numeric: true, sensitivity: 'base' });
  return localized || (left < right ? -1 : left > right ? 1 : 0);
}

function stableTextList(values: Array<string | undefined>): string {
  const unique = new Map<string, string>();
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase('vi-VN');
    const existing = unique.get(key);
    if (!existing || normalized < existing) unique.set(key, normalized);
  }
  return [...unique.values()].sort(compareStableText).join('; ');
}
export function buildPgdSummaryRegisterRows(input: PgdSummaryRegisterInput): SummaryGridRow[] {
  return input.requests
    .filter((request) => !request.deletedAt)
    .map((request) => {
      const samples = requestRelated(input.samples, request.id);
      const labRequests = requestRelated(input.labRequests, request.id);
      const labResults = requestRelated(input.labResults, request.id);
      const reports = requestRelated(input.reports, request.id);
      const certificates = requestRelated(input.certificates, request.id);
      const decisions = (input.documents ?? []).filter((document) => document.requestId === request.id && document.domain === 'pgd' && document.kind === 'DECISION' && document.status === 'ISSUED');
      const details = request.productDetails ?? {};
      const metadata = request.registryMetadata ?? {};
      const checklist = request.dossierChecklist ?? [];
      const labSampleCount = samples.filter((sample) => sample.disposition === 'LAB').length;
      const retainedSampleCount = samples.filter((sample) => sample.disposition === 'RETAINED').length;
      const requiredChecklist = checklist.filter((item) => item.required);
      const satisfiedRequiredDocumentCount = requiredChecklist.filter((item) => item.status === 'PRESENT' || item.status === 'CONFIRMED' || item.status === 'WAIVED').length;
      const missingRequiredCount = Math.max(0, requiredChecklist.length - satisfiedRequiredDocumentCount);
      const firstSample = earliestByTimestamp(samples, (sample) => sample.sampledAt);
      const lastSample = latestByTimestamp(samples, (sample) => sample.sampledAt);
      const latestLabResult = latestByTimestamp(labResults, (result) => result.receivedAt);
      const latestReport = latestByTimestamp(reports, (report) => report.updatedAt || report.createdAt);
      const signedCertificates = certificates.filter((certificate) => parseActualTimestamp(certificate.signedAt) !== undefined);
      const latestDecision = latestByTimestamp(decisions, (document) => document.generatedAt);
      const latestCertificate = latestByTimestamp(
        signedCertificates.length ? signedCertificates : certificates,
        (certificate) => certificate.signedAt || certificate.updatedAt || certificate.createdAt,
      );
      const labSampleIds = new Set(labRequests.map((labRequest) => labRequest.sampleId));
      const labHandoverAt = samples
        .filter((sample) => sample.disposition === 'LAB')
        .map((sample) => {
          const sentAtValues = labRequests
            .filter((labRequest) => labRequest.sampleId === sample.id)
            .map((labRequest) => labRequest.handover?.sentAt)
            .filter((value): value is string => parseActualTimestamp(value) !== undefined);
          if (sentAtValues.length > 0) {
            return sentAtValues.sort((left, right) => (parseActualTimestamp(left)! - parseActualTimestamp(right)!) || (left < right ? -1 : left > right ? 1 : 0))[0];
          }
          return parseActualTimestamp(sample.handedOverAt) === undefined ? undefined : sample.handedOverAt;
        })
        .filter((value): value is string => parseActualTimestamp(value) !== undefined)
        .sort((left, right) => (parseActualTimestamp(left)! - parseActualTimestamp(right)!) || (left < right ? -1 : left > right ? 1 : 0))[0];
      const laboratoryNames = stableTextList([
        ...labRequests.map((labRequest) => labRequest.laboratoryName),
        ...samples.filter((sample) => sample.disposition === 'LAB' && !labSampleIds.has(sample.id)).map((sample) => sample.laboratoryName),
      ]);
      const labSenderUnits = stableTextList(labRequests.map((labRequest) => labRequest.senderUnit));
      const cells = {
        requestCode: request.requestCode,
        registrationNumber: metadata.registrationNumber,
        receivedAt: metadata.receivedAt,
        status: request.status,
        currentStepLabel: getPgdStatusLabel(request.status),
        currentStationLabel: getPgdOperationalStation(request.status).title,
        intakeChannel: request.intakeChannel,
        customerName: request.customerSnapshot.name,
        customerTaxId: request.customerSnapshot.taxId,
        customerAddress: request.customerSnapshot.address,
        customerContact: request.customerSnapshot.contactPerson,
        customerPhone: request.customerSnapshot.phone,
        customerEmail: request.customerSnapshot.email,
        requesterName: request.requester.name,
        requesterAddress: request.requester.address,
        requesterContact: request.requester.contactPerson,
        requesterPhone: request.requester.phone,
        requesterEmail: request.requester.email,
        productGroup: request.productGroup,
        pgdGroupCode: request.pgdGroupCode ?? getPgdGroupCodeForCatalogItem(request.catalogItemId),
        catalogItemId: request.catalogItemId,
        productName: request.productName,
        productCode: request.productCode,
        brand: request.brand,
        productForm: details.productForm,
        productGrade: details.grade,
        productDimensions: details.dimensions,
        productStandard: details.productStandard,
        origin: details.origin ?? details.countryOfOrigin,
        manufacturer: details.manufacturer,
        manufacturerLotCode: details.manufacturerLotCode,
        importer: details.importer,
        hsCode: details.hsCode,
        steelLotSize: details.steelLotSize,
        steelSameGradeMultiProduct: details.steelSameGradeMultiProduct,
        machineType: details.machinery?.machineType,
        machineModel: details.machinery?.model,
        machineSerialNumber: details.machinery?.serialNumber,
        manufacturingYear: details.machinery?.manufacturingYear,
        coalType: details.coal?.coalType,
        coalSource: details.coal?.source,
        calorificValue: details.coal?.calorificValue,
        quantity: request.quantity,
        unit: request.unit,
        weight: request.weight,
        weightUnit: request.weightUnit,
        lotCode: request.lotCode,
        transportName: request.transportName,
        inspectionScope: request.inspectionScope,
        inspectionLocation: request.inspectionLocation,
        inspectionScheduledAt: request.inspectionScheduledAt,
        standards: request.standards.join('; '),
        method: request.method,
        assessmentMethod: request.assessmentMethod,
        priority: request.priority,
        urgentReason: request.urgentReason,
        invoiceStatus: request.invoiceStatus,
        invoiceNumber: request.invoiceNumber,
        pricingBasis: request.pricingSnapshot?.basis,
        pricingNote: request.pricingSnapshot?.note,
        targetDate: request.targetDate,
        ownerUsername: request.ownerUsername,
        ownerAssignedAt: request.ownerAssignedAt,
        assignmentStatus: input.assignments.find((assignment) => assignment.requestId === request.id)?.status,
        sampleCount: samples.length,
        sampleQuantity: samples.reduce((total, sample) => total + sample.quantity, 0),
        sampledAt: firstSample?.sampledAt,
        lastSampledAt: lastSample?.sampledAt,
        sampledBy: stableTextList(samples.map((sample) => sample.sampledByUsername)),
        labSampleCount,
        retainedSampleCount,
        labRequestCount: labRequests.length,
        laboratoryNames,
        labSenderUnits,
        labHandoverAt,
        labResultCount: labResults.length,
        latestLabReportNumber: latestLabResult?.reportNumber,
        latestLabReceivedAt: latestLabResult?.receivedAt,
        latestLabAcceptedAt: latestLabResult?.acceptedAt,
        reportCount: reports.length,
        latestReportNumber: latestReport?.reportNumber,
        latestReportStatus: latestReport?.status,
        latestReportDate: latestReport?.updatedAt || latestReport?.createdAt,
        decisionNumber: text(latestDecision?.cellValues.decisionNumber),
        decisionDate: text(latestDecision?.cellValues.decisionDate),
        certificateNumber: latestCertificate?.documentNumber,
        certificateSignedAt: latestCertificate?.signedAt,
        certificateReturnedAt: latestCertificate?.returnedAt,
        contractNumber: firstDocumentNumber(request, 'CONTRACT'),
        invoiceDocumentNumber: firstDocumentNumber(request, 'INVOICE'),
        packingListNumber: firstDocumentNumber(request, 'PACKING_LIST'),
        billOfLadingNumber: firstDocumentNumber(request, 'BILL_OF_LADING'),
        customsDeclarationNumber: firstDocumentNumber(request, 'CUSTOMS_DECLARATION'),
        certificateOfOriginNumber: firstDocumentNumber(request, 'CERTIFICATE_OF_ORIGIN'),
        documentCount: request.documentPointers.length,
        checklistItemCount: checklist.length,
        checklistMissingCount: checklist.filter((item) => item.status === 'MISSING').length,
        requiredDocumentCount: requiredChecklist.length,
        satisfiedRequiredDocumentCount,
        missingRequiredCount,
        completionPercent: requiredChecklist.length === 0 ? 100 : Math.round((satisfiedRequiredDocumentCount / requiredChecklist.length) * 100),
        completionLabel: missingRequiredCount === 0 ? 'Đủ hồ sơ' : 'Còn thiếu',
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        technicalDossierNote: metadata.technicalDossierNote,
        deficiencyNote: metadata.deficiencyNote,
        returnedPackageNote: metadata.returnedPackageNote,
        courierName: metadata.courierName,
        note: request.note,
      };

      return {
        id: request.id,
        cells,
        searchText: Object.values(cells).map(text).join(' '),
      };
    });
}

export type PgdSummaryCompletionFilter = 'ALL' | 'COMPLETE' | 'INCOMPLETE';
export type PgdSummaryReceivedYearFilter = 'ALL' | 'NO_DATE' | string;

export interface PgdSummaryRegisterFilters {
  completion: PgdSummaryCompletionFilter;
  receivedYear: PgdSummaryReceivedYearFilter;
}

function explicitReceivedYear(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return undefined;
  const date = match[1];
  const midnight = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return undefined;
  if (value.length > 10 && !Number.isFinite(Date.parse(value))) return undefined;
  return date.slice(0, 4);
}

export function getPgdSummaryReceivedAtYears(rows: SummaryGridRow[]): string[] {
  const years = new Set(rows.map((row) => explicitReceivedYear(row.cells.receivedAt)).filter((year): year is string => Boolean(year)));
  return [...years].sort((left, right) => Number(right) - Number(left));
}

export function filterPgdSummaryRegisterRows(rows: SummaryGridRow[], filters: PgdSummaryRegisterFilters): SummaryGridRow[] {
  return rows.filter((row) => {
    const missingRequiredCount = Number(row.cells.missingRequiredCount) || 0;
    const completionMatches = filters.completion === 'ALL'
      || (filters.completion === 'COMPLETE' && missingRequiredCount === 0)
      || (filters.completion === 'INCOMPLETE' && missingRequiredCount > 0);
    if (!completionMatches) return false;

    const receivedYear = explicitReceivedYear(row.cells.receivedAt);
    if (filters.receivedYear === 'ALL') return true;
    if (filters.receivedYear === 'NO_DATE') return !receivedYear;
    return receivedYear === filters.receivedYear;
  });
}
function withNumber(value: string, field: string): number {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error(`${field} phải là số hợp lệ.`);
  return parsed;
}

function withOptionalNumber(value: string, field: string): number | undefined {
  if (!value.trim()) return undefined;
  return withNumber(value, field);
}

function withStandards(value: string): string[] {
  return value.split(/[;\n,]/).map((item) => item.trim()).filter(Boolean);
}

function withRegistryDocumentPatch(request: PgdInspectionRequest, kind: string, value: string) {
  const metadata = request.registryMetadata ?? {};
  const documents = [...(metadata.documents ?? [])];
  const index = documents.findIndex((document) => document.kind === kind);
  if (index >= 0) {
    documents[index] = { ...documents[index], number: value || undefined };
  } else if (value.trim()) {
    documents.push({ kind: kind as never, number: value.trim() });
  }
  return { registryMetadata: { ...metadata, documents } };
}

const customerFieldMap = {
  customerName: 'name',
  customerTaxId: 'taxId',
  customerAddress: 'address',
  customerContact: 'contactPerson',
  customerPhone: 'phone',
  customerEmail: 'email',
} as const;

const requesterFieldMap = {
  requesterName: 'name',
  requesterAddress: 'address',
  requesterContact: 'contactPerson',
  requesterPhone: 'phone',
  requesterEmail: 'email',
} as const;

const productDetailFieldMap = {
  productForm: 'productForm',
  productGrade: 'grade',
  productDimensions: 'dimensions',
  productStandard: 'productStandard',
  origin: 'origin',
  manufacturer: 'manufacturer',
  manufacturerLotCode: 'manufacturerLotCode',
  importer: 'importer',
  hsCode: 'hsCode',
} as const;

const registryDocumentFieldMap = {
  contractNumber: 'CONTRACT',
  invoiceDocumentNumber: 'INVOICE',
  packingListNumber: 'PACKING_LIST',
  billOfLadingNumber: 'BILL_OF_LADING',
  customsDeclarationNumber: 'CUSTOMS_DECLARATION',
  certificateOfOriginNumber: 'CERTIFICATE_OF_ORIGIN',
} as const;

export function getPgdSummaryCellUpdate(
  request: PgdInspectionRequest,
  columnId: string,
  rawValue: string,
): PgdSummaryCellUpdate {
  const value = rawValue.trim();
  if (columnId === 'ownerUsername') return { kind: 'owner', ownerUsername: value || undefined };

  const customerField = customerFieldMap[columnId as keyof typeof customerFieldMap];
  if (customerField) return { kind: 'request', patch: { customerSnapshot: { ...request.customerSnapshot, [customerField]: value } } };

  const requesterField = requesterFieldMap[columnId as keyof typeof requesterFieldMap];
  if (requesterField) return { kind: 'request', patch: { requester: { ...request.requester, [requesterField]: value } } };

  const productDetailField = productDetailFieldMap[columnId as keyof typeof productDetailFieldMap];
  if (productDetailField) return { kind: 'request', patch: { productDetails: { ...(request.productDetails ?? {}), [productDetailField]: value } } };

  const registryDocumentKind = registryDocumentFieldMap[columnId as keyof typeof registryDocumentFieldMap];
  if (registryDocumentKind) return { kind: 'request', patch: withRegistryDocumentPatch(request, registryDocumentKind, value) };

  switch (columnId) {
    case 'intakeChannel':
      return { kind: 'request', patch: { intakeChannel: value } };
    case 'registrationNumber':
      return { kind: 'request', patch: { registryMetadata: { ...(request.registryMetadata ?? {}), registrationNumber: value || undefined } } };
    case 'receivedAt':
      return { kind: 'request', patch: { registryMetadata: { ...(request.registryMetadata ?? {}), receivedAt: value || undefined } } };
    case 'productName':
    case 'productCode':
    case 'brand':
    case 'unit':
    case 'weightUnit':
    case 'lotCode':
    case 'transportName':
    case 'inspectionScope':
    case 'inspectionLocation':
    case 'inspectionScheduledAt':
    case 'method':
    case 'targetDate':
    case 'note':
      return { kind: 'request', patch: { [columnId]: value || undefined } };
    case 'quantity':
      return { kind: 'request', patch: { quantity: withNumber(value, 'Số lượng') } };
    case 'weight':
      return { kind: 'request', patch: { weight: withOptionalNumber(value, 'Khối lượng') } };
    case 'standards':
      return { kind: 'request', patch: { standards: withStandards(rawValue) } };
    case 'assessmentMethod':
      return { kind: 'request', patch: { assessmentMethod: value || undefined } };
    case 'deficiencyNote':
    case 'returnedPackageNote':
    case 'technicalDossierNote':
    case 'courierName':
      return { kind: 'request', patch: { registryMetadata: { ...(request.registryMetadata ?? {}), [columnId]: value || undefined } } };
    default:
      throw new Error(`Cell ${columnId} không được phép chỉnh sửa trong Sổ tổng hợp PGD.`);
  }
}
