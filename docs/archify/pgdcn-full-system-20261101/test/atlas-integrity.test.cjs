const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const atlasDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(atlasDir, '../../..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(atlasDir, file), 'utf8'));
const playbook = readJson('node-playbook.json');
const matrix = readJson('document-matrix.json');
const workflowMaps = playbook.maps.filter((map) => map.primary || map.group !== 'technical');
const system = readJson('00-system-operation.workflow.json');
const statuses = new Set(['IMPLEMENTED', 'CONFIGURED', 'DESIGN_ONLY', 'EXTERNAL', 'NOT_VERIFIED']);

test('exactly three first-class maps precede the 13 configured dossier variants', () => {
  assert.deepEqual(playbook.maps.filter((map) => map.primary).map((map) => map.id), [
    'system-operation', 'pcn-canonical', 'pgd-canonical',
  ]);
  const variants = playbook.maps.filter((map) => !map.primary && map.group !== 'technical');
  assert.equal(variants.length, 13);
  assert.equal(variants.filter((map) => map.domain === 'PCN').length, 2);
  assert.equal(variants.filter((map) => map.domain === 'PGD').length, 11);
  assert.equal(system.cards.flatMap((card) => card.items || []).length, 13);
  for (const map of playbook.maps) assert.ok(fs.existsSync(path.join(atlasDir, map.file)), map.file);
});

test('every primary and variant diagram node has one complete, sourced handbook record', () => {
  const keys = new Set();
  for (const map of workflowMaps) {
    const workflow = readJson(map.candidate);
    const entries = playbook.entries.filter((entry) => entry.mapId === map.id);
    const nodeIds = workflow.nodes.map((node) => node.id);
    assert.equal(new Set(nodeIds).size, nodeIds.length, `${map.id}: duplicate diagram node`);
    assert.equal(entries.length, nodeIds.length, `${map.id}: node handbook cardinality`);
    assert.deepEqual(new Set(entries.map((entry) => entry.diagramNodeId)), new Set(nodeIds), `${map.id}: node cross-reference`);
    for (const entry of entries) {
      assert.ok(entry.id && entry.id === `${map.id}--${entry.diagramNodeId}`, `${entry.id}: stable id`);
      assert.ok(!keys.has(entry.id), `${entry.id}: duplicate handbook id`);
      keys.add(entry.id);
      for (const field of ['stage', 'domain', 'name', 'actor', 'verifier', 'nextHandoff', 'rbac', 'readOnly', 'guard', 'branch', 'afterState']) {
        const value = entry[field];
        assert.ok((typeof value === 'string' && value.trim()) || (Array.isArray(value) && value.length), `${entry.id}: ${field}`);
      }
      for (const field of ['actions', 'preconditions', 'filesIn', 'filesOut', 'failures', 'links', 'evidence']) {
        assert.ok(Array.isArray(entry[field]) && entry[field].length, `${entry.id}: ${field}`);
      }
      assert.ok(statuses.has(entry.implementationStatus), `${entry.id}: implementation status`);
      for (const file of entry.filesIn) {
        for (const field of ['id', 'label', 'requirement', 'activation', 'supplier', 'acceptableStatus']) {
          assert.ok(typeof file[field] === 'string' && file[field].trim(), `${entry.id}: input file ${field}`);
        }
        if (file.id === 'N/A') assert.equal(file.requirement, 'N/A', `${entry.id}: N/A file must stay N/A`);
      }
      for (const file of entry.filesOut) {
        for (const field of ['id', 'label', 'action']) assert.ok(typeof file[field] === 'string' && file[field].trim(), `${entry.id}: output file ${field}`);
      }
      for (const evidence of entry.evidence) {
        assert.ok(evidence.path && Number.isInteger(evidence.line) && Number.isInteger(evidence.end_line), `${entry.id}: evidence pointer`);
        const source = path.join(repoRoot, evidence.path);
        assert.ok(fs.existsSync(source), `${entry.id}: missing source ${evidence.path}`);
        const lineCount = fs.readFileSync(source, 'utf8').split(/\r?\n/).length;
        assert.ok(evidence.line > 0 && evidence.end_line >= evidence.line && evidence.end_line <= lineCount,
          `${entry.id}: invalid source lines ${evidence.path}:${evidence.line}-${evidence.end_line}`);
      }
    }
  }
  assert.equal(keys.size, 197);
});

test('PGD canonical rail and each profile variant preserve all 12 operational steps and mapped files', () => {
  const expected = [
    'Tiếp nhận PYC', 'Kiểm tra phạm vi & năng lực', 'Phân công giám định', 'Lập kế hoạch',
    'Kiểm tra hiện trường', 'Lấy mẫu & niêm phong', 'Giao mẫu / lập PYC PTN', 'Tiếp nhận KQTN',
    'Xem xét KQTN', 'Lập báo cáo', 'Phê duyệt & ký', 'Trả kết quả & lưu trữ',
  ];
  const profileMaps = workflowMaps.filter((map) => map.domain === 'PGD');
  assert.equal(profileMaps.length, 12);
  for (const map of profileMaps) {
    const entries = playbook.entries.filter((entry) => entry.mapId === map.id);
    assert.equal(entries.length, 12, `${map.id}: 12 steps`);
    for (let index = 0; index < 12; index++) {
      const step = String(index + 1).padStart(2, '0');
      const entry = entries.find((item) => item.diagramNodeId === `s${step}`);
      assert.ok(entry, `${map.id}: missing ${step}`);
      assert.ok(entry.name.includes(expected[index]), `${map.id}: step ${step} label`);
      if (!map.primary) {
        const row = matrix.pgdSteps.find((item) => item.mapId === map.id && item.stepNumber === index + 1);
        assert.ok(row, `${map.id}: missing file matrix row ${step}`);
        const documented = new Set(entry.filesIn.map((file) => file.id));
        for (const id of row.ids) assert.ok(documented.has(id), `${map.id} ${step}: file ${id} absent from node handbook`);
      }
    }
  }
  assert.equal(matrix.pgdSteps.length, 132);
});

test('PCN pack tables match node requirements and do not invent fixed files for the dynamic node', () => {
  assert.equal(matrix.pcnSteps.length, 18);
  for (const map of workflowMaps.filter((item) => item.domain === 'PCN' && !item.primary)) {
    const entries = playbook.entries.filter((entry) => entry.mapId === map.id);
    assert.equal(entries.length, 9, `${map.id}: nine dossier-pack stages`);
    for (const row of matrix.pcnSteps.filter((item) => item.mapId === map.id)) {
      const entry = entries.find((item) => item.diagramNodeId.endsWith(`_${['intake','select','dossier','snapshot','assign','native','docs','review','release'][row.stepNumber - 1]}`));
      assert.ok(entry, `${map.id}: step ${row.stepNumber}`);
      for (const id of row.ids) assert.ok(entry.filesIn.some((file) => file.id === id), `${map.id} step ${row.stepNumber}: ${id}`);
      if (row.stepNumber === 6) {
        assert.match(entry.filesIn[0].id, /workflowSnapshot\.node\.requirements/);
        assert.equal(row.ids.length, 0, `${map.id}: dynamic node files must not be invented`);
      }
    }
  }
});

test('required file IDs in the handbook are represented by a PCN or PGD file-matrix entry', () => {
  const documented = new Set([...matrix.pcnSteps, ...matrix.pgdSteps].flatMap((row) => row.ids));
  const missing = [];
  for (const entry of playbook.entries) {
    for (const file of entry.filesIn) {
      if (!/required/i.test(file.requirement) || file.id === 'N/A') continue;
      const ids = file.id.match(/[A-Z][A-Z0-9_-]{2,}/g) || [];
      for (const id of ids.filter((value) => value !== 'PCN' && value !== 'PGD')) {
        if (!documented.has(id) && !documented.has(`QC4-${id}`) && !documented.has(`QC9-${id}`)) {
          missing.push(`${entry.id}: ${id}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
  for (const row of [...matrix.pcnSteps, ...matrix.pgdSteps]) {
    for (const field of ['case', 'step', 'requirement', 'owner', 'state', 'workflow']) {
      assert.ok(typeof row[field] === 'string' && row[field].trim(), `${row.mapId} step ${row.stepNumber}: ${field}`);
    }
  }
});

test('each workflow has a passing Archify receipt for its current specification digest', () => {
  for (const map of workflowMaps) {
    const receiptPath = map.id === 'system-operation'
      ? path.join(atlasDir, 'review/finalize-system-v2/00-system-operation.finalize.json')
      : map.primary
        ? path.join(atlasDir, map.file.replace('.html', '.finalize.json'))
        : path.join(atlasDir, `review/finalize-final-${map.id}`, `${path.basename(map.file, '.html')}.finalize.json`);
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    const candidate = fs.readFileSync(path.join(atlasDir, map.candidate));
    const digest = crypto.createHash('sha256').update(candidate).digest('hex');
    assert.equal(receipt.status, 'pass', `${map.id}: finalization`);
    assert.equal(receipt.specification.sha256, digest, `${map.id}: candidate digest`);
    for (const stage of ['validate', 'deliver', 'check', 'browser-check']) {
      assert.equal(receipt.stages[stage].status, 'pass', `${map.id}: ${stage}`);
    }
  }
});

test('local landing, viewer, handbook and document-matrix links resolve without remote UI dependencies', () => {
  const index = fs.readFileSync(path.join(atlasDir, 'index.html'), 'utf8');
  const viewer = fs.readFileSync(path.join(atlasDir, 'diagram-viewer.html'), 'utf8');
  const handbook = fs.readFileSync(path.join(atlasDir, 'node-handbook.html'), 'utf8');
  const pcnTable = fs.readFileSync(path.join(atlasDir, 'document-matrix-pcn.html'), 'utf8');
  const pgdTable = fs.readFileSync(path.join(atlasDir, 'document-matrix-pgd.html'), 'utf8');
  const viewerLinks = [...index.matchAll(/diagram-viewer\.html\?map=([^"&]+\.html)/g)].map((match) => match[1]);
  assert.deepEqual(viewerLinks.slice(0, 3), ['00-system-operation.html', '03-pcn-canonical.html', '04-pgd-canonical.html']);
  assert.equal(viewerLinks.length, 36, '3 primary + 13 variants + 20 reference diagrams');
  for (const target of viewerLinks) assert.ok(fs.existsSync(path.join(atlasDir, decodeURIComponent(target))), `broken landing link ${target}`);
  assert.match(index, /id="variants"/);
  assert.match(index, /id="technical"/);
  assert.match(index, /Tìm tên\/mã, workflow ID, node, role, tệp/);
  assert.match(handbook, /#node=/);
  assert.match(handbook, /id="frame"/);
  assert.match(viewer, /URLSearchParams/);
  assert.match(pcnTable, /PCN/);
  assert.match(pgdTable, /PGD/);
  for (const html of [index, viewer, handbook, pcnTable, pgdTable]) {
    assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:\/\//i, 'custom atlas UI must work offline');
  }
  for (const file of ['diagram-viewer.html', 'node-handbook.html', 'document-matrix-pcn.html', 'document-matrix-pgd.html', 'source-evidence-final.md', 'coverage-matrix.md']) {
    assert.ok(fs.existsSync(path.join(atlasDir, file)), `missing local page ${file}`);
  }
});
