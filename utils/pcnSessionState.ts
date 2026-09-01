'use client';

import { create } from 'zustand';

import type { PcnUserAccount } from '../types';

type PcnSessionState = {
  currentUser: PcnUserAccount | null;
  setCurrentUser: (user: PcnUserAccount | null) => void;
  clearCurrentUser: () => void;
};

/**
 * Session state for the active PCN Next.js surface.
 *
 * This store deliberately has no persistence middleware: the signed HttpOnly
 * cookie is the source of truth, while this value is only the current render
 * projection returned by the PCN session endpoint. Keeping it separate from
 * the legacy store prevents the PCN route from hydrating DDT IndexedDB data.
 */
export const usePcnSessionStore = create<PcnSessionState>((set) => ({
  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),
  clearCurrentUser: () => set({ currentUser: null }),
}));

// --- End of pcnSessionState.ts ---
