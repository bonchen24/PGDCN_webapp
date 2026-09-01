import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import manifest from '../templates/pcn/manifest.json';
import { PCN_OPERATIONAL_TEMPLATE_CATALOG } from '../utils/pcnOperationalTemplateCatalog.ts';
import { PCN_TEMPLATE_CATALOG, mergePcnTemplateCatalog } from '../utils/pcnTemplateCatalog.ts';
import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';

const root = path.resolve(process.cwd());
const templateRoot = path.join(root, 'templates', 'pcn');

function documentXml(fileName: string): string {
  const zip = new AdmZip(path.join(templateRoot, fileName));
  return zip.readAsText('word/document.xml');
}

test('PCN operational template catalog is detached from research-folder paths', () => {
  for (const template of manifest.templates as Array<Record<string, unknown>>) {
    assert.equal('sourceReferences' in template, false, `${String(template.id)} must not expose research paths`);
  }

  for (const template of PCN_OPERATIONAL_TEMPLATE_CATALOG) {
    assert.equal('sourceReferences' in template, false, `${template.id} must not expose research paths`);
  }

  for (const template of mergePcnTemplateCatalog([])) {
    assert.equal('sourceLabel' in template, false, `${template.id} must not expose authoring labels at runtime`);
    assert.equal('sourceRelativePath' in template.sourceFingerprint, false, `${template.id} must not expose authoring paths at runtime`);
  }
  assert.ok(PCN_TEMPLATE_CATALOG.some((template) => template.sourceFingerprint.sourceRelativePath), 'authoring catalog keeps provenance outside runtime projection');

  const settingsView = fs.readFileSync(path.join(root, 'components', 'PcnSettingsView.tsx'), 'utf8');
  assert.doesNotMatch(settingsView, /sourceReferences|Xem nguồn đối chiếu|sourceLabel|Xem nguồn tham chiếu|Template nguồn/);
  const templateModal = fs.readFileSync(path.join(root, 'components', 'PcnTemplateSettingsModal.tsx'), 'utf8');
  assert.doesNotMatch(templateModal, /sourceRelativePath|Nguồn tham chiếu|Desktop/);
});

test('PCN operational DOCX pack contains real form content, not a generic placeholder appendix', () => {
  for (const template of manifest.templates as Array<{ id: string; fileName: string; requiredPlaceholderKeys: string[] }>) {
    const filePath = path.join(templateRoot, template.fileName);
    assert.ok(fs.statSync(filePath).size > 0, `${template.id} must have a checked-in DOCX asset`);
    const xml = documentXml(template.fileName);
    assert.doesNotMatch(xml, /Trường dữ liệu|Placeholder bắt buộc/gi, `${template.id} must not append the generic field-union table`);
    assert.match(xml, /\[\[/, `${template.id} must contain canonical placeholders in the form`);
    const keys = extractPcnTemplatePlaceholderKeys(fs.readFileSync(filePath));
    for (const key of template.requiredPlaceholderKeys) assert.ok(keys.includes(key), `${template.id} must expose ${key} to the renderer`);
  }
});

test('PCN operational DOCX pack renders through the production delimiter contract', () => {
  for (const template of manifest.templates as Array<{ id: string; fileName: string }>) {
    const keys = extractPcnTemplatePlaceholderKeys(fs.readFileSync(path.join(templateRoot, template.fileName)));
    const document = new Docxtemplater(new PizZip(fs.readFileSync(path.join(templateRoot, template.fileName))), {
      delimiters: { start: '[[', end: ']]' },
      paragraphLoop: true,
      linebreaks: true,
    });
    document.render(Object.fromEntries(keys.map((key) => [key, 'GIÁ TRỊ MẪU'])));
    assert.ok(document.getZip().generate({ type: 'nodebuffer' }).length > 0, `${template.id} must generate a DOCX buffer`);
  }
});
