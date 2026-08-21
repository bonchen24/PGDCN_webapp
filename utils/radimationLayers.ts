// Author: Gemini
// OS support: Web/Node
// Description: Shared checks for complete Radimation vector-layer composites

export function isCompleteVectorComposite(expectedLayerCount: number, convertedLayerCount: number): boolean {
  return expectedLayerCount > 0 && convertedLayerCount === expectedLayerCount;
}

export function shouldPreferBrowserVectorComposite(rawVectorCount: number, serverCompositeComplete?: boolean): boolean {
  return rawVectorCount > 0 && serverCompositeComplete !== true;
}

export function chooseRadimationImageSource(rasterCandidateCount: number, vectorCandidateCount: number): "raster" | "vector" | "none" {
  if (rasterCandidateCount > 0) return "raster";
  if (vectorCandidateCount > 0) return "vector";
  return "none";
}

export function getVectorCompositeDimensions(sourceWidth: number, sourceHeight: number, targetWidth = 2000): { width: number; height: number } {
  const width = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1800;
  const height = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1080;
  const renderWidth = Math.max(width, targetWidth);
  return {
    width: Math.round(renderWidth),
    height: Math.max(1, Math.round(renderWidth * (height / width)))
  };
}

export function stripFullCanvasWhiteBackground(svgBody: string, layerWidth = 0, layerHeight = 0): string {
  const isFullDimension = (rawValue: string | undefined, expected: number): boolean => {
    if (!rawValue) return false;
    const value = rawValue.trim().toLowerCase();
    if (value === "100%") return true;
    const numeric = Number.parseFloat(value);
    return expected > 0 && Number.isFinite(numeric) && Math.abs(numeric - expected) < 0.01;
  };

  return svgBody.replace(/<rect\b([^>]*?)(\/?>(?:[\s\S]*?<\/rect>)?)/gi, (match, attrs) => {
    const isWhite = /(?:fill=["']\s*(?:#ffffff|#fff|white|rgb\(255,\s*255,\s*255\))\s*["']|style=["'][^"']*fill:\s*(?:#ffffff|#fff|white|rgb\(255,\s*255,\s*255\)))/i.test(attrs);
    if (!isWhite) return match;

    const x = attrs.match(/\bx\s*=\s*["']([^"']+)["']/i)?.[1] ?? "0";
    const y = attrs.match(/\by\s*=\s*["']([^"']+)["']/i)?.[1] ?? "0";
    const width = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1];
    const height = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1];
    const isAtOrigin = Number.parseFloat(x) === 0 && Number.parseFloat(y) === 0;
    if (!isAtOrigin || !isFullDimension(width, layerWidth) || !isFullDimension(height, layerHeight)) return match;

    const strokeMatch = attrs.match(/stroke=["']([^"']+)["']/i) || attrs.match(/style=["'][^"']*stroke:\s*([^;"]+)/i);
    if (strokeMatch) {
      const strokeVal = strokeMatch[1].toLowerCase().trim();
      if (strokeVal && !["#ffffff", "#fff", "white", "none", "transparent", "rgba(0,0,0,0)"].includes(strokeVal)) {
        return match;
      }
    }

    return "";
  });
}

// --- End of radimationLayers.ts ---
