import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('workflow panel shares snapshot required document IDs across condition and runtime projections', () => {
  const panel = fs.readFileSync(new URL('../components/PcnDossierWorkflowPanel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const requiredIdsMemo = panel.match(/const requiredRequirementIds = useMemo\(\(\) => \{([\s\S]*?)\}, \[requirements, workflow\]\);/);

  assert.ok(requiredIdsMemo, 'required requirement IDs should be derived when requirements or the dossier workflow snapshot changes');
  assert.match(requiredIdsMemo[1], /workflow\.nodes\s*\.filter\(\(node\) => node\.active !== false\)/);
  assert.match(requiredIdsMemo[1], /new Set\(/);
  assert.match(requiredIdsMemo[1], /requirements\.find\(\(requirement\) => requirement\.id === requirementId\)\?\.required !== false/);

  assert.match(panel, /buildPcnWorkflowConditionContext\(\{[^}]*workflow, requiredRequirementIds,/);
  assert.match(panel, /\[approvalSteps,[^\]]*requiredRequirementIds[^\]]*\]/);
  assert.match(panel, /projectPcnWorkflowRuntime\(\{[^}]*requiredRequirementIds,[^}]*conditionContext/);
  assert.match(panel, /\[conditionContext,[^\]]*requiredRequirementIds[^\]]*\]/);
});
