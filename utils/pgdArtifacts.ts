import { PGD_DOMAIN } from './pgdDomain.ts';

export type PgdPlanStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED';
export type PgdFieldActivitySession = 'MORNING' | 'AFTERNOON';
export type PgdLabReviewCompleteness = 'COMPLETE' | 'INCOMPLETE';
export type PgdLabReviewConformity = 'CONFORMING' | 'NON_CONFORMING' | 'NOT_REVIEWED';
export type PgdDossierIndexEntryStatus = 'PRESENT' | 'MISSING' | 'WAIVED';

export interface PgdInspectionTeamMember {
  username: string;
  role: 'LEAD' | 'INSPECTOR' | 'TECHNICAL_REVIEWER';
  name?: string;
  expertCode?: string;
  phone?: string;
}

export interface PgdProductLine {
  id?: string;
  productName: string;
  grade?: string;
  dimensions?: string;
  standard: string;
  origin?: string;
  manufacturer?: string;
  quantity?: number;
  unit?: string;
  note?: string;
}

export interface PgdInspectionScheduleRow {
  startTime: string;
  endTime?: string;
  activity: string;
  note?: string;
}

export interface PgdSamplingLine {
  sampleCode?: string;
  description: string;
  quantity: number;
  unit?: string;
  destination: 'LAB' | 'RETAINED';
  sealNumber?: string;
  note?: string;
}

export interface PgdInspectionPlanInput {
  id: string;
  requestId: string;
  inspectionDate: string;
  team: PgdInspectionTeamMember[];
  productLines: PgdProductLine[];
  schedule: PgdInspectionScheduleRow[];
  samplingLines?: PgdSamplingLine[];
  criteria?: string;
  assessmentMethod?: string;
  inspectionType?: string;
  note?: string;
  status?: PgdPlanStatus;
}

export interface PgdInspectionPlan extends PgdInspectionPlanInput {
  domain: typeof PGD_DOMAIN;
  status: PgdPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PgdCaseEventInput {
  id: string;
  requestId: string;
  occurredAt: string;
  activity: string;
  actorUsername: string;
  note?: string;
  customerConfirmed?: boolean;
  evidenceAssetIds?: string[];
}

export interface PgdCaseEvent extends PgdCaseEventInput {
  domain: typeof PGD_DOMAIN;
  createdAt: string;
  updatedAt: string;
}

export interface PgdFieldActivityEntry {
  time: string;
  activity: string;
  comments?: string;
}

export interface PgdFieldActivityLogInput {
  id: string;
  requestId: string;
  session: PgdFieldActivitySession;
  auditeeName?: string;
  auditeeCode?: string;
  auditorUsername?: string;
  date?: string;
  entries: PgdFieldActivityEntry[];
  note?: string;
}

export interface PgdFieldActivityLog extends PgdFieldActivityLogInput {
  domain: typeof PGD_DOMAIN;
  createdAt: string;
  updatedAt: string;
}

export interface PgdLabResultReviewInput {
  id: string;
  requestId: string;
  labResultIds: string[];
  completeness: PgdLabReviewCompleteness;
  conformity: PgdLabReviewConformity;
  missingItems?: string[];
  nonconformities?: string[];
  recommendation?: string;
  conclusion: string;
  retestRequired?: boolean;
  retestReason?: string;
  retestSampleId?: string;
  retestRequestedAt?: string;
  retestRequestedByUsername?: string;
  reviewerUsername?: string;
  reviewedAt?: string;
  status?: 'DRAFT' | 'FINAL';
}

export interface PgdLabResultReview extends PgdLabResultReviewInput {
  domain: typeof PGD_DOMAIN;
  status: 'DRAFT' | 'FINAL';
  createdAt: string;
  updatedAt: string;
}

export interface PgdDossierIndexEntry {
  requirementCode: string;
  title: string;
  status: PgdDossierIndexEntryStatus;
  pageCount?: number;
  documentId?: string;
  note?: string;
}

export interface PgdDossierIndexInput {
  id?: string;
  requestId: string;
  entries: PgdDossierIndexEntry[];
  reviewerUsername?: string;
  archivistUsername?: string;
  reviewedAt?: string;
  archiveReference?: string;
}

export interface PgdDossierIndex extends PgdDossierIndexInput {
  id: string;
  domain: typeof PGD_DOMAIN;
  createdAt: string;
  updatedAt: string;
}

export interface PgdArtifactValidationIssue {
  field: string;
  message: string;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function optionalText(value: unknown): string | undefined {
  const text = clean(value);
  return text || undefined;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isIsoDate(value: string): boolean {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(text)) return false;
  return !Number.isNaN(new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text).getTime());
}

function isTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(clean(value)) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3, 5)) < 60;
}

