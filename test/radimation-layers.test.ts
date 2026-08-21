// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for complete Radimation vector-layer composites

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseRadimationImageSource, getVectorCompositeDimensions, isCompleteVectorComposite, shouldPreferBrowserVectorComposite, stripFullCanvasWhiteBackground } from "../utils/radimationLayers.ts";

test("rejects a composite when any vector layer was not converted", () => {
  assert.equal(isCompleteVectorComposite(4, 3), false);
});

test("accepts a composite only when every vector layer was converted", () => {
  assert.equal(isCompleteVectorComposite(4, 4), true);
});

test("removes only a full-canvas white rect from an overlay layer", () => {
  const svgBody = [
    '<rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>',
    '<path d="M0 0 L10 10" fill="white"/>',
    '<polygon points="0,0 10,0 10,10" fill="#fff"/>'
  ].join("");

  const stripped = stripFullCanvasWhiteBackground(svgBody, 100, 100);

  assert.doesNotMatch(stripped, /<rect\b/i);
  assert.match(stripped, /<path\b/i);
  assert.match(stripped, /<polygon\b/i);
});

test("uses browser compositing only when the server composite is incomplete", () => {
  assert.equal(shouldPreferBrowserVectorComposite(3, true), false);
  assert.equal(shouldPreferBrowserVectorComposite(3, false), true);
  assert.equal(shouldPreferBrowserVectorComposite(0, false), false);
});

test("keeps the source aspect ratio when sizing the browser composite canvas", () => {
  const dimensions = getVectorCompositeDimensions(877, 585);

  assert.equal(dimensions.width, 2000);
  assert.equal(dimensions.height, 1334);
});

test("prefers a complete raster graph when raster and vector candidates coexist", () => {
  assert.equal(chooseRadimationImageSource(1, 6), "raster");
  assert.equal(chooseRadimationImageSource(0, 6), "vector");
  assert.equal(chooseRadimationImageSource(0, 0), "none");
});

test("production image includes fonts required by EMF text rendering", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

  assert.match(dockerfile, /apk add --no-cache[\s\S]*fontconfig[\s\S]*ttf-liberation/i);
});

// --- End of radimation-layers.test.ts ---
