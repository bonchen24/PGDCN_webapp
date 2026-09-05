// Author: Codex
// OS support: Web/Node
// Description: Deterministic parsers used after PaddleOCR has extracted text.

export interface NameplateOcrFields {
  brand: string;
  model: string;
  indoorModel: string;
  outdoorModel: string;
  sealStamp: string;
  voltage: string;
  frequency: string;
  power: string;
  current: string;
  clockFreq: string;
  coolingHeatingPower: string;
  manufacturer: string;
  countryOfOrigin: string;
  origin: string;
  ipRating: string;
}

export interface TestResultsOcrFields {
  serialNumber?: string;
  measuredCapacity?: number;
  measuredPower?: number;
  cspf?: number;
  energyLevel?: number;
}

export interface RequestOcrFields {
  customerInfo: {
    name: string;
    senderUnit: string;
    address: string;
    phone: string;
    taxId: string;
    contactPerson: string;
  };
  sealStamp: string;
  sampleCondition: string;
  postTestHandling: string;
  resultCopyCount?: number;
  samples: Array<{
    modelName: string;
    brand: string;
    type: string;
    quantity: number;
    specifications: string;
    standard: string;
    testCriteria: string;
    testCategories: string[];
  }>;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(value: string): string {
  return stripDiacritics(String(value || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').replace(/^[|:：;\-–—]+|[|:：;\-–—]+$/g, '').trim();
}

function linesOf(text: string): string[] {
  return String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
}

function valueAfterLabels(lines: string[], labels: string[]): string {
  const normalizedLabels = labels.map(normalize);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalize(line);
    if (!normalizedLabels.some((label) => normalizedLine === label || normalizedLine.startsWith(`${label} `) || normalizedLine.includes(` ${label} `))) continue;

    const inlineValue = line.match(/[:：|]\s*(.+)$/)?.[1];
    if (inlineValue) return clean(inlineValue);

    const matchedLabel = normalizedLabels.find((label) => normalizedLine.startsWith(`${label} `) || normalizedLine === label);
    if (matchedLabel && normalizedLine.startsWith(`${matchedLabel} `)) {
      const rawValue = line.slice(Math.min(line.length, matchedLabel.length)).trim();
      if (rawValue && normalize(rawValue) !== matchedLabel) return clean(rawValue);
    }

    const nextLine = clean(lines[index + 1] || '');
    if (nextLine && !/[:：]/.test(nextLine)) return nextLine;
  }
  return '';
}

function firstNumber(value: string): number | undefined {
  const match = String(value || '').replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : undefined;
}

function extractSealStamp(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/\bIEMM(?:[A-Za-z0-9._/\-\s]*)/i);
    if (!match) continue;
    return clean(match[0]).replace(/-M\s*\d+$/i, '').trim();
  }
  return '';
}

export function parseNameplateOcrText(text: string): NameplateOcrFields {
  const lines = linesOf(text);
  const countryOfOrigin = valueAfterLabels(lines, ['country of origin', 'made in', 'nuoc san xuat', 'xuat xu']);
  return {
    brand: valueAfterLabels(lines, ['brand', 'nhan hieu', 'thuong hieu']),
    model: valueAfterLabels(lines, ['model', 'type', 'kieu loai']),
    indoorModel: valueAfterLabels(lines, ['indoor model', 'indoor unit', 'dan lanh']),
    outdoorModel: valueAfterLabels(lines, ['outdoor model', 'outdoor unit', 'dan nong']),
    sealStamp: extractSealStamp(lines),
    voltage: valueAfterLabels(lines, ['rated voltage', 'voltage', 'dien ap']),
    frequency: valueAfterLabels(lines, ['frequency', 'tan so']),
    power: valueAfterLabels(lines, ['rated power', 'power input', 'power', 'cong suat']),
    current: valueAfterLabels(lines, ['rated current', 'current', 'dong dien']),
    clockFreq: valueAfterLabels(lines, ['clock frequency', 'clock freq', 'tan so xung nhip']),
    coolingHeatingPower: valueAfterLabels(lines, ['cooling heating power', 'cooling capacity', 'heating capacity', 'cong suat lam lanh']),
    manufacturer: valueAfterLabels(lines, ['manufacturer', 'nha san xuat']),
    countryOfOrigin,
    origin: countryOfOrigin,
    ipRating: valueAfterLabels(lines, ['ip rating', 'protection rating', 'chi so bao ve']),
  };
}

