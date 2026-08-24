export const isIemmSealStamp = (value: string | null | undefined): boolean => {
  return String(value ?? '').trim().toUpperCase().startsWith('IEMM');
};

export const normalizeSealStampBase = (value: string | null | undefined): string => {
  const sealStamp = String(value ?? '');
  if (!isIemmSealStamp(sealStamp)) return sealStamp;
  return sealStamp.replace(/-M\d+$/i, '');
};

export const applySealStampPolicy = (
  sealStamps: string[],
  baseSealStamp: string | null | undefined,
): string[] => {
  if (!isIemmSealStamp(baseSealStamp)) return sealStamps;
  if (sealStamps.length === 0) return sealStamps;
  if (sealStamps.length === 1) return [String(baseSealStamp)];
  return sealStamps.map((_, index) => `${String(baseSealStamp)}-M${String(index + 1).padStart(2, '0')}`);
};