function issue(field: string, message: string): PgdArtifactValidationIssue {
  return { field, message };
}

export function validatePgdInspectionPlan(input: Partial<PgdInspectionPlanInput>): PgdArtifactValidationIssue[] {
  const issues: PgdArtifactValidationIssue[] = [];
  if (!clean(input.id)) issues.push(issue('id', 'Kế hoạch PGD cần có mã định danh.'));
  if (!clean(input.requestId)) issues.push(issue('requestId', 'Kế hoạch PGD cần liên kết hồ sơ.'));
  if (!isIsoDate(clean(input.inspectionDate))) issues.push(issue('inspectionDate', 'Ngày đánh giá không hợp lệ.'));
  if (!Array.isArray(input.team) || input.team.length === 0) issues.push(issue('team', 'Kế hoạch cần có ít nhất một thành viên đoàn giám định.'));
  if (!Array.isArray(input.productLines) || input.productLines.length === 0) issues.push(issue('productLines', 'Kế hoạch cần có ít nhất một dòng sản phẩm.'));
  if (!Array.isArray(input.schedule) || input.schedule.length === 0) issues.push(issue('schedule', 'Kế hoạch cần có ít nhất một mốc thời gian.'));
  for (const [index, member] of (input.team || []).entries()) {
    if (!clean(member?.username)) issues.push(issue(`team[${index}].username`, 'Thành viên đoàn cần có tài khoản.'));
    if (!['LEAD', 'INSPECTOR', 'TECHNICAL_REVIEWER'].includes(String(member?.role || ''))) issues.push(issue(`team[${index}].role`, 'Vai trò đoàn giám định không hợp lệ.'));
  }
  for (const [index, product] of (input.productLines || []).entries()) {
    if (!clean(product?.productName)) issues.push(issue(`productLines[${index}].productName`, 'Dòng sản phẩm cần có tên hàng.'));
    if (!clean(product?.standard)) issues.push(issue(`productLines[${index}].standard`, 'Dòng sản phẩm cần có tiêu chuẩn áp dụng.'));
  }
  for (const [index, row] of (input.schedule || []).entries()) {
    if (!isTime(clean(row?.startTime))) issues.push(issue(`schedule[${index}].startTime`, 'Giờ bắt đầu không hợp lệ.'));
    if (row?.endTime && !isTime(clean(row.endTime))) issues.push(issue(`schedule[${index}].endTime`, 'Giờ kết thúc không hợp lệ.'));
    if (!clean(row?.activity)) issues.push(issue(`schedule[${index}].activity`, 'Mốc thời gian cần có nội dung.'));
  }
  if (input.samplingLines !== undefined && !Array.isArray(input.samplingLines)) issues.push(issue('samplingLines', 'Dòng lấy mẫu dự kiến phải là danh sách.'));
  for (const [index, line] of (input.samplingLines || []).entries()) {
    if (!clean(line?.description)) issues.push(issue(`samplingLines[${index}].description`, 'Dòng lấy mẫu cần có mô tả.'));
    if (!Number.isFinite(line?.quantity) || Number(line.quantity) <= 0) issues.push(issue(`samplingLines[${index}].quantity`, 'Số lượng mẫu dự kiến phải lớn hơn 0.'));
    if (!['LAB', 'RETAINED'].includes(String(line?.destination || ''))) issues.push(issue(`samplingLines[${index}].destination`, 'Đích mẫu chỉ gồm LAB hoặc RETAINED.'));
  }
  return issues;
}

