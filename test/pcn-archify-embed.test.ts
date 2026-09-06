import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PcnArchifyWorkflowEmbed.tsx', import.meta.url), 'utf8');

test('both domains embed the upstream Archify reader and keep the PCN action bridge compact', () => {
  assert.match(source, /\/api\/\$\{domain === 'pcn' \? 'pcn\/dossiers' : 'pgd\/requests'\}/);
  assert.match(source, /<iframe/);
  assert.match(source, /#focus=\$\{encodeURIComponent\(initialNodeId\)\}/);
  assert.match(source, /event\.origin !== window\.location\.origin/);
  assert.match(source, /source !== 'pcn-archify'/);
  assert.match(source, /pcn-archify-action-dock/);
  assert.match(source, /Bắt đầu node/);
  assert.match(source, /Hoàn tất node/);
  assert.match(source, /Trả về node/);
  assert.doesNotMatch(source, /ArrowDown/);
});

test('viewer exposes exactly five validated diagram views and ephemeral URL state', () => {
  assert.match(source, /ARCHIFY_DIAGRAM_TYPES/);
  assert.match(source, /archify-diagram-selector/);
  assert.match(source, /workflow.*lifecycle.*dataflow.*sequence.*architecture/s);
  assert.match(source, /URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /diagram=/);
  assert.match(source, /window\.location\.hash/);
});

test('viewer preflights the authenticated route before assigning iframe src', () => {
  assert.match(source, /fetch\(.*credentials:\s*'include'.*cache:\s*'no-store'/s);
  assert.match(source, /response\.status === 409 \|\| response\.status === 422/);
  assert.match(source, /Không khả dụng/);
  assert.match(source, /Thử lại/);
  assert.match(source, /response\.ok/);
  assert.match(source, /setIframeSrc/);
  assert.match(source, /AbortController/);
});

test('mutation dock is guarded by workflow, PCN, selected task, edit permission and callbacks', () => {
  assert.match(source, /diagramType === 'workflow'/);
  assert.match(source, /domain === 'pcn'/);
  assert.match(source, /selectedTask && canEdit/);
  assert.match(source, /onStartTask/);
  assert.match(source, /onCompleteTask/);
  assert.match(source, /onReturnTask/);
  assert.match(source, /onOpenDocuments/);
});

test('parent messages never invoke mutation callbacks and retain authorization guards', () => {
  assert.match(source, /event\.source === window/);
  assert.match(source, /nodes\.some\(\(node\) => node\.id === message\.nodeId\)/);
  assert.doesNotMatch(source.slice(source.indexOf('const onMessage'), source.indexOf('const runTaskAction')), /on(Start|Complete|Return)Task\(/);
});

test('edge focus messages require an explicit authorized edge allowlist', () => {
  assert.match(source, /edgeIds\.includes\(message\.edgeId\)/);
  assert.doesNotMatch(source, /edgeIds\.length === 0 \|\| edgeIds\.includes\(message\.edgeId\)/);
});

test('diagram query validation is applied after a hydration-safe workflow default', () => {
  assert.match(source, /useState<ArchifyDiagramType>\('workflow'\)/);
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*URLSearchParams\(window\.location\.search\)[\s\S]*setDiagramType/s);
  assert.doesNotMatch(source, /useState<ArchifyDiagramType>\(initialDiagramType\)/);
});
