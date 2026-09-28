// Author: Gemini
// OS support: Web/Node
// Description: Radimation docx extraction endpoint with vector and raster image parsing

import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import sizeOf from 'image-size';
import { Resvg } from '@resvg/resvg-js';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import { getEmfOrWmfToSvg } from '@/lib/server/report-docx';
import {
  chooseRadimationImageSource,
  isCompleteVectorComposite,
  stripFullCanvasWhiteBackground,
} from '@/utils/radimationLayers';

function detectMediaType(buf: Buffer, filename = ''): 'png' | 'jpeg' | 'gif' | 'bmp' | 'emf' | 'wmf' | 'unknown' {
  if (!buf || buf.length < 4) return 'unknown';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return 'gif';
  }
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    return 'bmp';
  }
  if (
    buf.length > 44 &&
    buf[0] === 1 &&
    buf[1] === 0 &&
    buf[2] === 0 &&
    buf[3] === 0 &&
    buf[40] === 0x20 &&
    buf[41] === 0x45 &&
    buf[42] === 0x4d &&
    buf[43] === 0x46
  ) {
    return 'emf';
  }
  if (buf.length > 4 && buf[0] === 0xd7 && buf[1] === 0xcd && buf[2] === 0xc6 && buf[3] === 0x9a) {
    return 'wmf';
  }
  if (buf.length > 4 && (buf[0] === 0x01 || buf[0] === 0x02) && buf[1] === 0x00 && buf[2] === 0x09 && buf[3] === 0x00) {
    return 'wmf';
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'emf') return 'emf';
  if (ext === 'wmf') return 'wmf';
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  return 'unknown';
}