export function createPgdInspectionPlan(input: PgdInspectionPlanInput, now = new Date().toISOString()): PgdInspectionPlan {
  const normalized: PgdInspectionPlanInput = {
    ...clone(input),
    id: clean(input.id),
    requestId: clean(input.requestId),
    inspectionDate: clean(input.inspectionDate),
    team: (input.team || []).map((member) => ({
      ...member,
      username: clean(member.username),
      role: String(member.role || '').trim().toUpperCase() as PgdInspectionTeamMember['role'],
      ...(optionalText(member.name) ? { name: optionalText(member.name) } : {}),
      ...(optionalText(member.expertCode) ? { expertCode: optionalText(member.expertCode) } : {}),
      ...(optionalText(member.phone) ? { phone: optionalText(member.phone) } : {}),
    })),
    productLines: (input.productLines || []).map((product) => ({
      ...product,
      ...(product.id ? { id: clean(product.id) } : {}),
      productName: clean(product.productName),
      standard: clean(product.standard),
      ...(optionalText(product.grade) ? { grade: optionalText(product.grade) } : {}),
      ...(optionalText(product.dimensions) ? { dimensions: optionalText(product.dimensions) } : {}),
      ...(optionalText(product.origin) ? { origin: optionalText(product.origin) } : {}),
      ...(optionalText(product.manufacturer) ? { manufacturer: optionalText(product.manufacturer) } : {}),
      ...(optionalText(product.unit) ? { unit: optionalText(product.unit) } : {}),
      ...(optionalText(product.note) ? { note: optionalText(product.note) } : {}),
    })),
    schedule: (input.schedule || []).map((row) => ({
      ...row,
      startTime: clean(row.startTime),
      ...(row.endTime ? { endTime: clean(row.endTime) } : {}),
      activity: clean(row.activity),
      ...(optionalText(row.note) ? { note: optionalText(row.note) } : {}),
    })),
    samplingLines: (input.samplingLines || []).map((line) => ({
      ...(optionalText(line.sampleCode) ? { sampleCode: optionalText(line.sampleCode) } : {}),
      description: clean(line.description),
      quantity: line.quantity,
      ...(optionalText(line.unit) ? { unit: optionalText(line.unit) } : {}),
      destination: String(line.destination || '').trim().toUpperCase() as PgdSamplingLine['destination'],
      ...(optionalText(line.sealNumber) ? { sealNumber: optionalText(line.sealNumber) } : {}),
      ...(optionalText(line.note) ? { note: optionalText(line.note) } : {}),
    })),
    ...(optionalText(input.criteria) ? { criteria: optionalText(input.criteria) } : {}),
    ...(optionalText(input.assessmentMethod) ? { assessmentMethod: optionalText(input.assessmentMethod) } : {}),
    ...(optionalText(input.inspectionType) ? { inspectionType: optionalText(input.inspectionType) } : {}),
    ...(optionalText(input.note) ? { note: optionalText(input.note) } : {}),
    status: input.status || 'DRAFT',
  };
  const issues = validatePgdInspectionPlan(normalized);
  if (issues.length > 0) throw new Error(`Kế hoạch PGD chưa đủ: ${issues.map((item) => item.field).join(', ')}`);
  return {
    ...clone(normalized),
    domain: PGD_DOMAIN,
    status: input.status || 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };
}

export function validatePgdCaseEvent(input: Partial<PgdCaseEventInput>): PgdArtifactValidationIssue[] {
  const issues: PgdArtifactValidationIssue[] = [];
  if (!clean(input.id)) issues.push(issue('id', 'Diễn biến PGD cần có mã định danh.'));
  if (!clean(input.requestId)) issues.push(issue('requestId', 'Diễn biến PGD cần liên kết hồ sơ.'));
  if (!isIsoDate(clean(input.occurredAt))) issues.push(issue('occurredAt', 'Thời điểm diễn biến không hợp lệ.'));
  if (!clean(input.activity)) issues.push(issue('activity', 'Diễn biến cần có nội dung.'));
  if (!clean(input.actorUsername)) issues.push(issue('actorUsername', 'Diễn biến cần có người thực hiện.'));
  return issues;
}

export function createPgdCaseEvent(input: PgdCaseEventInput, now = new Date().toISOString()): PgdCaseEvent {
  const normalized: PgdCaseEventInput = {
    ...clone(input),
    id: clean(input.id),
    requestId: clean(input.requestId),
    occurredAt: clean(input.occurredAt),
    activity: clean(input.activity),
    actorUsername: clean(input.actorUsername),
    ...(optionalText(input.note) ? { note: optionalText(input.note) } : {}),
    evidenceAssetIds: [...new Set((input.evidenceAssetIds || []).map(clean).filter(Boolean))],
  };
  const issues = validatePgdCaseEvent(normalized);
  if (issues.length > 0) throw new Error(`Diễn biến PGD chưa đủ: ${issues.map((item) => item.field).join(', ')}`);
  return { ...clone(normalized), domain: PGD_DOMAIN, createdAt: now, updatedAt: now };
}

