import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { buildPcnDossierCompleteness } from './pcnDossierPipeline.ts';

export type PcnApprovalReviewStatus = 'PASS' | 'WARNING' | 'ERROR' | 'NOT_EVALUABLE';
export type PcnApprovalReviewSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';
export type PcnApprovalReviewSource = 'RULE' | 'AI' | 'RULE_AND_AI';

export type PcnApprovalReviewCriterionId =
  | 'ENTRY_GATE'
  | 'COMPLETENESS'
  | 'IDENTITY'
  | 'COMMERCIAL'
  | 'FIELD_EVALUATION'
  | 'SAMPLE_PYC'
  | 'LAB_RESULTS'
  | 'TECHNICAL_ASSESSMENT'
  | 'CERTIFICATE_DECISION'
  | 'DOCUMENT_QUALITY'
  | 'SYSTEM_LOGIC';

export const PCN_APPROVAL_REVIEW_CRITERIA: ReadonlyArray<{ id: PcnApprovalReviewCriterionId; title: string }> = [
  { id: 'ENTRY_GATE', title: 'Điều kiện và phạm vi dữ liệu hồ sơ' },
  { id: 'COMPLETENESS', title: 'Độ đầy đủ tài liệu và waiver' },
  { id: 'IDENTITY', title: 'Nhận dạng và đồng nhất dữ liệu' },
  { id: 'COMMERCIAL', title: 'Hồ sơ thương mại và nguồn gốc' },
  { id: 'FIELD_EVALUATION', title: 'Đánh giá hiện trường và phân công' },
  { id: 'SAMPLE_PYC', title: 'PYC và lấy mẫu' },
  { id: 'LAB_RESULTS', title: 'Kết quả thử nghiệm' },
  { id: 'TECHNICAL_ASSESSMENT', title: 'Đánh giá kỹ thuật' },
  { id: 'CERTIFICATE_DECISION', title: 'GCN và quyết định' },
  { id: 'DOCUMENT_QUALITY', title: 'Chất lượng văn bản và tệp' },
  { id: 'SYSTEM_LOGIC', title: 'Logic liên kết hệ thống' },
];

export interface PcnApprovalReviewTextEvidence {
  assetId: string;
  fileName: string;
  text: string;
  page?: number;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  tab?: PcnApprovalReviewEvidence['tab'];
}

export interface PcnApprovalReviewUnreadableFile {
  assetId: string;
  fileName: string;
  reason: string;
  tab: PcnApprovalReviewEvidence['tab'];
}

export interface PcnApprovalReviewEvidence {
  assetId: string;
  fileName: string;
  page?: number;
  sectionTitle?: string;
  excerpt?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  tab: 'overview' | 'documents' | 'sampling' | 'results' | 'approval';
}

export interface PcnApprovalReviewFinding {
  id: string;
  code: string;
  message: string;
  severity: PcnApprovalReviewSeverity;
  detail?: string;
  confidence?: number;
  suggestedAction?: string;
  evidence: PcnApprovalReviewEvidence[];
}

export interface PcnApprovalCriterionResult {
  id: PcnApprovalReviewCriterionId;
  title: string;
  status: PcnApprovalReviewStatus;
  severity: PcnApprovalReviewSeverity;
  source: PcnApprovalReviewSource;
  summary: string;
  findings: PcnApprovalReviewFinding[];
}

export interface PcnApprovalReviewSummary {
  pass: number;
  warning: number;
  error: number;
  notEvaluable: number;
  highestSeverity: PcnApprovalReviewSeverity;
  conclusion: 'KHÔNG PHÁT HIỆN BẤT THƯỜNG RÕ' | 'CẦN KIỂM TRA/BỔ SUNG' | 'CHƯA ĐỦ CĂN CỨ';
}

export interface PcnApprovalReviewCandidate {
  dossierId: string;
  dossierCode: string;
  fieldCode: PcnCertificationFieldCode;
  status: CertificationDossier['status'];
  customerName?: string;
  productName?: string;
  ownerUsername?: string;
  targetDate?: string;
  missingDocuments: string[];
  completenessScore: number;
}

export interface PcnApprovalReviewInput {
  fieldCode: PcnCertificationFieldCode;
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  labRequests: OutboundLabRequest[];
  sampleLots: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  returnedResults: ReturnedTestResult[];
  documentTexts?: PcnApprovalReviewTextEvidence[];
  unreadableFiles?: PcnApprovalReviewUnreadableFile[];
}

export interface PcnApprovalReviewCandidateInput {
  fieldCode: PcnCertificationFieldCode;
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
}

