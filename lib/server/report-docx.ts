import { Resvg } from '@resvg/resvg-js';

const dynamicImport = new Function('modulePath', 'return import(modulePath)');
let _emfOrWmfToSvg: any = null;

export async function getEmfOrWmfToSvg() {
  if (!_emfOrWmfToSvg) {
    const mod = await dynamicImport('emf-to-png');
    _emfOrWmfToSvg = mod.emfOrWmfToSvg;
  }
  return _emfOrWmfToSvg;
}

export async function ensurePngBuffer(rawBuf: Buffer): Promise<Buffer> {
  if (!rawBuf || rawBuf.length < 4) return rawBuf;
  const isEmf =
    rawBuf.length > 44 &&
    rawBuf[0] === 1 &&
    rawBuf[1] === 0 &&
    rawBuf[2] === 0 &&
    rawBuf[3] === 0 &&
    rawBuf[40] === 0x20 &&
    rawBuf[41] === 0x45 &&
    rawBuf[42] === 0x4d &&
    rawBuf[43] === 0x46;
  const isWmf =
    (rawBuf.length > 4 && rawBuf[0] === 0xd7 && rawBuf[1] === 0xcd && rawBuf[2] === 0xc6 && rawBuf[3] === 0x9a) ||
    (rawBuf.length > 4 && (rawBuf[0] === 0x01 || rawBuf[0] === 0x02) && rawBuf[1] === 0x00 && rawBuf[2] === 0x09 && bufEqualsWmf(rawBuf));

  if (isEmf || isWmf) {
    try {
      const convert = await getEmfOrWmfToSvg();
      const kind = isWmf ? 'wmf' : 'emf';
      const svg = await convert(kind, new Uint8Array(rawBuf), 96);
      if (svg && typeof svg === 'string') {
        const resvg = new Resvg(svg, {
          fitTo: { mode: 'width', value: 1600 },
          background: '#ffffff',
        });
        const pngData = resvg.render().asPng();
        if (pngData && pngData.length > 100) return Buffer.from(pngData);
      }
    } catch (conversionErr) {
      console.warn('Vector to PNG conversion failed, keeping original:', conversionErr);
    }
  }
  return rawBuf;
}

function bufEqualsWmf(rawBuf: Buffer): boolean {
  return rawBuf[3] === 0x00;
}

export async function preprocessImages(images: Record<string, string>): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, base64Url] of Object.entries(images)) {
    if (!base64Url || typeof base64Url !== 'string') continue;
    try {
      const commaIdx = base64Url.indexOf(',');
      const rawB64 = commaIdx >= 0 ? base64Url.slice(commaIdx + 1) : base64Url;
      const rawBuf = Buffer.from(rawB64, 'base64');
      const pngBuf = await ensurePngBuffer(rawBuf);
      result[key] = `data:image/png;base64,${pngBuf.toString('base64')}`;
    } catch (e) {
      console.warn(`preprocessImages failed for ${key}, keeping as-is:`, e);
      result[key] = base64Url;
    }
  }
  return result;
}
