import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const embedSource = fs.readFileSync(new URL('../components/PcnArchifyWorkflowEmbed.tsx', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const dossierSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

test('Archify dossier reader keeps a light surface and a real mobile height budget', () => {
  assert.match(embedSource, /[?&]theme=light/);
  assert.match(embedSource, /bg-slate-100/);
  assert.match(embedSource, /min-h-\[420px\]/);
  assert.match(embedSource, /sm:min-h-\[560px\]/);
  assert.doesNotMatch(embedSource, /bg-slate-950/);
});

test('embedded PCN dossier preserves the flex chain needed for vertical scrolling', () => {
  assert.match(workspaceSource, /embedded \? 'flex h-full min-h-0/);
  assert.match(workspaceSource, /embedded \? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'/);
  assert.match(dossierSource, /standalone \? 'flex h-full min-h-0/);
  assert.match(dossierSource, /pcn-dossier-focus-scroll/);
});
