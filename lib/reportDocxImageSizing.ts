// Author: Gemini
// OS support: Web/Node
// Description: Fixed-width DOCX graph sizing with source aspect-ratio preservation

export const DOCX_GRAPH_WIDTH_PX = 624;
const DEFAULT_GRAPH_HEIGHT_PX = 351;

export const getDocxGraphSize = (width: number, height: number): [number, number] => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return [DOCX_GRAPH_WIDTH_PX, DEFAULT_GRAPH_HEIGHT_PX];
  }

  return [DOCX_GRAPH_WIDTH_PX, Math.round(height * (DOCX_GRAPH_WIDTH_PX / width))];
};

// --- End of lib/reportDocxImageSizing.ts ---
