// Author: Codex
// OS support: Node
// Description: Canonical PCN dossier context plus bìa/mục lục DOCX and PDF renderers

import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import PizZip from 'pizzip';
import { Resvg } from '@resvg/resvg-js';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from './formatter.ts';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnSampleHandoverDetails,
  PcnSampleLot,
  PcnSampleRoute,
  PcnOperationalForms,
} from '../types.ts';
export { getPcnDocumentSourceUpdatedAt } from './pcnDocumentFreshness.ts';

export const PCN_DOCUMENT_IDENTITY = 'IEMM • TVCI · PHÒNG CHỨNG NHẬN PCN';

export interface PcnDocumentChecklistContext {
  requirementId: string;
  fieldCode: string;
  name: string;
  required: boolean;
  status: PcnDossierDocument['status'];
  versionCount: number;
}

export interface PcnDocumentAttachmentContext {
  kind: PcnDossierAttachment['kind'];
  fileName: string;
  sourceRelativePath: string;
  assetId: string;
  byteSize: number;
  sha256: string;
}

export interface PcnDossierDocumentContext {
  dossierId: string;
  dossierCode: string;
  proposalCode: string;
  proposalChannel?: CertificationProposal['channel'];
  proposalReceivedAt?: string;
  customerName: string;
  customerAddress: string;
  customerTaxId: string;
  customerContactPerson: string;
  customerPhone: string;
  customerEmail: string;
  productName: string;
  productType: string;
  specifications: string;
  warehouseAddress: string;
  model: string;
  brand: string;
  manufacturer: string;
  manufacturerAddress: string;
  quantity: number;
  method: CertificationDossier['method'];
  status: CertificationDossier['status'];
  ownerUsername?: string;
  evaluatorUsername?: string;
  reviewerUsername?: string;
  targetDate?: string;
  evaluationAt?: string;
  operationalForms?: PcnOperationalForms;
  fieldNames: string[];
  checklist: PcnDocumentChecklistContext[];
  attachments: PcnDocumentAttachmentContext[];
  sampleLots?: PcnSampleLotDocumentContext[];
  sampleRoutes?: PcnSampleRouteDocumentContext[];
  sampleHandover?: PcnSampleHandoverDocumentContext;
  labRequest?: PcnLabRequestDocumentContext;
  contextHash: string;
}

export interface PcnSampleLotDocumentContext {
  lotId: string;
  lotCode: string;
  sampleName: string;
  model: string;
  brand: string;
  quantity: number;
  unit: string;
  status: PcnSampleLot['status'];
  currentLocation: string;
  receivedAt: string;
  updatedAt: string;
}

export interface PcnSampleRouteDocumentContext {
  routeId: string;
  lotId: string;
  labCode: PcnSampleRoute['labCode'];
  labName: string;
  status: PcnSampleRoute['status'];
  labRequestId: string;
  sentAt: string;
  receivedAt: string;
  resultReturnedAt: string;
  returnedAt: string;
  updatedAt: string;
}

export interface PcnSampleHandoverDocumentContext {
  lotId: string;
  lotCode: string;
  sampleName: string;
  model: string;
  brand: string;
  quantity: number;
  unit: string;
  lotStatus: PcnSampleLot['status'];
  currentLocation: string;
  lotReceivedAt: string;
  routeId: string;
  labCode: PcnSampleRoute['labCode'];
  labName: string;
  routeStatus: PcnSampleRoute['status'];
  labRequestId: string;
  pycNumber: string;
  pycStatus: OutboundLabRequest['status'] | '';
  requestedAt: string;
  sentAt: string;
  routeReceivedAt: string;
  resultReturnedAt: string;
  returnedAt: string;
  criteria: string;
  note: string;
  handoverNote: string;
  issueDescription: string;
  senderName?: string;
  senderUnit?: string;
  receiverName?: string;
  receiverUnit?: string;
  handoverAt?: string;
  receivedAt?: string;
  location?: string;
  vehicle?: string;
  driver?: string;
  handoverQuantity?: number;
  sampleCodes?: string[];
}

