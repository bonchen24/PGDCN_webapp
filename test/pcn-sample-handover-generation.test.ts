import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PDFDocument } from 'pdf-lib';
import PizZip from 'pizzip';

import {
  buildPcnDossierDocumentContext,
  buildPcnSampleHandoverDocx,
  buildPcnSampleHandoverPdf,
} from '../utils/pcnDocumentGeneration.ts';
import type {
  CertificationDossier,
  CertificationProposal,
  PcnCertificationField,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnDocumentRequirement,
  PcnSampleLot,
  PcnSampleRoute,
} from '../types.ts';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../utils/pcnDocumentGenerationApi.ts', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../components/PcnDocumentGenerationPanel.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

const dossier: CertificationDossier = {
  id: 'dossier-handover-0665',
  dossierCode: 'QC4-2026-0665',
  proposalId: 'proposal-handover-0665',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'AWAITING_SAMPLING',
  labRequestIds: ['pyc-handover-1'],
  returnedResultIds: [],
  sampleLotIds: ['lot-handover-1'],
  updatedAt: '2026-08-28T03:00:00.000Z',
};

const proposal: CertificationProposal = {
  id: dossier.proposalId,
  proposalCode: 'DN-QC4-2026-0665',
  channel: 'OTHER',
  status: 'CONVERTED',
  dossierId: dossier.id,
  customerSnapshot: { name: 'Công ty Mẫu', address: 'Hà Nội' },
  productName: 'Bình đun nước',
  model: 'KETTLE-01',
  brand: 'PCN Brand',
  quantity: 1,
  fieldCodes: ['QC4'],
  receivedAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T03:00:00.000Z',
};

const lot: PcnSampleLot = {
  id: 'lot-handover-1',
  dossierId: dossier.id,
  lotCode: '0665-26-M01',
  sampleName: 'Bình đun nước mẫu',
  model: 'KETTLE-01',
  brand: 'PCN Brand',
  quantity: 2,
  unit: 'cái',
  fieldCodes: ['QC4'],
  routeIds: ['route-handover-1'],
  status: 'IN_TRANSIT',
  currentLocation: 'Đang luân chuyển tới PTN',
  receivedAt: '2026-08-28T04:00:00.000Z',
  updatedAt: '2026-08-28T05:00:00.000Z',
};

const route: PcnSampleRoute = {
  id: 'route-handover-1',
  sampleLotId: lot.id,
  labCode: 'ELECTRICAL_SAFETY',
  labName: 'Phòng thử An toàn điện',
  status: 'SENT',
  labRequestId: 'pyc-handover-1',
  sentAt: '2026-08-28T05:00:00.000Z',
  updatedAt: '2026-08-28T05:00:00.000Z',
};

const context = buildPcnDossierDocumentContext({
  dossier,
  proposal,
  fields: [{ code: 'QC4', name: 'Quy chuẩn 4', standardRefs: ['QCVN 4'], active: true } satisfies PcnCertificationField],
  documents: [] satisfies PcnDossierDocument[],
  documentRequirements: [] satisfies PcnDocumentRequirement[],
  attachments: [] satisfies PcnDossierAttachment[],
  sampleLots: [lot],
  sampleRoutes: [route],
  labRequests: [{
    id: 'pyc-handover-1',
    pycNumber: 'PYC-QC4-0665-01',
    dossierId: dossier.id,
    fieldCode: 'QC4',
    laboratoryName: route.labName,
    sampleLotId: lot.id,
    sampleRouteId: route.id,
    status: 'SENT',
    requestedAt: '2026-08-28T04:30:00.000Z',
    updatedAt: '2026-08-28T05:00:00.000Z',
  }],
  sampleRouteId: route.id,
});

test('sample handover context is route-specific and retains linked PYC', () => {
  assert.equal(context.sampleHandover?.lotCode, lot.lotCode);
  assert.equal(context.sampleHandover?.routeId, route.id);
  assert.equal(context.sampleHandover?.pycNumber, 'PYC-QC4-0665-01');
  assert.equal(context.sampleHandover?.labName, route.labName);
  assert.equal(context.sampleHandover?.quantity, 2);
});

test('sample handover generator carries canonical lot, route and PYC into DOCX and PDF', async () => {
  const docx = buildPcnSampleHandoverDocx(context);
  const documentXml = new PizZip(docx).file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /BIÊN BẢN GIAO\/NHẬN MẪU/);
  assert.match(documentXml, /0665-26-M01/);
  assert.match(documentXml, /PYC-QC4-0665-01/);
  assert.match(documentXml, /Phòng thử An toàn điện/);

  const pdf = await buildPcnSampleHandoverPdf(context);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
});

test('sample handover generation requires the selected route and carries the route identity end to end', () => {
  assert.throws(() => buildPcnDossierDocumentContext({
    dossier,
    proposal,
    fields: [],
    documents: [],
    documentRequirements: [],
    attachments: [],
    sampleLots: [lot],
    sampleRoutes: [route],
    sampleRouteId: 'route-not-found',
  }), /Không tìm thấy tuyến mẫu/);
  assert.match(server, /SAMPLE_HANDOVER/);
  assert.match(server, /sampleRouteId/);
  assert.match(api, /sampleRouteId/);
  assert.match(panel, /SAMPLE_HANDOVER/);
  assert.match(panel, /Chọn tuyến mẫu/);
  assert.match(panel, /sampleRouteId === selectedRoute\.id/);
  assert.match(detail, /sampleLots/);
});
