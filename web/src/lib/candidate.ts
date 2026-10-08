import { useSyncExternalStore } from 'react';
import type { CandidateInfo } from '../../../shared/types';

/** Candidate details and the interview session they own, kept across reloads. */
export interface CandidateState extends CandidateInfo {
  audioOnly: boolean;
  headphones: boolean;
  /** Longer pauses before the interviewer responds. */
  extraTime: boolean;
  /** Show the elapsed-time clock (hidden by default to reduce time pressure). */
  showTimer: boolean;
  /** Mic gate level learned from the candidate's voice during the device check. */
  voiceThreshold: number | null;
  session: { id: string; token: string } | null;
}

const KEY = 'se-candidate';

function load(): CandidateState {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (v && typeof v === 'object') return { headphones: false, extraTime: false, showTimer: false, voiceThreshold: null, ...v };
  } catch {
    /* storage unavailable */
  }
  return { name: '', email: '', track: 'frontend', audioOnly: false, headphones: false, extraTime: false, showTimer: false, voiceThreshold: null, session: null };
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
