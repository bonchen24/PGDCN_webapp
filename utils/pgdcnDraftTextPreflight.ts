export type PgdcnDraftTextIssueCode =
  | 'required-empty'
  | 'double-space'
  | 'space-before-punctuation'
  | 'unfilled-placeholder'
  | 'broken-placeholder'
  | 'repeated-punctuation';

export type PgdcnDraftTextIssueSeverity = 'warning';

export interface PgdcnDraftTextIssue {
  code: PgdcnDraftTextIssueCode;
  severity: PgdcnDraftTextIssueSeverity;
  message: string;
  offset?: number;
}

export interface PgdcnDraftTextPreflightOptions {
  required?: boolean;
  placeholderKeys?: readonly string[];
}

const identifierPattern = /^[\p{L}\p{N}_][\p{L}\p{N}_.:-]*$/u;

function isLikelyPlaceholder(value: string, knownKeys?: ReadonlySet<string>): boolean {
  const candidate = value.trim();

  if (knownKeys !== undefined) {
    return [...knownKeys].some((key) => key === candidate);
  }

  return candidate.length >= 2 && identifierPattern.test(candidate);
}

function isLikelyBrokenPlaceholder(
  value: string,
  knownKeys?: ReadonlySet<string>,
): boolean {
  const candidate = value.trim();

  if (knownKeys !== undefined) {
    return [...knownKeys].some(
      (key) => key.startsWith(candidate) || candidate.startsWith(key),
    );
  }

  return candidate.length >= 2 && identifierPattern.test(candidate);
}

/** Stable, non-mutating PCN/PGD draft-text preflight. With placeholderKeys, only listed keys are treated as markers; without them, identifier-like brace contents are recognized except one-character math variables. Offsets are zero-based UTF-16 positions in the original text. */
export function preflightPgdcnDraftText(
  currentText: string,
  options: PgdcnDraftTextPreflightOptions = {},
): PgdcnDraftTextIssue[] {
  const issues: PgdcnDraftTextIssue[] = [];
  const knownKeys = options.placeholderKeys === undefined
    ? undefined
    : new Set(options.placeholderKeys.map((key) => key.trim()).filter(Boolean));

  const addIssue = (
    code: PgdcnDraftTextIssueCode,
    message: string,
    offset?: number,
  ) => {
    issues.push({ code, severity: 'warning', message, ...(offset === undefined ? {} : { offset }) });
  };

  if (options.required && currentText.trim().length === 0) {
    addIssue('required-empty', 'Trường bắt buộc đang để trống.');
    return issues;
  }

  for (const match of currentText.matchAll(/ {2,}/g)) {
    addIssue('double-space', 'Có nhiều dấu cách liên tiếp; hãy kiểm tra khoảng trắng.', match.index);
  }

  for (const match of currentText.matchAll(/[ \t]+([,;:!?]|\.(?!\d))/g)) {
    addIssue(
      'space-before-punctuation',
      'Có khoảng trắng trước dấu câu; hãy kiểm tra vị trí dấu câu.',
      match.index,
    );
  }

  const openingBraces: number[] = [];
  for (let index = 0; index < currentText.length; index += 1) {
    const character = currentText[index];
    if (character === '{') {
      openingBraces.push(index);
      continue;
    }
    if (character !== '}') continue;

    const openingIndex = openingBraces.pop();
    if (openingIndex === undefined) {
      const beforeBrace = currentText.slice(0, index).trimEnd();
      const malformedKey = knownKeys === undefined
        ? beforeBrace.match(/[\p{L}\p{N}_][\p{L}\p{N}_.:-]*$/u)?.[0]
        : [...knownKeys].find((key) => beforeBrace.endsWith(key));
      if (malformedKey && isLikelyBrokenPlaceholder(malformedKey, knownKeys)) {
        addIssue('broken-placeholder', 'Placeholder đang thiếu dấu ngoặc mở `{`.', index);
      }
      continue;
    }

    if (openingBraces.length > 0) continue;

    const content = currentText.slice(openingIndex + 1, index);
    if (content.includes('{') || content.includes('}')) {
      addIssue('broken-placeholder', 'Placeholder có dấu ngoặc lồng nhau; hãy kiểm tra lại cú pháp.', openingIndex);
    } else if (content.trim().length === 0) {
      addIssue('broken-placeholder', 'Placeholder đang trống; hãy điền nội dung hoặc bỏ dấu ngoặc.', openingIndex);
    } else if (isLikelyPlaceholder(content, knownKeys)) {
      addIssue(
        'unfilled-placeholder',
        `Còn placeholder “{${content.trim()}}” chưa được điền.`,
        openingIndex,
      );
    }
  }

  for (const openingIndex of openingBraces) {
    const content = currentText.slice(openingIndex + 1);
    if (isLikelyBrokenPlaceholder(content, knownKeys)) {
      addIssue('broken-placeholder', 'Placeholder đang thiếu dấu ngoặc đóng `}`.', openingIndex);
    }
  }

  for (const match of currentText.matchAll(/[.,;:!?]{2,}/g)) {
    addIssue('repeated-punctuation', 'Có dấu câu lặp liên tiếp; hãy kiểm tra lại.', match.index);
  }

  return issues
    .map((issue, insertionOrder) => ({ issue, insertionOrder }))
    .sort((left, right) => {
      const leftOffset = left.issue.offset ?? -1;
      const rightOffset = right.issue.offset ?? -1;
      return leftOffset - rightOffset || left.insertionOrder - right.insertionOrder;
    })
    .map(({ issue }) => issue);
}
