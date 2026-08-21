// Author: Gemini
// OS support: Web/Node
// Description: Builds normalized report metadata for DOCX template rendering

import {
  formatBilingualReportDate,
  normalizeNameplateOcrValues,
} from './reportFormatting.ts';

type ReportSource = Record<string, unknown>;

export interface ReportDocxMetadataInput {
  reportMeta?: ReportSource;
  ocrData?: ReportSource;
  emcData?: ReportSource;
}

export interface ReportDocxMetadata {
  reportDate: string;
  sealStamp: string;
  codingNumber: string;
  manufacturer: string;
  countryOfOrigin: string;
  emcPower: string;
  emcVoltage: string;
  emcCurrent: string;
  emcFrequency: string;
  emcClockFreq: string;
}

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const firstPresent = (...values: unknown[]): string => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
};

export const buildReportDocxMetadata = ({
  reportMeta = {},
  ocrData = {},
  emcData = {},
}: ReportDocxMetadataInput = {}): ReportDocxMetadata => {
  const sealStamp = firstPresent(reportMeta.sealStamp);
  const normalized = normalizeNameplateOcrValues({
    manufacturer: firstPresent(reportMeta.manufacturer, ocrData.manufacturer),
    countryOfOrigin: firstPresent(reportMeta.countryOfOrigin, ocrData.countryOfOrigin, ocrData.origin),
    power: firstPresent(emcData.power, ocrData.power),
    voltage: firstPresent(emcData.voltage, ocrData.voltage),
    current: firstPresent(emcData.current, ocrData.current),
    frequency: firstPresent(emcData.frequency, ocrData.frequency),
    clockFreq: firstPresent(emcData.clockFreq, ocrData.clockFreq),
  });

  return {
    reportDate: formatBilingualReportDate(firstPresent(reportMeta.rawReportDate, reportMeta.reportDate)),
    sealStamp,
    codingNumber: sealStamp,
    manufacturer: normalized.manufacturer,
    countryOfOrigin: normalized.countryOfOrigin,
    emcPower: normalized.power,
    emcVoltage: normalized.voltage,
    emcCurrent: normalized.current,
    emcFrequency: normalized.frequency,
    emcClockFreq: normalized.clockFreq,
  };
};

// --- End of lib/reportDocxMetadata.ts ---
