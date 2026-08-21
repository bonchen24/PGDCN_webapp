// Author: Gemini
// OS support: Web/Node
// Description: Removes temporary OCR and report images before KQTN persistence

export function stripTransientKqtnImages<T extends object>(record: T): T {
  const source = record as Record<string, unknown>;
  const {
    productPhoto1: _productPhoto1,
    productPhoto2: _productPhoto2,
    nameplatePhoto1: _nameplatePhoto1,
    nameplatePhoto2: _nameplatePhoto2,
    nameplatePhotos: _nameplatePhotos,
    ...persisted
  } = source;

  if (persisted.emcData && typeof persisted.emcData === 'object' && !Array.isArray(persisted.emcData)) {
    const { images: _images, ...persistedEmcData } = persisted.emcData as Record<string, unknown>;
    persisted.emcData = persistedEmcData;
  }

  return persisted as T;
}

// --- End of transientReportImages.ts ---
