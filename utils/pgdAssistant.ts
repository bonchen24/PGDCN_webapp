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

export type PgdAssistantCriterionStatus = 'PASS' | 'WARNING' | 'ERROR' | 'NOT_EVALUABLE';

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
  criterionId: PgdAssistantCriterion['id'];
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
  id: 'INTAKE_CAPABILITY' | 'PREPARATION' | 'FIELD_SAMPLING' | 'LAB_RESULTS' | 'REPORT_APPROVAL_RETURN';
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
  fieldInspections?: PgdFieldInspection[];
  samples?: PgdSample[];
  labRequests?: PgdLabRequest[];
  labResults?: PgdLabResult[];
  reports?: PgdInspectionReport[];
  certificates?: PgdInspectionCertificate[];
  approvals?: PgdApprovalStep[];
  documentTexts?: PgdAssistantTextEvidence[];
  unreadableFiles?: PgdAssistantUnreadableFile[];
};

const terminalStatuses = new Set<PgdInspectionRequest['status']>(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED']);

function criterion(
  id: PgdAssistantCriterion['id'],
  title: string,
  status: PgdAssistantCriterionStatus,
  summary: string,
  provenance: string[],
  findings: PgdAssistantFinding[] = [],
): PgdAssistantCriterion {
  return { id, title, status, summary, source: 'RULES', provenance, findings };
}

function summarize(criteria: PgdAssistantCriterion[]): PgdAssistantReview['summary'] {
  const pass = criteria.filter((item) => item.status === 'PASS').length;
  const warning = criteria.filter((item) => item.status === 'WARNING').length;
  const error = criteria.filter((item) => item.status === 'ERROR').length;
  const notEvaluable = criteria.filter((item) => item.status === 'NOT_EVALUABLE').length;
  const conclusion = error > 0 ? 'Cần xử lý lỗi trước khi xem xét tiếp.' : notEvaluable > 0 ? 'Chưa đủ căn cứ cho toàn bộ trạm nghiệp vụ.' : warning > 0 ? 'Có cảnh báo cần người phụ trách đối chiếu.' : 'Bằng chứng hiện có phù hợp với các trạm PGD.';
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

export function buildPgdAssistantReview(input: PgdAssistantReviewInput): PgdAssistantReview {
  const { request } = input;
  const assignments = (input.assignments || []).filter((item) => item.requestId === request.id);
  const inspections = (input.fieldInspections || []).filter((item) => item.requestId === request.id);
  const samples = (input.samples || []).filter((item) => item.requestId === request.id);
  const labRequests = (input.labRequests || []).filter((item) => item.requestId === request.id);
  const labResults = (input.labResults || []).filter((item) => item.requestId === request.id);
  const reports = (input.reports || []).filter((item) => item.requestId === request.id);
  const certificates = (input.certificates || []).filter((item) => item.requestId === request.id);
  const approvals = (input.approvals || []).filter((item) => item.requestId === request.id);
  const hasTechnicalApproval = approvals.some((item) => item.role === 'TECHNICAL_REVIEW' && item.status === 'APPROVED');
  const hasLeadershipApproval = approvals.some((item) => item.role === 'LEADERSHIP_APPROVAL' && item.status === 'APPROVED');
  const reportReady = reports.length > 0 && certificates.length > 0;
  const approvalReady = hasTechnicalApproval && hasLeadershipApproval;

  const intakeMissing = [
    !request.customerSnapshot.name && 'CUSTOMER',
    !request.productName && 'PRODUCT',
    !request.inspectionScope && 'SCOPE',
    !request.inspectionLocation && 'LOCATION',
    request.standards.length === 0 && 'STANDARDS',
  ].filter(Boolean) as string[];
  const criteria: PgdAssistantCriterion[] = [
    criterion(
      'INTAKE_CAPABILITY',
      'Tiếp nhận & năng lực',
      intakeMissing.length > 0 ? 'ERROR' : 'PASS',
      intakeMissing.length > 0 ? 'PYC còn thiếu thông tin nền tảng để xem xét năng lực.' : 'PYC có đủ thông tin chính để đối chiếu phạm vi và năng lực.',
      [`requests:${request.id}`],
      intakeMissing.length > 0 ? [{ id: 'intake-missing', message: `Thiếu trường: ${intakeMissing.join(', ')}.`, suggestedAction: 'Bổ sung PYC trước khi chuyển sang trạm tiếp theo.' }] : [],
    ),
    criterion(
      'PREPARATION',
      'Chuẩn bị & phân công',
      assignments.some((item) => item.status === 'APPROVED') ? 'PASS' : 'NOT_EVALUABLE',
      assignments.some((item) => item.status === 'APPROVED') ? 'Đã có phân công được phê duyệt.' : 'Chưa có bằng chứng phân công được phê duyệt.',
      assignments.length > 0 ? assignments.map((item) => `assignments:${item.id}`) : [`requests:${request.id}`],
      assignments.some((item) => item.status === 'APPROVED') ? [] : [{ id: 'assignment-pending', message: 'Chưa thể kết luận trạm chuẩn bị.', suggestedAction: 'Đối chiếu phân công và phê duyệt đúng vai trò PGD.' }],
    ),
    criterion(
      'FIELD_SAMPLING',
      'Hiện trường & lấy mẫu',
      inspections.some((item) => item.completed) && samples.length > 0 ? 'PASS' : 'NOT_EVALUABLE',
      inspections.some((item) => item.completed) && samples.length > 0 ? 'Có biên bản hiện trường hoàn tất và mẫu liên quan.' : 'Chưa đủ biên bản hiện trường hoàn tất hoặc mẫu liên quan.',
      [...(inspections.length > 0 ? inspections.map((item) => `fieldInspections:${item.id}`) : []), ...(samples.length > 0 ? samples.map((item) => `samples:${item.id}`) : [`requests:${request.id}`])],
      inspections.some((item) => item.completed) && samples.length > 0 ? [] : [{ id: 'field-evidence-missing', message: 'Chưa thể đánh giá đầy đủ hiện trường/lấy mẫu.', suggestedAction: 'Bổ sung biên bản hiện trường, mã mẫu và bằng chứng bàn giao.' }],
    ),
    criterion(
      'LAB_RESULTS',
      'PTN & xem xét kết quả',
      labRequests.length === 0 || labRequests.some((item) => !['RESULT_RECEIVED', 'CLOSED'].includes(item.status)) || labResults.length < labRequests.length
        ? 'NOT_EVALUABLE'
        : labResults.some((item) => !item.acceptedAt) ? 'WARNING' : 'PASS',
      labRequests.length === 0 ? 'Chưa có yêu cầu PTN để xem xét.' : labResults.length < labRequests.length ? 'Chưa nhận đủ kết quả cho các yêu cầu PTN.' : labResults.some((item) => !item.acceptedAt) ? 'Đã nhận kết quả nhưng còn kết quả chưa được người phụ trách chấp nhận.' : 'Các yêu cầu PTN đã có kết quả để đối chiếu.',
      [...(labRequests.length > 0 ? labRequests.map((item) => `labRequests:${item.id}`) : []), ...(labResults.length > 0 ? labResults.map((item) => `labResults:${item.id}`) : [`requests:${request.id}`])],
      labRequests.length === 0 || labRequests.some((item) => !['RESULT_RECEIVED', 'CLOSED'].includes(item.status)) || labResults.length < labRequests.length
        ? [{ id: 'lab-evidence-missing', message: 'Chưa thể kết luận kết quả PTN đã đầy đủ.', suggestedAction: 'Đối chiếu trạng thái PYC PTN, kết quả nhận về và xác nhận xem xét.' }]
        : labResults.some((item) => !item.acceptedAt) ? [{ id: 'lab-acceptance-pending', message: 'Còn kết quả PTN chưa được chấp nhận.', suggestedAction: 'Người xem xét kỹ thuật cần ghi nhận kết luận đối chiếu.' }] : [],
    ),
    criterion(
      'REPORT_APPROVAL_RETURN',
      'Báo cáo, phê duyệt & trả kết quả',
      !reportReady ? 'NOT_EVALUABLE' : !approvalReady || reports.some((item) => !item.conclusion) ? 'WARNING' : 'PASS',
      !reportReady ? 'Chưa đủ báo cáo và chứng thư để xem xét.' : !approvalReady ? 'Đã có báo cáo/chứng thư nhưng chưa đủ chain phê duyệt PGD.' : reports.some((item) => !item.conclusion) ? 'Báo cáo còn thiếu kết luận.' : 'Đã có báo cáo, chứng thư và chain phê duyệt để đối chiếu.',
      [...(reports.length > 0 ? reports.map((item) => `reports:${item.id}`) : []), ...(certificates.length > 0 ? certificates.map((item) => `certificates:${item.id}`) : []), ...(approvals.length > 0 ? approvals.map((item) => `approvals:${item.id}`) : [`requests:${request.id}`])],
      !reportReady ? [{ id: 'report-evidence-missing', message: 'Chưa thể kết luận trạm phát hành/trả kết quả.', suggestedAction: 'Hoàn tất báo cáo, phê duyệt và dự thảo chứng thư trước khi ký.' }] : !approvalReady ? [{ id: 'approval-chain-pending', message: 'Chain phê duyệt PGD chưa đầy đủ.', suggestedAction: 'Đối chiếu đủ phê duyệt chuyên môn và phê duyệt lãnh đạo trước khi ký/trả kết quả.' }] : reports.some((item) => !item.conclusion) ? [{ id: 'report-conclusion-missing', message: 'Báo cáo chưa có kết luận kỹ thuật.', suggestedAction: 'Bổ sung kết luận dựa trên bằng chứng và kết quả PTN.' }] : [],
    ),
  ];

  for (const file of input.unreadableFiles || []) {
    const target = criteria.find((item) => item.id === file.criterionId);
    if (!target) continue;
    target.findings.push({
      id: `${file.criterionId}:file-not-readable:${file.assetId}`,
      message: `Chưa đọc được ${file.fileName}; cần đối chiếu thủ công.`,
      detail: file.reason,
      suggestedAction: 'Mở hồ sơ PGD và bổ sung bản PDF/DOCX nếu cần.',
      evidence: [{
        assetId: file.assetId,
        fileName: file.fileName,
        ...(file.documentId ? { documentId: file.documentId } : {}),
        ...(file.documentType ? { documentType: file.documentType } : {}),
        tab: file.tab,
      }],
    });
    target.status = 'NOT_EVALUABLE';
    target.summary = 'Một phần tài liệu chưa đọc được; cần người phụ trách đối chiếu file gốc.';
  }

  return { domain: 'PGD', requestId: request.id, readOnly: true, criteria, summary: summarize(criteria) };
}