export function validatePgdFieldActivityLog(input: Partial<PgdFieldActivityLogInput>): PgdArtifactValidationIssue[] {
  const issues: PgdArtifactValidationIssue[] = [];
  if (!clean(input.id)) issues.push(issue('id', 'Phiếu ghi chép PGD cần có mã định danh.'));
  if (!clean(input.requestId)) issues.push(issue('requestId', 'Phiếu ghi chép PGD cần liên kết hồ sơ.'));
  if (!['MORNING', 'AFTERNOON'].includes(String(input.session || ''))) issues.push(issue('session', 'Phiên ghi chép chỉ gồm buổi sáng hoặc buổi chiều.'));
  if (!Array.isArray(input.entries) || input.entries.length === 0) issues.push(issue('entries', 'Phiếu ghi chép cần có ít nhất một dòng.'));
  for (const [index, entry] of (input.entries || []).entries()) {
    if (!isTime(clean(entry?.time))) issues.push(issue(`entries[${index}].time`, 'Mốc giờ ghi chép không hợp lệ.'));
    if (!clean(entry?.activity)) issues.push(issue(`entries[${index}].activity`, 'Dòng ghi chép cần có nội dung.'));
  }
  return issues;
}

export function createPgdFieldActivityLog(input: PgdFieldActivityLogInput, now = new Date().toISOString()): PgdFieldActivityLog {
  const normalized: PgdFieldActivityLogInput = {
    ...clone(input),
    id: clean(input.id),
    requestId: clean(input.requestId),
    session: String(input.session || '').trim().toUpperCase() as PgdFieldActivitySession,
    ...(optionalText(input.auditeeName) ? { auditeeName: optionalText(input.auditeeName) } : {}),
    ...(optionalText(input.auditeeCode) ? { auditeeCode: optionalText(input.auditeeCode) } : {}),
    ...(optionalText(input.auditorUsername) ? { auditorUsername: optionalText(input.auditorUsername) } : {}),
    ...(optionalText(input.date) ? { date: optionalText(input.date) } : {}),
    entries: (input.entries || []).map((entry) => ({
      time: clean(entry.time),
      activity: clean(entry.activity),
      ...(optionalText(entry.comments) ? { comments: optionalText(entry.comments) } : {}),
    })),
    ...(optionalText(input.note) ? { note: optionalText(input.note) } : {}),
  };
  const issues = validatePgdFieldActivityLog(normalized);
  if (issues.length > 0) throw new Error(`Phiếu ghi chép PGD chưa đủ: ${issues.map((item) => item.field).join(', ')}`);
  return { ...clone(normalized), domain: PGD_DOMAIN, createdAt: now, updatedAt: now };
}

export function validatePgdLabResultReview(input: Partial<PgdLabResultReviewInput>): PgdArtifactValidationIssue[] {
  const issues: PgdArtifactValidationIssue[] = [];
  if (!clean(input.id)) issues.push(issue('id', 'Bản đánh giá KQTN cần có mã định danh.'));
  if (!clean(input.requestId)) issues.push(issue('requestId', 'Bản đánh giá KQTN cần liên kết hồ sơ.'));
  if (!Array.isArray(input.labResultIds) || input.labResultIds.filter(Boolean).length === 0) issues.push(issue('labResultIds', 'Cần liên kết ít nhất một kết quả PTN.'));
  if (input.completeness !== 'COMPLETE') issues.push(issue('completeness', 'Chưa đủ kết quả PTN để đánh giá.'));
  if (!['CONFORMING', 'NON_CONFORMING'].includes(String(input.conformity || ''))) issues.push(issue('conformity', 'Cần kết luận tình trạng phù hợp của kết quả PTN.'));
  if (!clean(input.conclusion)) issues.push(issue('conclusion', 'Bản đánh giá KQTN cần có kết luận.'));
  if (input.conformity === 'NON_CONFORMING' && input.retestRequired !== true) issues.push(issue('retestRequired', 'Kết quả không phù hợp phải yêu cầu kiểm tra/thử lại mẫu.'));
  if (input.retestRequired === true && !clean(input.retestReason)) issues.push(issue('retestReason', 'Yêu cầu kiểm tra/thử lại phải ghi rõ lý do.'));
  if (input.reviewedAt && !isIsoDate(input.reviewedAt)) issues.push(issue('reviewedAt', 'Thời điểm đánh giá KQTN không hợp lệ.'));
  return issues;
}

