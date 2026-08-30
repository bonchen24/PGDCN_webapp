// Author: Codex
// OS support: Node
// Description: Safe, provenance-preserving annotation of DOCX table value cells

import PizZip from 'pizzip';

import { extractPcnTemplatePlaceholderKeys } from './pcnTemplateDiscovery.ts';
import type { PcnTemplateAnnotationMapping } from '../types.ts';

export interface PcnTemplateAnnotationResult {
  bytes: Buffer;
  placeholderKeys: string[];
  appliedMappings: PcnTemplateAnnotationMapping[];
}

interface XmlRange {
  start: number;
  end: number;
}

const ANNOTATABLE_XML = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i;

function findXmlElementRanges(xml: string, tagName: string): XmlRange[] {
  const tokenPattern = new RegExp(`<\\/?${tagName}(?:\\s[^>]*)?>`, 'g');
  const ranges: XmlRange[] = [];
  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(xml))) {
    const token = match[0];
    const closing = token.startsWith(`</${tagName}`);
    const selfClosing = /\/\s*>$/.test(token);
    if (closing) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        ranges.push({ start, end: match.index + token.length });
        start = -1;
      }
    } else if (!selfClosing) {
      depth += 1;
      if (depth === 1) start = match.index;
    }
  }
  return ranges;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cellText(cellXml: string): string {
  const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  return [...cellXml.matchAll(textPattern)]
    .map((match) => decodeXmlEntities(match[1]))
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalized(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi-VN');
}

function validateMapping(mapping: PcnTemplateAnnotationMapping): PcnTemplateAnnotationMapping {
  const key = String(mapping.key || '').trim();
  const sourceText = String(mapping.sourceText || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`Placeholder key không hợp lệ: ${key || '(trống)'}.`);
  if (sourceText.length < 2) throw new Error(`Nhãn nguồn cho ${key} phải có ít nhất 2 ký tự.`);
  if (mapping.occurrence !== undefined && (!Number.isInteger(mapping.occurrence) || mapping.occurrence < 1)) {
    throw new Error(`Occurrence của ${key} phải là số nguyên dương.`);
  }
  return { key, sourceText, ...(mapping.occurrence === undefined ? {} : { occurrence: mapping.occurrence }) };
}

function copyRunProperties(cellXml: string): string {
  const match = cellXml.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/);
  return match?.[0] || '';
}

function insertPlaceholder(cellXml: string, key: string, sourceCellXml: string): string {
  if (cellText(cellXml)) throw new Error(`Ô giá trị của ${key} không trống.`);
  const run = `<w:r>${copyRunProperties(sourceCellXml)}<w:t xml:space="preserve">[[${escapeXmlText(key)}]]</w:t></w:r>`;
  const paragraph = cellXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/);
  if (paragraph) {
    const paragraphXml = paragraph[0];
    const updatedParagraph = paragraphXml.replace(/<\/w:p>$/, run + '</w:p>');
    return cellXml.replace(paragraphXml, updatedParagraph);
  }
  const emptyParagraph = cellXml.match(/<w:p(?:\s[^>]*)?\s*\/>/);
  if (emptyParagraph) {
    const openTag = emptyParagraph[0].replace(/\s*\/>$/, '>');
    return cellXml.replace(emptyParagraph[0], `${openTag}${run}</w:p>`);
  }
  throw new Error(`Không tìm thấy ô đoạn văn đích cho ${key}.`);
}

interface CellMatch {
  fileName: string;
  cellRange: XmlRange;
  cellXml: string;
  sourceCellXml: string;
}

interface InlineMatch {
  fileName: string;
  paragraphRange: XmlRange;
  paragraphXml: string;
}

type LabelMatch = CellMatch | InlineMatch;

function findLabelCells(files: Map<string, string>, sourceText: string): CellMatch[] {
  const needle = normalized(sourceText);
  const matches: CellMatch[] = [];
  for (const [fileName, xml] of files) {
    for (const rowRange of findXmlElementRanges(xml, 'w:tr')) {
      const rowXml = xml.slice(rowRange.start, rowRange.end);
      const cellRanges = findXmlElementRanges(rowXml, 'w:tc');
      const cells = cellRanges.map((range) => ({ range, xml: rowXml.slice(range.start, range.end) }));
      cells.forEach((cell, index) => {
        if (!normalized(cellText(cell.xml)).includes(needle)) return;
        const nextCell = cells[index + 1];
        if (!nextCell) return;
        matches.push({
          fileName,
          cellRange: { start: rowRange.start + nextCell.range.start, end: rowRange.start + nextCell.range.end },
          cellXml: nextCell.xml,
          sourceCellXml: cell.xml,
        });
      });
    }
  }
  return matches;
}