async function renderCompositeVectorLayers(entries: any[]): Promise<string | null> {
  if (!entries || entries.length === 0) return null;
  try {
    let masterWidth = '';
    let masterHeight = '';
    let masterViewBox = '';
    const combinedSvgLayers: string[] = [];
    let convertedLayerCount = 0;
    const failedLayerIndexes: number[] = [];

    for (let idx = 0; idx < entries.length; idx++) {
      try {
        const entry = entries[idx];
        const rawBuf = entry.getData();
        if (!rawBuf || rawBuf.length === 0) {
          failedLayerIndexes.push(idx);
          continue;
        }

        const mediaType = detectMediaType(rawBuf, entry.entryName);
        const kind = mediaType === 'wmf' ? 'wmf' : 'emf';
        const data = new Uint8Array(rawBuf);
        const convertToSvg = await getEmfOrWmfToSvg();
        let svg = await convertToSvg(kind as any, data, 96);
        if (!svg || typeof svg !== 'string' || svg.length < 30 || !svg.includes('<svg')) {
          failedLayerIndexes.push(idx);
          continue;
        }

        svg = svg.trim().replace(/<\?xml[\s\S]*?\?>/gi, '');
        svg = svg.replace(/\s*xmlns:svg=["'][^"']*["']/gi, '');
        svg = svg.replace(/<(\/?)svg:([a-zA-Z0-9_-]+)/g, '<$1$2');
        svg = svg.replace(/url\(#svg:([^)]+)\)/g, 'url(#$1)');

        const prefix = `layer_${idx}_`;
        svg = svg.replace(/\bid\s*=\s*['"]([^'"]+)['"]/gi, `id="${prefix}$1"`);
        svg = svg.replace(/url\(\s*['"]?#([^'")]+)['"]?\s*\)/gi, `url(#${prefix}$1)`);
        svg = svg.replace(/href\s*=\s*['"]#([^'"]+)['"]/gi, `href="#${prefix}$1"`);
        svg = svg.replace(/xlink:href\s*=\s*['"]#([^'"]+)['"]/gi, `xlink:href="#${prefix}$1"`);
        svg = svg.replace(/clip-path\s*=\s*['"]url\(#([^)]+)\)['"]/gi, `clip-path="url(#${prefix}$1)"`);

        let layerVb = '';
        let layerW = 0;
        let layerH = 0;

        const vbMatch = svg.match(/viewBox=["']([^"']+)["']/i);
        if (vbMatch) {
          layerVb = vbMatch[1];
          if (!masterViewBox) masterViewBox = layerVb;
        }
        const wMatch = svg.match(/\bwidth=["']([^"']+)["']/i);
        if (wMatch) {
          layerW = parseFloat(wMatch[1]);
          if (!masterWidth) masterWidth = wMatch[1];
        }
        const hMatch = svg.match(/\bheight=["']([^"']+)["']/i);
        if (hMatch) {
          layerH = parseFloat(hMatch[1]);
          if (!masterHeight) masterHeight = hMatch[1];
        }

        if (!layerVb && layerW > 0 && layerH > 0) {
          layerVb = `0 0 ${layerW} ${layerH}`;
        }

        const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
        if (bodyMatch && bodyMatch[1] && bodyMatch[1].trim()) {
          let layerBody = bodyMatch[1];
          if (idx > 0) {
            layerBody = stripFullCanvasWhiteBackground(layerBody, layerW, layerH);
          }
          const effectiveVb = layerVb || masterViewBox || '0 0 1000 600';
          combinedSvgLayers.push(
            `<svg x="0" y="0" width="100%" height="100%" viewBox="${effectiveVb}" preserveAspectRatio="none" overflow="visible">${layerBody}</svg>`,
          );
          convertedLayerCount++;
        } else {
          failedLayerIndexes.push(idx);
        }
      } catch (layerErr) {
        failedLayerIndexes.push(idx);
        console.warn(`Layer ${idx} conversion warning:`, layerErr);
      }
    }

    if (!isCompleteVectorComposite(entries.length, convertedLayerCount)) {
      console.warn(
        `[Radimation] Refusing incomplete vector composite: ${convertedLayerCount}/${entries.length} layers converted; failed indexes: ${failedLayerIndexes.join(',') || 'unknown'}`,
      );
      return null;
    }

    let viewBoxAttr = masterViewBox ? `viewBox="${masterViewBox}"` : '';
    if (!viewBoxAttr && masterWidth && masterHeight) {
      viewBoxAttr = `viewBox="0 0 ${parseFloat(masterWidth)} ${parseFloat(masterHeight)}"`;
    }
    if (!viewBoxAttr) {
      viewBoxAttr = `viewBox="0 0 1000 600"`;
    }
    let widthAttr = masterWidth ? `width="${masterWidth}"` : `width="1800"`;
    let heightAttr = masterHeight ? `height="${masterHeight}"` : `height="1080"`;

    const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${widthAttr} ${heightAttr} ${viewBoxAttr}>
      <rect width="100%" height="100%" fill="#ffffff"/>
      ${combinedSvgLayers.join('\n')}
    </svg>`;

    const resvg = new Resvg(masterSvg, {
      fitTo: { mode: 'width', value: 2000 },
      background: '#ffffff',
      font: {
        loadSystemFonts: true,
        defaultFontFamily: 'Liberation Sans',
        sansSerifFamily: 'Liberation Sans',
        serifFamily: 'Liberation Serif',
        monospaceFamily: 'Liberation Mono',
      },
    } as any);

    const pngBuf = resvg.render().asPng();
    if (pngBuf && pngBuf.length > 100) {
      return `data:image/png;base64,${Buffer.from(pngBuf).toString('base64')}`;
    }
    return null;
  } catch (compErr) {
    console.error('Composite vector rendering error:', compErr);
    return null;
  }
}

async function getTableImage(
  $: any,
  relsXml: string,
  zipInstance: AdmZip,
  tblEl: any,
  prevTblEl: any,
  allVectorEntries: any[],
): Promise<string | null> {
  const $rels = cheerio.load(relsXml, { xmlMode: true });
  const candidateEntries: any[] = [];
  const seenPaths = new Set<string>();

  const nodesToSearch: any[] = [];
  if (prevTblEl) {
    let curr = $(prevTblEl).next();
    while (curr.length > 0 && curr[0] !== tblEl) {
      nodesToSearch.push(curr);
      curr = curr.next();
    }
  } else {
    let prev = $(tblEl).prev();
    const prevList: any[] = [];
    for (let i = 0; i < 50 && prev.length > 0; i++) {
      prevList.push(prev);
      prev = prev.prev();
    }
    for (let i = prevList.length - 1; i >= 0; i--) {
      nodesToSearch.push(prevList[i]);
    }
  }

  nodesToSearch.push($(tblEl));

  for (const node of nodesToSearch) {
    $(node)
      .find('*')
      .addBack()
      .each((_: any, el: any) => {
        if (el.attribs) {
          Object.values(el.attribs).forEach((val: any) => {
            if (typeof val === 'string') {
              const matches = val.match(/rId\d+/g);
              if (matches) {
                matches.forEach((embedId: string) => {
                  const target = $rels(`Relationship[Id="${embedId}"]`).attr('Target');
                  if (target) {
                    const imagePath = target.startsWith('word/') ? target : `word/${target}`;
                    if (!seenPaths.has(imagePath)) {
                      seenPaths.add(imagePath);
                      const entry = zipInstance.getEntry(imagePath);
                      if (entry) {
                        candidateEntries.push(entry);
                      }
                    }
                  }
                });
              }
            }
          });
        }
      });
  }

  const vectorCandidates = candidateEntries.filter((e) => {
    const t = detectMediaType(e.getData(), e.entryName);
    return t === 'emf' || t === 'wmf';
  });
  const webCandidates = candidateEntries.filter((e) => {
    const t = detectMediaType(e.getData(), e.entryName);
    return t === 'png' || t === 'jpeg' || t === 'gif' || t === 'bmp';
  });

  const imageSource = chooseRadimationImageSource(webCandidates.length, vectorCandidates.length);

  if (imageSource === 'raster') {
    const imgEntry = webCandidates.reduce((best, candidate) => {
      if (!best) return candidate;
      try {
        const bestSize = sizeOf(best.getData());
        const candidateSize = sizeOf(candidate.getData());
        return candidateSize.width! * candidateSize.height! > bestSize.width! * bestSize.height! ? candidate : best;
      } catch {
        return candidate.getData().length > best.getData().length ? candidate : best;
      }
    }, null as any);

    if (imgEntry) {
      const raw = imgEntry.getData();
      const t = detectMediaType(raw, imgEntry.entryName);
      const mime = t === 'jpeg' ? 'image/jpeg' : `image/${t}`;
      return `data:${mime};base64,${raw.toString('base64')}`;
    }
  }

  if (imageSource === 'vector') {
    const composite = await renderCompositeVectorLayers(vectorCandidates);
    if (composite) return composite;
  }

  if (allVectorEntries && allVectorEntries.length > 0) {
    const composite = await renderCompositeVectorLayers(allVectorEntries);
    if (composite) return composite;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return jsonBadRequest('No file uploaded');
    }

    const fileBuffer = Buffer.from(await (file as Blob).arrayBuffer());
    const zip = new AdmZip(fileBuffer);
    const docXmlEntry = zip.getEntries().find((e) => e.entryName === 'word/document.xml');
    const relsXmlEntry = zip.getEntries().find((e) => e.entryName === 'word/_rels/document.xml.rels');

    let tableData: any[] = [];
    let tablePhaseL: any[] = [];
    let tablePhaseN: any[] = [];
    let tablePower: any[] = [];
    let info: Record<string, string> = {};
    let images: Record<string, string> = {};
    let phaseLFound = false;
    let phaseNFound = false;

    const mediaEntries = zip.getEntries().filter((e) => e.entryName.startsWith('word/media/'));
    mediaEntries.sort((a, b) => {
      const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    const vectorEntries = mediaEntries.filter((e) => {
      const t = detectMediaType(e.getData(), e.entryName);
      return t === 'emf' || t === 'wmf';
    });

    if (docXmlEntry) {
      const docXml = docXmlEntry.getData().toString('utf8');
      const relsXml = relsXmlEntry ? relsXmlEntry.getData().toString('utf8') : '';
      const $ = cheerio.load(docXml, { xmlMode: true });

      let allTables: any[] = [];
      const tblElements = $('w\\:tbl').toArray();
      let prevTblEl: any = null;

      for (let tblIndex = 0; tblIndex < tblElements.length; tblIndex++) {
        const tblEl = tblElements[tblIndex];

        let headingText = '';
        let prev = $(tblEl).prev();
        for (let i = 0; i < 15 && prev.length > 0; i++) {
          const text = prev.text().trim();
          if (text) headingText = text + ' ' + headingText;
          prev = prev.prev();
        }

        let rows: string[][] = [];
        $(tblEl)
          .find('w\\:tr')
          .each((_, tr) => {
            let cells: string[] = [];
            $(tr)
              .find('w\\:tc')
              .each((_, tc) => {
                let text = $(tc)
                  .find('w\\:t')
                  .map((_2, t) => $(t).text())
                  .get()
                  .join('')
                  .trim();
                cells.push(text);
              });
            if (cells.length > 0) rows.push(cells);
          });

        if (rows.length === 0) {
          prevTblEl = tblEl;
          continue;
        }
        allTables.push(rows);

        const fullText = rows.map((r) => r.join(' ')).join(' ').toLowerCase();

        if (fullText.includes('nhãn hiệu') || fullText.includes('brand name') || fullText.includes('kiểu loại') || fullText.includes('model')) {
          rows.forEach((r) => {
            const label = (r[0] || '').toLowerCase();
            const val = r[1] || '';
            if (label.includes('nhãn hiệu') || label.includes('brand')) info.brand = val;
            else if (label.includes('kiểu loại') || label.includes('model')) info.model = val;
            else if (label.includes('công suất') || label.includes('rated power')) info.power = val;
            else if (label.includes('điện áp') || label.includes('rated voltage')) info.voltage = val;
            else if (label.includes('dòng điện') || label.includes('rated current')) info.current = val;
            else if (label.includes('tần số danh nghĩa') || label.includes('rated frequency')) info.frequency = val;
            else if (label.includes('tần số xung nhịp') || label.includes('clock frequency')) info.clockFreq = val;
          });
        }

        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(3, rows.length); i++) {
          const rText = rows[i].join(' ').toLowerCase();
          if (
            rText.includes('freq') ||
            rText.includes('tần số') ||
            rText.includes('mhz') ||
            rText.includes('peak') ||
            rText.includes('average') ||
            rText.includes('quasi') ||
            rText.includes('qp') ||
            rText.includes('pk') ||
            rText.includes('dbµv') ||
            rText.includes('dbpw') ||
            rText.includes('nr') ||
            rText.includes('stt') ||
            rText.includes('point')
          ) {
            headerRowIdx = i;
            break;
          }
        }

        const headerCells = rows[headerRowIdx].map((c) => c.toLowerCase().trim());
        const headerCombined = headerCells.join(' ');

        let colPeakNum = -1,
          colFreq = -1,
          colPeak = -1,
          colAvg = -1,
          colAvgLimit = -1;
        let colQp = -1,
          colQpLimit = -1,
          colQpDiff = -1,
          colAvgDiff = -1,
          colStatus = -1;
        let colDistance = -1;

        headerCells.forEach((c, idx) => {
          const norm = c.toLowerCase().replace(/[\s\-_()[\]]/g, '');
          if (
            norm.includes('peaknumber') ||
            norm === 'nr' ||
            norm === 'nr.' ||
            norm === 'no' ||
            norm === 'no.' ||
            norm === 'stt' ||
            norm === 'tt' ||
            norm === 'point'
          ) {
            colPeakNum = idx;
          } else if (norm.includes('frequency') || norm.includes('tầnsố') || norm.includes('tanso') || norm.includes('freq')) {
            colFreq = idx;
          } else if (norm.includes('distance') || norm.includes('khoảngcách') || norm.includes('khoangcach') || norm.includes('vịtrí') || norm.includes('vitri')) {
            colDistance = idx;
          } else if (norm.includes('averagelimit') || norm.includes('limitav') || norm.includes('gioihanav') || (norm.includes('limit') && norm.includes('av')) || (norm.includes('giớihạn') && norm.includes('tb')) || norm.includes('avglimit')) {
            colAvgLimit = idx;
          } else if (norm.includes('quasipeaklimit') || norm.includes('limitqp') || norm.includes('gioihanqp') || (norm.includes('limit') && norm.includes('qp')) || (norm.includes('giớihạn') && norm.includes('qp')) || norm.includes('qplimit')) {
            colQpLimit = idx;
          } else if (norm.includes('quasipeakdiff') || norm.includes('qpdiff') || norm.includes('qpmargin') || (norm.includes('diff') && norm.includes('qp')) || (norm.includes('độlệch') && norm.includes('qp')) || (norm.includes('dolech') && norm.includes('qp'))) {
            colQpDiff = idx;
          } else if (norm.includes('averagediff') || norm.includes('avgdiff') || norm.includes('avmargin') || (norm.includes('diff') && norm.includes('av')) || (norm.includes('độlệch') && norm.includes('av')) || (norm.includes('độlệch') && norm.includes('tb')) || (norm.includes('dolech') && norm.includes('av'))) {
            colAvgDiff = idx;
          } else if (norm.includes('quasipeak') || norm.includes('quasi') || norm.includes('qp') || norm.includes('giatriqp') || norm.includes('giátrịqp')) {
            colQp = idx;
          } else if (norm.includes('average') || norm.includes('avg') || norm.includes('trungbình') || norm.includes('trungbinh') || norm.includes('giatritb') || norm.includes('giátrịtb') || norm.includes('av(') || norm === 'av') {
            colAvg = idx;
          } else if (norm.includes('peak') || norm.includes('pk') || norm.includes('đỉnh') || norm.includes('dinh')) {
            colPeak = idx;
          } else if (norm.includes('status') || norm.includes('result') || norm.includes('kếtquả') || norm.includes('ketqua') || norm.includes('đánhgiá') || norm.includes('danhgia') || norm.includes('kếtluận') || norm.includes('ketluan')) {
            colStatus = idx;
          }
        });

        const headingLower = headingText.toLowerCase();
        const isPower =
          headingLower.includes('công suất') ||
          headingLower.includes('power') ||
          headingLower.includes('clamp') ||
          headingLower.includes('6.3') ||
          headerCombined.includes('dbpw') ||
          headerCombined.includes('distance') ||
          headerCombined.includes('khoảng cách') ||
          colDistance >= 0;

        const isVoltage =
          headingLower.includes('điện áp') ||
          headingLower.includes('conducted') ||
          headingLower.includes('5.3') ||
          headerCombined.includes('dbµv') ||
          headerCombined.includes('average') ||
          headerCombined.includes('quasi-peak') ||
          (colQp >= 0 && colAvg >= 0);

        const isPhaseN =
          headingLower.includes('pha n') ||
          headingLower.includes('phase n') ||
          headingLower.includes('5.3.1.2') ||
          headingLower.includes('5.3.2') ||
          headingLower.includes('dây trung tính') ||
          headingLower.includes('neutral');
        const isPhaseL =
          headingLower.includes('pha l') ||
          headingLower.includes('phase l') ||
          headingLower.includes('5.3.1.1') ||
          headingLower.includes('dây pha') ||
          headingLower.includes('line');

        if (isPower && rows.length > headerRowIdx + 1) {
          const dataRows: any[] = [];
          for (let rIdx = headerRowIdx + 1; rIdx < rows.length; rIdx++) {
            const r = rows[rIdx];
            if (!r || r.length === 0 || r.join('').includes('{#') || r.join('').includes('{/')) continue;
            dataRows.push({
              nr: colPeakNum >= 0 ? r[colPeakNum] || '' : r[0] || '',
              frequency: colFreq >= 0 ? r[colFreq] || '' : r[1] || '',
              pkValue: colPeak >= 0 ? r[colPeak] || '' : r[2] || '',
              avgValue: colAvg >= 0 ? r[colAvg] || '' : r[3] || '',
              qpValue: colQp >= 0 ? r[colQp] || '' : r[4] || '',
              avgLimit: colAvgLimit >= 0 ? r[colAvgLimit] || '' : r[5] || '',
              qpLimit: colQpLimit >= 0 ? r[colQpLimit] || '' : r[6] || '',
              result: colStatus >= 0 ? r[colStatus] || 'Pass' : r[7] || 'Pass',
              status: colStatus >= 0 ? r[colStatus] || 'Pass' : r[7] || 'Pass',
              distance: colDistance >= 0 ? r[colDistance] || '' : r[8] || '',
            });
          }
          if (dataRows.length > 0) {
            tablePower = dataRows;
            if (relsXml) {
              const img = await getTableImage($, relsXml, zip, tblEl, prevTblEl, vectorEntries);
              if (img) images.powerDisturbance = img;
            }
          }
        } else if ((isVoltage || colFreq >= 0) && rows.length > headerRowIdx + 1) {
          const dataRows: any[] = [];
          for (let rIdx = headerRowIdx + 1; rIdx < rows.length; rIdx++) {
            const r = rows[rIdx];
            if (!r || r.length === 0 || r.join('').includes('{#') || r.join('').includes('{/')) continue;
            dataRows.push({
              peakNumber: colPeakNum >= 0 ? r[colPeakNum] || '' : r[0] || '',
              frequency: colFreq >= 0 ? r[colFreq] || '' : r[1] || '',
              peak: colPeak >= 0 ? r[colPeak] || '' : '',
              average: colAvg >= 0 ? r[colAvg] || '' : r[2] || '',
              averageLimit: colAvgLimit >= 0 ? r[colAvgLimit] || '' : r[3] || '',
              quasiPeak: colQp >= 0 ? r[colQp] || '' : r[4] || '',
              quasiPeakLimit: colQpLimit >= 0 ? r[colQpLimit] || '' : r[5] || '',
              quasiPeakDiff: colQpDiff >= 0 ? r[colQpDiff] || '' : r[6] || '',
              averageDiff: colAvgDiff >= 0 ? r[colAvgDiff] || '' : r[7] || '',
              status: colStatus >= 0 ? r[colStatus] || 'Pass' : r[8] || 'Pass',
            });
          }

          if (dataRows.length > 0) {
            let img: string | null = null;
            if (relsXml) {
              img = await getTableImage($, relsXml, zip, tblEl, prevTblEl, vectorEntries);
            }

            if (isPhaseN) {
              tablePhaseN = dataRows;
              if (img) images.phaseN = img;
              phaseNFound = true;
            } else if (isPhaseL) {
              tablePhaseL = dataRows;
              if (img) images.phaseL = img;
              phaseLFound = true;
            } else if (isPower) {
              tablePower = dataRows;
              if (img && !images.powerDisturbance) images.powerDisturbance = img;
            } else if (!phaseLFound) {
              tablePhaseL = dataRows;
              if (img) images.phaseL = img;
              phaseLFound = true;
            } else if (!phaseNFound) {
              tablePhaseN = dataRows;
              if (img) images.phaseN = img;
              phaseNFound = true;
            }
          }
        }

        prevTblEl = tblEl;
      }

      if (allTables.length > 0) {
        tableData = allTables[allTables.length - 1];
      }
    }

    let vectorBase64 = '';
    let vectorType = '';
    let allVectors: string[] = [];
    let imageBase64 = '';
    let allWebImages: string[] = [];
    let vectorCompositeComplete = vectorEntries.length === 0;

    for (const entry of mediaEntries) {
      try {
        const rawBuf = entry.getData();
        if (!rawBuf || rawBuf.length === 0) continue;

        const mediaType = detectMediaType(rawBuf, entry.entryName);
        if (mediaType === 'png' || mediaType === 'jpeg' || mediaType === 'gif' || mediaType === 'bmp') {
          const mime = mediaType === 'jpeg' ? 'image/jpeg' : `image/${mediaType}`;
          allWebImages.push(`data:${mime};base64,${rawBuf.toString('base64')}`);
        } else if (mediaType === 'emf' || mediaType === 'wmf') {
          allVectors.push(`data:image/x-${mediaType};base64,${rawBuf.toString('base64')}`);
        }
      } catch (err) {
        console.error(`Error processing media entry ${entry.entryName}:`, err);
      }
    }

    if (vectorEntries.length > 0) {
      const compositePng = await renderCompositeVectorLayers(vectorEntries);
      vectorCompositeComplete = Boolean(compositePng);
      if (compositePng) {
        imageBase64 = compositePng;
        allWebImages.unshift(compositePng);

        if (tablePhaseL.length > 0 && tablePhaseN.length === 0 && tablePower.length === 0) {
          images.phaseL = compositePng;
        } else if (tablePhaseN.length > 0 && tablePhaseL.length === 0 && tablePower.length === 0) {
          images.phaseN = compositePng;
        } else if (tablePower.length > 0 && tablePhaseL.length === 0 && tablePhaseN.length === 0) {
          images.powerDisturbance = compositePng;
        }
      }
    }

    if (!imageBase64 && allWebImages.length > 0) {
      imageBase64 = allWebImages[0];
    }

    if (imageBase64) {
      if (tablePhaseL.length > 0 && !images.phaseL) {
        images.phaseL = imageBase64;
      } else if (tablePhaseN.length > 0 && !images.phaseN) {
        images.phaseN = imageBase64;
      } else if (tablePower.length > 0 && !images.powerDisturbance) {
        images.powerDisturbance = imageBase64;
      } else if (!images.phaseL) {
        images.phaseL = imageBase64;
      }
    }

    if (allVectors.length > 0) {
      vectorBase64 = allVectors[0];
      vectorType = vectorBase64.includes('x-wmf') ? 'wmf' : 'emf';
    }

    return jsonOk({
      success: true,
      imageBase64,
      vectorBase64,
      vectorType,
      allVectors,
      vectorCompositeComplete,
      allWebImages,
      images,
      tableData,
      tablePhaseL,
      tablePhaseN,
      tablePower,
      info,
    });
  } catch (error: any) {
    console.error('Error extracting radimation:', error);
    return jsonError(error?.message || 'Lỗi xử lý file Radimation', 500);
  }
}
