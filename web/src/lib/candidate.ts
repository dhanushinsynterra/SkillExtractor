import { useSyncExternalStore } from 'react';
import type { CandidateInfo } from '../../../shared/types';

/** Candidate details and the interview session they own, kept across reloads. */
export interface CandidateState extends CandidateInfo {
  audioOnly: boolean;
  session: { id: string; token: string } | null;
}

const KEY = 'se-candidate';

function load(): CandidateState {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (v && typeof v === 'object') return v;
  } catch {
    /* storage unavailable */
  }
  return { name: '', email: '', track: 'frontend', audioOnly: false, session: null };
}

let state = load();
const listeners = new Set<() => void>();

export function setCandidate(patch: Partial<CandidateState>) {
  state = { ...state, ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useCandidate() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}
