import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');

function actionSource(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing action ${start}`);
  assert.notEqual(endIndex, -1, `Missing action boundary ${end}`);
  return source.slice(startIndex, endIndex);
}

test('PGD detail leaves unverified evidence blank and validates it before persistence', () => {
  const defaults = source.slice(source.indexOf('function createPgdDetailFieldForm'), source.indexOf('function getPgdFieldInspectionValidationMessage'));
  for (const field of ['lotObservation', 'packaging', 'nonconformities', 'inspectionResult', 'note']) {
    assert.match(defaults, new RegExp(`${field}: ''`), `${field} must start empty`);
  }
  assert.match(defaults, /labeling: lotCode \? `Số lô: \$\{lotCode\}` : ''/);
  assert.match(source, /useState\(\(\) => createPgdDetailFieldForm\(request\.lotCode\)\)/);
  assert.match(source, /const \[sampleQuantity, setSampleQuantity\] = useState\(''\)/);
  assert.match(source, /const \[labConclusion, setLabConclusion\] = useState\(''\)/);
  assert.match(source, /const \[certificateConclusion, setCertificateConclusion\] = useState\(''\)/);
  assert.match(source, /setLabConclusion\(storedLabConclusion\)/);
  assert.match(source, /setCertificateConclusion\(certificate\?\.conclusion\?\.trim\(\) \|\| getPgdReportConclusion\(report\)\)/);
  assert.match(source, /function getPgdReportConclusion\(report\?: PgdInspectionReport\)[\s\S]*report\?\.values\.find/);
  assert.match(source, /report\.values\.reduce<Record<string, string>>\(\(inputs, value\) => \{[\s\S]*?inputs\[value\.key\]/);

  const fieldSave = actionSource('const saveFieldInspection =', 'const splitSample =');
  assert.ok(fieldSave.indexOf('getPgdFieldInspectionValidationMessage') < fieldSave.indexOf('pgd.saveFieldInspection'));
  const sampleSplit = actionSource('const splitSample =', 'const createLabRequest =');
  assert.ok(sampleSplit.indexOf('getPgdSampleSplitValidationMessage') < sampleSplit.indexOf('pgd.splitSample'));
  assert.match(source, /Number\.isInteger\(actualQuantity\)/);
  const labSave = actionSource('const saveLabResult =', 'const saveCertificate =');
  assert.ok(labSave.indexOf('getPgdLabResultValidationMessage') < labSave.indexOf('pgd.saveLabResult'));
  const reportSave = actionSource('const saveCertificate =', 'const advance =');
  assert.ok(reportSave.indexOf('getPgdCertificateValidationMessage') < reportSave.indexOf('pgd.saveReport'));
  for (const saveAction of [fieldSave, sampleSplit, labSave, reportSave]) {
    assert.match(saveAction, /if \(validationMessage\) \{\s*toast\.error\(validationMessage\)/);
  }
  assert.match(source, /reportIssues\.map\(\(issue\) => issue\.message\)\.join\(" "\)/);

  for (const message of [
    'Vui lòng nhập ghi nhận lô hàng thực tế.',
    'Vui lòng nhập số lượng mẫu thực tế là số nguyên từ 2 trở lên.',
    'Vui lòng nhập kết luận PTN thực tế.',
    'Vui lòng nhập kết luận báo cáo/chứng thư thực tế.',
  ]) {
    assert.ok(source.includes(message), `Missing localized data-integrity validation: ${message}`);
  }
});
