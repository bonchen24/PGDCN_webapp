import assert from 'node:assert/strict';
import test from 'node:test';
import PizZip from 'pizzip';

import {
  buildPcnDossierDocumentContext,
  buildPcnEvaluationPlanDocx,
  buildPcnSampleCodingDocx,
} from '../utils/pcnDocumentGeneration.ts';
import { mergePcnOperationalForm } from '../utils/pcnOperationalForms.ts';
import type { CertificationDossier, CertificationProposal, PcnCertificationField, PcnDocumentRequirement, PcnOperationalForms, PcnSampleLot, PcnSampleRoute } from '../types.ts';

const fields: PcnCertificationField[] = [{
  code: 'QC4',
  name: 'Quy chuẩn 4',
  standardRefs: ['QCVN 4:2009/BKHCN'],
  active: true,
}];

const dossier: CertificationDossier = {
  id: 'dossier-form-generation',
  dossierCode: 'HS-QC4-001',
  proposalId: 'proposal-form-generation',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'FIELD_EVALUATION',
  ownerUsername: 'tranhoangphuong',
  evaluatorUsername: 'vuthitham',
  reviewerUsername: 'nguyentuanthanh',
  operationalForms: mergePcnOperationalForm(undefined, 'EVALUATION_PLAN', {
    plannedStartAt: '2026-09-01',
    plannedEndAt: '2026-09-02',
    location: 'Nhà máy Bình Dương',
    teamMembers: ['Vũ Thị Thắm'],
    scope: 'Đánh giá dây chuyền sản xuất',
    criteria: 'QCVN 4:2009/BKHCN',
    customerRepresentative: 'Nguyễn Văn A',
    notes: 'Mang theo thiết bị kiểm tra.',
  }),
  labRequestIds: [],
  returnedResultIds: [],
};

const proposal: CertificationProposal = {
  id: 'proposal-form-generation',
  proposalCode: '0665',
  channel: 'DIRECT',
  status: 'CONVERTED',
  dossierId: dossier.id,
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội', contactPerson: 'Nguyễn Văn A' },
  productName: 'Bếp điện',
  productType: 'Bếp điện gia dụng',
  model: 'A-01',
  brand: 'IEMM',
  specifications: '220V',
  manufacturer: 'Nhà máy A',
  quantity: 1,
  fieldCodes: ['QC4'],
  receivedAt: '2026-08-31T01:00:00.000Z',
};

function context(forms = dossier.operationalForms, sampleRouteId?: string): ReturnType<typeof buildPcnDossierDocumentContext> {
  return buildPcnDossierDocumentContext({
    dossier: { ...dossier, operationalForms: forms },
    proposal,
    fields,
    documents: [] as never[],
    documentRequirements: [] as PcnDocumentRequirement[],
    attachments: [],
    sampleLots: [{
      id: 'lot-form-generation', dossierId: dossier.id, lotCode: 'QC4-LOT-01', sampleName: 'Bếp điện', model: 'A-01', brand: 'IEMM', quantity: 1, unit: 'mẫu', fieldCodes: ['QC4'], status: 'PREPARED', currentLocation: 'Kho PCN', receivedAt: '2026-08-31T01:00:00.000Z', updatedAt: '2026-08-31T01:00:00.000Z', routeIds: [],
    } as PcnSampleLot],
    sampleRoutes: [{
      id: 'route-form-generation', sampleLotId: 'lot-form-generation', labCode: 'PERFORMANCE', labName: 'Phòng thử nghiệm Hiệu suất', status: 'PENDING', updatedAt: '2026-08-31T01:00:00.000Z',
    } as PcnSampleRoute],
    sampleRouteId,
  });
}

function documentXml(output: Buffer): string {
  const zip = new PizZip(output);
  return zip.file('word/document.xml')?.asText() || '';
}

test('document context carries structured station forms without embedding file bytes', () => {
  const result = context();
  assert.equal(result.operationalForms?.evaluationPlan?.location, 'Nhà máy Bình Dương');
  assert.equal(result.operationalForms?.evaluationPlan?.criteria, 'QCVN 4:2009/BKHCN');
  assert.equal('bytes' in result, false);
});

test('evaluation plan DOCX uses saved station form facts instead of empty placeholders', () => {
  const output = buildPcnEvaluationPlanDocx(context());
  const xml = documentXml(output);
  assert.match(xml, /Nhà máy Bình Dương/);
  assert.match(xml, /Đánh giá dây chuyền sản xuất/);
  assert.match(xml, /Mang theo thiết bị kiểm tra/);
});

test('sample coding DOCX keeps the PCN lot, physical sample code, and seal stamp distinct', () => {
  const forms: PcnOperationalForms = mergePcnOperationalForm(undefined, 'SAMPLE_CODING', {
    codedAt: '2026-08-31',
    coder: 'Vũ Thị Thắm',
    lotCode: 'QC4-LOT-01',
    sampleCodes: ['QC4-LOT-01-01'],
    sealCode: 'TEM-QC4-01',
    notes: 'Dán tem niêm phong.',
  });
  const output = buildPcnSampleCodingDocx(context(forms, 'route-form-generation'));
  const xml = documentXml(output);
  assert.match(xml, /QC4-LOT-01/);
  assert.match(xml, /QC4-LOT-01-01/);
  assert.match(xml, /TEM-QC4-01/);
});
