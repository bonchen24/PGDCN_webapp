import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from './pgdDomain.ts';
import type { PgdCaseEvent, PgdDossierIndex, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from './pgdArtifacts.ts';

export type PgdAssistantCriterionStatus = 'PASS' | 'WARNING' | 'ERROR' | 'NOT_EVALUABLE';
export type PgdAssistantCriterionId =
  | 'REQUEST_IDENTITY'
  | 'CUSTOMER_CONTACT'
  | 'PRODUCT_PROFILE'
  | 'SCOPE_AND_STANDARDS'
  | 'DOSSIER_DOCUMENTS'
  | 'ASSIGNMENT_CAPABILITY'
  | 'INSPECTION_PLAN'
  | 'FIELD_EVIDENCE'
  | 'SAMPLING_CHAIN'
  | 'LAB_RESULTS_REVIEW'
  | 'REPORT_APPROVAL_RETURN';

export interface PgdAssistantCriterionDefinition {
  id: PgdAssistantCriterionId;
  title: string;
}

export const PGD_ASSISTANT_CRITERION_DEFINITIONS: readonly PgdAssistantCriterionDefinition[] = [
  { id: 'REQUEST_IDENTITY', title: 'PYC và người yêu cầu' },
  { id: 'CUSTOMER_CONTACT', title: 'Khách hàng và liên hệ' },
  { id: 'PRODUCT_PROFILE', title: 'Đối tượng và nhóm sản phẩm' },
  { id: 'SCOPE_AND_STANDARDS', title: 'Phạm vi, địa điểm, tiêu chuẩn và phương thức' },
  { id: 'DOSSIER_DOCUMENTS', title: 'Chứng từ và danh mục hồ sơ' },
  { id: 'ASSIGNMENT_CAPABILITY', title: 'Phân công và năng lực' },
  { id: 'INSPECTION_PLAN', title: 'Kế hoạch, thiết bị và lịch thực hiện' },
  { id: 'FIELD_EVIDENCE', title: 'Biên bản và bằng chứng hiện trường' },
  { id: 'SAMPLING_CHAIN', title: 'Lấy mẫu, niêm phong và bàn giao' },
  { id: 'LAB_RESULTS_REVIEW', title: 'PTN, kết quả và đánh giá kết quả' },
  { id: 'REPORT_APPROVAL_RETURN', title: 'Báo cáo, chứng thư, phê duyệt và trả kết quả' },
];

export const PGD_ASSISTANT_CRITERION_ORDER = PGD_ASSISTANT_CRITERION_DEFINITIONS.map((item) => item.id);

export interface PgdAssistantEvidence {
  assetId: string;
  fileName: string;
  documentId?: string;
  documentType?: 'DOSSIER' | 'GENERATED';
  page?: number;
  excerpt?: string;
  tab: 'overview' | 'documents' | 'sampling' | 'results' | 'approval';
}

export interface PgdAssistantTextEvidence extends PgdAssistantEvidence {
  text: string;
  confidence?: number;
}

export interface PgdAssistantUnreadableFile {
  assetId: string;
  fileName: string;
  reason: string;
  criterionId: PgdAssistantCriterionId;
  tab: PgdAssistantEvidence['tab'];
  documentId?: string;
  documentType?: PgdAssistantEvidence['documentType'];
}

export interface PgdAssistantFinding {
  id: string;
  message: string;
  detail?: string;
  suggestedAction?: string;
  evidence?: PgdAssistantEvidence[];
}

export interface PgdAssistantCriterion {
  id: PgdAssistantCriterionId;
  title: string;
  status: PgdAssistantCriterionStatus;
  summary: string;
  source: 'RULES' | 'AI' | 'RULES_AND_AI';
  provenance: string[];
  findings: PgdAssistantFinding[];
}

export interface PgdAssistantReview {
  domain: 'PGD';
  requestId: string;
  readOnly: true;
  criteria: PgdAssistantCriterion[];
  summary: {
    pass: number;
    warning: number;
    error: number;
    notEvaluable: number;
    conclusion: string;
  };
}

export interface PgdAssistantCandidate {
  requestId: string;
  requestCode: string;
  customerName: string;
  productName: string;
  status: PgdInspectionRequest['status'];
  updatedAt: string;
}

export type PgdAssistantReviewInput = {
  request: PgdInspectionRequest;
  assignments?: PgdInspectionAssignment[];
  inspectionPlans?: PgdInspectionPlan[];
  caseEvents?: PgdCaseEvent[];
  fieldActivityLogs?: PgdFieldActivityLog[];
  fieldInspections?: PgdFieldInspection[];
  samples?: PgdSample[];
  labRequests?: PgdLabRequest[];
  labResults?: PgdLabResult[];
  labResultReviews?: PgdLabResultReview[];
  reports?: PgdInspectionReport[];
  certificates?: PgdInspectionCertificate[];
  approvals?: PgdApprovalStep[];
  dossierIndexes?: PgdDossierIndex[];
  documentTexts?: PgdAssistantTextEvidence[];
  unreadableFiles?: PgdAssistantUnreadableFile[];
};

const terminalStatuses = new Set<PgdInspectionRequest['status']>(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED']);

function hasText(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

function criterion(
  id: PgdAssistantCriterionId,
  status: PgdAssistantCriterionStatus,
  summary: string,
  provenance: string[],
  findings: PgdAssistantFinding[] = [],
): PgdAssistantCriterion {
  const definition = PGD_ASSISTANT_CRITERION_DEFINITIONS.find((item) => item.id === id)!;
  return { id, title: definition.title, status, summary, source: 'RULES', provenance, findings };
}

function missingFinding(id: string, fields: string[], action: string): PgdAssistantFinding {
  return { id, message: `Thiếu hoặc chưa đủ: ${fields.join(', ')}.`, suggestedAction: action };
}

function summarize(criteria: PgdAssistantCriterion[]): PgdAssistantReview['summary'] {
  const pass = criteria.filter((item) => item.status === 'PASS').length;
  const warning = criteria.filter((item) => item.status === 'WARNING').length;
  const error = criteria.filter((item) => item.status === 'ERROR').length;
  const notEvaluable = criteria.filter((item) => item.status === 'NOT_EVALUABLE').length;
  const conclusion = error > 0
    ? 'Cần xử lý lỗi trước khi xem xét tiếp.'
    : notEvaluable > 0
      ? 'Chưa đủ căn cứ cho một hoặc nhiều tiêu chí.'
      : warning > 0
        ? 'Có cảnh báo cần người phụ trách đối chiếu.'
        : 'Bằng chứng hiện có phù hợp với 11 tiêu chí PGD.';
  return { pass, warning, error, notEvaluable, conclusion };
}

export function getPgdAssistantCandidates(requests: PgdInspectionRequest[]): PgdAssistantCandidate[] {
  return requests
    .filter((request) => !terminalStatuses.has(request.status))
    .map((request) => ({
      requestId: request.id,
      requestCode: request.requestCode,
      customerName: request.customerSnapshot.name,
      productName: request.productName,
      status: request.status,
      updatedAt: request.updatedAt,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.requestCode.localeCompare(right.requestCode));
}

function productProfileMissing(request: PgdInspectionRequest): string[] {
  const missing = [
    !hasText(request.productGroup) && 'nhóm sản phẩm',
    !hasText(request.catalogItemId) && 'mã catalog',
    !hasText(request.productName) && 'tên sản phẩm',
  ].filter(Boolean) as string[];
  const details = request.productDetails || {};
  if (request.productGroup === 'STEEL_METAL') {
    if (!hasText(details.grade)) missing.push('mác thép');
    if (!hasText(details.dimensions)) missing.push('kích thước');
    if (!hasText(details.lotDefinition) && !hasText(details.manufacturerLotCode) && !hasText(request.lotCode)) missing.push('thông tin lô');
  } else if (request.productGroup === 'MACHINERY_LINE') {
    if (!details.machinery || (!hasText(details.machinery.model) && !hasText(details.machinery.serialNumber))) missing.push('model/serial máy móc');
  } else if (request.productGroup === 'COAL') {
    if (!details.coal || (!hasText(details.coal.coalType) && !hasText(details.coal.source))) missing.push('nguồn hoặc loại than');
  } else if (!hasText(details.origin) && !hasText(details.countryOfOrigin) && !hasText(details.productForm)) {
    missing.push('quy cách/xuất xứ hàng hóa');
  }
  return missing;
}

export function buildPgdAssistantReview(input: PgdAssistantReviewInput): PgdAssistantReview {
  const { request } = input;
  const assignments = (input.assignments || []).filter((item) => item.requestId === request.id);
  const plans = (input.inspectionPlans || []).filter((item) => item.requestId === request.id);
  const caseEvents = (input.caseEvents || []).filter((item) => item.requestId === request.id);
  const fieldActivityLogs = (input.fieldActivityLogs || []).filter((item) => item.requestId === request.id);
  const inspections = (input.fieldInspections || []).filter((item) => item.requestId === request.id);
  const samples = (input.samples || []).filter((item) => item.requestId === request.id);
  const labRequests = (input.labRequests || []).filter((item) => item.requestId === request.id);
  const labResults = (input.labResults || []).filter((item) => item.requestId === request.id);
  const labReviews = (input.labResultReviews || []).filter((item) => item.requestId === request.id);
  const reports = (input.reports || []).filter((item) => item.requestId === request.id);
  const certificates = (input.certificates || []).filter((item) => item.requestId === request.id);
  const approvals = (input.approvals || []).filter((item) => item.requestId === request.id);
  const documentTexts = input.documentTexts || [];
  const checklist = request.dossierChecklist || [];
  const requiredMissing = checklist.filter((item) => item.required && item.status === 'MISSING');
  const approvedAssignment = assignments.find((item) => item.status === 'APPROVED');
  const completedPlan = plans.find((item) => item.status !== 'DRAFT');
  const completedInspection = inspections.find((item) => item.completed);
  const hasTechnicalApproval = approvals.some((item) => item.role === 'TECHNICAL_REVIEW' && item.status === 'APPROVED');
  const hasLeadershipApproval = approvals.some((item) => item.role === 'LEADERSHIP_APPROVAL' && item.status === 'APPROVED');
  const reportReady = reports.length > 0 && certificates.length > 0;
  const approvalReady = hasTechnicalApproval && hasLeadershipApproval;

  const requesterMissing = [
    !hasText(request.requestCode) && 'mã PYC',
    !hasText(request.intakeChannel) && 'kênh tiếp nhận',
    !hasText(request.requester.name) && 'người yêu cầu',
  ].filter(Boolean) as string[];
  const customerMissing = [
    !hasText(request.customerSnapshot.name) && 'tên khách hàng',
    !hasText(request.customerSnapshot.address) && 'địa chỉ khách hàng',
    !hasText(request.customerSnapshot.contactPerson) && 'người liên hệ',
  ].filter(Boolean) as string[];
  const scopeMissing = [
    !hasText(request.inspectionScope) && 'phạm vi',
    !hasText(request.inspectionLocation) && 'địa điểm',
    request.standards.length === 0 && 'tiêu chuẩn',
    !hasText(request.method || request.assessmentMethod) && 'phương thức',
  ].filter(Boolean) as string[];
  const planValid = Boolean(completedPlan && completedPlan.team.length > 0 && completedPlan.productLines.length > 0 && completedPlan.schedule.length > 0);
  const fieldEvidenceValid = Boolean(completedInspection && (
    (completedInspection.evidenceAssetIds || []).length > 0
    || hasText(completedInspection.lotObservation)
    || Object.keys(completedInspection.measurements || {}).length > 0
    || hasText(completedInspection.inspectionResult)
    || fieldActivityLogs.some((item) => item.entries.length > 0)
    || caseEvents.some((item) => (item.evidenceAssetIds || []).length > 0 || item.customerConfirmed === true)
  ));
  const sampleMissing = samples.flatMap((sample) => [
    !hasText(sample.sampleCode) && `${sample.id}: mã mẫu`,
    !hasText(sample.sealNumber) && `${sample.id}: niêm phong`,
    !hasText(sample.sampledAt) && `${sample.id}: thời điểm lấy mẫu`,
    !hasText(sample.samplingLocation) && `${sample.id}: địa điểm lấy mẫu`,
    !hasText(sample.handedOverAt) && `${sample.id}: bàn giao`,
  ].filter(Boolean) as string[]);
  const pendingLabRequests = labRequests.filter((item) => !['RESULT_RECEIVED', 'CLOSED'].includes(item.status) || !item.resultId);
  const missingLabResults = labRequests.filter((item) => !labResults.some((result) => result.labRequestId === item.id));
  const unacceptedLabResults = labResults.filter((item) => !item.acceptedAt);
  const finalLabReview = labReviews.find((item) => item.status === 'FINAL');
  const profileMissing = productProfileMissing(request);

  const criteria: PgdAssistantCriterion[] = [
    criterion('REQUEST_IDENTITY', requesterMissing.length > 0 ? 'ERROR' : 'PASS', requesterMissing.length > 0 ? 'Thông tin nhận diện PYC chưa đủ để xác định nguồn yêu cầu.' : 'PYC có mã, kênh tiếp nhận và người yêu cầu để đối chiếu.', [`requests:${request.id}`], requesterMissing.length > 0 ? [missingFinding('request-identity-missing', requesterMissing, 'Bổ sung thông tin nhận diện PYC và người yêu cầu.')] : []),
    criterion('CUSTOMER_CONTACT', customerMissing.length > 0 ? 'ERROR' : 'PASS', customerMissing.length > 0 ? 'Ảnh chụp khách hàng còn thiếu thông tin liên hệ.' : 'Ảnh chụp khách hàng có tên, địa chỉ và đầu mối liên hệ.', [`requests:${request.id}`], customerMissing.length > 0 ? [missingFinding('customer-contact-missing', customerMissing, 'Đối chiếu và bổ sung snapshot khách hàng trước khi lập kết quả.')] : []),
    criterion('PRODUCT_PROFILE', profileMissing.length > 0 ? 'WARNING' : 'PASS', profileMissing.length > 0 ? 'Thông tin đối tượng/sản phẩm chưa đủ chi tiết theo nhóm PGD.' : 'Đối tượng và thông tin sản phẩm phù hợp với nhóm PGD đã chọn.', [`requests:${request.id}`, `catalog:${request.catalogItemId}`], profileMissing.length > 0 ? [missingFinding('product-profile-missing', profileMissing, 'Bổ sung thông tin đặc thù của sản phẩm và đối chiếu với catalog/tiêu chuẩn.')] : []),
    criterion('SCOPE_AND_STANDARDS', scopeMissing.length > 0 ? 'ERROR' : 'PASS', scopeMissing.length > 0 ? 'Phạm vi kiểm tra chưa đủ cơ sở để đối chiếu phương thức.' : 'Phạm vi, địa điểm, tiêu chuẩn và phương thức đã được khai báo.', [`requests:${request.id}`], scopeMissing.length > 0 ? [missingFinding('scope-standards-missing', scopeMissing, 'Bổ sung phạm vi, tiêu chuẩn và phương thức áp dụng trong PYC.')] : []),
    criterion('DOSSIER_DOCUMENTS', requiredMissing.length > 0 ? 'ERROR' : documentTexts.length > 0 || (request.documentPointers || []).some((item) => Boolean(item.assetId)) || checklist.some((item) => item.status === 'PRESENT' || item.status === 'WAIVED') ? 'PASS' : 'NOT_EVALUABLE', requiredMissing.length > 0 ? 'Danh mục hồ sơ còn tài liệu bắt buộc chưa có.' : documentTexts.length > 0 || checklist.length > 0 ? 'Đã có dữ liệu danh mục hồ sơ hoặc nội dung tài liệu để đối chiếu.' : 'Chưa có tệp/danh mục hồ sơ đủ căn cứ để đánh giá.', [`requests:${request.id}`, ...(documentTexts.length > 0 ? documentTexts.slice(0, 6).map((item) => `file_assets:${item.assetId}`) : [])], requiredMissing.length > 0 ? [missingFinding('dossier-documents-missing', requiredMissing.map((item) => item.title || item.requirementCode), 'Bổ sung hoặc ghi nhận miễn trừ có căn cứ cho tài liệu bắt buộc.')] : documentTexts.length === 0 && checklist.length === 0 ? [{ id: 'dossier-documents-unavailable', message: 'Chưa đọc được bộ hồ sơ tài liệu để đối chiếu.', suggestedAction: 'Nạp file private PGD hoặc mở hồ sơ để kiểm tra thủ công.' }] : []),
    criterion('ASSIGNMENT_CAPABILITY', approvedAssignment && approvedAssignment.inspectorUsernames.length > 0 ? 'PASS' : 'NOT_EVALUABLE', approvedAssignment && approvedAssignment.inspectorUsernames.length > 0 ? 'Đã có phân công được phê duyệt và có người thực hiện.' : 'Chưa có phân công được phê duyệt kèm người thực hiện.', approvedAssignment ? [`assignments:${approvedAssignment.id}`] : [`requests:${request.id}`], approvedAssignment && approvedAssignment.inspectorUsernames.length > 0 ? [] : [{ id: 'assignment-capability-missing', message: 'Chưa thể xác định năng lực/phân công của đoàn giám định.', suggestedAction: 'Đối chiếu phân công, người phụ trách và phê duyệt đúng vai trò PGD.' }]),
    criterion('INSPECTION_PLAN', planValid ? 'PASS' : 'NOT_EVALUABLE', planValid ? 'Kế hoạch có đoàn, dòng sản phẩm và lịch thực hiện.' : 'Chưa có kế hoạch đủ cấu phần để đối chiếu thiết bị/lịch.', completedPlan ? [`inspectionPlans:${completedPlan.id}`] : [`requests:${request.id}`], planValid ? [] : [{ id: 'inspection-plan-missing', message: 'Thiếu kế hoạch hoặc kế hoạch chưa đủ thành phần.', suggestedAction: 'Bổ sung kế hoạch, lịch thực hiện, đoàn và thiết bị/bằng chứng liên quan.' }]),
    criterion('FIELD_EVIDENCE', fieldEvidenceValid ? 'PASS' : 'NOT_EVALUABLE', fieldEvidenceValid ? 'Có biên bản hiện trường hoàn tất và dấu vết hoạt động/bằng chứng.' : 'Chưa đủ biên bản hiện trường và bằng chứng để kết luận.', completedInspection ? [`fieldInspections:${completedInspection.id}`] : [`requests:${request.id}`], fieldEvidenceValid ? [] : [{ id: 'field-evidence-missing', message: 'Chưa thể đánh giá đầy đủ biên bản/bằng chứng hiện trường.', suggestedAction: 'Bổ sung biên bản hoàn tất, ảnh/file bằng chứng hoặc nhật ký hoạt động hiện trường.' }]),
    criterion('SAMPLING_CHAIN', samples.length === 0 ? 'NOT_EVALUABLE' : sampleMissing.length > 0 ? 'WARNING' : 'PASS', samples.length === 0 ? 'Chưa có mẫu để đánh giá chuỗi lấy mẫu.' : sampleMissing.length > 0 ? 'Mẫu đã có nhưng còn thiếu dấu vết niêm phong/bàn giao.' : 'Mẫu có mã, niêm phong, lấy mẫu và bàn giao để truy xuất.', samples.length > 0 ? samples.map((item) => `samples:${item.id}`) : [`requests:${request.id}`], samples.length === 0 ? [{ id: 'sampling-chain-missing', message: 'Chưa có mẫu liên kết với PYC.', suggestedAction: 'Bổ sung mã mẫu và bằng chứng lấy mẫu/bàn giao.' }] : sampleMissing.length > 0 ? [missingFinding('sampling-chain-incomplete', sampleMissing, 'Bổ sung dấu vết còn thiếu của chuỗi lấy mẫu.')] : []),
    criterion('LAB_RESULTS_REVIEW', labRequests.length === 0 || pendingLabRequests.length > 0 || missingLabResults.length > 0 ? 'NOT_EVALUABLE' : unacceptedLabResults.length > 0 || !finalLabReview ? 'WARNING' : finalLabReview.conformity === 'NON_CONFORMING' ? 'ERROR' : 'PASS', labRequests.length === 0 ? 'Chưa có yêu cầu PTN để đánh giá.' : pendingLabRequests.length > 0 || missingLabResults.length > 0 ? 'Chưa nhận đủ kết quả cho các yêu cầu PTN.' : !finalLabReview ? 'Đã có kết quả nhưng chưa có bản đánh giá kết quả cuối.' : finalLabReview.conformity === 'NON_CONFORMING' ? 'Bản đánh giá kết quả ghi nhận không phù hợp.' : 'Kết quả PTN đã nhận và có đánh giá cuối để đối chiếu.', [...labRequests.map((item) => `labRequests:${item.id}`), ...labResults.map((item) => `labResults:${item.id}`), ...(finalLabReview ? [`labResultReviews:${finalLabReview.id}`] : [])], labRequests.length === 0 || pendingLabRequests.length > 0 || missingLabResults.length > 0 ? [{ id: 'lab-results-missing', message: 'Chưa thể kết luận KQTN đã đầy đủ cho toàn bộ yêu cầu.', suggestedAction: 'Đối chiếu trạng thái PYC PTN, KQTN nhận về và bản đánh giá kết quả.' }] : unacceptedLabResults.length > 0 || !finalLabReview ? [{ id: 'lab-review-pending', message: 'KQTN còn chờ chấp nhận hoặc xem xét cuối.', suggestedAction: 'Hoàn tất xác nhận và lập bản đánh giá kết quả trước khi lập báo cáo.' }] : finalLabReview.conformity === 'NON_CONFORMING' ? [{ id: 'lab-review-nonconforming', message: 'Kết quả được đánh giá là không phù hợp.', suggestedAction: 'Ghi nhận xử lý không phù hợp hoặc yêu cầu đánh giá lại theo quy trình.' }] : []),
    criterion('REPORT_APPROVAL_RETURN', !reportReady ? 'NOT_EVALUABLE' : !approvalReady || reports.some((item) => !hasText(item.conclusion)) ? 'WARNING' : 'PASS', !reportReady ? 'Chưa đủ báo cáo và chứng thư để xem xét.' : !approvalReady ? 'Đã có báo cáo/chứng thư nhưng chưa đủ chain phê duyệt PGD.' : reports.some((item) => !hasText(item.conclusion)) ? 'Báo cáo còn thiếu kết luận.' : 'Đã có báo cáo, chứng thư và chain phê duyệt để đối chiếu.', [...reports.map((item) => `reports:${item.id}`), ...certificates.map((item) => `certificates:${item.id}`), ...approvals.map((item) => `approvals:${item.id}`)], !reportReady ? [{ id: 'report-evidence-missing', message: 'Chưa thể kết luận báo cáo/chứng thư đã sẵn sàng.', suggestedAction: 'Hoàn tất báo cáo và chứng thư trước khi xem xét chain phê duyệt.' }] : !approvalReady ? [{ id: 'approval-chain-pending', message: 'Chain phê duyệt PGD chưa đầy đủ.', suggestedAction: 'Đối chiếu đủ phê duyệt chuyên môn và phê duyệt lãnh đạo.' }] : reports.some((item) => !hasText(item.conclusion)) ? [{ id: 'report-conclusion-missing', message: 'Báo cáo chưa có kết luận kỹ thuật.', suggestedAction: 'Bổ sung kết luận dựa trên bằng chứng và kết quả PTN.' }] : []),
  ];

  for (const file of input.unreadableFiles || []) {
    const target = criteria.find((item) => item.id === file.criterionId);
    if (!target) continue;
    target.findings.push({
      id: `${file.criterionId}:file-not-readable:${file.assetId}`,
      message: `Chưa đọc được ${file.fileName}; cần đối chiếu thủ công.`,
      detail: file.reason,
      suggestedAction: 'Mở hồ sơ PGD và bổ sung bản PDF/DOCX nếu cần.',
      evidence: [{ assetId: file.assetId, fileName: file.fileName, ...(file.documentId ? { documentId: file.documentId } : {}), ...(file.documentType ? { documentType: file.documentType } : {}), tab: file.tab }],
    });
    target.status = 'NOT_EVALUABLE';
    target.summary = 'Một phần tài liệu chưa đọc được; cần người phụ trách đối chiếu tệp gốc.';
  }

  return { domain: 'PGD', requestId: request.id, readOnly: true, criteria, summary: summarize(criteria) };
}