export interface PcnLabRequestDocumentContext {
  requestId: string;
  pycNumber: string;
  fieldCode: OutboundLabRequest['fieldCode'];
  laboratoryName: string;
  status: OutboundLabRequest['status'];
  requestedAt: string;
  targetDate: string;
  criteria: string;
  handoverAt: string;
  receivedAt: string;
  handoverNote: string;
  issueDescription: string;
  updatedAt: string;
  sampleLotId: string;
  lotCode: string;
  sampleName: string;
  model: string;
  brand: string;
  quantity: number;
  unit: string;
  currentLocation: string;
  sampleLotUpdatedAt: string;
  sampleRouteId: string;
  routeLabCode: PcnSampleRoute['labCode'] | '';
  routeStatus: PcnSampleRoute['status'] | '';
  routeUpdatedAt: string;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function xmlEscape(value: unknown): string {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, Math.max(0, length - 1))}…` : value;
}

function documentDate(value?: string): string {
  return formatDateDdMmYyyy(value) || 'Chưa cập nhật';
}

function documentDateTime(value?: string): string {
  return formatDateTimeDdMmYyyy(value) || 'Chưa cập nhật';
}

export function buildPcnDossierDocumentContext(input: {
  dossier: CertificationDossier;
  proposal: CertificationProposal;
  fields: PcnCertificationField[];
  documents: PcnDossierDocument[];
  documentRequirements: PcnDocumentRequirement[];
  attachments: PcnDossierAttachment[];
  sampleLots?: PcnSampleLot[];
  sampleRoutes?: PcnSampleRoute[];
  labRequests?: OutboundLabRequest[];
  sampleRouteId?: string;
  labRequestId?: string;
}): PcnDossierDocumentContext {
  const { dossier, proposal } = input;
  const customer = dossier.customerSnapshot || proposal.customerSnapshot;
  const documentsByRequirement = new Map(input.documents.filter((item) => item.dossierId === dossier.id).map((item) => [item.requirementId, item]));
  const checklist = input.documentRequirements
    .filter((requirement) => dossier.fieldCodes.includes(requirement.fieldCode))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((requirement) => {
      const document = documentsByRequirement.get(requirement.id);
      return {
        requirementId: requirement.id,
        fieldCode: requirement.fieldCode,
        name: requirement.name,
        required: requirement.required,
        status: document?.status || 'MISSING',
        versionCount: document?.versions?.length || 0,
      };
    });
  const attachments = input.attachments
    .filter((attachment) => !attachment.dossierId || attachment.dossierId === dossier.id)
    .sort((left, right) => left.sourceRelativePath.localeCompare(right.sourceRelativePath) || left.id.localeCompare(right.id))
    .map((attachment) => ({
      kind: attachment.kind,
      fileName: attachment.fileName,
      sourceRelativePath: attachment.sourceRelativePath,
      assetId: attachment.assetId,
      byteSize: attachment.byteSize,
      sha256: attachment.sha256,
    }));
  const dossierLots = (input.sampleLots || [])
    .filter((lot) => lot.dossierId === dossier.id)
    .sort((left, right) => left.lotCode.localeCompare(right.lotCode) || left.id.localeCompare(right.id));
  const dossierLotIds = new Set(dossierLots.map((lot) => lot.id));
  const dossierRoutes = (input.sampleRoutes || [])
    .filter((route) => dossierLotIds.has(route.sampleLotId))
    .sort((left, right) => left.id.localeCompare(right.id));
  const labRequests = (input.labRequests || []).filter((request) => request.dossierId === dossier.id);
  const sampleLots = dossierLots.map((lot) => ({
    lotId: lot.id,
    lotCode: clean(lot.lotCode),
    sampleName: clean(lot.sampleName),
    model: clean(lot.model),
    brand: clean(lot.brand),
    quantity: Number.isFinite(Number(lot.quantity)) ? Number(lot.quantity) : 0,
    unit: clean(lot.unit),
    status: lot.status,
    currentLocation: clean(lot.currentLocation),
    receivedAt: clean(lot.receivedAt),
    updatedAt: clean(lot.updatedAt),
  }));
  const sampleRoutes = dossierRoutes.map((route) => ({
    routeId: route.id,
    lotId: route.sampleLotId,
    labCode: route.labCode,
    labName: clean(route.labName),
    status: route.status,
    labRequestId: clean(route.labRequestId),
    sentAt: clean(route.sentAt),
    receivedAt: clean(route.receivedAt),
    resultReturnedAt: clean(route.resultReturnedAt),
    returnedAt: clean(route.returnedAt),
    updatedAt: clean(route.updatedAt),
  }));
  let sampleHandover: PcnSampleHandoverDocumentContext | undefined;
  if (clean(input.sampleRouteId)) {
    const route = dossierRoutes.find((item) => item.id === clean(input.sampleRouteId));
    if (!route) throw new Error('Không tìm thấy tuyến mẫu thuộc hồ sơ để sinh biên bản giao nhận.');
    const lot = dossierLots.find((item) => item.id === route.sampleLotId);
    if (!lot) throw new Error('Không tìm thấy lô mẫu thuộc tuyến đã chọn.');
    const labRequest = labRequests.find((request) => request.id === route.labRequestId || request.sampleRouteId === route.id);
    const handoverDetails: PcnSampleHandoverDetails | undefined = labRequest?.handoverDetails;
    sampleHandover = {
      lotId: lot.id,
      lotCode: clean(lot.lotCode),
      sampleName: clean(lot.sampleName),
      model: clean(lot.model),
      brand: clean(lot.brand),
      quantity: Number.isFinite(Number(lot.quantity)) ? Number(lot.quantity) : 0,
      unit: clean(lot.unit),
      lotStatus: lot.status,
      currentLocation: clean(lot.currentLocation),
      lotReceivedAt: clean(lot.receivedAt),
      routeId: route.id,
      labCode: route.labCode,
      labName: clean(route.labName),
      routeStatus: route.status,
      labRequestId: clean(route.labRequestId || labRequest?.id),
      pycNumber: clean(labRequest?.pycNumber),
      pycStatus: labRequest?.status || '',
      requestedAt: clean(labRequest?.requestedAt),
      sentAt: clean(route.sentAt),
      routeReceivedAt: clean(route.receivedAt),
      resultReturnedAt: clean(route.resultReturnedAt),
      returnedAt: clean(route.returnedAt),
      criteria: clean(labRequest?.criteria),
      note: clean(route.note),
      handoverNote: clean(labRequest?.handoverNote),
      issueDescription: clean(labRequest?.sampleIssue?.description),
      ...(clean(handoverDetails?.senderName) ? { senderName: clean(handoverDetails?.senderName) } : {}),
      ...(clean(handoverDetails?.senderUnit) ? { senderUnit: clean(handoverDetails?.senderUnit) } : {}),
      ...(clean(handoverDetails?.receiverName) ? { receiverName: clean(handoverDetails?.receiverName) } : {}),
      ...(clean(handoverDetails?.receiverUnit) ? { receiverUnit: clean(handoverDetails?.receiverUnit) } : {}),
      ...(clean(handoverDetails?.handoverAt) ? { handoverAt: clean(handoverDetails?.handoverAt) } : {}),
      ...(clean(handoverDetails?.receivedAt) ? { receivedAt: clean(handoverDetails?.receivedAt) } : {}),
      ...(clean(handoverDetails?.location) ? { location: clean(handoverDetails?.location) } : {}),
      ...(clean(handoverDetails?.vehicle) ? { vehicle: clean(handoverDetails?.vehicle) } : {}),
      ...(clean(handoverDetails?.driver) ? { driver: clean(handoverDetails?.driver) } : {}),
      ...(handoverDetails && Number.isFinite(Number(handoverDetails.quantity)) ? { handoverQuantity: Number(handoverDetails.quantity) } : {}),
      ...(handoverDetails?.sampleCodes?.length ? { sampleCodes: handoverDetails.sampleCodes.map(clean).filter(Boolean) } : {}),
    };
  }
  let selectedLabRequest: PcnLabRequestDocumentContext | undefined;
  if (clean(input.labRequestId)) {
    const request = labRequests.find((item) => item.id === clean(input.labRequestId));
    if (!request) throw new Error('Không tìm thấy PYC thuộc hồ sơ để sinh phiếu yêu cầu thử nghiệm.');
    const lot = request.sampleLotId ? dossierLots.find((item) => item.id === request.sampleLotId) : undefined;
    if (request.sampleLotId && !lot) throw new Error('PYC đang trỏ tới lô mẫu không thuộc hồ sơ.');
    const route = request.sampleRouteId
      ? dossierRoutes.find((item) => item.id === request.sampleRouteId)
      : dossierRoutes.find((item) => item.labRequestId === request.id);
    if (request.sampleRouteId && !route) throw new Error('PYC đang trỏ tới tuyến mẫu không thuộc hồ sơ.');
    if (route && lot && route.sampleLotId !== lot.id) throw new Error('Liên kết PYC, lô mẫu và tuyến mẫu không nhất quán.');
    if (route && request.sampleLotId && route.sampleLotId !== request.sampleLotId) throw new Error('Liên kết PYC và tuyến mẫu không nhất quán.');
    const resolvedLot = lot || (route ? dossierLots.find((item) => item.id === route.sampleLotId) : undefined);
    selectedLabRequest = {
      requestId: request.id,
      pycNumber: clean(request.pycNumber),
      fieldCode: request.fieldCode,
      laboratoryName: clean(request.laboratoryName),
      status: request.status,
      requestedAt: clean(request.requestedAt),
      targetDate: clean(request.targetDate),
      criteria: clean(request.criteria),
      handoverAt: clean(request.handoverAt),
      receivedAt: clean(request.receivedAt),
      handoverNote: clean(request.handoverNote),
      issueDescription: clean(request.sampleIssue?.description),
      updatedAt: clean(request.updatedAt),
      sampleLotId: clean(resolvedLot?.id || request.sampleLotId),
      lotCode: clean(resolvedLot?.lotCode),
      sampleName: clean(resolvedLot?.sampleName),
      model: clean(resolvedLot?.model),
      brand: clean(resolvedLot?.brand),
      quantity: Number.isFinite(Number(resolvedLot?.quantity)) ? Number(resolvedLot?.quantity) : 0,
      unit: clean(resolvedLot?.unit),
      currentLocation: clean(resolvedLot?.currentLocation),
      sampleLotUpdatedAt: clean(resolvedLot?.updatedAt),
      sampleRouteId: clean(route?.id || request.sampleRouteId),
      routeLabCode: route?.labCode || '',
      routeStatus: route?.status || '',
      routeUpdatedAt: clean(route?.updatedAt),
    };
  }
  const base = {
    dossierId: dossier.id,
    dossierCode: dossier.dossierCode,
    proposalCode: proposal.proposalCode,
    proposalChannel: proposal.channel,
    proposalReceivedAt: clean(proposal.receivedAt),
    customerName: clean(customer?.name),
    customerAddress: clean(customer?.address),
    customerTaxId: clean(customer?.taxId),
    customerContactPerson: clean(customer?.contactPerson),
    customerPhone: clean(customer?.phone),
    customerEmail: clean(customer?.email),
    productName: clean(proposal.productName),
    productType: clean(proposal.productType),
    specifications: clean(proposal.specifications),
    warehouseAddress: clean(proposal.warehouseAddress),
    model: clean(proposal.model),
    brand: clean(proposal.brand),
    manufacturer: clean(proposal.manufacturer),
    manufacturerAddress: clean(proposal.manufacturerAddress),
    quantity: Number.isFinite(Number(proposal.quantity)) ? Number(proposal.quantity) : 0,
    method: dossier.method,
    status: dossier.status,
    ...(clean(dossier.ownerUsername) ? { ownerUsername: clean(dossier.ownerUsername) } : {}),
    ...(clean(dossier.evaluatorUsername) ? { evaluatorUsername: clean(dossier.evaluatorUsername) } : {}),
    ...(clean(dossier.reviewerUsername) ? { reviewerUsername: clean(dossier.reviewerUsername) } : {}),
    ...(clean(dossier.targetDate) ? { targetDate: clean(dossier.targetDate) } : {}),
    ...(clean(dossier.evaluationAt) ? { evaluationAt: clean(dossier.evaluationAt) } : {}),
    ...(dossier.operationalForms ? { operationalForms: dossier.operationalForms } : {}),
    fieldNames: dossier.fieldCodes.map((code) => input.fields.find((field) => field.code === code)?.name || code),
    checklist,
    attachments,
    sampleLots,
    sampleRoutes,
    ...(sampleHandover ? { sampleHandover } : {}),
    ...(selectedLabRequest ? { labRequest: selectedLabRequest } : {}),
  };
  const contextHash = createHash('sha256').update(JSON.stringify(base)).digest('hex');
  return { ...base, contextHash };
}

function textRun(value: unknown, bold = false): string {
  return `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r>`;
}

function paragraph(value: unknown, bold = false, align?: 'center' | 'right'): string {
  const alignment = align ? `<w:jc w:val="${align}"/>` : '';
  const displayValue = value === 'TRUNG TÂM TVCI' ? PCN_DOCUMENT_IDENTITY : value;
  return `<w:p><w:pPr>${alignment}</w:pPr>${textRun(displayValue, bold)}</w:p>`;
}

function tableCell(value: unknown, width: number, bold = false): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph(value, bold)}</w:tc>`;
}

function table(rows: Array<Array<{ value: string; bold?: boolean }>>): string {
  const widths = rows[0]?.length === 3 ? [1700, 3000, 4300] : [2400, 6600];
  return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${rows.map((row) => `<w:tr>${row.map((cell, index) => tableCell(cell.value, widths[index] || 3000, cell.bold)).join('')}</w:tr>`).join('')}</w:tbl>`;
}

export function buildPcnDossierCoverDocx(context: PcnDossierDocumentContext): Buffer {
  const zip = new PizZip();
  const metadataRows = [
    [{ value: 'Mã hồ sơ', bold: true }, { value: context.dossierCode }],
    [{ value: 'Mã Đề nghị', bold: true }, { value: context.proposalCode }],
    [{ value: 'Khách hàng', bold: true }, { value: context.customerName || 'Chưa cập nhật' }],
    [{ value: 'Địa chỉ', bold: true }, { value: context.customerAddress || 'Chưa cập nhật' }],
    [{ value: 'Sản phẩm', bold: true }, { value: context.productName || 'Chưa cập nhật' }],
    [{ value: 'Model / Nhãn hiệu', bold: true }, { value: [context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Phương thức', bold: true }, { value: context.method.replace('METHOD_', 'Phương thức ') }],
    [{ value: 'Chủ hồ sơ', bold: true }, { value: context.ownerUsername || 'Chưa phân công' }],
    [{ value: 'Trạng thái', bold: true }, { value: context.status }],
  ];
  const checklistRows = [
    [{ value: 'Tài liệu', bold: true }, { value: 'Trạng thái', bold: true }, { value: 'Phiên bản', bold: true }],
    ...context.checklist.map((item) => [{ value: item.name }, { value: item.status }, { value: String(item.versionCount) }]),
  ];
  const attachmentRows = [
    [{ value: 'Nhóm', bold: true }, { value: 'Tên tệp', bold: true }, { value: 'Đường dẫn nguồn', bold: true }],
    ...context.attachments.map((item) => [{ value: item.kind }, { value: item.fileName }, { value: item.sourceRelativePath }]),
  ];
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('HỒ SƠ CHỨNG NHẬN', true, 'center'),
    paragraph('Bìa và mục lục tệp hồ sơ', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(metadataRows),
    paragraph('MỤC LỤC TỆP HỒ SƠ', true),
    table(checklistRows),
    paragraph('DANH SÁCH TỆP ĐÍNH KÈM', true),
    table(attachmentRows),
    paragraph('Tài liệu này được sinh từ dữ liệu PCN hiện tại; không thay thế GCN/QĐ chính thức.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr>',
  ].join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}

function createMinimalPcnDocx(body: string): Buffer {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}

export function buildPcnProposalSummaryDocx(context: PcnDossierDocumentContext): Buffer {
  const metadataRows = [
    [{ value: 'Mã Đề nghị', bold: true }, { value: context.proposalCode }],
    [{ value: 'Mã hồ sơ', bold: true }, { value: context.dossierCode }],
    [{ value: 'Khách hàng', bold: true }, { value: context.customerName || 'Chưa cập nhật' }],
    [{ value: 'Địa chỉ', bold: true }, { value: context.customerAddress || 'Chưa cập nhật' }],
    [{ value: 'MST / Liên hệ', bold: true }, { value: [context.customerTaxId, context.customerContactPerson, context.customerPhone].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Sản phẩm', bold: true }, { value: context.productName || 'Chưa cập nhật' }],
    [{ value: 'Loại / Thông số', bold: true }, { value: [context.productType, context.specifications].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Model', bold: true }, { value: context.model || 'Chưa cập nhật' }],
    [{ value: 'Nhãn hiệu', bold: true }, { value: context.brand || 'Chưa cập nhật' }],
    [{ value: 'Nhà sản xuất', bold: true }, { value: context.manufacturer || 'Chưa cập nhật' }],
    [{ value: 'Địa chỉ nhà sản xuất', bold: true }, { value: context.manufacturerAddress || 'Chưa cập nhật' }],
    [{ value: 'Số lượng / Kho', bold: true }, { value: `${context.quantity || 0} / ${context.warehouseAddress || 'Chưa cập nhật'}` }],
    [{ value: 'Phương thức', bold: true }, { value: context.method.replace('METHOD_', 'Phương thức ') }],
    [{ value: 'Lĩnh vực', bold: true }, { value: context.fieldNames.join(', ') || 'Chưa cập nhật' }],
    [{ value: 'Trạng thái hồ sơ', bold: true }, { value: context.status }],
  ];
  const missingChecklist = context.checklist.filter((item) => item.required && item.status !== 'PRESENT').map((item) => item.name).join(', ') || 'Không còn tài liệu bắt buộc thiếu';
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('PHIẾU TÓM TẮT ĐỀ NGHỊ', true, 'center'),
    paragraph('Bản nháp nội bộ để kiểm tra dữ liệu liền mạch', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(metadataRows),
    paragraph('TÀI LIỆU BẮT BUỘC CÒN THIẾU', true),
    paragraph(missingChecklist),
    paragraph('Ghi chú: Phiếu này chỉ là bản nháp quản lý nội bộ, không thay thế Đề nghị đã được ký hoặc GCN/QĐ chính thức.'),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

function svgText(value: string, x: number, y: number, size: number, weight = 400, color = '#1e293b'): string {
  return `<text x="${x}" y="${y}" font-family="Arial, Liberation Sans, sans-serif" font-size="${size}px" font-weight="${weight}" fill="${color}">${xmlEscape(value)}</text>`;
}

function applyPcnSvgIdentity(svg: string): string {
  return svg.replace(/>TRUNG TÂM TVCI<\/text>/g, `>${xmlEscape(PCN_DOCUMENT_IDENTITY)}</text>`);
}

function renderPcnSvg(svg: string): Buffer {
  return new Resvg(applyPcnSvgIdentity(svg)).render().asPng();
}

async function createPcnPdf(title: string): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${PCN_DOCUMENT_IDENTITY} • ${title}`);
  pdf.setAuthor(PCN_DOCUMENT_IDENTITY);
  return pdf;
}

