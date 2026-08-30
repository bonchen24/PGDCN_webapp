import assert from 'node:assert/strict';
import test from 'node:test';

import PizZip from 'pizzip';

import {
  extractPcnTemplatePlaceholderKeys,
  inspectPcnTemplateSource,
  validatePcnTemplateRelativePath,
} from '../utils/pcnTemplateDiscovery.ts';

function makeDocxWithSplitPlaceholder(): Buffer {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>[[ten_cong_</w:t></w:r><w:r><w:t>ty]]</w:t></w:r><w:r><w:t>[[ model ]]</w:t></w:r></w:p></w:body></w:document>');
  return zip.generate({ type: 'nodebuffer' });
}

test('DOCX placeholder discovery joins values split across Word XML runs', () => {
  assert.deepEqual(extractPcnTemplatePlaceholderKeys(makeDocxWithSplitPlaceholder()), ['model', 'ten_cong_ty']);
});

test('template discovery is a dry-run inspection with stable fingerprint and warnings', () => {
  const bytes = makeDocxWithSplitPlaceholder();
  const result = inspectPcnTemplateSource({
    fileName: 'GCN.docx',
    sourceRelativePath: 'QC4/Tool QC4/Nhap data/GCN.docx',
    bytes,
  });

  assert.equal(result.format, 'DOCX');
  assert.equal(result.byteSize, bytes.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.placeholderKeys, ['model', 'ten_cong_ty']);
  assert.equal(result.suggestedStatus, 'DISCOVERED');
  assert.deepEqual(result.warnings, []);
});

test('legacy DOC and placeholder-free DOCX are never suggested as approved', () => {
  const doc = inspectPcnTemplateSource({
    fileName: 'Quyet dinh.doc',
    sourceRelativePath: 'QC9/File ket qua mau/Quyet dinh.doc',
    bytes: Buffer.from('legacy binary content'),
  });
  assert.equal(doc.format, 'DOC');
  assert.equal(doc.suggestedStatus, 'NEEDS_ANNOTATION');
  assert.ok(doc.warnings.includes('LEGACY_FORMAT_REQUIRES_ANNOTATION'));

  const docx = inspectPcnTemplateSource({
    fileName: 'GCN-example.docx',
    sourceRelativePath: 'QC9/File ket qua mau/GCN-example.docx',
    bytes: (() => { const zip = new PizZip(); zip.file('word/document.xml', '<w:document/>'); return zip.generate({ type: 'nodebuffer' }); })(),
  });
  assert.equal(docx.suggestedStatus, 'NEEDS_ANNOTATION');
  assert.ok(docx.warnings.includes('NO_MACHINE_PLACEHOLDERS'));
});

test('template source path must be relative and cannot smuggle Desktop/dist runtime dependencies', () => {
  assert.equal(validatePcnTemplateRelativePath('QC4/Tool/GCN.docx'), 'QC4/Tool/GCN.docx');
  assert.throws(() => validatePcnTemplateRelativePath('C:/Users/HungX/Desktop/PCN/GCN.docx'), /tương đối|relative/i);
  assert.throws(() => validatePcnTemplateRelativePath('Desktop/PCN/GCN.docx'), /Desktop/i);
  assert.throws(() => validatePcnTemplateRelativePath('dist/GCN.docx'), /dist/i);
  assert.throws(() => validatePcnTemplateRelativePath('../GCN.docx'), /ngoài thư mục|relative/i);
});

// --- End of pcn-template-discovery.test.ts ---
