import type { PcnSampleHandoverDetails } from '../types.ts';
import { getPcnTimestampDenial } from './pcnDossierDate.ts';

export type PcnSampleHandoverDetailsDraft = Partial<PcnSampleHandoverDetails> & {
  quantity: number | string;
  sampleCodes?: readonly string[];
};

function requiredText(label: string, value: unknown): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} là bắt buộc.`);
  return normalized;
}

function optionalText(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

export function buildPcnSampleHandoverDetails(draft: PcnSampleHandoverDetailsDraft): PcnSampleHandoverDetails {
  const senderName = requiredText('Người giao mẫu', draft.senderName);
  const receiverName = requiredText('Người nhận mẫu', draft.receiverName);
  const handoverAt = requiredText('Thời điểm bàn giao', draft.handoverAt);
  const handoverAtDenial = getPcnTimestampDenial('Thời điểm bàn giao', handoverAt);
  if (handoverAtDenial) throw new Error(handoverAtDenial);
  const receivedAt = optionalText(draft.receivedAt);
  if (receivedAt) {
    const receivedAtDenial = getPcnTimestampDenial('Thời điểm PTN nhận mẫu', receivedAt);
    if (receivedAtDenial) throw new Error(receivedAtDenial);
    if (Date.parse(receivedAt) < Date.parse(handoverAt)) throw new Error('Thời điểm PTN nhận mẫu phải sau thời điểm bàn giao.');
  }
  const location = requiredText('Địa điểm bàn giao', draft.location);
  const quantity = Number(draft.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Số lượng mẫu giao nhận phải là số nguyên dương.');
  const sampleCodes = Array.from(new Set((draft.sampleCodes || []).map((code) => String(code || '').trim()).filter(Boolean)));
  if (sampleCodes.length === 0) throw new Error('Biên bản giao nhận phải có ít nhất một mã mẫu.');

  return {
    senderName,
    ...(optionalText(draft.senderUnit) ? { senderUnit: optionalText(draft.senderUnit) } : {}),
    receiverName,
    ...(optionalText(draft.receiverUnit) ? { receiverUnit: optionalText(draft.receiverUnit) } : {}),
    handoverAt,
    ...(receivedAt ? { receivedAt } : {}),
    location,
    ...(optionalText(draft.vehicle) ? { vehicle: optionalText(draft.vehicle) } : {}),
    ...(optionalText(draft.driver) ? { driver: optionalText(draft.driver) } : {}),
    quantity,
    sampleCodes,
    ...(optionalText(draft.note) ? { note: optionalText(draft.note) } : {}),
  };
}