export function parseTestResultsOcrText(text: string): TestResultsOcrFields {
  const lines = linesOf(text);
  const serialNumber = valueAfterLabels(lines, ['serial number', 'serial no', 'so serial']);
  const measuredCapacity = firstNumber(valueAfterLabels(lines, ['measured capacity', 'cooling capacity', 'cong suat lanh do duoc']));
  const measuredPower = firstNumber(valueAfterLabels(lines, ['measured power', 'power consumption', 'cong suat tieu thu']));
  const cspf = firstNumber(valueAfterLabels(lines, ['cspf', 'chi so hieu suat nang luong']));
  const energyLevel = firstNumber(valueAfterLabels(lines, ['energy level', 'energy star', 'cap sao nang luong']));
  return {
    ...(serialNumber ? { serialNumber } : {}),
    ...(measuredCapacity !== undefined ? { measuredCapacity } : {}),
    ...(measuredPower !== undefined ? { measuredPower } : {}),
    ...(cspf !== undefined ? { cspf } : {}),
    ...(energyLevel !== undefined ? { energyLevel } : {}),
  };
}

export function parseRequestOcrText(text: string): RequestOcrFields {
  const lines = linesOf(text);
  const customerName = valueAfterLabels(lines, ['customer', 'customer name', 'khach hang', 'don vi yeu cau']);
  const senderUnit = valueAfterLabels(lines, ['sender unit', 'don vi gui', 'don vi gui mau thu']);
  const modelName = valueAfterLabels(lines, ['model', 'model name', 'ma model']);
  const quantity = firstNumber(valueAfterLabels(lines, ['quantity', 'so luong'])) || 1;
  const sample = {
    modelName,
    brand: valueAfterLabels(lines, ['brand', 'nhan hieu', 'thuong hieu']),
    type: valueAfterLabels(lines, ['product type', 'type', 'loai san pham']),
    quantity: Math.max(1, Math.floor(quantity)),
    specifications: valueAfterLabels(lines, ['specifications', 'thong so ky thuat']),
    standard: valueAfterLabels(lines, ['standard', 'tieu chuan']),
    testCriteria: valueAfterLabels(lines, ['test criteria', 'chi tieu thu nghiem']),
    testCategories: [
      ...(normalize(text).includes('emc') ? ['EMC'] : []),
      ...(normalize(text).match(/\bitd\b|an toan dien|tcvn 5699|qcvn 4/) ? ['ITD'] : []),
    ],
  };
  const resultCopyCount = firstNumber(valueAfterLabels(lines, ['result copy count', 'so luong ban sao', 'so ban ket qua']));
  return {
    customerInfo: {
      name: customerName,
      senderUnit: senderUnit || customerName,
      address: valueAfterLabels(lines, ['address', 'dia chi']),
      phone: valueAfterLabels(lines, ['phone', 'telephone', 'sdt', 'dien thoai']),
      taxId: valueAfterLabels(lines, ['tax id', 'tax code', 'ma so thue']),
      contactPerson: valueAfterLabels(lines, ['contact person', 'nguoi lien he', 'nguoi dai dien']),
    },
    sealStamp: extractSealStamp(lines),
    sampleCondition: valueAfterLabels(lines, ['sample condition', 'tinh trang mau']),
    postTestHandling: valueAfterLabels(lines, ['post test handling', 'xu ly sau thu nghiem']),
    ...(resultCopyCount !== undefined ? { resultCopyCount: Math.max(1, Math.floor(resultCopyCount)) } : {}),
    samples: [sample],
  };
}

// --- End of ocrTextParsers.ts ---
