// Author: Gemini
// OS support: Web/Node
// Description: Responsive mobile layout contract tests for the DDT Lab app

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const stylesheet = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8')) as {
  orientation?: string;
};
const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const handoverDocsModal = fs.readFileSync(new URL('../components/HandoverDocsModal.tsx', import.meta.url), 'utf8');
const scheduleView = fs.readFileSync(new URL('../components/ScheduleView.tsx', import.meta.url), 'utf8');
const atdScheduleView = fs.readFileSync(new URL('../components/ATDScheduleView.tsx', import.meta.url), 'utf8');
const summaryLogView = fs.readFileSync(new URL('../components/SummaryLogView.tsx', import.meta.url), 'utf8');
const kqtnView = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');
const reportGeneratorView = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');
const systemManagementViews = fs.readFileSync(new URL('../components/SystemManagementViews.tsx', import.meta.url), 'utf8');
const requestModal = fs.readFileSync(new URL('../components/RequestModal.tsx', import.meta.url), 'utf8');
const handoverModal = fs.readFileSync(new URL('../components/HandoverModal.tsx', import.meta.url), 'utf8');
const printFormModal = fs.readFileSync(new URL('../components/PrintFormModal.tsx', import.meta.url), 'utf8');
const aiChatBot = fs.readFileSync(new URL('../components/AIChatBot.tsx', import.meta.url), 'utf8');

test('keeps the root constrained to the viewport', () => {
  assert.match(stylesheet, /#root\s*\{[\s\S]*zoom:\s*1/);
  assert.match(stylesheet, /#root\s*\{[\s\S]*width:\s*100%/);
  assert.match(stylesheet, /#root\s*\{[\s\S]*min-height:\s*100%/);
});

test('defines reusable mobile layout contracts', () => {
  assert.match(stylesheet, /\.mobile-safe-bottom/);
  assert.match(stylesheet, /\.mobile-scroll-x/);
  assert.match(stylesheet, /\.mobile-touch-target/);
});

test('keeps mobile webapp in portrait orientation', () => {
  assert.equal(manifest.orientation, 'portrait');
  assert.match(html, /id="portrait-only-message"/);
  assert.match(stylesheet, /@media\s+screen\s+and\s+\(orientation:\s*landscape\)\s+and\s+\(pointer:\s*coarse\)\s+and\s+\(max-height:\s*600px\)\s+and\s+\(max-width:\s*1024px\)/);
  assert.match(stylesheet, /#portrait-only-message/);
});

test('keeps the mobile navigation safe-area aware', () => {
  assert.match(app, /Menu di động/);
  assert.match(app, /safe-area-inset-bottom/);
});

test('bounds handover history data inside the modal viewport', () => {
  assert.match(handoverDocsModal, /mobile-scroll-x/);
  assert.match(handoverDocsModal, /max-h-\[calc\(100dvh/);
});

test('keeps ITD and EMC schedules inside bounded mobile regions', () => {
  assert.match(scheduleView, /mobile-scroll-x/);
  assert.match(atdScheduleView, /mobile-scroll-x/);
  assert.match(scheduleView, /selectedMobileDate/);
  assert.match(atdScheduleView, /selectedMobileDate/);
});

test('keeps dense data and report controls inside mobile boundaries', () => {
  assert.match(summaryLogView, /mobile-scroll-x/);
  assert.match(kqtnView, /mobile-scroll-x/);
  assert.match(reportGeneratorView, /mobile-touch-target/);
  assert.match(reportGeneratorView, /mobile-safe-bottom/);
  assert.match(systemManagementViews, /mobile-safe-bottom/);
});

test('keeps large dialogs and floating tools inside the mobile viewport', () => {
  assert.match(requestModal, /max-h-\[calc\(100dvh/);
  assert.match(handoverModal, /max-h-\[calc\(100dvh/);
  assert.match(printFormModal, /mobile-scroll-x/);
  assert.match(aiChatBot, /max-h-\[calc\(100dvh/);
});

// --- End of mobile-ui-contract.test.ts ---
