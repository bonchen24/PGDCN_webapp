// Author: Codex
// Description: Tolerant OCR label/value extraction shared by PGD and PCN intake.

export function foldOcrLabelForMatch(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

function cleanOcrLine(value: string): string {
  return String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isKnownLabel(value: string, labels: string[]): boolean {
  const normalizedValue = foldOcrLabelForMatch(value);
  return labels.some((label) => {
    const normalizedLabel = foldOcrLabelForMatch(label);
    return normalizedLabel.length > 0 && normalizedValue === normalizedLabel;
  });
}

export function readOcrLabelValue(text: string, labels: string[]): string {
  const lines = String(text || '').split(/\r?\n/).map(cleanOcrLine);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    const colonIndex = line.search(/[:：]/);
    if (colonIndex >= 0 && isKnownLabel(line.slice(0, colonIndex), labels)) {
      const value = line.slice(colonIndex + 1).trim();
      if (value) return value.slice(0, 500);
    }

    const dashMatch = line.match(/\s[-–—]\s/);
    if (dashMatch?.index !== undefined && isKnownLabel(line.slice(0, dashMatch.index), labels)) {
      const value = line.slice(dashMatch.index + dashMatch[0].length).trim();
      if (value) return value.slice(0, 500);
    }

    if (isKnownLabel(line, labels)) {
      const previousLine = lines[index - 1] || '';
      const nextLine = lines[index + 1] || '';
      const nextValue = nextLine.replace(/^\s*[:：-]\s*/, '').trim();
      const previousValue = previousLine.replace(/^\s*[:：]\s*/, '').trim();
      if (/^\s*[:：]/.test(previousLine) && previousValue && !/^\s*[:：]/.test(nextLine)) {
        return [previousValue, nextValue].filter(Boolean).join(' ').slice(0, 500);
      }
      if (nextValue) return nextValue.slice(0, 500);
    }
  }
  return '';
}

// --- End of ocrLabelParser.ts ---