const INLINE_BLANK_PATTERN = /(?:…{2,}|\.{3,}|_{3,})/;

function insertInlinePlaceholder(paragraphXml: string, key: string, sourceText: string): string {
  const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = textPattern.exec(paragraphXml))) {
    const decoded = decodeXmlEntities(match[1]);
    const blank = INLINE_BLANK_PATTERN.exec(decoded);
    if (!blank) continue;
    const beforeText = `${cellText(paragraphXml.slice(0, match.index))}${decoded.slice(0, blank.index)}`;
    if (!normalized(beforeText).includes(normalized(sourceText))) continue;
    const replacementText = `${decoded.slice(0, blank.index)}[[${key}]]${decoded.slice(blank.index + blank[0].length)}`;
    const updatedRunText = match[0].replace(match[1], escapeXmlText(replacementText));
    return paragraphXml.slice(0, match.index) + updatedRunText + paragraphXml.slice(match.index + match[0].length);
  }
  throw new Error(`Không tìm thấy vùng giá trị trống cho ${key} sau nhãn “${sourceText}”.`);
}

function findInlineParagraphs(files: Map<string, string>, sourceText: string): InlineMatch[] {
  const needle = normalized(sourceText);
  const matches: InlineMatch[] = [];
  for (const [fileName, xml] of files) {
    for (const paragraphRange of findXmlElementRanges(xml, 'w:p')) {
      const paragraphXml = xml.slice(paragraphRange.start, paragraphRange.end);
      if (normalized(cellText(paragraphXml)).includes(needle)) {
        matches.push({ fileName, paragraphRange, paragraphXml });
      }
    }
  }
  return matches;
}

function findLabelMatches(files: Map<string, string>, sourceText: string): LabelMatch[] {
  const cellMatches = findLabelCells(files, sourceText);
  return cellMatches.length > 0 ? cellMatches : findInlineParagraphs(files, sourceText);
}

export function annotatePcnDocxTemplate(
  bytes: Buffer,
  mappings: PcnTemplateAnnotationMapping[],
): PcnTemplateAnnotationResult {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new Error('Template DOCX rỗng.');
  if (!Array.isArray(mappings) || mappings.length === 0) throw new Error('Phải có ít nhất một mapping chú thích.');
  const cleanMappings = mappings.map(validateMapping);
  const keys = new Set<string>();
  for (const mapping of cleanMappings) {
    if (keys.has(mapping.key)) throw new Error(`Mapping placeholder bị trùng: ${mapping.key}.`);
    keys.add(mapping.key);
  }

  const zip = new PizZip(bytes);
  if (!zip.file('word/document.xml')) throw new Error('Template không có word/document.xml hợp lệ.');
  const files = new Map<string, string>();
  Object.keys(zip.files)
    .filter((fileName) => ANNOTATABLE_XML.test(fileName))
    .sort()
    .forEach((fileName) => files.set(fileName, zip.file(fileName)?.asText() || ''));

  for (const mapping of cleanMappings) {
    const matches = findLabelMatches(files, mapping.sourceText);
    if (matches.length === 0) throw new Error(`Không tìm thấy nhãn nguồn “${mapping.sourceText}”.`);
    const occurrence = mapping.occurrence || 1;
    if (occurrence > matches.length) throw new Error(`Occurrence ${occurrence} của nhãn “${mapping.sourceText}” không tồn tại.`);
    if (mapping.occurrence === undefined && matches.length !== 1) {
      throw new Error(`Nhãn “${mapping.sourceText}” không duy nhất; hãy chỉ định occurrence.`);
    }
    const target = matches[occurrence - 1];
    const xml = files.get(target.fileName)!;
    if ('cellXml' in target) {
      const updatedCell = insertPlaceholder(target.cellXml, mapping.key, target.sourceCellXml);
      files.set(target.fileName, xml.slice(0, target.cellRange.start) + updatedCell + xml.slice(target.cellRange.end));
    } else {
      const updatedParagraph = insertInlinePlaceholder(target.paragraphXml, mapping.key, mapping.sourceText);
      files.set(target.fileName, xml.slice(0, target.paragraphRange.start) + updatedParagraph + xml.slice(target.paragraphRange.end));
    }
  }

  for (const [fileName, xml] of files) zip.file(fileName, xml);
  const annotatedBytes = zip.generate({ type: 'nodebuffer' });
  const placeholderKeys = extractPcnTemplatePlaceholderKeys(annotatedBytes);
  const missing = cleanMappings.map((mapping) => mapping.key).filter((key) => !placeholderKeys.includes(key));
  if (missing.length > 0) throw new Error(`Không xác nhận được placeholder sau chú thích: ${missing.join(', ')}.`);
  return { bytes: annotatedBytes, placeholderKeys, appliedMappings: cleanMappings };
}
