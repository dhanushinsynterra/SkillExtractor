import { useSyncExternalStore } from 'react';

/** Candidate details captured during onboarding, kept for the session. */
export interface CandidateDraft {
  name: string;
  email: string;
  track: TrackId;
  audioOnly: boolean;
}

export type TrackId = 'frontend' | 'backend' | 'data' | 'mobile' | 'qa';

export const TRACKS: { id: TrackId; label: string; blurb: string }[] = [
  { id: 'frontend', label: 'Frontend', blurb: 'HTML, CSS, JavaScript, React' },
  { id: 'backend', label: 'Backend', blurb: 'APIs, databases, Java / Node / Python' },
  { id: 'data', label: 'Data & AI', blurb: 'Python, SQL, analytics, ML' },
  { id: 'mobile', label: 'Mobile', blurb: 'Android, iOS, Flutter, React Native' },
  { id: 'qa', label: 'Quality engineering', blurb: 'Test design, automation, APIs' },
];

let draft: CandidateDraft = { name: '', email: '', track: 'frontend', audioOnly: false };
const listeners = new Set<() => void>();

export function setCandidate(patch: Partial<CandidateDraft>) {
  draft = { ...draft, ...patch };
  listeners.forEach((l) => l());
}

export function useCandidate() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => draft,
  );
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}
