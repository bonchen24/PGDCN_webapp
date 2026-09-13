import type {
  PgdInspectionCertificate,
  PgdInspectionAssignment,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from './pgdDomain';
import { getPgdGroupCodeForCatalogItem } from './pgdDomain';
import type { SummaryGridRow } from './summaryRegister';

export interface PgdSummaryRegisterInput {
  requests: PgdInspectionRequest[];
  assignments: PgdInspectionAssignment[];
  samples: PgdSample[];
  labRequests: PgdLabRequest[];
  labResults: PgdLabResult[];
  reports: PgdInspectionReport[];
  certificates: PgdInspectionCertificate[];
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

export function buildPgdSummaryRegisterRows(input: PgdSummaryRegisterInput): SummaryGridRow[] {
  return input.requests
    .filter((request) => !request.deletedAt)
    .map((request) => {
      const samples = requestRelated(input.samples, request.id);
      const labRequests = requestRelated(input.labRequests, request.id);
      const labResults = requestRelated(input.labResults, request.id);
      const reports = requestRelated(input.reports, request.id);
      const certificates = requestRelated(input.certificates, request.id);
      const details = request.productDetails ?? {};
      const metadata = request.registryMetadata ?? {};
      const cells = {
        requestCode: request.requestCode,
        registrationNumber: metadata.registrationNumber,
        receivedAt: metadata.receivedAt,
        status: request.status,
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
        labRequestCount: labRequests.length,
        labResultCount: labResults.length,
        latestLabReportNumber: labResults.at(-1)?.reportNumber,
        reportCount: reports.length,
        certificateNumber: certificates.at(-1)?.documentNumber,
        contractNumber: firstDocumentNumber(request, 'CONTRACT'),
        invoiceDocumentNumber: firstDocumentNumber(request, 'INVOICE'),
        packingListNumber: firstDocumentNumber(request, 'PACKING_LIST'),
        billOfLadingNumber: firstDocumentNumber(request, 'BILL_OF_LADING'),
        customsDeclarationNumber: firstDocumentNumber(request, 'CUSTOMS_DECLARATION'),
        certificateOfOriginNumber: firstDocumentNumber(request, 'CERTIFICATE_OF_ORIGIN'),
        documentCount: request.documentPointers.length,
        checklistItemCount: request.dossierChecklist?.length ?? 0,
        checklistMissingCount: request.dossierChecklist?.filter((item) => item.status === 'MISSING').length ?? 0,
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