function isReviewStatus(status: CertificationDossier['status']): boolean {
  return status === 'TECHNICAL_REVIEW' || status === 'WAITING_APPROVAL';
}

function isHistorical(dossier: CertificationDossier): boolean {
  return Boolean(dossier.historicalImport);
}

function excerpt(text: string, term?: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!term) return clean.slice(0, 300);
  const index = clean.toLocaleLowerCase('vi-VN').indexOf(term.toLocaleLowerCase('vi-VN'));
  if (index < 0) return clean.slice(0, 300);
  return clean.slice(Math.max(0, index - 80), Math.min(clean.length, index + term.length + 160));
}

function textEvidence(entry: PcnApprovalReviewTextEvidence, tab: PcnApprovalReviewEvidence['tab'], term?: string): PcnApprovalReviewEvidence {
  return {
    assetId: entry.assetId,
    fileName: entry.fileName,
    ...(entry.page ? { page: entry.page } : {}),
    excerpt: excerpt(entry.text, term),
    ...(entry.boundingBox ? { boundingBox: entry.boundingBox } : {}),
    tab: entry.tab || tab,
  };
}

function createFinding(
  criterionId: PcnApprovalReviewCriterionId,
  code: string,
  message: string,
  evidence: PcnApprovalReviewEvidence[] = [],
  options: Partial<Pick<PcnApprovalReviewFinding, 'detail' | 'confidence' | 'suggestedAction' | 'severity'>> = {},
): PcnApprovalReviewFinding {
  return {
    id: `${criterionId}:${code}`,
    code,
    message,
    severity: options.severity || 'ATTENTION',
    evidence,
    ...options,
  };
}

function standardEntries(input: PcnApprovalReviewInput): Array<{ standard: string; entry: PcnApprovalReviewTextEvidence }> {
  const pattern = /\b(?:QCVN|TCVN|IEC|CISPR)\s*[A-Z0-9][A-Z0-9./:-]*/gi;
  return (input.documentTexts || []).flatMap((entry) => [...entry.text.matchAll(pattern)].map((match) => ({
    standard: match[0].replace(/\s+/g, ' ').trim().toUpperCase(),
    entry,
  })));
}

function findTypographyAnomaly(entry: PcnApprovalReviewTextEvidence): string | undefined {
  if (/[ \t]{2,}/.test(entry.text)) return 'Có khoảng trắng lặp trong nội dung văn bản.';
  if (/[ \t]+[,:;!?]/.test(entry.text)) return 'Có khoảng trắng trước dấu câu.';
  if (/[,:;!?][\p{L}]/u.test(entry.text)) return 'Có dấu câu nối liền với từ kế tiếp, cần kiểm tra cách ngắt câu.';
  return undefined;
}

function buildCriterion(id: PcnApprovalReviewCriterionId, title: string): PcnApprovalCriterionResult {
  return {
    id,
    title,
    status: 'PASS',
    severity: 'INFO',
    source: 'RULE',
    summary: 'Luật xác định không phát hiện bất thường rõ trong dữ liệu hiện có.',
    findings: [],
  };
}

function applyFinding(criterion: PcnApprovalCriterionResult, finding: PcnApprovalReviewFinding, status: PcnApprovalReviewStatus, severity: PcnApprovalReviewSeverity, summary: string): void {
  criterion.findings.push(finding);
  finding.severity = severity;
  const statusRank: Record<PcnApprovalReviewStatus, number> = { PASS: 0, WARNING: 1, ERROR: 2, NOT_EVALUABLE: 3 };
  const severityRank: Record<PcnApprovalReviewSeverity, number> = { INFO: 0, ATTENTION: 1, CRITICAL: 2 };
  if (statusRank[status] >= statusRank[criterion.status]) {
    criterion.status = status;
    criterion.summary = summary;
  }
  if (severityRank[severity] >= severityRank[criterion.severity]) criterion.severity = severity;
}

