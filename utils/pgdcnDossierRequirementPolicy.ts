import type {
  PgdcnDossierRequirementCondition,
  PgdcnDossierRequirementDefaultClass,
  PgdcnDossierRequirementPolicy,
  PgdcnDossierRequirementSourceMode,
} from '../types.ts';

export type DossierRequirementDefaultClass = PgdcnDossierRequirementDefaultClass;
export type DossierRequirementSourceMode = PgdcnDossierRequirementSourceMode;
export type DossierRequirementDomain = 'PCN' | 'PGD';
export type DossierRequirementCondition = PgdcnDossierRequirementCondition;
export type DossierRequirementPolicy = PgdcnDossierRequirementPolicy;

export type DossierRequirementContext =
  | { domain: 'PCN'; fieldCodes?: readonly string[] }
  | { domain: 'PGD'; productGroup?: string; method?: string };

export interface DossierRequirementPolicyProjection {
  applicability: 'APPLICABLE' | 'NOT_APPLICABLE';
  required: boolean;
}

export const PGD_REQUIREMENT_METHOD_CODES = [
  'TT58',
  'GENERIC',
  'QT-GĐ-02',
  'QT-GĐ-03',
  'QT-GĐ-04',
  'QT-GĐ-05',
  'QT-GĐ-06',
  'QT-GĐ-07',
  'QT-GĐ-08',
  'QT-GĐ-09',
  'QT-GĐ-10',
  'QT-GĐ-12',
  'QT-GĐ-14',
] as const;
const PGD_METHOD_CODES = new Set<string>(PGD_REQUIREMENT_METHOD_CODES);

const DEFAULT_CLASSES = new Set<DossierRequirementDefaultClass>([
  'DEFAULT_REQUIRED',
  'DEFAULT_CONDITIONAL',
  'DEFAULT_OPTIONAL',
  'FREE_ADDITIONAL',
]);
const SOURCE_MODES = new Set<DossierRequirementSourceMode>(['CREATE_DOCX', 'UPLOAD', 'EXTERNAL_PTN', 'MULTI']);

function conditionMatches(condition: DossierRequirementCondition, context: DossierRequirementContext): boolean {
  if (condition.key === 'PCN_FIELD') {
    return context.domain === 'PCN' && condition.values.some((value) => context.fieldCodes?.includes(value));
  }
  if (condition.key === 'PGD_PRODUCT_GROUP') {
    return context.domain === 'PGD' && condition.values.includes(context.productGroup as 'STEEL_METAL' | 'MACHINERY_LINE' | 'COAL' | 'OTHER');
  }
  return context.domain === 'PGD' && condition.values.includes(String(context.method || ''));
}

export function projectDossierRequirementPolicy(
  policy: DossierRequirementPolicy,
  context: DossierRequirementContext,
): DossierRequirementPolicyProjection {
  const conditions = policy.appliesWhen?.conditions || [];
  const matches = !conditions.length || (policy.appliesWhen?.operator === 'ANY'
    ? conditions.some((condition) => conditionMatches(condition, context))
    : conditions.every((condition) => conditionMatches(condition, context)));
  if (!matches) return { applicability: 'NOT_APPLICABLE', required: false };
  return {
    applicability: 'APPLICABLE',
    required: policy.defaultClass === 'DEFAULT_REQUIRED' || policy.defaultClass === 'DEFAULT_CONDITIONAL',
  };
}

export function validateDossierRequirementPolicy(
  value: unknown,
  domain: DossierRequirementDomain,
): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Cấu hình yêu cầu tài liệu không hợp lệ.'];
  const policy = value as Partial<DossierRequirementPolicy>;
  if (!DEFAULT_CLASSES.has(policy.defaultClass as DossierRequirementDefaultClass)) errors.push('Phân loại yêu cầu tài liệu không hợp lệ.');
  if (!SOURCE_MODES.has(policy.sourceMode as DossierRequirementSourceMode)) errors.push('Nguồn tạo tài liệu không hợp lệ.');
  const cardinality = policy.cardinality;
  if (!cardinality || !Number.isInteger(cardinality.min) || cardinality.min < 1
    || (cardinality.max !== undefined && (!Number.isInteger(cardinality.max) || cardinality.max < cardinality.min))) {
    errors.push('Số lượng tài liệu phải có mức tối thiểu từ 1 và mức tối đa không nhỏ hơn mức tối thiểu.');
  }

  const appliesWhen = policy.appliesWhen;
  if (policy.defaultClass === 'DEFAULT_CONDITIONAL' && (!appliesWhen || !Array.isArray(appliesWhen.conditions) || appliesWhen.conditions.length === 0)) {
    errors.push('Yêu cầu có điều kiện phải cấu hình ít nhất một điều kiện trong danh mục cho phép.');
  }
  if (appliesWhen) {
    if (!['ALL', 'ANY'].includes(appliesWhen.operator) || !Array.isArray(appliesWhen.conditions) || appliesWhen.conditions.length === 0) {
      errors.push('Cấu hình điều kiện áp dụng không hợp lệ.');
    } else {
      for (const condition of appliesWhen.conditions) {
        if (!condition || !Array.isArray(condition.values) || condition.values.length === 0) {
          errors.push('Điều kiện áp dụng phải có giá trị thuộc danh mục cho phép.');
          continue;
        }
        if (condition.key === 'PCN_FIELD') {
          if (domain !== 'PCN' || condition.values.some((item) => !['QC4', 'QC9'].includes(String(item)))) {
            errors.push('Điều kiện lĩnh vực chỉ chấp nhận QC4 hoặc QC9 thuộc miền PCN.');
          }
        } else if (condition.key === 'PGD_PRODUCT_GROUP') {
          if (domain !== 'PGD' || condition.values.some((item) => !['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].includes(String(item)))) {
            errors.push('Điều kiện nhóm sản phẩm PGD không thuộc danh mục cho phép.');
          }
        } else if (condition.key === 'PGD_METHOD') {
          if (domain !== 'PGD' || condition.values.some((item) => !PGD_METHOD_CODES.has(String(item)))) {
            errors.push('Điều kiện phương pháp PGD không thuộc danh mục cho phép.');
          }
        } else {
          errors.push('Điều kiện áp dụng không thuộc danh mục cho phép.');
        }
      }
    }
  }
  return [...new Set(errors)];
}
