/**
 * Types shared by the server and the web client: the domain model and the
 * WebSocket protocol between the browser and the interview orchestrator.
 */

export const AI_NAME = 'Aria';

export type TrackId = 'frontend' | 'backend' | 'data' | 'mobile' | 'qa';

export const TRACKS: { id: TrackId; label: string; blurb: string }[] = [
  { id: 'frontend', label: 'Frontend', blurb: 'HTML, CSS, JavaScript, React' },
  { id: 'backend', label: 'Backend', blurb: 'APIs, databases, Java / Node / Python' },
  { id: 'data', label: 'Data & AI', blurb: 'Python, SQL, analytics, ML' },
  { id: 'mobile', label: 'Mobile', blurb: 'Android, iOS, Flutter, React Native' },
  { id: 'qa', label: 'Quality engineering', blurb: 'Test design, automation, APIs' },
];

export const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.id, t.label])) as Record<TrackId, string>;

export type Phase = 'hello' | 'ice_breaker' | 'domain' | 'adjacent' | 'problem' | 'code_card' | 'wrap_up';

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'hello', label: 'Introduction' },
  { id: 'ice_breaker', label: 'Warm-up' },
  { id: 'domain', label: 'Core skills' },
  { id: 'adjacent', label: 'Related skills' },
  { id: 'problem', label: 'Problem solving' },
  { id: 'code_card', label: 'Code review' },
  { id: 'wrap_up', label: 'Wrap-up' },
];

export type Verdict = 'strong' | 'promising' | 'review' | 'hold';

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'Strong yes',
  promising: 'Promising',
  review: 'Needs review',
  hold: 'Not yet',
};

/** 0 = not shown … 4 = expert. */
export type Depth = 0 | 1 | 2 | 3 | 4;

export const DEPTH_LABEL: Record<Depth, string> = {
  0: 'Not shown',
  1: 'Aware',
  2: 'Working',
  3: 'Proficient',
  4: 'Expert',
};

/** Comfort settings the candidate chooses before the interview. */
export interface CandidatePrefs {
  /** Longer pauses are allowed before the interviewer responds. */
  extraTime: boolean;
}

export interface CandidateInfo {
  name: string;
  email: string;
  track: TrackId;
  prefs?: CandidatePrefs;
}

export interface TranscriptTurn {
  who: 'ai' | 'candidate';
  text: string;
  /** Milliseconds since the interview started. */
  at: number;
}

export interface SkillEvidence {
  skill: string;
  kind: 'core' | 'related' | 'tool';
  depth: Depth;
  evidence: string;
  at: number;
  /** Skill-map topic id this evidence belongs to. */
  topic?: string;
}

/**
 * One area of the candidate's skill map. Core areas come from the role
 * itself, adjacent areas are related skills (e.g. Docker for a frontend
 * engineer), and extra areas are anything else the candidate knows.
 */
export interface TopicCoverage {
  id: string;
  label: string;
  kind: 'core' | 'adjacent' | 'extra';
  /** The candidate said they use it. */
  claimed: boolean;
  /** Questions answered on this topic. */
  asked: number;
  /** Depth of each answer, in order. */
  history: Depth[];
  /** The sub-topic each answer was about (parallel to history). */
  asks: string[];
  /** Highest depth demonstrated, or null if never assessed. */
  depth: Depth | null;
  status: 'pending' | 'active' | 'done';
  /** Depth level the next question should probe. */
  level: Depth;
  /** Aspects of the topic to explore, in order. */
  subtopics: string[];
  /** Index of the sub-topic currently being explored. */
  sub: number;
  /** Reopened in the second, depth-focused pass. */
  revisit?: boolean;
}

/** Label for each tier of the skill map, in report order. */
export const TIER_LABEL: Record<TopicCoverage['kind'], string> = {
  core: 'Role skills',
  adjacent: 'Related skills',
  extra: 'Extra skills',
};

export type IntegrityKind = 'absent' | 'returned' | 'multiple_faces' | 'camera_off' | 'reconnect' | 'tab_hidden';

export interface IntegrityEvent {
  kind: IntegrityKind;
  note: string;
  severity: 'info' | 'warn';
  at: number;
}

export interface CodeCardView {
  title: string;
  language: string;
  lines: string[];
  changedLine: number | null;
  solved: boolean;
  attempts: number;
}

export interface Report {
  verdict: Verdict;
  score: number;
  summary: string;
  nextStep: string;
  communication: number;
  composure: number;
  collaboration: number;
  strengths: string[];
  practise: { title: string; why: string }[];
  skills: { name: string; kind: 'core' | 'related' | 'tool'; depth: Depth; evidence: string }[];
}

export type SessionStatus = 'created' | 'active' | 'completed' | 'abandoned' | 'terminated';

export interface SessionRecord {
  id: string;
  candidate: CandidateInfo;
  status: SessionStatus;
  phase: Phase;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  transcript: TranscriptTurn[];
  evidence: SkillEvidence[];
  coverage?: TopicCoverage[];
  integrity: IntegrityEvent[];
  code?: CodeCardView & { startedAt?: number; solvedAt?: number };
  report?: Report;
  reportStatus: 'none' | 'pending' | 'ready' | 'failed';
  reportError?: string;
}

export interface SessionSummary {
  id: string;
  candidate: CandidateInfo;
  status: SessionStatus;
  createdAt: string;
  endedAt?: string;
  durationMin?: number;
  verdict?: Verdict;
  score?: number;
  flags: number;
  reportStatus: SessionRecord['reportStatus'];
}

export interface PublicStatus {
  ready: boolean;
}

export interface AdminSettingsView {
  hasKey: boolean;
  keyHint: string | null;
  keySource: 'env' | 'settings' | null;
  liveModel: string;
  reportModel: string;
  voice: string;
  voices: string[];
  authRequired: boolean;
}

export interface ModelOption {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// WebSocket protocol. Audio travels as binary frames in both directions:
// client → server: PCM16 mono 16 kHz; server → client: PCM16 mono 24 kHz.
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: 'start' }
  | { type: 'text'; text: string }
  | { type: 'mic'; on: boolean }
  | { type: 'integrity'; kind: IntegrityKind; note: string }
  | { type: 'request'; kind: CandidateRequest }
  | { type: 'end' };

/** On-screen help buttons the candidate can press at any time. */
export type CandidateRequest = 'repeat' | 'rephrase' | 'pause';

export type ServerMessage =
  | { type: 'ready'; resumed: boolean; phase: Phase; transcript: TranscriptTurn[]; code: CodeCardView | null }
  | { type: 'transcript'; who: 'ai' | 'candidate'; delta: string }
  | { type: 'turn_complete' }
  | { type: 'interrupted' }
  /** Remove the interviewer's current (unfinished) turn from the screen. */
  | { type: 'retract' }
  | { type: 'phase'; phase: Phase }
  | { type: 'code'; code: CodeCardView }
  | { type: 'ended'; reason: 'completed' | 'terminated' | 'ended_by_candidate' }
  | { type: 'error'; message: string };