export function getPcnApprovalReviewCandidates(input: PcnApprovalReviewCandidateInput): PcnApprovalReviewCandidate[] {
  const proposals = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  return input.dossiers
    .filter((dossier) => !isHistorical(dossier) && isReviewStatus(dossier.status) && dossier.fieldCodes.includes(input.fieldCode))
    .map((dossier) => {
      const proposal = proposals.get(dossier.proposalId);
      const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements: input.requirements, documents: input.documents });
      return {
        dossierId: dossier.id,
        dossierCode: dossier.dossierCode,
        fieldCode: input.fieldCode,
        status: dossier.status,
        ...(dossier.customerSnapshot?.name || proposal?.customerSnapshot?.name ? { customerName: dossier.customerSnapshot?.name || proposal?.customerSnapshot?.name } : {}),
        ...(proposal?.productName ? { productName: proposal.productName } : {}),
        ...(dossier.ownerUsername ? { ownerUsername: dossier.ownerUsername } : {}),
        ...(dossier.targetDate ? { targetDate: dossier.targetDate } : {}),
        missingDocuments: [...completeness.missingLabels],
        completenessScore: completeness.score,
      };
    })
    .sort((left, right) => {
      const statusOrder = (status: CertificationDossier['status']) => status === 'WAITING_APPROVAL' ? 0 : 1;
      return statusOrder(left.status) - statusOrder(right.status) || left.dossierCode.localeCompare(right.dossierCode, 'vi');
    });
}

