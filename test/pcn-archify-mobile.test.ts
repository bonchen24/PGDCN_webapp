import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const embedSource = fs.readFileSync(new URL('../components/PcnArchifyWorkflowEmbed.tsx', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const dossierSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const pgdWorkspaceSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const appShellSource = fs.readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');
const pgdMapSource = fs.readFileSync(new URL('../components/PgdWorkflowMap.tsx', import.meta.url), 'utf8');

test('Archify dossier reader keeps a light surface and a real mobile height budget', () => {
  assert.match(embedSource, /[?&]theme=light/);
  assert.match(embedSource, /bg-slate-100/);
  assert.match(embedSource, /min-h-\[420px\]/);
  assert.match(embedSource, /sm:min-h-\[560px\]/);
  assert.doesNotMatch(embedSource, /bg-slate-950/);
  assert.match(embedSource, /overflow-y-auto/);
  assert.match(embedSource, /mobile-scroll-y/);
});

test('embedded PCN dossier preserves the flex chain needed for vertical scrolling', () => {
  assert.match(workspaceSource, /embedded \? 'flex h-full min-h-0/);
  assert.match(workspaceSource, /embedded \? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'/);
  assert.match(dossierSource, /standalone \? 'flex h-full min-h-0/);
  assert.match(dossierSource, /pcn-dossier-focus-scroll/);
});

test('PGD does not fall back to a dark full-screen surface around the reader', () => {
  assert.match(pgdWorkspaceSource, /if \(!sessionChecked\) return <div className="flex min-h-\[100dvh\] items-center justify-center bg-slate-50/);
  assert.match(pgdWorkspaceSource, /if \(!hasAccess\) return <div className="flex min-h-\[100dvh\] items-center justify-center bg-slate-50/);
  assert.match(appShellSource, /if \(!sessionChecked\) return <div className="flex min-h-\[100dvh\] items-center justify-center bg-slate-50/);
  assert.match(pgdMapSource, /domain="pgd"/);
  assert.doesNotMatch(pgdMapSource, /on(Start|Complete|Return)Task/);
});

test('read-only diagram views cannot render the mutation dock', () => {
  assert.match(embedSource, /diagramType === 'workflow' && domain === 'pcn'/);
});
