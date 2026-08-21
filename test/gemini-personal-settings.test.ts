// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for personal Gemini model selection and caller resolution

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { resolveGeminiModel } from '../utils/geminiSettings.ts';

const systemSettingsSource = fs.readFileSync(new URL('../components/SystemManagementViews.tsx', import.meta.url), 'utf8');
const personalSettingsSource = fs.readFileSync(new URL('../components/UserSettingsModal.tsx', import.meta.url), 'utf8');
const geminiSource = fs.readFileSync(new URL('../utils/gemini.ts', import.meta.url), 'utf8');
const directCallerSources = [
  fs.readFileSync(new URL('../components/AIChatBot.tsx', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../components/EmcBepDien1VungNauForm.tsx', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8')
];

test('prefers the personal Gemini model over the legacy system model', () => {
  assert.equal(resolveGeminiModel({
    currentUser: { username: 'tester' },
    userPreferences: { tester: { geminiModel: 'gemini-2.5-pro' } },
    settings: { geminiModel: 'gemini-1.5-flash' }
  }), 'gemini-2.5-pro');
});

test('uses the legacy system model until a user configures a personal model', () => {
  assert.equal(resolveGeminiModel({
    currentUser: { username: 'tester' },
    userPreferences: {},
    settings: { geminiModel: 'gemini-1.5-flash' }
  }), 'gemini-1.5-flash');
});

test('preserves automatic mode when a user explicitly saves an empty model', () => {
  assert.equal(resolveGeminiModel({
    currentUser: { username: 'tester' },
    userPreferences: { tester: { geminiModel: '' } },
    settings: { geminiModel: 'gemini-1.5-flash' }
  }), undefined);
});

test('keeps Gemini discovery and selection in personal settings only', () => {
  assert.match(personalSettingsSource, /fetchGoogleGeminiModels/);
  assert.match(personalSettingsSource, /geminiModel/);
  assert.match(personalSettingsSource, /onClick=\{\(\) => fetchGoogleGeminiModels\(true\)\}/);
  assert.doesNotMatch(systemSettingsSource, /fetchGoogleGeminiModels/);
  assert.doesNotMatch(systemSettingsSource, /Mô hình Trí tuệ Nhân tạo \(Gemini\)/);
  assert.doesNotMatch(systemSettingsSource, /Lưu thiết lập mô hình AI/);
});

test('all Gemini callers resolve the selected model through the shared helper', () => {
  assert.match(geminiSource, /resolveGeminiModel\(state\)/);
  for (const source of directCallerSources) {
    assert.match(source, /resolveGeminiModel\(state\)/);
  }
});

// --- End of gemini-personal-settings.test.ts ---
