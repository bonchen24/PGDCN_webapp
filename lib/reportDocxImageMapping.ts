// Author: Gemini
// OS support: Web/Node
// Description: Combines dynamic label photos into anh_1 and maps supporting DOCX images after it

import sizeOf from 'image-size';
import { Resvg } from '@resvg/resvg-js';

export interface ReportDocxImageMappingInput {
  standardId?: string;
  images?: Record<string, unknown>;
  productPhoto1?: string;
  nameplatePhoto1?: string;
  nameplatePhoto2?: string;
  nameplatePhotos?: unknown[];
  combinedLabelImage?: string;
}

export type ReportDocxImageSlots = Record<`anh_${1 | 2 | 3 | 4 | 5 | 6}`, string> & {
  anh_1_1?: string;
  anh_1_2?: string;
  anh_1_3?: string;
  anh_1_4?: string;
  anh_1_5?: string;
  anh_1_6?: string;
  anh_tem_1?: string;
  anh_tem_2?: string;
  anh_tem_3?: string;
  anh_tem_4?: string;
  anh_tem_5?: string;
  anh_tem_6?: string;
  has_anh_1_1?: boolean;
  has_anh_1_2?: boolean;
  has_anh_1_3?: boolean;
  has_anh_1_4?: boolean;
  has_anh_1_5?: boolean;
  has_anh_1_6?: boolean;
  has_anh_tem_1?: boolean;
  has_anh_tem_2?: boolean;
  has_anh_tem_3?: boolean;
  has_anh_tem_4?: boolean;
  has_anh_tem_5?: boolean;
  has_anh_tem_6?: boolean;
  [key: string]: any;
};

const MAX_LABEL_COMPOSITE_HEIGHT = 1200;
const LABEL_GAP = 16;

const asImage = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const labelNumber = (field: string): number => field === 'label' ? 1 : Number(field.slice('label'.length));

const getLabelFields = (images: Record<string, unknown>, standardId?: string): string[] => {
  const dynamicFields = Object.keys(images)
    .filter(field => /^label(?:\d+)?$/.test(field))
    .sort((left, right) => labelNumber(left) - labelNumber(right));
  const defaultFields = standardId === 'emc_dieu_hoa' ? ['label', 'label2'] : ['label'];
  return Array.from(new Set([...defaultFields, ...dynamicFields]));
};

export const getReportDocxLabelImages = (input: ReportDocxImageMappingInput): string[] => {
  const images = input.images || {};
  const dynamicImages = getLabelFields(images, input.standardId)
    .map(field => asImage(images[field]))
    .filter(Boolean);

  if (dynamicImages.length > 0) {
    return dynamicImages;
  }

  const legacyImages = Array.isArray(input.nameplatePhotos)
    ? input.nameplatePhotos.map(asImage).filter(Boolean)
    : [input.nameplatePhoto1, input.nameplatePhoto2].map(asImage).filter(Boolean);

  return legacyImages;
};

const getSupportingImages = (input: ReportDocxImageMappingInput): string[] => {
  const images = input.images || {};
  const sampleImages = input.standardId === 'emc_dieu_hoa'
    ? [asImage(images.sample), asImage(images.sample2)]
    : [asImage(images.sample) || asImage(input.productPhoto1)];
  const supportingImages = [
    ...sampleImages,
    asImage(images.setupVoltage),
    asImage(images.setupPower),
    ...(input.standardId === 'emc_dieu_hoa' ? [] : [asImage(images.setupRadiated)]),
  ];
  return input.standardId === 'emc_dieu_hoa' ? supportingImages : supportingImages.filter(Boolean);
};

export const buildReportDocxImageSlots = (input: ReportDocxImageMappingInput): ReportDocxImageSlots => {
  const labelImages = getReportDocxLabelImages(input);
  const combinedLabelImage = asImage(input.combinedLabelImage) || labelImages[0] || '';
  const values = [combinedLabelImage, ...getSupportingImages(input)].slice(0, 6);

  const slots: any = {
    anh_1: values[0] || '',
    anh_2: values[1] || '',
    anh_3: values[2] || '',
    anh_4: values[3] || '',
    anh_5: values[4] || '',
    anh_6: values[5] || '',
  };

  for (let i = 1; i <= 6; i++) {
    const img = labelImages[i - 1] || '';
    slots[`anh_1_${i}`] = img;
    slots[`anh_tem_${i}`] = img;
    slots[`has_anh_1_${i}`] = Boolean(img);
    slots[`has_anh_tem_${i}`] = Boolean(img);
  }

  return slots;
};

interface DecodedImage {
  source: string;
  width: number;
  height: number;
}

const decodeImage = (source: string): DecodedImage | null => {
  const separator = source.indexOf(',');
  if (separator < 0) return null;

  try {
    const buffer = Buffer.from(source.slice(separator + 1).replace(/\s/g, ''), 'base64');
    const dimensions = sizeOf(buffer);
    if (!dimensions.width || !dimensions.height) return null;
    return {
      source,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    return null;
  }
};

const escapeXmlAttribute = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const combineReportDocxLabelImages = async (images: string[]): Promise<string> => {
  const sources = images.map(asImage).filter(Boolean);
  if (sources.length <= 1) return sources[0] || '';

  const decoded = sources.map(decodeImage).filter((image): image is DecodedImage => Boolean(image));
  if (decoded.length <= 1) return decoded[0]?.source || sources[0] || '';

  const targetHeight = Math.min(
    MAX_LABEL_COMPOSITE_HEIGHT,
    Math.max(...decoded.map(image => image.height)),
  );
  const itemWidths = decoded.map(image => Math.max(1, Math.round(image.width * (targetHeight / image.height))));
  const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0) + LABEL_GAP * (itemWidths.length - 1);

  let currentX = 0;
  const imageElements = decoded.map((image, index) => {
    const width = itemWidths[index];
    const element = `<image href="${escapeXmlAttribute(image.source)}" x="${currentX}" y="0" width="${width}" height="${targetHeight}" preserveAspectRatio="none"/>`;
    currentX += width + LABEL_GAP;
    return element;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${targetHeight}" viewBox="0 0 ${totalWidth} ${targetHeight}"><rect width="100%" height="100%" fill="#ffffff"/>${imageElements}</svg>`;
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: totalWidth },
    background: '#ffffff',
  }).render().asPng();

  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
};

// --- End of lib/reportDocxImageMapping.ts ---