export function createPgdLabResultReview(input: PgdLabResultReviewInput, now = new Date().toISOString()): PgdLabResultReview {
  const normalized: PgdLabResultReviewInput = {
    ...clone(input),
    id: clean(input.id),
    requestId: clean(input.requestId),
    labResultIds: [...new Set((input.labResultIds || []).map(clean).filter(Boolean))],
    completeness: String(input.completeness || '').trim().toUpperCase() as PgdLabReviewCompleteness,
    conformity: String(input.conformity || '').trim().toUpperCase() as PgdLabReviewConformity,
    missingItems: [...new Set((input.missingItems || []).map(clean).filter(Boolean))],
    nonconformities: [...new Set((input.nonconformities || []).map(clean).filter(Boolean))],
    ...(optionalText(input.recommendation) ? { recommendation: optionalText(input.recommendation) } : {}),
    conclusion: clean(input.conclusion),
    ...(input.retestRequired === true ? { retestRequired: true } : {}),
    ...(optionalText(input.retestReason) ? { retestReason: optionalText(input.retestReason) } : {}),
    ...(optionalText(input.retestSampleId) ? { retestSampleId: optionalText(input.retestSampleId) } : {}),
    ...(optionalText(input.retestRequestedAt) ? { retestRequestedAt: optionalText(input.retestRequestedAt) } : {}),
    ...(optionalText(input.retestRequestedByUsername) ? { retestRequestedByUsername: optionalText(input.retestRequestedByUsername) } : {}),
    ...(optionalText(input.reviewerUsername) ? { reviewerUsername: optionalText(input.reviewerUsername) } : {}),
    ...(optionalText(input.reviewedAt) ? { reviewedAt: optionalText(input.reviewedAt) } : {}),
    status: input.status || 'FINAL',
  };
  const issues = validatePgdLabResultReview(normalized);
  if (issues.length > 0) throw new Error(`Đánh giá KQTN PGD chưa đủ: ${issues.map((item) => `${item.field}: ${item.message}`).join('; ')}`);
  return { ...clone(normalized), domain: PGD_DOMAIN, status: normalized.status || 'FINAL', createdAt: now, updatedAt: now };
}

export function validatePgdDossierIndex(input: Partial<PgdDossierIndexInput>): PgdArtifactValidationIssue[] {
  const issues: PgdArtifactValidationIssue[] = [];
  if (!clean(input.requestId)) issues.push(issue('requestId', 'Mục lục hồ sơ cần liên kết hồ sơ.'));
  if (!Array.isArray(input.entries) || input.entries.length === 0) issues.push(issue('entries', 'Mục lục hồ sơ cần có ít nhất một tài liệu.'));
  for (const [index, entry] of (input.entries || []).entries()) {
    if (!clean(entry?.requirementCode)) issues.push(issue(`entries[${index}].requirementCode`, 'Tài liệu mục lục cần có mã yêu cầu.'));
    if (!clean(entry?.title)) issues.push(issue(`entries[${index}].title`, 'Tài liệu mục lục cần có tiêu đề.'));
    if (!['PRESENT', 'MISSING', 'WAIVED'].includes(String(entry?.status || ''))) issues.push(issue(`entries[${index}].status`, 'Trạng thái tài liệu mục lục không hợp lệ.'));
    if (entry?.pageCount !== undefined && (!Number.isInteger(entry.pageCount) || entry.pageCount < 1)) issues.push(issue(`entries[${index}].pageCount`, 'Số trang phải là số nguyên dương.'));
  }
  return issues;
}

export function buildPgdDossierIndex(input: PgdDossierIndexInput, now = new Date().toISOString()): PgdDossierIndex {
  const normalized: PgdDossierIndexInput = {
    ...clone(input),
    ...(input.id ? { id: clean(input.id) } : {}),
    requestId: clean(input.requestId),
    entries: (input.entries || []).map((entry) => ({
      ...entry,
      requirementCode: clean(entry.requirementCode),
      title: clean(entry.title),
      status: String(entry.status || '').trim().toUpperCase() as PgdDossierIndexEntryStatus,
      ...(entry.pageCount !== undefined ? { pageCount: entry.pageCount } : {}),
      ...(optionalText(entry.documentId) ? { documentId: optionalText(entry.documentId) } : {}),
      ...(optionalText(entry.note) ? { note: optionalText(entry.note) } : {}),
    })),
    ...(optionalText(input.reviewerUsername) ? { reviewerUsername: optionalText(input.reviewerUsername) } : {}),
    ...(optionalText(input.archivistUsername) ? { archivistUsername: optionalText(input.archivistUsername) } : {}),
    ...(optionalText(input.reviewedAt) ? { reviewedAt: optionalText(input.reviewedAt) } : {}),
    ...(optionalText(input.archiveReference) ? { archiveReference: optionalText(input.archiveReference) } : {}),
  };
  const issues = validatePgdDossierIndex(normalized);
  if (issues.length > 0) throw new Error(`Mục lục hồ sơ PGD chưa đủ: ${issues.map((item) => item.field).join(', ')}`);
  return {
    ...clone(normalized),
    id: clean(normalized.id) || `pgd-dossier-index-${clean(normalized.requestId)}`,
    domain: PGD_DOMAIN,
    createdAt: now,
    updatedAt: now,
  };
}
