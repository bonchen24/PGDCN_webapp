// Author: Gemini
// OS support: Web/Node
// Description: Resolves the effective Gemini model for the active user

import type { AppSettings, UserAccount, UserPreferences } from '../types';
import { findUserPreference } from './userIdentity';

export interface GeminiSettingsState {
  currentUser: Pick<UserAccount, 'username'> | null;
  userPreferences: Record<string, UserPreferences>;
  settings: Pick<AppSettings, 'geminiModel'>;
}

export function resolveGeminiModel(state: GeminiSettingsState): string | undefined {
  const preferences = state.currentUser
    ? findUserPreference(state.userPreferences, [state.currentUser.username])
    : undefined;

  if (preferences && Object.prototype.hasOwnProperty.call(preferences, 'geminiModel')) {
    return preferences.geminiModel?.trim() || undefined;
  }

  return state.settings.geminiModel?.trim() || undefined;
}

// --- End of geminiSettings.ts ---