export function buildPcnApprovalReview(input: PcnApprovalReviewInput): { criteria: PcnApprovalCriterionResult[]; summary: PcnApprovalReviewSummary } {
  const criteria = PCN_APPROVAL_REVIEW_CRITERIA.map(({ id, title }) => buildCriterion(id, title));
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const entry = byId.get('ENTRY_GATE')!;
  if (!input.dossier.fieldCodes.includes(input.fieldCode) || !isReviewStatus(input.dossier.status) || isHistorical(input.dossier)) {
    applyFinding(entry, createFinding('ENTRY_GATE', 'REVIEW_SCOPE_INVALID', 'Hồ sơ không thuộc phạm vi phiên kiểm duyệt hoặc là dữ liệu lịch sử.'), 'ERROR', 'CRITICAL', 'Không thể dùng hồ sơ này cho phiên kiểm duyệt.');
  }

  const completeness = byId.get('COMPLETENESS')!;
  const completenessProjection = buildPcnDossierCompleteness({ dossier: input.dossier, proposal: input.proposal, requirements: input.requirements, documents: input.documents });
  if (completenessProjection.missingLabels.length > 0) {
    applyFinding(
      completeness,
      createFinding('COMPLETENESS', 'REQUIRED_DOCUMENT_MISSING', `Còn thiếu tài liệu bắt buộc: ${completenessProjection.missingLabels.join(', ')}.`, [], { suggestedAction: 'Mở Tài liệu hồ sơ và bổ sung phiên file hiện hành hoặc waiver hợp lệ.' }),
      'ERROR',
      'CRITICAL',
      'Bộ hồ sơ còn tài liệu bắt buộc chưa có phiên hiện hành hoặc waiver hợp lệ.',
    );
  }
  if (completenessProjection.missingCoreLabels.length > 0) {
    applyFinding(
      completeness,
      createFinding('COMPLETENESS', 'CORE_METADATA_MISSING', `Thiếu dữ liệu nền để kiểm tra chắc chắn: ${completenessProjection.missingCoreLabels.join(', ')}.`, [], { suggestedAction: 'Kiểm tra metadata chuẩn trong hồ sơ và Đề nghị; trợ lý không tự suy đoán giá trị còn thiếu.' }),
      'WARNING',
      'ATTENTION',
      'Một số dữ liệu nền của hồ sơ chưa đủ để đối soát trọn vẹn.',
    );
  }

  const identity = byId.get('IDENTITY')!;
  const standards = standardEntries(input);
  const uniqueStandards = [...new Map(standards.map((item) => [item.standard, item])).values()];
  if (uniqueStandards.length > 1) {
    const evidence = uniqueStandards.slice(0, 4).map((item) => textEvidence(item.entry, 'documents', item.standard));
    applyFinding(
      identity,
      createFinding('IDENTITY', 'STANDARD_REFERENCE_MISMATCH', `Các tài liệu đang thể hiện tiêu chuẩn không thống nhất: ${uniqueStandards.map((item) => item.standard).join(' và ')}.`, evidence, { suggestedAction: 'Mở từng tài liệu và xác nhận tiêu chuẩn áp dụng trước khi kết luận.' }),
      'ERROR',
      'CRITICAL',
      'Phát hiện khác biệt tiêu chuẩn giữa các tài liệu nguồn.',
    );
  }

  const commercial = byId.get('COMMERCIAL')!;
  const commercialMissing = [
    ...(input.proposal?.customerSnapshot?.name?.trim() || input.dossier.customerSnapshot?.name?.trim() ? [] : ['Tên khách hàng']),
    ...(input.proposal?.customerSnapshot?.address?.trim() || input.dossier.customerSnapshot?.address?.trim() ? [] : ['Địa chỉ khách hàng']),
    ...(input.proposal?.productName?.trim() ? [] : ['Tên sản phẩm']),
  ];
  if (commercialMissing.length > 0) {
    applyFinding(commercial, createFinding('COMMERCIAL', 'COMMERCIAL_METADATA_MISSING', `Thiếu thông tin thương mại cần đối chiếu: ${commercialMissing.join(', ')}.`, [], { suggestedAction: 'Mở Đề nghị và phần tổng quan hồ sơ để kiểm tra dữ liệu gốc.' }), 'WARNING', 'ATTENTION', 'Thông tin thương mại chưa đầy đủ để đối chiếu chắc chắn.');
  }

  const fieldEvaluation = byId.get('FIELD_EVALUATION')!;
  const missingActors = [
    ...(input.dossier.evaluatorUsername?.trim() ? [] : ['người đánh giá']),
    ...(input.dossier.reviewerUsername?.trim() ? [] : ['người soát xét']),
  ];
  if (missingActors.length > 0 && ['TECHNICAL_REVIEW', 'WAITING_APPROVAL'].includes(input.dossier.status)) {
    applyFinding(fieldEvaluation, createFinding('FIELD_EVALUATION', 'REVIEW_ASSIGNMENT_MISSING', `Chưa thấy phân công ${missingActors.join(' và ')} trên snapshot hồ sơ.`, [], { suggestedAction: 'Mở phần phân công/soát xét của hồ sơ để xác nhận người chịu trách nhiệm.' }), 'WARNING', 'ATTENTION', 'Phân công đánh giá cần được xác nhận trên hồ sơ chuẩn.');
  }

  const sample = byId.get('SAMPLE_PYC')!;
  const pycTexts = (input.documentTexts || []).filter((entry) => /pyc|p\.y\.c|phi[eế]u.*y[eê]u/i.test(entry.fileName));
  const sampleNumbers = [...new Set(pycTexts.flatMap((entry) => [...entry.text.matchAll(/\bM\s*0*(\d+)\b/gi)].map((match) => Number(match[1])).filter(Number.isFinite)))].sort((a, b) => a - b);
  const missingSampleNumbers: number[] = [];
  for (let number = sampleNumbers[0] || 0; number <= (sampleNumbers.at(-1) || 0); number += 1) {
    if (number > 0 && !sampleNumbers.includes(number)) missingSampleNumbers.push(number);
  }
  if (missingSampleNumbers.length > 0 && pycTexts[0]) {
    applyFinding(
      sample,
      createFinding('SAMPLE_PYC', 'SAMPLE_SEQUENCE_GAP', `Mã mẫu bị đứt chuỗi: thiếu ${missingSampleNumbers.map((number) => `M${String(number).padStart(2, '0')}`).join(', ')} trong dãy PYC.`, [textEvidence(pycTexts[0], 'sampling', 'M')], { suggestedAction: 'Đối chiếu lại PYC, bảng mã hóa mẫu và biên bản giao nhận.' }),
      'ERROR',
      'CRITICAL',
      'Mã mẫu trong PYC có khoảng trống hoặc thứ tự cần xác minh.',
    );
  }

  const lab = byId.get('LAB_RESULTS')!;
  const dossierResults = input.returnedResults.filter((result) => result.dossierId === input.dossier.id);
  const officialResult = [...dossierResults].sort((left, right) => right.round - left.round).find((result) => result.isOfficial) || dossierResults.at(-1);
  if (input.dossier.returnedResultIds.length > 0 && dossierResults.length === 0) {
    applyFinding(lab, createFinding('LAB_RESULTS', 'RESULT_LINK_MISSING', 'Hồ sơ có backlink KQTN nhưng không tìm thấy bản ghi KQTN tương ứng.'), 'ERROR', 'CRITICAL', 'Không đủ liên kết để xác minh KQTN.');
  } else if (officialResult?.outcome === 'FAIL') {
    applyFinding(lab, createFinding('LAB_RESULTS', 'OFFICIAL_RESULT_FAIL', 'KQTN hiện hành đang có kết quả không đạt.', [], { suggestedAction: 'Kiểm tra hồ sơ khắc phục và vòng thử lại trước khi kết luận.' }), 'WARNING', 'CRITICAL', 'KQTN hiện hành chưa chứng minh kết quả đạt.');
  }

  const documentQuality = byId.get('DOCUMENT_QUALITY')!;
  const typography = (input.documentTexts || []).map((entry) => ({ entry, message: findTypographyAnomaly(entry) })).find((item) => item.message);
  if (typography?.message) {
    applyFinding(documentQuality, createFinding('DOCUMENT_QUALITY', 'TYPOGRAPHIC_ANOMALY', `${typography.message} Nguồn: ${typography.entry.fileName}.`, [textEvidence(typography.entry, 'documents')], { suggestedAction: 'Mở tệp gốc để sửa hoặc xác nhận đây chỉ là định dạng hợp lệ.' }), 'WARNING', 'ATTENTION', 'Phát hiện dấu hiệu định dạng/chính tả cần người dùng kiểm tra trong tệp gốc.');
  }
  const lowConfidence = (input.documentTexts || []).find((entry) => typeof entry.confidence === 'number' && entry.confidence < 0.7);
  if (lowConfidence) {
    applyFinding(documentQuality, createFinding('DOCUMENT_QUALITY', 'OCR_CONFIDENCE_LOW', `Nội dung OCR của ${lowConfidence.fileName} có độ tin cậy thấp.`, [textEvidence(lowConfidence, 'documents')], { confidence: lowConfidence.confidence, suggestedAction: 'Mở tệp gốc để kiểm tra thủ công.' }), 'WARNING', 'ATTENTION', 'Một phần nội dung OCR cần được kiểm tra thủ công.');
  }
  for (const file of input.unreadableFiles || []) {
    applyFinding(
      documentQuality,
      createFinding(
        'DOCUMENT_QUALITY',
        'FILE_NOT_READABLE',
        `Chưa đọc được ${file.fileName}; cần đối chiếu thủ công.`,
        [{ assetId: file.assetId, fileName: file.fileName, tab: file.tab }],
        { detail: file.reason, suggestedAction: 'Mở tệp gốc trong Tài liệu hồ sơ để kiểm tra nội dung và bổ sung bản PDF/DOCX nếu cần.' },
      ),
      'NOT_EVALUABLE',
      'ATTENTION',
      'Một số tệp chưa đọc được; kết quả chỉ là hỗ trợ và chưa đủ căn cứ cho các tệp này.',
    );
  }

  const system = byId.get('SYSTEM_LOGIC')!;
  const linkedRequestIds = new Set(input.labRequests.filter((request) => request.dossierId === input.dossier.id).map((request) => request.id));
  const missingRequestLinks = input.dossier.labRequestIds.filter((requestId) => !linkedRequestIds.has(requestId));
  if (missingRequestLinks.length > 0) {
    applyFinding(system, createFinding('SYSTEM_LOGIC', 'LAB_REQUEST_LINK_MISSING', `Hồ sơ trỏ tới PYC không tìm thấy bản ghi: ${missingRequestLinks.join(', ')}.`), 'ERROR', 'CRITICAL', 'Liên kết hồ sơ–PYC chưa đầy đủ.');
  }
  const orphanResults = dossierResults.filter((result) => !linkedRequestIds.has(result.labRequestId));
  if (orphanResults.length > 0) {
    applyFinding(system, createFinding('SYSTEM_LOGIC', 'RESULT_REQUEST_LINK_MISMATCH', 'Có KQTN thuộc hồ sơ nhưng không liên kết về PYC của hồ sơ.'), 'ERROR', 'CRITICAL', 'Liên kết hồ sơ–PYC–KQTN cần được đối soát.');
  }

  const summary: PcnApprovalReviewSummary = {
    pass: criteria.filter((criterion) => criterion.status === 'PASS').length,
    warning: criteria.filter((criterion) => criterion.status === 'WARNING').length,
    error: criteria.filter((criterion) => criterion.status === 'ERROR').length,
    notEvaluable: criteria.filter((criterion) => criterion.status === 'NOT_EVALUABLE').length,
    highestSeverity: criteria.some((criterion) => criterion.severity === 'CRITICAL') ? 'CRITICAL' : criteria.some((criterion) => criterion.severity === 'ATTENTION') ? 'ATTENTION' : 'INFO',
    conclusion: criteria.some((criterion) => criterion.status === 'NOT_EVALUABLE')
      ? 'CHƯA ĐỦ CĂN CỨ'
      : criteria.some((criterion) => criterion.status === 'ERROR' || criterion.status === 'WARNING')
        ? 'CẦN KIỂM TRA/BỔ SUNG'
        : 'KHÔNG PHÁT HIỆN BẤT THƯỜNG RÕ',
  };

  return { criteria, summary };
}

// --- End of pcnApprovalReview.ts ---