function buildPdfPageSvg(context: PcnDossierDocumentContext, pageRows: Array<{ kind: string; name: string; detail: string }>, pageNumber: number, pageCount: number): string {
  const rows = pageRows.map((row, index) => {
    const y = 360 + index * 35;
    return `${svgText(truncate(`${row.kind} • ${row.name}`, 88), 42, y, 14, 700, '#475569')}${svgText(truncate(row.detail, 96), 42, y + 17, 12, 400, '#64748b')}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('HỒ SƠ CHỨNG NHẬN', 68, 111, 28, 700, '#ffffff')}${svgText(`${context.dossierCode} • ${context.proposalCode}`, 68, 137, 14, 400, '#cbd5e1')}${svgText('BÌA VÀ MỤC LỤC TỆP HỒ SƠ', 42, 195, 23, 700, '#0f172a')}${svgText(`Khách hàng: ${truncate(context.customerName || 'Chưa cập nhật', 60)}`, 42, 230, 15, 400)}${svgText(`Sản phẩm: ${truncate(context.productName || 'Chưa cập nhật', 60)}`, 42, 255, 15, 400)}${svgText(`Trạng thái: ${context.status}`, 42, 280, 15, 400, '#475569')}${svgText('DANH SÁCH MỤC LỤC', 42, 325, 13, 700, '#64748b')}${rows}${svgText(`Context ${context.contextHash.slice(0, 16)} • Trang ${pageNumber}/${pageCount}`, 42, 1068, 12, 400, '#94a3b8')}</svg>`;
}

export async function buildPcnDossierCoverPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const rows = [
    ...context.checklist.map((item) => ({ kind: 'CHECKLIST', name: item.name, detail: `${item.status} / ${item.versionCount} phiên` })),
    ...context.attachments.map((item) => ({ kind: item.kind, name: item.fileName, detail: item.sourceRelativePath })),
  ];
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pdf = await createPcnPdf('HỒ SƠ CHỨNG NHẬN');
  for (let index = 0; index < pageCount; index += 1) {
    const pageRows = rows.slice(index * pageSize, (index + 1) * pageSize);
    const png = renderPcnSvg(buildPdfPageSvg(context, pageRows, index + 1, pageCount));
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export async function buildPcnProposalSummaryPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const rows = [
    ['Mã Đề nghị', context.proposalCode],
    ['Mã hồ sơ', context.dossierCode],
    ['Khách hàng', context.customerName || 'Chưa cập nhật'],
    ['Địa chỉ', context.customerAddress || 'Chưa cập nhật'],
    ['MST / Liên hệ', [context.customerTaxId, context.customerContactPerson, context.customerPhone].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Sản phẩm', context.productName || 'Chưa cập nhật'],
    ['Loại / Thông số', [context.productType, context.specifications].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Model / Nhãn hiệu', [context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Nhà sản xuất', context.manufacturer || 'Chưa cập nhật'],
    ['Địa chỉ nhà sản xuất', context.manufacturerAddress || 'Chưa cập nhật'],
    ['Số lượng / Kho', `${context.quantity || 0} / ${context.warehouseAddress || 'Chưa cập nhật'}`],
    ['Phương thức', context.method.replace('METHOD_', 'Phương thức ')],
    ['Lĩnh vực', context.fieldNames.join(', ') || 'Chưa cập nhật'],
    ['Trạng thái', context.status],
  ];
  const missingChecklist = context.checklist.filter((item) => item.required && item.status !== 'PRESENT').map((item) => item.name).join(', ') || 'Không còn tài liệu bắt buộc thiếu';
  const rowSvg = rows.map(([label, value], index) => {
    const y = 300 + index * 32;
    return `${svgText(label, 42, y, 14, 700, '#475569')}${svgText(truncate(value, 78), 230, y, 14)}<line x1="42" y1="${y + 12}" x2="752" y2="${y + 12}" stroke="#e2e8f0"/>`;
  }).join('');
  const warningY = 300 + rows.length * 32 + 32;
  const disclaimerY = warningY + 132;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('PHIẾU TÓM TẮT ĐỀ NGHỊ', 68, 111, 28, 700, '#ffffff')}${svgText(`${context.proposalCode} • ${context.dossierCode}`, 68, 137, 14, 400, '#cbd5e1')}${svgText('BẢN NHÁP NỘI BỘ', 42, 195, 23, 700, '#0f172a')}${svgText('Kiểm tra thông tin liền mạch giữa Đề nghị và Hồ sơ', 42, 230, 15, 400, '#475569')}${rowSvg}<rect x="42" y="${warningY}" width="710" height="84" rx="8" fill="#fff7ed" stroke="#fed7aa"/>${svgText('TÀI LIỆU BẮT BUỘC CÒN THIẾU', 62, warningY + 30, 13, 700, '#9a3412')}${svgText(truncate(missingChecklist, 82), 62, warningY + 58, 14, 400, '#7c2d12')}${svgText('Không thay thế Đề nghị đã ký hoặc GCN/QĐ chính thức.', 42, disclaimerY, 13, 400, '#64748b')}${svgText(`Context ${context.contextHash.slice(0, 16)}`, 42, 1068, 12, 400, '#94a3b8')}</svg>`;
  const png = renderPcnSvg(svg);
  const pdf = await createPcnPdf('PHIẾU TÓM TẮT ĐỀ NGHỊ');
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function pcnProposalChannelLabel(channel: CertificationProposal['channel']): string {
  if (channel === 'DIRECT') return 'Trực tiếp';
  if (channel === 'EMAIL') return 'Email';
  if (channel === 'ONLINE_ZALO') return 'Online / Zalo';
  return 'Khác';
}

function pcnProposalFormRows(context: PcnDossierDocumentContext): Array<[string, string]> {
  const rows: PcnOperationalFormRow[] = [
    ['Mã Đề nghị', context.proposalCode],
    ['Mã hồ sơ', context.dossierCode],
    ['Ngày tiếp nhận / Kênh', `${documentDate(context.proposalReceivedAt)} / ${pcnProposalChannelLabel(context.proposalChannel || 'OTHER')}`],
    ['Phương thức chứng nhận', context.method.replace('METHOD_', 'Phương thức ')],
    ['Lĩnh vực / Quy chuẩn', context.fieldNames.join(', ') || 'Chưa cập nhật'],
    ['Tên đơn vị yêu cầu', context.customerName || 'Chưa cập nhật'],
    ['Địa chỉ đơn vị', context.customerAddress || 'Chưa cập nhật'],
    ['Mã số thuế', context.customerTaxId || 'Chưa cập nhật'],
    ['Người liên hệ / Điện thoại', [context.customerContactPerson, context.customerPhone].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Email', context.customerEmail || 'Chưa cập nhật'],
    ['Tên sản phẩm', context.productName || 'Chưa cập nhật'],
    ['Kiểu / Loại sản phẩm', context.productType || 'Chưa cập nhật'],
    ['Model / Nhãn hiệu', [context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Nhà sản xuất', context.manufacturer || 'Chưa cập nhật'],
    ['Địa chỉ nhà sản xuất', context.manufacturerAddress || 'Chưa cập nhật'],
    ['Thông số kỹ thuật', context.specifications || 'Chưa cập nhật'],
    ['Số lượng / Địa chỉ kho', `${context.quantity || 0} / ${context.warehouseAddress || 'Chưa cập nhật'}`],
  ];
  return rows;
}

export function buildPcnProposalFormDocx(context: PcnDossierDocumentContext): Buffer {
  const metadataRows = [
    [{ value: 'Mã Đề nghị', bold: true }, { value: context.proposalCode }],
    [{ value: 'Mã hồ sơ', bold: true }, { value: context.dossierCode }],
    [{ value: 'Ngày tiếp nhận / Kênh', bold: true }, { value: `${documentDate(context.proposalReceivedAt)} / ${pcnProposalChannelLabel(context.proposalChannel || 'OTHER')}` }],
    [{ value: 'Phương thức chứng nhận', bold: true }, { value: context.method.replace('METHOD_', 'Phương thức ') }],
    [{ value: 'Lĩnh vực / Quy chuẩn', bold: true }, { value: context.fieldNames.join(', ') || 'Chưa cập nhật' }],
  ];
  const customerRows = [
    [{ value: 'Tên đơn vị yêu cầu', bold: true }, { value: context.customerName || 'Chưa cập nhật' }],
    [{ value: 'Địa chỉ', bold: true }, { value: context.customerAddress || 'Chưa cập nhật' }],
    [{ value: 'Mã số thuế', bold: true }, { value: context.customerTaxId || 'Chưa cập nhật' }],
    [{ value: 'Người liên hệ / Điện thoại', bold: true }, { value: [context.customerContactPerson, context.customerPhone].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Email', bold: true }, { value: context.customerEmail || 'Chưa cập nhật' }],
  ];
  const productRows = [
    [{ value: 'Tên sản phẩm', bold: true }, { value: context.productName || 'Chưa cập nhật' }],
    [{ value: 'Kiểu / Loại sản phẩm', bold: true }, { value: context.productType || 'Chưa cập nhật' }],
    [{ value: 'Model / Nhãn hiệu', bold: true }, { value: [context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Nhà sản xuất', bold: true }, { value: context.manufacturer || 'Chưa cập nhật' }],
    [{ value: 'Địa chỉ nhà sản xuất', bold: true }, { value: context.manufacturerAddress || 'Chưa cập nhật' }],
    [{ value: 'Thông số kỹ thuật', bold: true }, { value: context.specifications || 'Chưa cập nhật' }],
    [{ value: 'Số lượng / Địa chỉ kho', bold: true }, { value: `${context.quantity || 0} / ${context.warehouseAddress || 'Chưa cập nhật'}` }],
  ];
  const checklistRows = [
    [{ value: 'Tài liệu', bold: true }, { value: 'Bắt buộc', bold: true }, { value: 'Tình trạng', bold: true }],
    ...(context.checklist.length > 0
      ? context.checklist.map((item) => [{ value: item.name }, { value: item.required ? 'Có' : 'Không' }, { value: `${item.status} / ${item.versionCount} phiên` }])
      : [[{ value: 'Chưa có tài liệu trong checklist' }, { value: '—' }, { value: 'MISSING' }]]),
  ];
  const attachmentRows = [
    [{ value: 'Nhóm', bold: true }, { value: 'Tên tệp', bold: true }, { value: 'Đường dẫn nguồn', bold: true }],
    ...(context.attachments.length > 0
      ? context.attachments.map((item) => [{ value: item.kind }, { value: item.fileName }, { value: item.sourceRelativePath }])
      : [[{ value: '—' }, { value: 'Chưa có tệp đính kèm' }, { value: '—' }]]),
  ];
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('ĐỀ NGHỊ CHỨNG NHẬN', true, 'center'),
    paragraph(`(${context.method.replace('METHOD_', 'Phương thức ')})`, false, 'center'),
    paragraph('Bản nháp quản lý nội bộ được sinh từ dữ liệu Đề nghị và Hồ sơ', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    paragraph('THÔNG TIN CHUNG', true),
    table(metadataRows),
    paragraph('I. THÔNG TIN VỀ ĐƠN VỊ YÊU CẦU', true),
    table(customerRows),
    paragraph('II. THÔNG TIN SẢN PHẨM', true),
    table(productRows),
    paragraph('III. HỒ SƠ, TÀI LIỆU KÈM THEO', true),
    table(checklistRows),
    paragraph('Danh sách tệp đính kèm và provenance', false),
    table(attachmentRows),
    paragraph('IV. YÊU CẦU CHỨNG NHẬN', true),
    paragraph(`Kính đề nghị Trung tâm TVCI xem xét thực hiện chứng nhận sản phẩm thuộc ${context.fieldNames.join(', ') || 'lĩnh vực chưa cập nhật'} theo ${context.method.replace('METHOD_', 'Phương thức ')}.`),
    paragraph('CAM KẾT', true),
    paragraph('Đơn vị yêu cầu cam kết các thông tin trên là thông tin được lấy từ hồ sơ hiện tại và sẽ phối hợp cung cấp, bổ sung tài liệu theo yêu cầu của Trung tâm.'),
    paragraph('Người yêu cầu: ________________________________        Ngày: ____/____/________'),
    paragraph('ĐẠI DIỆN ĐƠN VỊ YÊU CẦU', true, 'center'),
    paragraph('(Ký, ghi rõ họ tên và đóng dấu nếu áp dụng)', false, 'center'),
    paragraph('Lưu ý: Đây là bản nháp quản lý nội bộ; không thay thế Đề nghị đã ký, GCN hoặc Quyết định chính thức.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

interface PcnProposalFormPdfRow {
  label: string;
  value?: string;
  section?: boolean;
}

function buildPcnProposalFormPdfPageSvg(context: PcnDossierDocumentContext, rows: PcnProposalFormPdfRow[], pageNumber: number, pageCount: number): string {
  const rowMarkup = rows.map((row, index) => {
    const y = 314 + index * 30;
    if (row.section) return svgText(row.label, 42, y, 13, 700, '#0f766e');
    return `${svgText(row.label, 42, y, 12, 700, '#475569')}${svgText(truncate(row.value || 'Chưa cập nhật', 76), 250, y, 12)}<line x1="42" y1="${y + 9}" x2="752" y2="${y + 9}" stroke="#e2e8f0"/>`;
  }).join('');
  const finalNote = pageNumber === pageCount
    ? `${svgText('CAM KẾT', 42, 314 + rows.length * 30 + 28, 13, 700, '#0f766e')}${svgText('Người yêu cầu: ____________________   Ngày: ____/____/________', 42, 314 + rows.length * 30 + 58, 12, 400, '#475569')}${svgText('Bản nháp quản lý nội bộ; không thay thế Đề nghị đã ký, GCN hoặc Quyết định.', 42, 314 + rows.length * 30 + 92, 11, 400, '#64748b')}`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('ĐỀ NGHỊ CHỨNG NHẬN', 68, 111, 27, 700, '#ffffff')}${svgText(`${context.proposalCode} • ${context.dossierCode}`, 68, 137, 14, 400, '#cbd5e1')}${svgText('BẢN NHÁP NỘI BỘ', 42, 198, 22, 700, '#0f172a')}${svgText(`Phương thức: ${context.method.replace('METHOD_', '')} • Lĩnh vực: ${truncate(context.fieldNames.join(', ') || 'Chưa cập nhật', 54)}`, 42, 230, 13, 400, '#475569')}${rowMarkup}${finalNote}${svgText(`Context ${context.contextHash.slice(0, 16)} • Trang ${pageNumber}/${pageCount}`, 42, 1068, 12, 400, '#94a3b8')}</svg>`;
}

export async function buildPcnProposalFormPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const rows: PcnProposalFormPdfRow[] = [
    { label: 'THÔNG TIN CHUNG', section: true },
    ...pcnProposalFormRows(context).slice(0, 5).map(([label, value]) => ({ label, value })),
    { label: 'I. THÔNG TIN VỀ ĐƠN VỊ YÊU CẦU', section: true },
    ...pcnProposalFormRows(context).slice(5, 10).map(([label, value]) => ({ label, value })),
    { label: 'II. THÔNG TIN SẢN PHẨM', section: true },
    ...pcnProposalFormRows(context).slice(10).map(([label, value]) => ({ label, value })),
    { label: 'III. HỒ SƠ, TÀI LIỆU KÈM THEO', section: true },
    ...context.checklist.map((item) => ({ label: item.name, value: `${item.required ? 'Bắt buộc' : 'Không bắt buộc'} / ${item.status} / ${item.versionCount} phiên` })),
    ...context.attachments.map((item) => ({ label: item.kind, value: `${item.fileName} • ${item.sourceRelativePath}` })),
    ...(context.checklist.length === 0 && context.attachments.length === 0 ? [{ label: 'Tài liệu kèm theo', value: 'Chưa có' }] : []),
    { label: 'IV. YÊU CẦU CHỨNG NHẬN', section: true },
    { label: 'Yêu cầu', value: `Chứng nhận sản phẩm thuộc ${context.fieldNames.join(', ') || 'lĩnh vực chưa cập nhật'} theo ${context.method.replace('METHOD_', 'Phương thức ')}.` },
  ];
  const pageSize = 22;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pdf = await createPcnPdf('ĐỀ NGHỊ CHỨNG NHẬN');
  for (let index = 0; index < pageCount; index += 1) {
    const pageRows = rows.slice(index * pageSize, (index + 1) * pageSize);
    const png = renderPcnSvg(buildPcnProposalFormPdfPageSvg(context, pageRows, index + 1, pageCount));
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

type PcnEvaluationReportPdfRow = { label: string; value: string; section?: boolean };

function pcnEvaluationReportRows(context: PcnDossierDocumentContext): PcnEvaluationReportPdfRow[] {
  const report = context.operationalForms?.evaluationReport;
  const missingRequired = context.checklist
    .filter((item) => item.required && item.status !== 'PRESENT')
    .map((item) => item.name)
    .filter(Boolean);
  return [
    { label: 'THÔNG TIN HỒ SƠ', value: '', section: true },
    { label: 'Mã hồ sơ / Đề nghị', value: `${context.dossierCode} / ${context.proposalCode}` },
    { label: 'Khách hàng', value: context.customerName || 'Chưa cập nhật' },
    { label: 'Sản phẩm', value: [context.productName, context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật' },
    { label: 'Lĩnh vực / Phương thức', value: `${context.fieldNames.join(', ') || 'Chưa cập nhật'} / ${context.method.replace('METHOD_', 'Phương thức ')}` },
    { label: 'Người đánh giá', value: context.evaluatorUsername || 'Chưa phân công' },
    { label: 'Người rà soát', value: context.reviewerUsername || 'Chưa phân công' },
    { label: 'Hạn xử lý / Ngày đánh giá', value: `${documentDate(context.targetDate)} / ${documentDate(context.evaluationAt)}` },
    { label: 'Trạng thái hồ sơ', value: context.status },
    ...(report ? [
      { label: 'Số báo cáo đánh giá', value: report.reportNumber || 'Chưa cập nhật' },
      { label: 'Ngày lập báo cáo', value: documentDate(report.reportedAt) },
      { label: 'Kết quả/nhận xét đánh giá', value: report.findings || 'Chưa cập nhật' },
      { label: 'Kết luận đánh giá', value: report.conclusion || 'Chưa cập nhật' },
      { label: 'Điểm không phù hợp', value: report.nonconformities.join('; ') || 'Không có' },
      { label: 'Kiến nghị', value: report.recommendations || 'Không có' },
      { label: 'Ghi chú báo cáo', value: report.notes || 'Không có' },
    ] : []),
    { label: 'CHECKLIST HỒ SƠ', value: '', section: true },
    ...(context.checklist.length > 0
      ? context.checklist.map((item) => ({
        label: item.name,
        value: `${item.required ? 'Bắt buộc' : 'Không bắt buộc'} / ${item.status} / ${item.versionCount} phiên`,
      }))
      : [{ label: 'Checklist', value: 'Chưa có mục checklist' }]),
    { label: 'TỆP ĐÍNH KÈM', value: '', section: true },
    ...(context.attachments.length > 0
      ? context.attachments.map((item) => ({ label: item.kind, value: `${item.fileName} • ${item.sourceRelativePath}` }))
      : [{ label: 'Tệp đính kèm', value: 'Chưa có' }]),
    { label: 'KẾT QUẢ KIỂM TRA ĐIỀU PHỐI', value: '', section: true },
    { label: 'Tài liệu bắt buộc còn thiếu', value: missingRequired.join(', ') || 'Không còn' },
    { label: 'Số tệp provenance', value: `${context.attachments.length} tệp; bytes không nằm trong document context` },
  ];
}

export function buildPcnEvaluationReportDocx(context: PcnDossierDocumentContext): Buffer {
  const rows = pcnEvaluationReportRows(context);
  const checklistStart = rows.findIndex((row) => row.label === 'CHECKLIST HỒ SƠ');
  const metadataRows = rows
    .slice(1, checklistStart)
    .map((row) => [{ value: row.label, bold: true }, { value: row.value }]);
  const resultStart = rows.findIndex((row) => row.label === 'KẾT QUẢ KIỂM TRA ĐIỀU PHỐI');
  const checklistRows = [
    [{ value: 'Mục', bold: true }, { value: 'Trạng thái', bold: true }, { value: 'Phiên bản', bold: true }],
    ...context.checklist.map((item) => [{ value: item.name }, { value: `${item.required ? 'Bắt buộc' : 'Không bắt buộc'} / ${item.status}` }, { value: String(item.versionCount) }]),
  ];
  const attachmentRows = [
    [{ value: 'Nhóm', bold: true }, { value: 'Tên tệp', bold: true }, { value: 'Đường dẫn nguồn', bold: true }],
    ...context.attachments.map((item) => [{ value: item.kind }, { value: item.fileName }, { value: item.sourceRelativePath }]),
  ];
  const resultRows = rows.slice(resultStart + 1).map((row) => [{ value: row.label, bold: true }, { value: row.value }]);
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('BÁO CÁO ĐÁNH GIÁ HỒ SƠ PCN', true, 'center'),
    paragraph('Tài liệu điều phối nội bộ được sinh từ dữ liệu liên kết', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(metadataRows),
    paragraph('CHECKLIST HỒ SƠ', true),
    context.checklist.length > 0 ? table(checklistRows) : paragraph('Chưa có mục checklist.'),
    paragraph('TỆP ĐÍNH KÈM', true),
    context.attachments.length > 0 ? table(attachmentRows) : paragraph('Chưa có tệp đính kèm.'),
    paragraph('KẾT QUẢ KIỂM TRA ĐIỀU PHỐI', true),
    table(resultRows),
    paragraph('Tài liệu này chỉ hỗ trợ điều phối và rà soát nội bộ; không thay thế biên bản đánh giá đã ký, GCN hoặc Quyết định.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

function buildPcnEvaluationReportPdfPageSvg(context: PcnDossierDocumentContext, pageRows: PcnEvaluationReportPdfRow[], pageNumber: number, pageCount: number): string {
  const rows = pageRows.map((row, index) => {
    const y = 300 + index * 32;
    if (row.section) return svgText(row.label, 54, y, 13, 700, '#0f766e');
    return `${svgText(truncate(row.label, 42), 54, y, 12, 700, '#475569')}${svgText(truncate(row.value, 78), 270, y, 12)}<line x1="54" y1="${y + 10}" x2="740" y2="${y + 10}" stroke="#e2e8f0"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('BÁO CÁO ĐÁNH GIÁ HỒ SƠ PCN', 68, 111, 24, 700, '#ffffff')}${svgText(`${context.dossierCode} • ${context.proposalCode}`, 68, 137, 13, 400, '#cbd5e1')}${svgText('TÀI LIỆU ĐIỀU PHỐI NỘI BỘ', 54, 204, 21, 700, '#0f172a')}${svgText(`Đánh giá: ${context.evaluatorUsername || 'Chưa phân công'} • Rà soát: ${context.reviewerUsername || 'Chưa phân công'}`, 54, 232, 13, 400, '#475569')}${rows}${svgText('Không thay thế biên bản đánh giá đã ký, GCN hoặc Quyết định.', 54, 1015, 12, 400, '#64748b')}${svgText(`Context ${context.contextHash.slice(0, 16)} • Trang ${pageNumber}/${pageCount}`, 54, 1068, 12, 400, '#94a3b8')}</svg>`;
}

export async function buildPcnEvaluationReportPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const rows = pcnEvaluationReportRows(context);
  const pageSize = 21;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pdf = await createPcnPdf('BÁO CÁO ĐÁNH GIÁ HỒ SƠ PCN');
  for (let index = 0; index < pageCount; index += 1) {
    const pageRows = rows.slice(index * pageSize, (index + 1) * pageSize);
    const png = renderPcnSvg(buildPcnEvaluationReportPdfPageSvg(context, pageRows, index + 1, pageCount));
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

type PcnOperationalFormRow = [string, string];

function pcnOperationalFormRows(context: PcnDossierDocumentContext): PcnOperationalFormRow[] {
  const assignment = context.operationalForms?.assignment;
  const plan = context.operationalForms?.evaluationPlan;
  const inspection = context.operationalForms?.fieldInspection;
  const rows: PcnOperationalFormRow[] = [
    ['Mã hồ sơ / Đề nghị', `${context.dossierCode} / ${context.proposalCode}`],
    ['Lĩnh vực / Phương thức', `${context.fieldNames.join(', ') || 'Chưa cập nhật'} / ${context.method.replace('METHOD_', 'Phương thức ')}`],
    ['Khách hàng', context.customerName || 'Chưa cập nhật'],
    ['Sản phẩm / Model / Nhãn hiệu', [context.productName, context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Nhà sản xuất', context.manufacturer || 'Chưa cập nhật'],
    ['Chủ hồ sơ', context.ownerUsername || 'Chưa phân công'],
    ['Người đánh giá', context.evaluatorUsername || 'Chưa phân công'],
    ['Người rà soát', context.reviewerUsername || 'Chưa phân công'],
    ['Hạn xử lý / Ngày đánh giá', `${documentDate(context.targetDate)} / ${documentDate(context.evaluationAt)}`],
    ...(assignment ? ([
      ['Số phiếu phân công', assignment.assignmentNumber || 'Chưa cập nhật'],
      ['Ngày phân công', documentDate(assignment.assignedAt)],
      ['Người phân công', assignment.assignedBy || 'Chưa cập nhật'],
      ['Phạm vi phân công', assignment.scope || 'Chưa cập nhật'],
      ['Ghi chú phân công', assignment.notes || 'Không có'],
    ] as PcnOperationalFormRow[]) : []),
    ...(plan ? ([
      ['Kế hoạch đánh giá', `${documentDate(plan.plannedStartAt)} – ${documentDate(plan.plannedEndAt)}`],
      ['Địa điểm đánh giá', plan.location || 'Chưa cập nhật'],
      ['Thành viên đoàn đánh giá', plan.teamMembers.join('; ') || 'Chưa cập nhật'],
      ['Phạm vi kế hoạch', plan.scope || 'Chưa cập nhật'],
      ['Tiêu chí đánh giá', plan.criteria || 'Chưa cập nhật'],
      ['Đại diện khách hàng', plan.customerRepresentative || 'Chưa cập nhật'],
      ['Ghi chú kế hoạch', plan.notes || 'Không có'],
    ] as PcnOperationalFormRow[]) : []),
    ...(inspection ? ([
      ['Ngày kiểm tra hiện trường', documentDate(inspection.inspectedAt)],
      ['Địa điểm kiểm tra', inspection.location || 'Chưa cập nhật'],
      ['Thành phần tham gia', inspection.participants.join('; ') || 'Chưa cập nhật'],
      ['Kết quả/nhận xét hiện trường', inspection.findings || 'Chưa cập nhật'],
      ['Kết luận hiện trường', inspection.conclusion || 'Chưa cập nhật'],
      ['Điểm không phù hợp hiện trường', inspection.nonconformities.join('; ') || 'Không có'],
      ['Ghi chú hiện trường', inspection.notes || 'Không có'],
    ] as PcnOperationalFormRow[]) : []),
  ];
  return rows;
}

function pcnOperationalChecklistSummary(context: PcnDossierDocumentContext): string {
  const present = context.checklist.filter((item) => item.status === 'PRESENT').length;
  const required = context.checklist.filter((item) => item.required).length;
  const missing = context.checklist.filter((item) => item.status !== 'PRESENT').map((item) => item.name).filter(Boolean);
  return `${present}/${context.checklist.length} mục hiện có; bắt buộc ${required}; còn thiếu: ${missing.join(', ') || 'Không còn'}`;
}

function buildPcnOperationalFormDocx(
  context: PcnDossierDocumentContext,
  title: string,
  rows: PcnOperationalFormRow[],
  signatureTitle: string,
  signatureLabels: string,
): Buffer {
  const tableRows = rows.map(([label, value]) => [{ value: label, bold: true }, { value }]);
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph(title, true, 'center'),
    paragraph('Biểu mẫu vận hành nội bộ theo context hồ sơ PCN', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(tableRows),
    paragraph(signatureTitle, true),
    paragraph(signatureLabels),
    paragraph('Ngày lập: ____/____/________        Ngày ký: ____/____/________'),
    paragraph('Tài liệu này là bản nháp quản lý nội bộ; không thay thế biểu mẫu đã ký, GCN hoặc Quyết định.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

async function buildPcnOperationalFormPdf(
  context: PcnDossierDocumentContext,
  title: string,
  rows: PcnOperationalFormRow[],
  signatureLeft: string,
  signatureRight: string,
): Promise<Buffer> {
  const rowSvg = rows.map(([label, value], index) => {
    const y = 270 + index * 38;
    return `${svgText(label, 54, y, 13, 700, '#475569')}${svgText(truncate(value, 70), 275, y, 13)}<line x1="54" y1="${y + 12}" x2="740" y2="${y + 12}" stroke="#e2e8f0"/>`;
  }).join('');
  const signatureY = Math.min(900, 315 + rows.length * 38);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText(title, 68, 111, title.length > 34 ? 20 : 25, 700, '#ffffff')}${svgText(`${context.dossierCode} • ${context.proposalCode}`, 68, 137, 13, 400, '#cbd5e1')}${svgText('BẢN NHÁP NỘI BỘ', 54, 204, 22, 700, '#0f172a')}${rowSvg}${svgText(`${signatureLeft}: ____________________`, 54, signatureY, 13, 700, '#475569')}${svgText(`${signatureRight}: ____________________`, 430, signatureY, 13, 700, '#475569')}${svgText('Không thay thế biểu mẫu đã ký, GCN hoặc Quyết định.', 54, signatureY + 54, 12, 400, '#64748b')}${svgText(`Context ${context.contextHash.slice(0, 16)}`, 54, 1068, 12, 400, '#94a3b8')}</svg>`;
  const png = renderPcnSvg(svg);
  const pdf = await createPcnPdf(title);
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export function buildPcnAssignmentFormDocx(context: PcnDossierDocumentContext): Buffer {
  return buildPcnOperationalFormDocx(context, 'PHIẾU PHÂN CÔNG CHỨNG NHẬN', pcnOperationalFormRows(context), 'XÁC NHẬN PHÂN CÔNG', 'Người phân công: ____________________        Chủ hồ sơ: ____________________');
}

export async function buildPcnAssignmentFormPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  return buildPcnOperationalFormPdf(context, 'PHIẾU PHÂN CÔNG CHỨNG NHẬN', pcnOperationalFormRows(context), 'NGƯỜI PHÂN CÔNG', 'CHỦ HỒ SƠ');
}

export function buildPcnEvaluationPlanDocx(context: PcnDossierDocumentContext): Buffer {
  return buildPcnOperationalFormDocx(context, 'KẾ HOẠCH ĐÁNH GIÁ CNSP', [...pcnOperationalFormRows(context), ['Tình trạng checklist', pcnOperationalChecklistSummary(context)], ['Tài liệu bắt buộc còn thiếu', context.checklist.filter((item) => item.required && item.status !== 'PRESENT').map((item) => item.name).join(', ') || 'Không còn']], 'XÁC NHẬN KẾ HOẠCH', 'Người lập kế hoạch: ____________________        Người rà soát: ____________________');
}

export async function buildPcnEvaluationPlanPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  return buildPcnOperationalFormPdf(context, 'KẾ HOẠCH ĐÁNH GIÁ CNSP', [...pcnOperationalFormRows(context), ['Tình trạng checklist', pcnOperationalChecklistSummary(context)], ['Tài liệu bắt buộc còn thiếu', context.checklist.filter((item) => item.required && item.status !== 'PRESENT').map((item) => item.name).join(', ') || 'Không còn']], 'NGƯỜI LẬP KẾ HOẠCH', 'NGƯỜI RÀ SOÁT');
}

export function buildPcnFieldInspectionDocx(context: PcnDossierDocumentContext): Buffer {
  return buildPcnOperationalFormDocx(context, 'BIÊN BẢN KIỂM TRA TẠI HIỆN TRƯỜNG', [...pcnOperationalFormRows(context), ['Địa chỉ kho / hiện trường', context.warehouseAddress || 'Chưa cập nhật'], ['Số lượng kiểm tra', `${context.quantity || 0}`], ['Tình trạng hồ sơ tại thời điểm kiểm tra', pcnOperationalChecklistSummary(context)]], 'XÁC NHẬN KIỂM TRA HIỆN TRƯỜNG', 'Người kiểm tra: ____________________        Đại diện đơn vị: ____________________');
}

export async function buildPcnFieldInspectionPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  return buildPcnOperationalFormPdf(context, 'BIÊN BẢN KIỂM TRA TẠI HIỆN TRƯỜNG', [...pcnOperationalFormRows(context), ['Địa chỉ kho / hiện trường', context.warehouseAddress || 'Chưa cập nhật'], ['Số lượng kiểm tra', `${context.quantity || 0}`], ['Tình trạng hồ sơ tại thời điểm kiểm tra', pcnOperationalChecklistSummary(context)]], 'NGƯỜI KIỂM TRA', 'ĐẠI DIỆN ĐƠN VỊ');
}

function pcnSampleTakingRows(context: PcnDossierDocumentContext): PcnOperationalFormRow[] {
  const sample = context.sampleHandover;
  if (!sample) throw new Error('Biên bản lấy mẫu phải có một tuyến mẫu được chọn.');
  const form = context.operationalForms?.sampleTaking;
  const rows: PcnOperationalFormRow[] = [
    ['Mã hồ sơ / Đề nghị', `${context.dossierCode} / ${context.proposalCode}`],
    ['Lĩnh vực / Quy chuẩn', context.fieldNames.join(', ') || 'Chưa cập nhật'],
    ['Mã lô mẫu', sample.lotCode || 'Chưa cập nhật'],
    ['Tên mẫu / Model / Nhãn hiệu', [sample.sampleName, sample.model, sample.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Số lượng / Đơn vị', `${sample.quantity} ${sample.unit}`.trim()],
    ['Địa điểm / nơi lấy mẫu', form?.location || sample.currentLocation || context.warehouseAddress || 'Chưa cập nhật'],
    ['Ngày lấy / tiếp nhận mẫu', documentDate(form?.sampledAt || sample.lotReceivedAt)],
    ...(form ? ([
      ['Phương pháp lấy mẫu', form.samplingMethod || 'Chưa cập nhật'],
      ['Thành phần tham gia', form.participants.join('; ') || 'Chưa cập nhật'],
      ['Số lượng lấy mẫu', `${form.sampleQuantity} ${form.unit}`.trim()],
      ['Tình trạng bao gói', form.packaging || 'Chưa cập nhật'],
      ['Mã tem niêm phong', form.sealCode || 'Chưa cập nhật'],
    ] as PcnOperationalFormRow[]) : []),
    ['Phòng thử nghiệm dự kiến', sample.labName || 'Chưa cập nhật'],
    ['Mã tuyến / PYC liên kết', `${sample.routeId} / ${sample.pycNumber || 'Chưa tạo PYC'}`],
    ['Tiêu chuẩn / chỉ tiêu', sample.criteria || context.specifications || 'Chưa cập nhật'],
    ['Trạng thái tuyến / lô', `${sample.routeStatus} / ${sample.lotStatus}`],
    ['Ghi chú lấy mẫu', form?.notes || sample.note || 'Không có'],
  ];
  return rows;
}

export function buildPcnSampleTakingDocx(context: PcnDossierDocumentContext): Buffer {
  return buildPcnOperationalFormDocx(context, 'BIÊN BẢN LẤY MẪU', pcnSampleTakingRows(context), 'XÁC NHẬN LẤY MẪU', 'Người lấy mẫu: ____________________        Đại diện đơn vị: ____________________');
}

export async function buildPcnSampleTakingPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  return buildPcnOperationalFormPdf(context, 'BIÊN BẢN LẤY MẪU', pcnSampleTakingRows(context), 'NGƯỜI LẤY MẪU', 'ĐẠI DIỆN ĐƠN VỊ');
}

function pcnSampleCodingRows(context: PcnDossierDocumentContext): PcnOperationalFormRow[] {
  const sample = context.sampleHandover;
  if (!sample) throw new Error('Biên bản mã hóa mẫu phải có một tuyến mẫu được chọn.');
  const form = context.operationalForms?.sampleCoding;
  const rows: PcnOperationalFormRow[] = [
    ['Mã hồ sơ / Đề nghị', `${context.dossierCode} / ${context.proposalCode}`],
    ['Lĩnh vực / Quy chuẩn', context.fieldNames.join(', ') || 'Chưa cập nhật'],
    ['Mã lô mẫu', form?.lotCode || sample.lotCode || 'Chưa cập nhật'],
    ['Tên mẫu / Model / Nhãn hiệu', [sample.sampleName, sample.model, sample.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Số lượng / Đơn vị', `${sample.quantity} ${sample.unit}`.trim()],
    ...(form ? ([
      ['Ngày mã hóa mẫu', documentDate(form.codedAt)],
      ['Người mã hóa mẫu', form.coder || 'Chưa cập nhật'],
      ['Mã mẫu vật lý', form.sampleCodes.join(', ') || 'Chưa cập nhật'],
      ['Mã tem niêm phong', form.sealCode || 'Chưa cập nhật'],
    ] as PcnOperationalFormRow[]) : []),
    ['Mã tuyến mẫu', sample.routeId],
    ['Phòng thử nghiệm', sample.labName || 'Chưa cập nhật'],
    ['PYC liên kết', sample.pycNumber || 'Chưa tạo PYC'],
    ['Tiêu chuẩn / chỉ tiêu', sample.criteria || context.specifications || 'Chưa cập nhật'],
    ['Trạng thái tuyến / lô', `${sample.routeStatus} / ${sample.lotStatus}`],
    ['Ngày tiếp nhận mẫu', documentDate(sample.lotReceivedAt)],
    ...(form ? ([['Ghi chú mã hóa mẫu', form.notes || 'Không có']] as PcnOperationalFormRow[]) : []),
  ];
  return rows;
}

export function buildPcnSampleCodingDocx(context: PcnDossierDocumentContext): Buffer {
  return buildPcnOperationalFormDocx(context, 'BIÊN BẢN MÃ HÓA MẪU', pcnSampleCodingRows(context), 'XÁC NHẬN MÃ HÓA MẪU', 'Người mã hóa: ____________________        Người kiểm tra: ____________________');
}

export async function buildPcnSampleCodingPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  return buildPcnOperationalFormPdf(context, 'BIÊN BẢN MÃ HÓA MẪU', pcnSampleCodingRows(context), 'NGƯỜI MÃ HÓA', 'NGƯỜI KIỂM TRA');
}

export function buildPcnLabRequestDocx(context: PcnDossierDocumentContext): Buffer {
  const request = context.labRequest;
  if (!request) throw new Error('Phiếu yêu cầu thử nghiệm phải có một PYC thuộc hồ sơ được chọn.');
  const rows = [
    [{ value: 'Số PYC', bold: true }, { value: request.pycNumber || 'Chưa cập nhật' }],
    [{ value: 'Mã hồ sơ / Đề nghị', bold: true }, { value: `${context.dossierCode} / ${context.proposalCode}` }],
    [{ value: 'Khách hàng', bold: true }, { value: context.customerName || 'Chưa cập nhật' }],
    [{ value: 'Địa chỉ', bold: true }, { value: context.customerAddress || 'Chưa cập nhật' }],
    [{ value: 'Lĩnh vực', bold: true }, { value: context.fieldNames.join(', ') || request.fieldCode }],
    [{ value: 'Phòng thử nghiệm nhận', bold: true }, { value: request.laboratoryName || 'Chưa cập nhật' }],
    [{ value: 'Trạng thái PYC', bold: true }, { value: request.status }],
    [{ value: 'Ngày lập / Hạn trả KQTN', bold: true }, { value: `${documentDate(request.requestedAt)} / ${documentDate(request.targetDate)}` }],
    [{ value: 'Tiêu chuẩn / chỉ tiêu', bold: true }, { value: request.criteria || context.specifications || 'Chưa cập nhật' }],
    [{ value: 'Lô mẫu', bold: true }, { value: request.lotCode || 'PYC không gắn lô mẫu' }],
    [{ value: 'Tên mẫu', bold: true }, { value: request.sampleName || context.productName || 'Chưa cập nhật' }],
    [{ value: 'Model / Nhãn hiệu', bold: true }, { value: [request.model, request.brand].filter(Boolean).join(' / ') || [context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Số lượng / Nơi giữ', bold: true }, { value: request.sampleLotId ? `${request.quantity} ${request.unit} / ${request.currentLocation || 'Chưa cập nhật'}` : 'Không gắn lô mẫu' }],
    [{ value: 'Tuyến mẫu', bold: true }, { value: request.sampleRouteId ? `${request.sampleRouteId} / ${request.routeStatus || 'Chưa cập nhật'}` : 'PYC không gắn tuyến mẫu' }],
    [{ value: 'Ngày giao / PTN nhận', bold: true }, { value: `${documentDate(request.handoverAt)} / ${documentDate(request.receivedAt)}` }],
    [{ value: 'Ghi chú giao nhận', bold: true }, { value: request.handoverNote || 'Không có' }],
    ...(request.issueDescription ? [[{ value: 'Vấn đề mẫu', bold: true }, { value: request.issueDescription }]] : []),
  ];
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('PHIẾU YÊU CẦU THỬ NGHIỆM PCN', true, 'center'),
    paragraph('Chứng từ outbound nội bộ được sinh từ PYC và hồ sơ liên kết', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(rows),
    paragraph('XÁC NHẬN GỬI PHÒNG THỬ NGHIỆM', true),
    paragraph('Người lập: ____________________        Người nhận: ____________________'),
    paragraph('Ngày gửi: ____/____/________        Ngày nhận: ____/____/________'),
    paragraph('Tài liệu này là chứng từ outbound nội bộ; không thay thế KQTN, GCN hoặc Quyết định.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

export async function buildPcnLabRequestPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const request = context.labRequest;
  if (!request) throw new Error('Phiếu yêu cầu thử nghiệm phải có một PYC thuộc hồ sơ được chọn.');
  const rows: Array<[string, string]> = [
    ['Số PYC', request.pycNumber || 'Chưa cập nhật'],
    ['Mã hồ sơ / Đề nghị', `${context.dossierCode} / ${context.proposalCode}`],
    ['Khách hàng', context.customerName || 'Chưa cập nhật'],
    ['Địa chỉ', context.customerAddress || 'Chưa cập nhật'],
    ['Lĩnh vực', context.fieldNames.join(', ') || request.fieldCode],
    ['Phòng thử nghiệm nhận', request.laboratoryName || 'Chưa cập nhật'],
    ['Trạng thái PYC', request.status],
    ['Ngày lập / Hạn trả KQTN', `${documentDate(request.requestedAt)} / ${documentDate(request.targetDate)}`],
    ['Tiêu chuẩn / chỉ tiêu', request.criteria || context.specifications || 'Chưa cập nhật'],
    ['Lô mẫu', request.lotCode || 'PYC không gắn lô mẫu'],
    ['Tên mẫu', request.sampleName || context.productName || 'Chưa cập nhật'],
    ['Model / Nhãn hiệu', [request.model, request.brand].filter(Boolean).join(' / ') || [context.model, context.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Số lượng / Nơi giữ', request.sampleLotId ? `${request.quantity} ${request.unit} / ${request.currentLocation || 'Chưa cập nhật'}` : 'Không gắn lô mẫu'],
    ['Tuyến mẫu', request.sampleRouteId ? `${request.sampleRouteId} / ${request.routeStatus || 'Chưa cập nhật'}` : 'PYC không gắn tuyến mẫu'],
    ['Ngày giao / PTN nhận', `${documentDate(request.handoverAt)} / ${documentDate(request.receivedAt)}`],
    ['Ghi chú giao nhận', request.handoverNote || 'Không có'],
    ...(request.issueDescription ? [['Vấn đề mẫu', request.issueDescription] as [string, string]] : []),
  ];
  const rowSvg = rows.map(([label, value], index) => {
    const y = 276 + index * 33;
    return `${svgText(label, 54, y, 13, 700, '#475569')}${svgText(truncate(value, 74), 270, y, 13)}<line x1="54" y1="${y + 10}" x2="740" y2="${y + 10}" stroke="#e2e8f0"/>`;
  }).join('');
  const footerY = Math.min(1020, 315 + rows.length * 33);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('PHIẾU YÊU CẦU THỬ NGHIỆM PCN', 68, 111, 24, 700, '#ffffff')}${svgText(`${request.pycNumber || 'PYC'} • ${request.laboratoryName || 'Chưa cập nhật'}`, 68, 137, 13, 400, '#cbd5e1')}${svgText('CHỨNG TỪ OUTBOUND NỘI BỘ', 54, 204, 22, 700, '#0f172a')}${svgText('Thông tin lấy từ PYC, hồ sơ và lô/tuyến liên kết', 54, 232, 14, 400, '#475569')}${rowSvg}${svgText('NGƯỜI LẬP: ____________________', 54, footerY, 13, 700, '#475569')}${svgText('NGƯỜI NHẬN: ____________________', 430, footerY, 13, 700, '#475569')}${svgText('Không thay thế KQTN, GCN hoặc Quyết định.', 54, footerY + 54, 12, 400, '#64748b')}${svgText(`Context ${context.contextHash.slice(0, 16)}`, 54, 1068, 12, 400, '#94a3b8')}</svg>`;
  const png = renderPcnSvg(svg);
  const pdf = await createPcnPdf('PHIẾU YÊU CẦU THỬ NGHIỆM PCN');
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export function buildPcnSampleHandoverDocx(context: PcnDossierDocumentContext): Buffer {
  const handover = context.sampleHandover;
  if (!handover) throw new Error('Biên bản giao nhận phải có một tuyến mẫu được chọn.');
  const rows = [
    [{ value: 'Mã hồ sơ', bold: true }, { value: context.dossierCode }],
    [{ value: 'Mã Đề nghị', bold: true }, { value: context.proposalCode }],
    [{ value: 'Mã lô mẫu', bold: true }, { value: handover.lotCode }],
    [{ value: 'Tên mẫu', bold: true }, { value: handover.sampleName || context.productName || 'Chưa cập nhật' }],
    [{ value: 'Model / Nhãn hiệu', bold: true }, { value: [handover.model, handover.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Số lượng', bold: true }, { value: `${handover.quantity} ${handover.unit}`.trim() }],
    [{ value: 'Phòng thử nghiệm nhận', bold: true }, { value: handover.labName }],
    [{ value: 'Mã tuyến mẫu', bold: true }, { value: handover.routeId }],
    [{ value: 'PYC liên kết', bold: true }, { value: handover.pycNumber || 'Chưa tạo PYC' }],
    [{ value: 'Trạng thái tuyến / PYC', bold: true }, { value: [handover.routeStatus, handover.pycStatus].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Ngày tiếp nhận mẫu', bold: true }, { value: documentDate(handover.lotReceivedAt) }],
    [{ value: 'Số lượng giao nhận', bold: true }, { value: `${handover.handoverQuantity ?? handover.quantity} ${handover.unit}`.trim() }],
    [{ value: 'Mã mẫu / mã hóa theo lô', bold: true }, { value: handover.sampleCodes?.join(', ') || handover.lotCode }],
    [{ value: 'Bên giao / đơn vị', bold: true }, { value: [handover.senderName, handover.senderUnit].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Bên nhận / đơn vị', bold: true }, { value: [handover.receiverName, handover.receiverUnit || handover.labName].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Thời điểm bàn giao', bold: true }, { value: documentDateTime(handover.handoverAt || handover.sentAt) }],
    [{ value: 'Thời điểm PTN nhận', bold: true }, { value: documentDateTime(handover.receivedAt || handover.routeReceivedAt) }],
    [{ value: 'Địa điểm bàn giao', bold: true }, { value: handover.location || handover.currentLocation || 'Chưa cập nhật' }],
    [{ value: 'Phương tiện / lái xe', bold: true }, { value: [handover.vehicle, handover.driver].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Tiêu chuẩn / chỉ tiêu', bold: true }, { value: handover.criteria || context.specifications || 'Chưa cập nhật' }],
    [{ value: 'Ghi chú giao nhận', bold: true }, { value: handover.handoverNote || handover.note || 'Không có' }],
    ...(handover.issueDescription ? [[{ value: 'Vấn đề mẫu', bold: true }, { value: handover.issueDescription }]] : []),
  ];
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('BIÊN BẢN GIAO/NHẬN MẪU', true, 'center'),
    paragraph('Bản nháp nội bộ được sinh từ lô mẫu, tuyến thử và PYC liên kết', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(rows),
    paragraph('XÁC NHẬN GIAO NHẬN', true),
    paragraph(`Bên giao: ${handover.senderName || '____________________'}        Bên nhận: ${handover.receiverName || '____________________'}`),
    paragraph('Ngày ký: ____/____/________        Ngày ký: ____/____/________'),
    paragraph('Tài liệu này là bản nháp quản lý; không thay thế biên bản đã ký hoặc chứng từ pháp lý.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

export async function buildPcnSampleHandoverPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const handover = context.sampleHandover;
  if (!handover) throw new Error('Biên bản giao nhận phải có một tuyến mẫu được chọn.');
  const rows = [
    ['Mã hồ sơ', context.dossierCode],
    ['Mã Đề nghị', context.proposalCode],
    ['Mã lô mẫu', handover.lotCode],
    ['Tên mẫu', handover.sampleName || context.productName || 'Chưa cập nhật'],
    ['Model / Nhãn hiệu', [handover.model, handover.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Số lượng', `${handover.quantity} ${handover.unit}`.trim()],
    ['Phòng thử nghiệm nhận', handover.labName],
    ['Mã tuyến mẫu', handover.routeId],
    ['PYC liên kết', handover.pycNumber || 'Chưa tạo PYC'],
    ['Trạng thái tuyến / PYC', [handover.routeStatus, handover.pycStatus].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Ngày tiếp nhận mẫu', documentDate(handover.lotReceivedAt)],
    ['Số lượng giao nhận', `${handover.handoverQuantity ?? handover.quantity} ${handover.unit}`.trim()],
    ['Mã mẫu / mã hóa theo lô', handover.sampleCodes?.join(', ') || handover.lotCode],
    ['Bên giao / đơn vị', [handover.senderName, handover.senderUnit].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Bên nhận / đơn vị', [handover.receiverName, handover.receiverUnit || handover.labName].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Thời điểm bàn giao', documentDateTime(handover.handoverAt || handover.sentAt)],
    ['Thời điểm PTN nhận', documentDateTime(handover.receivedAt || handover.routeReceivedAt)],
    ['Địa điểm bàn giao', handover.location || handover.currentLocation || 'Chưa cập nhật'],
    ['Phương tiện / lái xe', [handover.vehicle, handover.driver].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Tiêu chuẩn / chỉ tiêu', handover.criteria || context.specifications || 'Chưa cập nhật'],
    ['Ghi chú giao nhận', handover.handoverNote || handover.note || 'Không có'],
    ...(handover.issueDescription ? [['Vấn đề mẫu', handover.issueDescription]] : []),
  ];
  const rowSvg = rows.map(([label, value], index) => {
    const y = 268 + index * 29;
    return `${svgText(label, 54, y, 13, 700, '#475569')}${svgText(truncate(value, 72), 260, y, 13)}<line x1="54" y1="${y + 11}" x2="740" y2="${y + 11}" stroke="#e2e8f0"/>`;
  }).join('');
  const signatureY = Math.min(945, 300 + rows.length * 29);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('BIÊN BẢN GIAO/NHẬN MẪU', 68, 111, 25, 700, '#ffffff')}${svgText(`${handover.lotCode} • ${handover.labName}`, 68, 137, 13, 400, '#cbd5e1')}${svgText('BẢN NHÁP NỘI BỘ', 54, 204, 22, 700, '#0f172a')}${svgText('Thông tin lấy từ lô mẫu, tuyến thử và PYC liên kết', 54, 232, 14, 400, '#475569')}${rowSvg}${svgText(`BÊN GIAO: ${handover.senderName || '____________________'}`, 54, signatureY, 13, 700, '#475569')}${svgText(`BÊN NHẬN: ${handover.receiverName || '____________________'}`, 430, signatureY, 13, 700, '#475569')}${svgText('Không thay thế biên bản đã ký hoặc chứng từ pháp lý.', 54, signatureY + 55, 12, 400, '#64748b')}${svgText(`Context ${context.contextHash.slice(0, 16)}`, 54, 1068, 12, 400, '#94a3b8')}</svg>`;
  const png = renderPcnSvg(svg);
  const pdf = await createPcnPdf('BIÊN BẢN GIAO/NHẬN MẪU');
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export function buildPcnSampleReturnDocx(context: PcnDossierDocumentContext): Buffer {
  const returned = context.sampleHandover;
  if (!returned) throw new Error('Biên bản trả mẫu phải có một tuyến mẫu được chọn.');
  const rows = [
    [{ value: 'Mã hồ sơ', bold: true }, { value: context.dossierCode }],
    [{ value: 'Mã Đề nghị', bold: true }, { value: context.proposalCode }],
    [{ value: 'Mã lô mẫu', bold: true }, { value: returned.lotCode }],
    [{ value: 'Tên mẫu', bold: true }, { value: returned.sampleName || context.productName || 'Chưa cập nhật' }],
    [{ value: 'Model / Nhãn hiệu', bold: true }, { value: [returned.model, returned.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Số lượng', bold: true }, { value: `${returned.quantity} ${returned.unit}`.trim() }],
    [{ value: 'Phòng thử nghiệm trả mẫu', bold: true }, { value: returned.labName }],
    [{ value: 'Mã tuyến mẫu', bold: true }, { value: returned.routeId }],
    [{ value: 'PYC liên kết', bold: true }, { value: returned.pycNumber || 'Chưa tạo PYC' }],
    [{ value: 'Trạng thái tuyến / PYC', bold: true }, { value: [returned.routeStatus, returned.pycStatus].filter(Boolean).join(' / ') || 'Chưa cập nhật' }],
    [{ value: 'Ngày PTN nhận / trả KQTN', bold: true }, { value: `${documentDate(returned.routeReceivedAt)} / ${documentDate(returned.resultReturnedAt)}` }],
    [{ value: 'Ngày trả mẫu về PCN', bold: true }, { value: documentDate(returned.returnedAt) }],
    [{ value: 'Nơi nhận lại', bold: true }, { value: returned.currentLocation || 'Chưa cập nhật' }],
    [{ value: 'Tình trạng khi trả', bold: true }, { value: returned.note || returned.issueDescription || 'Chưa ghi nhận' }],
  ];
  const body = [
    paragraph('TRUNG TÂM TVCI', true, 'center'),
    paragraph('BIÊN BẢN TRẢ MẪU', true, 'center'),
    paragraph('Bản nháp nội bộ được sinh từ lô mẫu, tuyến thử và PYC liên kết', false, 'center'),
    paragraph(`Mã context: ${context.contextHash}`, false, 'right'),
    table(rows),
    paragraph('XÁC NHẬN TRẢ MẪU', true),
    paragraph('Bên trả: ____________________        Bên nhận lại: ____________________'),
    paragraph('Ngày ký: ____/____/________        Ngày ký: ____/____/________'),
    paragraph('Tài liệu này là bản nháp quản lý; không thay thế biên bản đã ký hoặc chứng từ pháp lý.', false),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr>',
  ].join('');
  return createMinimalPcnDocx(body);
}

export async function buildPcnSampleReturnPdf(context: PcnDossierDocumentContext): Promise<Buffer> {
  const returned = context.sampleHandover;
  if (!returned) throw new Error('Biên bản trả mẫu phải có một tuyến mẫu được chọn.');
  const rows = [
    ['Mã hồ sơ', context.dossierCode],
    ['Mã Đề nghị', context.proposalCode],
    ['Mã lô mẫu', returned.lotCode],
    ['Tên mẫu', returned.sampleName || context.productName || 'Chưa cập nhật'],
    ['Model / Nhãn hiệu', [returned.model, returned.brand].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Số lượng', `${returned.quantity} ${returned.unit}`.trim()],
    ['Phòng thử nghiệm trả mẫu', returned.labName],
    ['Mã tuyến mẫu', returned.routeId],
    ['PYC liên kết', returned.pycNumber || 'Chưa tạo PYC'],
    ['Trạng thái tuyến / PYC', [returned.routeStatus, returned.pycStatus].filter(Boolean).join(' / ') || 'Chưa cập nhật'],
    ['Ngày PTN nhận / trả KQTN', `${documentDate(returned.routeReceivedAt)} / ${documentDate(returned.resultReturnedAt)}`],
    ['Ngày trả mẫu về PCN', documentDate(returned.returnedAt)],
    ['Nơi nhận lại', returned.currentLocation || 'Chưa cập nhật'],
    ['Tình trạng khi trả', returned.note || returned.issueDescription || 'Chưa ghi nhận'],
  ];
  const rowSvg = rows.map(([label, value], index) => {
    const y = 282 + index * 36;
    return `${svgText(label, 54, y, 13, 700, '#475569')}${svgText(truncate(value, 72), 270, y, 13)}<line x1="54" y1="${y + 11}" x2="740" y2="${y + 11}" stroke="#e2e8f0"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="#ffffff"/><rect x="28" y="28" width="738" height="1067" rx="14" fill="#f8fafc" stroke="#cbd5e1"/><rect x="42" y="42" width="710" height="112" rx="10" fill="#0f172a"/><text x="68" y="78" font-family="Arial, Liberation Sans, sans-serif" font-size="18px" font-weight="700" fill="#6ee7b7">TRUNG TÂM TVCI</text>${svgText('BIÊN BẢN TRẢ MẪU', 68, 111, 25, 700, '#ffffff')}${svgText(`${returned.lotCode} • ${returned.labName}`, 68, 137, 13, 400, '#cbd5e1')}${svgText('BẢN NHÁP NỘI BỘ', 54, 204, 22, 700, '#0f172a')}${svgText('Thông tin lấy từ lô mẫu, tuyến thử và PYC liên kết', 54, 232, 14, 400, '#475569')}${rowSvg}${svgText('BÊN TRẢ: ____________________', 54, 900, 13, 700, '#475569')}${svgText('BÊN NHẬN LẠI: ____________________', 430, 900, 13, 700, '#475569')}${svgText('Không thay thế biên bản đã ký hoặc chứng từ pháp lý.', 54, 960, 12, 400, '#64748b')}${svgText(`Context ${context.contextHash.slice(0, 16)}`, 54, 1068, 12, 400, '#94a3b8')}</svg>`;
  const png = renderPcnSvg(svg);
  const pdf = await createPcnPdf('BIÊN BẢN TRẢ MẪU');
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

// --- End of pcnDocumentGeneration.ts ---
