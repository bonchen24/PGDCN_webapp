// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for request-card icon density and dashboard staffing customization

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
const requestCard = app.slice(
  app.indexOf('const RequestGroupCard'),
  app.indexOf('interface HandoverDocCardProps')
);
const dashboard = app.slice(
  app.indexOf('const DashboardView'),
  app.indexOf('const App =')
);

test('keeps request-card icons compact', () => {
  assert.match(requestCard, /<Award size=\{14\}/);
  assert.match(requestCard, /<FolderOpen size=\{14\}/);
  assert.match(requestCard, /<ChevronUp size=\{10\}/);
  assert.match(requestCard, /<ChevronDown size=\{10\}/);
});

test('keeps request-card action tiles visually compact while retaining the mobile hit target', () => {
  assert.equal((requestCard.match(/request-card-action-visual/g) ?? []).length, 4);
  assert.match(requestCard, /request-card-action mobile-touch-target p-0/);
  assert.match(requestCard, /request-card-action-visual inline-flex w-7 h-7/);
});

test('anchors request-card actions to the card upper-right', () => {
  assert.match(requestCard, /request-card-action-group absolute top-2\.5 right-2\.5 z-10[\s\S]*md:static/);
  assert.match(requestCard, /className="flex items-start gap-2 pr-48 md:pr-0"/);
});

test('renders every failed sample as a red history row without requiring the optional history toggle', () => {
  assert.match(store, /if \(keepHistory \|\| effectiveIsFail\)/);
  assert.match(requestCard, /const logsForReq = requests\.filter\(r => r\.id\.startsWith\(req\.id \+ '-log-'\)\)/);
  assert.match(requestCard, /bg-red-50\/20 hover:bg-red-50\/40/);
  assert.match(requestCard, /Thất bại lần \{idx \+ 1\}/);
});

test('opens dashboard staffing customization with a click', () => {
  assert.match(dashboard, /const \[isTesterCustomizationOpen, setIsTesterCustomizationOpen\]/);
  assert.match(dashboard, /onClick=\{\(\) => setIsTesterCustomizationOpen\(prev => !prev\)\}/);
  assert.match(dashboard, /aria-expanded=\{isTesterCustomizationOpen\}/);
  assert.match(dashboard, /id="dashboard-tester-customization"/);
  assert.match(dashboard, /isTesterCustomizationOpen \? 'flex' : 'hidden'/);
});

test('limits dashboard staffing to employees assigned to a configured test room', () => {
  assert.match(dashboard, /const \{ testers, settings, currentUser \} = useStore\(\);/);
  assert.match(dashboard, /const assignedTesterNames = new Set\(\[/);
  assert.match(dashboard, /\.\.\.\(settings\?\.defaultTestersAtd \|\| \[\]\)/);
  assert.match(dashboard, /\.\.\.\(settings\?\.defaultTestersChamber1 \|\| \[\]\)/);
  assert.match(dashboard, /\.\.\.\(settings\?\.defaultTestersChamber2 \|\| \[\]\)/);
  assert.match(dashboard, /const assignedTesters = testers\.filter\(t => t\.name !== 'Khác' && assignedTesterNames\.has\(t\.name\)\)/);
  assert.match(dashboard, /const boardTesters = assignedTesters\.filter/);
  assert.match(dashboard, /assignedTesters\.map\(t => \(/);
});

// --- End of request-dashboard-ui.test.ts ---
